# Arquitetura V2 — persistência Supabase preparada

**CONFIGURAÇÃO MANUAL NECESSÁRIA.** O projeto Supabase ainda não existe. A implementação abaixo é a arquitetura de destino, com testes locais concluídos e homologação hospedada pendente. O provedor padrão permanece JSONBin até os testes de ativação. A arquitetura anterior foi preservada em [ARQUITETURA-V2-JSONBIN.md](ARQUITETURA-V2-JSONBIN.md).

## Estrutura do produto

As nove páginas continuam em HTML/CSS/JS puro, sem npm/build, login, senha, usuários ou perfis. Dashboard, listagem, editor, controle ao vivo, Cerimonial, Sonoplastia, palco, catálogo e configurações reutilizam os módulos compartilhados. Não há mesa de som nem letras. A identidade visual foi preservada; somente informações de conexão e filtros de status foram acrescentados aos fluxos existentes.

## Fluxo de dados

```text
HTMLs
  → app.js → editor.js / dashboard.js / operational.js
                   ↓
                storage.js
                 ├─ leitura → supabase.js → read_culto_collection()
                 └─ escrita → Cloudflare /api/culto
                                 → server/supabase.js
                                 → regras em culto.js
                                 → commit_culto_change() [transação PostgreSQL]

live-sync.js → eventos Realtime → invalidação → storage.loadCollection()
music.js → data/musicas.json
```

Os HTMLs não fazem queries. O servidor lê o snapshot, aplica a operação com as regras compartilhadas e envia apenas o culto alterado para a RPC transacional. O PostgreSQL confere a revisão novamente sob lock, impedindo que duas gravações concorrentes com a mesma versão sejam aceitas. Frontend e Function validam o provedor para evitar escrever em origem diferente daquela configurada para leitura.

## Modelo JS e banco

A API da UI continua com `{schemaVersion:2,revision,cultos,liveState}`. O snapshot é uma projeção das tabelas, não um documento monolítico salvo no PostgreSQL. `legacySnapshot` integral da origem fica no schema privado de migração.

Culto: `id`, `legacyId`, `date`, `title`, `status`, `startTime`, `sabbathStartTime`, `elder`, `ceremonyLead`, `soundTeam`, `notes`, `sections`, `items`, `createdAt`, `updatedAt`, `realStartedAt`, `finishedAt`, `lastLiveState` e `checklistIds`.

Seção: `id`, `type`, `label`, `position`, `startTime`, `enabled`. Culto e Escola Sabatina são os padrões existentes, preservados separadamente. Tipos adicionais são aceitos sem enum fechado e mantidos no editor. Campos SQL são em inglês/snake_case; no JS, inglês/camelCase. O editor permite adicionar, renomear, habilitar, ordenar e remover seções. A ordem é position; não existe precedência rígida entre Culto e Escola Sabatina.

Item: `id`, `sectionId`, `section`, `order`, `type`, `label`, `responsible`, `duration`, `computedTime`, `enabled`, `note`, `mediaType`, `mediaTitle`, `hasSongs`, `songs`, `status`, `realStartedAt`, `realFinishedAt`.

Seleção de música: `{id,songId,title,reference}`; strings de título antigas continuam aceitas na normalização. A busca nova mantém o ID real do catálogo. `songTitle()` concentra a leitura compatível e `songLabel()` combina a referência de hinário/CD para exibição. Há exceção manual com songId nulo, vinculada somente ao momento. IDs do catálogo são texto na associação, sem FK para um catálogo que continua em JSON local.

```text
cultos (UUID)
 ├──< culto_sections (UUID; culto_id; tipo/posição/horário)
 │       └──< culto_items (UUID; culto_id + section_id)
 │                └──< culto_item_songs (UUID; culto_item_id)
 ├── culto_live_state (culto_id PK; active_item_id)
 └──< cerimonial_checklist (UUID; culto_id + item_id UNIQUE)

culto_app_state (singleton; revision)
culto_private.migration_imports (hash; original + mapas de IDs)
```

FKs compostas garantem que seção, item ativo e checklist pertençam ao mesmo culto. Deletes em cascata limpam dependências, mas o fluxo rejeita exclusão de um culto ao vivo. O índice parcial de status permite um único culto ao vivo. Cultos finalizados não são removidos automaticamente.

## Horários planejados e reais

`computeTimes()` usa horário inicial único, posição das seções e duração dos momentos no modo continuous, padrão de novos cultos. As seções seguintes também se deslocam. O modo independent é mantido somente para compatibilidade com programações anteriores e pode ser convertido no editor. Itens/seções desabilitados não consomem tempo. `computedTime` permanece calculado no frontend e no domínio do servidor, sem coluna redundante no banco.

Tempos reais são persistidos nos itens e no culto. O estado operacional registra início do culto e do item atual. O timer calcula restante a partir desse início real, preservando o horário previsto para referência. Horários de programação continuam locais HH:MM; ao passar da meia-noite o mostrador volta a 00:00. Não há suporte novo a agendas multitimezone.

## Estado ao vivo e transações

`liveState` mantém `cultoId`, `activeItemId`, `startedAt`, `activeStartedAt`, `updatedAt` e `completedItemIds`. O snapshot monta os concluídos a partir dos estados dos itens.

- Iniciar: primeiro habilitado vira ativo, os demais ficam pendentes; registra início real.
- Próximo: atual concluído com fim real; seguinte ativo com início real; atualiza live state.
- Anterior: reabre o anterior e limpa os tempos dos itens reabertos conforme a nova execução.
- Finalizar: conclui o atual, marca o culto finalizado, preserva a última execução e retira live state.

Tudo é persistido numa transação por `commit_culto_change()`, com lock de `culto_app_state` e CAS de revisão. A leitura é um snapshot SQL consistente; eventos só sinalizam a recarga, evitando montar estado parcial com linhas de transações diferentes. Repetição com revisão antiga retorna conflito, sem avançar novamente.

O editor mantém um rascunho em memória e não recebe substituição por Realtime. Cultos ao vivo precisam ser finalizados antes de edição da programação. Duplicação gera novos UUIDs, sugere data sete dias depois, mantém a estrutura e limpa checklist/status operacional/tempos reais. A última execução é mantida em `lastLiveState`; isso não é um histórico de múltiplas execuções do mesmo culto.

## Checklist compartilhado

`cerimonial_checklist` tem unicidade por culto/item e FKs compostas. `set_culto_checklist()` verifica item habilitado, registra `completed_at` e faz upsert idempotente. A marcação não altera a revisão de programação nem reinicia o timer. A UI conta somente IDs válidos e habilitados do culto atual.

Não há mais fonte principal em chaves locais por semana. Supabase compartilha entre aparelhos; o adaptador JSONBin também persiste as marcações na coleção. O modo de demonstração local compartilha entre abas via coleção local. O checklist continua separado do estado operacional: concluir um momento ao vivo não marca automaticamente a tarefa cerimonial.

## Persistência, cliente e permissões

`shared/supabase.js` cria um cliente único com SDK UMD oficial versionado localmente. Usa URL e publishable/anon públicas; opções de sessão/Auth permanecem desligadas. A Function usa `SUPABASE_SECRET_KEY` apenas no servidor. Não há SDK/segredo privilegiado enviado ao browser.

RLS habilitado. `anon`/`authenticated` recebem SELECT com policy temporária; não recebem escrita direta nem execução das RPCs mutantes. Leitura RPC é invoker; mutações/importação são definer com search_path vazio e execução só para service_role. O schema privado não é exposto.

A Function segue pública e sem autenticação: qualquer pessoa que alcance o endpoint pode solicitar as operações previstas. Essa é uma condição provisória explícita do produto, não um controle de quem pode operar. Não foram implementados login ou roles de aplicação.

## Sincronização

`live-sync.js` centraliza uma assinatura por tela, com helpers para culto/live/checklist e unsubscribe. Publicação seletiva: `cultos` sinaliza alterações completas de programação/live, `cerimonial_checklist` sinaliza marcações. Não é necessário assinar cada tabela filha porque todas as escritas de programação passam pela RPC que atualiza o pai.

Filtros por ID quando há culto selecionado. Só Cerimonial escuta checklist. Dashboard/listagem escutam cultos; telas sem ID precisam observar qual culto ficou ao vivo. Alterações são agrupadas por 120 ms e geram uma recarga. Uma leitura após SUBSCRIBED fecha a janela da assinatura inicial.

Enquanto Realtime e leitura estiverem saudáveis, não há polling periódico. Reconexão/falha ativa polling de 30 segundos e os indicadores discretos. O último estado conhecido permanece visível, com controles de escrita indisponíveis até recuperar a leitura. O contador continua localmente sobre o início conhecido, indicando reconexão. Não é feita troca silenciosa de provedor.

## Migração e rollback

O script aceita JSONBin legado, envelope ou coleção V2. Converte IDs não UUID de forma determinística, mantém UUIDs existentes e mapas para itens/checklist/live state. `legacy_id` mantém resolução de URLs de cultos antigos. Originais ficam no schema privado. Títulos antigos ambíguos não recebem ID de catálogo inventado.

Dry run é o padrão; `--apply` precisa de credenciais no ambiente. A RPC de importação é transacional, idempotente por hash e recusa colisões em vez de sobrescrever. Checklists antigos por culto podem ser fornecidos por arquivo sidecar antes da primeira importação. O antigo checklist global não é atribuível com segurança a uma semana.

JSONBin não foi removido como provedor disponível nem houve cutover. Após configuração/homologação, altere frontend e Function juntos. Rollback posterior a novas escritas exige exportar/revisar o Supabase antes de restaurar o bin; não há replicação reversa automática. Procedimentos em [SUPABASE.md](SUPABASE.md).

## Responsabilidades e páginas

As páginas da V2 permanecem com os mesmos caminhos e parâmetro `?id=…`. `programacoes.html` ganhou filtros Todos/Planejados/Finalizados. Sem ID, acompanhamento descobre o culto ao vivo ou oferece seleção; ID inexistente nunca escolhe outro culto.

| Módulo | Responsabilidade |
| --- | --- |
| config.js | Provedor, configurações públicas, modo e fallback |
| culto.js | Regras, validação, seções, horários e transições |
| supabase.js | Cliente público e snapshot de leitura |
| supabase-model.js | UUIDs de seções e projeção para persistência |
| storage.js | API única e seleção de adaptador |
| live-sync.js | Realtime, filtros, reconexão, polling e cleanup |
| ui.js / music.js | Apresentação e banco local de músicas |
| editor.js / dashboard.js / operational.js | Fluxos preservados das telas |
| server/supabase.js | Transporte RPC privilegiado e commit com regras do domínio |
| server/jsonbin.js | Adaptador anterior para transição/rollback |
| functions/api/culto.js | Roteamento do provedor, validação HTTP e origem |

## Limites e melhorias futuras

Configuração e testes A–F hospedados são pendentes, conforme [VALIDACAO-SUPABASE.md](VALIDACAO-SUPABASE.md). Clock dos dispositivos precisa estar correto. A revisão global é conservadora e pode causar conflito entre edições de cultos diferentes; checklist não participa dela. Falhas de rede após uma gravação podem deixar o resultado incerto no cliente: recarregue antes de repetir. Paginação do histórico e versões por culto podem ser avaliadas com o crescimento da coleção. Auth permanece fora desta etapa.

## Modelo validado pela programação real

A modelagem foi ampliada para a [liturgia de 10/10/2026](MODELO-DE-PROGRAMACAO.md), em `fixtures/exemplo-sabado-2026-10-10.json`, sem carregamento automático no produto.

### Seções

`position` controla a sequência. Seções são editáveis e ordenáveis, sem enum limitado a Culto/Escola Sabatina. Horários de seção antigos continuam como metadados de compatibilidade; no modo contínuo, somente o horário inicial do programa ancora o cálculo.

### Momentos e tipos

Momento é uma unidade da timeline e do controle ao vivo, com tipo independente do nome. Os tipos sugeridos cobrem boas-vindas, louvor, oração, oferta, mensagem musical, infantil, sermão, vídeo, informativo, transição, escola, encerramento e outro; nomes são livres e tipos antigos são preservados. Duração `null` significa desconhecida, enquanto zero é explícito. Um desconhecido antes de outros itens deixa seus horários por calcular, sem supor duração.

### Músicas

Seleções mantêm ID do catálogo quando conhecido, título histórico, referência textual opcional e ordem. Número de hinário é referência, não o ID do JSON. A exceção manual permite músicas ausentes sem escrever no catálogo principal. A fixture contém cinco associações, uma manual (“A alegria”, CD Jovem).

### Mídia

`mediaType` e `mediaTitle` são informação operacional. Tipos: none/video/audio/image/other. O título é contextual no editor; Sonoplastia e Cerimonial mostram a indicação de mídia. Não há upload, player ou armazenamento de arquivos.

### Observações e responsáveis

`note` aparece de forma secundária, inclusive a instrução instrumental após o vídeo do Ofertório. Responsável continua texto opcional; ausência não gera bloco nem placeholder nas telas operacionais. Ancião e Cerimonial são dados gerais independentes.

### Transições e Escola Sabatina

A transição é item normal do tipo transition e tem um minuto neste caso. Pode ficar ativa em qualquer tela. Escola Sabatina é a seção seguinte do mesmo culto e usa o mesmo estado ao vivo, checklist e sequência de tempos. Não há reinício da aplicação na troca de seção.

### SQL e validação

`005-real-program.sql` altera duração para nullable, acrescenta timing_mode/media_type/media_title/song_reference e substitui as duas RPCs de leitura/commit preservando permissões. O snapshot informa databaseVersion 5; frontend, servidor e migração verificam essa versão antes de operar no Supabase. Não houve alteração de banco de produção.

O caso real passou em regras puras, PostgreSQL local e Chrome: horários, recálculo de sermão/louvor, reordenação, duplicação, mídia, música manual, transição e encerramento sem timer inventado. O teste final em dois aparelhos com Supabase hospedado continua pendente da configuração externa já documentada.
