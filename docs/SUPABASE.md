# Supabase — configuração e migração

**CONFIGURAÇÃO MANUAL NECESSÁRIA.** Ainda não existe projeto Supabase para esta aplicação. O código está preparado, mas não houve criação de projeto, deploy, importação ou teste no serviço hospedado. `CONFIG.provider` e o servidor continuam com JSONBin como padrão até a homologação. Não existe fallback automático entre bancos.

## Como criar o projeto

1. Crie um projeto dedicado no [Supabase Dashboard](https://supabase.com/dashboard).
2. Escolha região próxima à equipe e guarde a senha do banco fora do repositório. A aplicação não usa essa senha.
3. Em Project Settings/API Keys, obtenha a URL, a **publishable key** pública e uma **secret key** para o servidor. Não envie a secret key em conversas nem a coloque em arquivos públicos.
4. Confira que a Data API está habilitada para o schema `public`. Não exponha `culto_private`.
5. Faça a configuração primeiro em um ambiente de homologação. O projeto não implementa Supabase Auth, contas ou sessões.

## Variáveis necessárias

| Local | Configuração | Exposição |
| --- | --- | --- |
| `shared/config.js` | `supabaseUrl` | Pública |
| `shared/config.js` | `supabasePublishableKey` | Pública; `sb_publishable_…` ou `anon` legada |
| `shared/config.js` | `provider: 'supabase'` | Ativar após preparar o ambiente |
| `shared/config.js` | `storageMode: 'remote'` para testar Supabase em localhost | Pública |
| Cloudflare/CLI | `SUPABASE_URL` | URL do mesmo projeto do frontend |
| Cloudflare/CLI | `SUPABASE_SECRET_KEY` | Segredo somente no servidor |
| Cloudflare | `PERSISTENCE_PROVIDER=supabase` | Seleciona o adaptador |

`.dev.vars.example` é somente um modelo. O `.dev.vars` real continua ignorado pelo git e não foi alterado. `JB_KEY`/`JB_BIN_ID` ficam temporariamente disponíveis apenas para o adaptador de rollback. `ADMIN_PASSWORD` não é usada.

O SDK UMD oficial **2.118.0** foi incluído em `vendor/supabase/`, com licença MIT e hash registrado. Carrega sob demanda, sem CDN em tempo de execução, npm ou build. Persistência de sessão, refresh de tokens e detecção de sessão por URL estão desativados. O módulo recusa secret/service role no frontend. Não existe login.

## Como executar migrations

No SQL Editor do projeto dedicado, execute **uma vez e na ordem**:

1. `supabase/001-schema.sql`: tabelas, FKs, índices e triggers de `updated_at`.
2. `supabase/002-policies.sql`: RLS, SELECT público temporário e restrição de escrita.
3. `supabase/003-realtime.sql`: publicação apenas dos sinais necessários.
4. `supabase/004-functions.sql`: leitura consistente, commit transacional, checklist e importação.
5. `supabase/005-real-program.sql`: sequência contínua, duração opcional, mídia e referência musical. Se 001–004 já estiverem aplicadas, execute somente 005.

Os scripts não contêm `DROP TABLE` nem limpeza de dados. Cada arquivo usa transação. A criação de tabelas/policies é intencionalmente executada uma única vez; reexecutar tudo não é um mecanismo de atualização. Para evoluções posteriores, crie outra migration numerada. Não rode em um banco já ocupado por tabelas de mesmo nome.

## Tabelas e nomes

Campos SQL usam inglês em `snake_case`; o domínio JS mantém inglês em `camelCase`. Os nomes das tabelas preservam o termo do produto `culto` e o nome existente `cerimonial_checklist`.

| Tabela | Responsabilidade |
| --- | --- |
| `cultos` | Data, título, responsáveis, equipe, observações, status e início/fim reais |
| `culto_sections` | Seções ordenadas, tipo livre, label, horário inicial e habilitação |
| `culto_items` | Momentos, posição, tipo, duração, responsável, estado e tempos reais |
| `culto_item_songs` | Somente seleções: ID do catálogo quando conhecido, título histórico e ordem |
| `culto_live_state` | Item ativo e horários reais da execução atual |
| `cerimonial_checklist` | Marcações compartilhadas por culto/item |
| `culto_app_state` | Revisão e linha de bloqueio para gravações atômicas |
| `culto_private.migration_imports` | Hash, snapshot original e mapa de IDs; sem leitura pública |

`computedTime` não é persistido: `computeTimes()` calcula a partir da duração e ordem, usando horário inicial único no modo contínuo ou horários por seção no modo de compatibilidade. Assim não há dois horários previstos conflitantes. O real é persistido em `real_started_at`/`real_finished_at`. O timer usa `active_item_started_at + duration_minutes` e não avança sozinho.

Culto e Escola Sabatina mantêm seções separadas e a ordem anterior por padrão. Schema e módulos aceitam seções adicionais sem enum fechado. O editor permite adicionar, renomear, habilitar e reordenar seções. Novas programações usam sequência contínua; as antigas preservam independent até uma conversão explícita.

## Relacionamentos

```text
cultos
 ├─< culto_sections
 │    └─< culto_items
 │         └─< culto_item_songs
 ├─< culto_items (FK composta confere que a seção pertence ao mesmo culto)
 ├── culto_live_state → item ativo do mesmo culto
 └─< cerimonial_checklist → item do mesmo culto

culto_app_state → revisão/lock global
culto_private.migration_imports → backup/mapa da importação
```

Deletes de cultos e momentos fazem CASCADE nas dependências. Excluir um culto exige confirmação na interface e é rejeitado enquanto estiver ao vivo. Nenhum culto finalizado é apagado automaticamente.

`UNIQUE(culto_id,item_id)` impede marcações duplicadas. FKs compostas impedem associar checklist, seção ou item ativo ao culto errado. Índice parcial permite um culto ao vivo e um item ativo por culto. Posições usam constraints diferidas para permitir trocar a ordem dentro de uma transação. Índices compostos com prefixo `culto_id` cobrem consultas por culto; não foram criados índices redundantes para o mesmo prefixo.

## Transações e RPCs

- `read_culto_collection(cultoId?)`: uma instrução SQL retorna um snapshot coerente no formato esperado pelo JS. A leitura pode ser limitada a um culto.
- `commit_culto_change(...)`: bloqueia a revisão com `FOR UPDATE`, verifica `expectedRevision`, grava somente o culto alterado e seus filhos e incrementa a revisão. Falha em qualquer etapa desfaz tudo.
- `set_culto_checklist(...)`: upsert idempotente da marcação, verifica item habilitado e pertencimento ao culto. Não altera a revisão da programação nem o timer.
- `import_culto_snapshot(...)`: importação integral em uma transação, sem sobrescrever IDs existentes; guarda o original no schema privado.

As regras compartilhadas em `culto.js` são aplicadas pela Function antes do commit. O lock e o CAS são verificados novamente **dentro do PostgreSQL**. Dois comandos “Próximo” com a mesma revisão resultam em um sucesso e um conflito, sem pular dois momentos. Recarregue antes de repetir uma operação em conflito. Duplicação limpa checklist, estados e tempos reais e recria os IDs de todos os filhos.

A revisão é global e conservadora: uma edição de outro culto pode causar conflito no editor aberto. Isso preserva o comportamento de conflito da V2 e pode ser refinado para versões por culto no futuro. O checklist é independente dessa revisão.

## Realtime

Somente **`cultos` e `cerimonial_checklist`** entram em `supabase_realtime`.

Toda alteração de programação/live aceita pela aplicação atualiza `cultos` na mesma transação dos filhos. Esse evento sinaliza a recarga do snapshot; portanto não é necessário publicar cada tabela filha. Editar tabelas filhas manualmente, fora das RPCs, não é um fluxo suportado de atualização da aplicação.

`shared/live-sync.js` cria uma assinatura por tela. Telas com ID filtram o culto; Cerimonial também filtra o checklist daquele culto. Dashboard/listagem acompanham apenas eventos de `cultos`. Telas sem ID escutam cultos para descobrir qual está ao vivo. Exclusões são conferidas pelo PK no cliente quando o evento não oferece colunas de filtro. Mudanças recebidas são agrupadas por 120 ms antes da leitura.

Ao entrar em `SUBSCRIBED`, faz uma leitura para fechar a janela entre carregar dados e assinar. Enquanto Realtime e leitura estão saudáveis, não há polling periódico. Em reconexão/falha, o fallback lê a cada **30 segundos**; o SDK tenta reconectar. Voltar à aba ou ficar online também dispara recarga. Ao recuperar, o polling é cancelado.

Indicadores discretos mostram Sincronizado/Reconectando. Durante falhas, a tela mantém o último estado e o contador baseado no último início conhecido; controles de gravação ficam indisponíveis até uma leitura válida. O estado não é apresentado como sincronizado enquanto a conexão não for confirmada. Não há cache remoto persistente que escolha outro culto silenciosamente.

## Policies temporárias

RLS habilitado nas tabelas. `temporary_public_read` permite SELECT para `anon`/`authenticated`. Não há policies de INSERT/UPDATE/DELETE para esses papéis; privilégios de escrita e execução das RPCs mutantes também foram revogados explicitamente de `PUBLIC`, `anon` e `authenticated`.

A RPC de leitura é `SECURITY INVOKER`. RPCs mutantes são `SECURITY DEFINER`, com `search_path` vazio e nomes qualificados, concedidas somente a `service_role`. A secret key da Function permite essa execução e nunca é enviada ao navegador. O snapshot de migração permanece privado.

**Permissão provisória:** a Function continua sem autenticação, conforme o escopo. Qualquer pessoa que alcance esse endpoint público pode solicitar as operações previstas. Encaminhar as escritas pelo servidor protege a chave e concentra as regras; não restringe quem pode operar o culto. A leitura pública também torna disponíveis os nomes e observações armazenados. Essas permissões precisam ser revistas quando o produto adotar acesso restrito, sem implementar Auth agora.

## Como configurar Cloudflare

1. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` como segredo e `PERSISTENCE_PROVIDER=supabase` no ambiente de homologação do Pages.
2. Configure os dados públicos correspondentes em `shared/config.js` e selecione `provider: 'supabase'`.
3. Publique a raiz, incluindo `functions/`, `server/`, `shared/` e `vendor/`, sem build command.
4. Verifique que os dados públicos e a Function apontam para o mesmo projeto. Um provedor ou URL de projeto diferente entre frontend e Function retorna 409; não há escrita nos dois bancos simultaneamente.
5. Faça os testes A–F abaixo antes de mudar o ambiente usado pela igreja. `storageMode: 'auto'` em localhost continua local; use `remote` quando quiser exercitar Supabase localmente.

No novo modo, GET/Realtime do navegador usam Supabase diretamente; PUT usa `/api/culto` e a secret key do servidor. GET na Function também existe para diagnóstico/compatibilidade. Os adaptadores ficam em `server/`, fora de `functions/`, evitando criar rotas públicas alternativas de escrita.

## Como migrar JSONBin

1. Exporte o registro atual pelo JSONBin e guarde uma cópia fora do repositório. O script aceita o registro direto, coleção V2 ou envelope `{record: ...}`.
2. Opcionalmente, para preservar o checklist da versão anterior, exporte **somente chaves por culto** do navegador onde ele era usado:

```js
JSON.stringify(Object.fromEntries(
  Object.keys(localStorage)
    .filter(key => key.startsWith('cerimonialChecklist_'))
    .map(key => [key.slice('cerimonialChecklist_'.length), JSON.parse(localStorage.getItem(key))])
), null, 2)
```

Salve o resultado como `checklists.json`. Não importe o antigo `cer-checked`: ele mistura cultos. Na versão atual, marcações já incluídas em `checklistIds` no export da coleção são preservadas sem arquivo separado.

3. Faça um dry run:

```bash
node scripts/migrate-jsonbin-to-supabase.mjs --source /tmp/jsonbin-export.json --out /tmp/plano-supabase.json
```

Se houver checklist anterior, acrescente `--checklists /tmp/checklists.json` **na primeira importação**. O script mapeia IDs e ignora IDs órfãos/desabilitados com aviso. Não tenta adivinhar a semana de uma marcação global.

4. Revise datas, contagens, seções, músicas e o mapa de IDs. IDs UUID já existentes são preservados; IDs antigos não UUID recebem UUIDs determinísticos. `legacy_id` permite que URLs antigas de culto continuem sendo resolvidas. IDs de momentos são remapeados, inclusive no estado ao vivo e no checklist.
5. Configure URL/secret key no ambiente local ignorado pelo git. Execute conscientemente:

```bash
node --env-file=.dev.vars scripts/migrate-jsonbin-to-supabase.mjs --source /tmp/jsonbin-export.json --out /tmp/plano-aplicado.json --apply
```

Arquivos de saída usam criação exclusiva: não sobrescrevem um plano existente. Sem `--apply`, nenhum request de gravação é executado. O script não apaga nem modifica JSONBin. O mesmo hash de origem resulta em `skipped: true`; IDs já existentes com outra origem causam cancelamento integral, sem sobrescrever dados.

O registro bruto, incluindo campos não reconhecidos, fica em `culto_private.migration_imports`. Não publique exports/planos junto ao site. Checklists sidecar devem ser incluídos antes da primeira importação, não como uma segunda importação sobre os mesmos IDs.

### Músicas

`data/musicas.json` continua intacto, com **1.889 IDs distintos em 1.889 registros** na auditoria. Novas seleções salvam `song_id` real e `song_title`. Seleções antigas que contêm só título recebem `song_id` apenas quando o título identifica inequivocamente um registro do catálogo; títulos repetidos/desconhecidos ficam com ID nulo e título preservado. Não há tabela de catálogo nem letras.

## Como testar em dois dispositivos

**CONFIGURAÇÃO MANUAL NECESSÁRIA:** projeto, migrations, chaves e deploy devem estar prontos. Use dois navegadores/aparelhos com o mesmo domínio publicado; não use o modo local.

| Teste | Ação e resultado esperado |
| --- | --- |
| A | Desktop em Ao Vivo e celular no Cerimonial do mesmo ID. Próximo no desktop atualiza AGORA no celular sem refresh. |
| B | Cerimonial em dois dispositivos. Marcar/desmarcar atualiza ambos, mantendo progresso limitado ao culto selecionado. |
| C | Palco aberto. Avançar muda nome, próximo e reinicia o timer a partir do início real. |
| D | Criar A e B; editar A. B permanece intacto. |
| E | Finalizar. Sai do estado ao vivo, continua no histórico e palco sem ID mostra nenhum culto em andamento. |
| F | Recarregar todas as páginas. Programação, execução e checklist continuam vindos do banco. |

Confira “Sincronizado”, bloqueie temporariamente o WebSocket para verificar fallback/reconexão e abra um editor antigo para exercitar conflito 409. A guia Network deve mostrar requests de leitura direta ao Supabase e escritas somente à Function, sem secret key no browser.

## Testes automatizados disponíveis

```bash
node tests/flows.mjs
node --experimental-vm-modules tests/realtime.mjs
```

Para executar migrations/RPCs num PostgreSQL em WebAssembly isolado, informe o caminho de uma cópia externa do pacote `@electric-sql/pglite` (testado com 0.5.10):

```bash
PGLITE_MODULE=/caminho/pglite/dist/index.js node tests/supabase-sql.mjs
```

Essa ferramenta é opcional e não integra o produto nem exige npm/build na aplicação. O teste verifica SQL real, políticas, CAS, rollback, migração e a Function com transporte HTTP simulado. Os testes Realtime simulam callbacks do SDK: não comprovam a publicação/WebSocket de um projeto hospedado. Evidências e pendências em [VALIDACAO-SUPABASE.md](VALIDACAO-SUPABASE.md).

## Como fazer rollback

Não apague nem altere o bin original durante a homologação. Até o cutover, o código mantém o adaptador JSONBin e a configuração padrão anterior.

- Se ainda não houve escrita no Supabase, restaure `provider: 'jsonbin'` no frontend e `PERSISTENCE_PROVIDER=jsonbin` na Function, com a chave antiga válida. Publique os dois juntos.
- Se já houve escrita no Supabase, exporte primeiro o snapshot atual. Trocar apenas a configuração voltaria a um bin desatualizado. Não existe replicação reversa automática.

Exportação server-side opcional, sem imprimir credenciais:

```bash
node --env-file=.dev.vars --input-type=module -e 'import {writeFile} from "node:fs/promises"; import {readSupabase} from "./server/supabase.js"; await writeFile("/tmp/cultos-supabase-backup.json", JSON.stringify(await readSupabase(process.env),null,2), {flag:"wx"});'
```

Com backup revisado, restaure o conteúdo no JSONBin por seu painel/administração segura e só então altere os dois provedores. O adaptador atualizado entende seções e músicas com ID/título. Preserve também a exportação bruta original e os mapas de IDs. Não há SQL de exclusão das novas tabelas nem reversão destrutiva automática.

## Referências oficiais

As decisões de SDK, publicação, filtros e permissões foram conferidas em [Installing](https://supabase.com/docs/reference/javascript/installing), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [Database Functions](https://supabase.com/docs/guides/database/functions).

## Inventário desta etapa

Criados:

- `supabase/001-schema.sql`, `002-policies.sql`, `003-realtime.sql`, `004-functions.sql`, `005-real-program.sql`.
- `shared/supabase.js`, `shared/supabase-model.js`.
- `server/supabase.js`, `server/jsonbin.js`.
- `scripts/migrate-jsonbin-to-supabase.mjs`.
- `vendor/supabase/supabase.js`, `LICENSE`, `README.md`.
- `.dev.vars.example`.
- `tests/realtime.mjs`, `tests/supabase-sql.mjs`.
- `docs/SUPABASE.md`, `docs/VALIDACAO-SUPABASE.md`, `docs/ARQUITETURA-V2-JSONBIN.md`.

Alterados:

- `shared/config.js`, `culto.js`, `storage.js`, `live-sync.js`, `ui.js`, `music.js`, `editor.js`, `operational.js`, `dashboard.js`, `app.js`.
- `functions/api/culto.js`.
- `tests/browser-edge.mjs`.
- `README.md`, `docs/ARQUITETURA-V2.md`.

HTMLs, identidade visual, banco de músicas e o arquivo real de segredos permaneceram sem alteração nesta etapa.

## Ajuste ao sábado real

Aplique também `005-real-program.sql` antes de usar esta versão. O snapshot retorna databaseVersion 5 e a aplicação recusa um schema anterior, evitando descartar mídia/referências ou transformar duração vazia em zero. A fixture real e o procedimento de teste local estão em [MODELO-DE-PROGRAMACAO.md](MODELO-DE-PROGRAMACAO.md). O contador exibe duração não definida quando não houver tempo informado; computedTime continua derivado, sem coluna redundante.
