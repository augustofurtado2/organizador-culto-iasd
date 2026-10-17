# Organizador de Culto — IASD Boa Vista

Aplicação em HTML, CSS e JavaScript puro para preparar programações, guardar histórico e acompanhar o mesmo culto em Sonoplastia, Cerimonial e Tela de Palco. Sem framework, npm ou build obrigatório. As telas são acessíveis por URL, sem login, senha ou permissões por usuário nesta etapa.

## Uso

1. Na home ou em Programações, escolha **Novo Culto**.
2. Informe data, horários, responsáveis e observações. Organize seções como Culto e Escola Sabatina; elas podem ser adicionadas, renomeadas e reordenadas.
3. Defina nome, tipo, duração e responsável. Use subir/descer para reorganizar; novos programas recalculam em sequência contínua, inclusive entre seções. Duração pode ficar vazia quando não for conhecida.
4. Ative músicas no momento e use o buscador. Títulos selecionados podem ser removidos/reordenados, receber referência de hinário/CD e, como exceção, ser informados manualmente sem alterar o catálogo. Mídia é apenas tipo/título operacional, sem player.
5. **Salvar culto** persiste a programação. A URL passa a conter seu ID.
6. Abra **Culto ao Vivo** e clique em **Iniciar culto**. Use Anterior/Próximo para controlar o momento ativo; o timer não avança sozinho.
7. Abra Sonoplastia, Cerimonial ou Tela de Palco pelo mesmo ID, ou sem ID para seguir o culto ao vivo.
8. **Finalizar culto** encerra o estado operacional e mantém a programação no histórico.

Programações permite abrir, duplicar e excluir cultos. Cultos ao vivo não podem ser editados nem excluídos até serem finalizados. Há apenas um culto ao vivo por coleção. A duplicação cria novos IDs e uma programação planejada independente.

## Páginas

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Dashboard: próximo culto, culto em andamento e últimos cultos |
| `programacoes.html` | Listagem e gerenciamento de cultos |
| `programacao.html?id=…` | Editor; `?new=1` inicia uma programação vazia |
| `ao-vivo.html?id=…` | Controle principal: iniciar, anterior, próximo e finalizar |
| `sonoplastia.html?id=…` | Leitura operacional: agora, tempos, músicas, próximo e timeline |
| `cerimonial.html?id=…` | Checklist vinculado ao culto, progresso e acompanhamento |
| `timer-culto.html?id=…` | Tela de palco, sem sidebar e sem controles |
| `musicas.html` | Consulta ao banco existente de nomes e álbuns |
| `configuracoes.html` | Informações reais de armazenamento e sincronização |

Nenhuma integração de equipamentos, letra, cifra, projeção, WhatsApp ou e-mail faz parte da V2.

## Executar localmente

Na raiz do projeto:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080`. Módulos ES nativos precisam de HTTP; abrir os HTMLs por `file://` não funciona.

Em `localhost`, `127.0.0.1` e `[::1]`, `storageMode: 'auto'` usa uma coleção em `localStorage` e a interface informa **Modo local**. Dados persistem ao reabrir o mesmo navegador/origem. As abas sincronizam por BroadcastChannel e eventos de storage. Esse modo não sincroniza dispositivos nem carrega automaticamente o registro de produção. As chaves antigas do checklist não são mais fonte principal; consulte a importação opcional no guia Supabase.

Em outros hosts, o modo automático usa `/api/culto`. Não há troca silenciosa para dados locais quando o servidor falha. Em um host local que execute também a Function, use `storageMode: 'remote'` para testar o backend.

## Persistência e estágio de implantação

**CONFIGURAÇÃO MANUAL NECESSÁRIA:** ainda não existe projeto Supabase. A integração está implementada e testada localmente, mas não houve migração, deploy ou homologação no serviço hospedado. O código mantém `provider: 'jsonbin'` como padrão até a configuração e os testes A–F. Não há troca automática entre bancos.

Arquitetura preparada para o cutover:

```text
HTML → shared/app.js → editor / dashboard / operational
                          ↓
                     storage.js
                      ├─ leitura → Supabase RPC de snapshot → PostgreSQL
                      ├─ escrita → /api/culto → server/supabase.js → RPC transacional
                      └─ sincronização → live-sync.js → Supabase Realtime

music.js → data/musicas.json (somente leitura)
```

- `shared/config.js`: provedor, URL e publishable key públicas, modo local e intervalo de fallback.
- `shared/supabase.js`: SDK oficial local, cliente sem sessões e leitura do snapshot.
- `shared/supabase-model.js`: adaptação para IDs UUID, seções e seleções de músicas.
- `shared/culto.js`: regras, validação, cálculos e transições de estado compartilhadas.
- `shared/storage.js`: API única para as páginas, com adaptadores local, JSONBin e Supabase.
- `shared/live-sync.js`: assinatura centralizada, filtros por culto/checklist, reconexão e polling somente como fallback.
- `shared/ui.js`, `editor.js`, `dashboard.js`, `operational.js`: apresentação e fluxos existentes; editor não substitui alterações não salvas por eventos remotos.
- `shared/music.js`: catálogo original e seletor; novas seleções armazenam ID e título.
- `functions/api/culto.js`: seleciona o adaptador server-side. Segredos ficam no servidor.
- `server/supabase.js` e `server/jsonbin.js`: adaptadores fora do diretório de rotas públicas.
- `supabase/001…005`: schema, RLS/policies, publicação e RPCs reproduzíveis.
- `scripts/migrate-jsonbin-to-supabase.mjs`: dry run/importação transacional e idempotente.

A identidade visual e os HTMLs ativos foram preservados. Os quatro CSS antigos permanecem fora do carregamento da V2.

## Supabase e configuração

Veja o passo a passo completo em [docs/SUPABASE.md](docs/SUPABASE.md), incluindo projeto, migrations, policies temporárias, Cloudflare, importação, testes em dois dispositivos e rollback.

| Configuração | Onde |
| --- | --- |
| `supabaseUrl`, `supabasePublishableKey`, `provider: 'supabase'` | `shared/config.js`, valores públicos |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PERSISTENCE_PROVIDER=supabase` | Cloudflare Pages, secret key somente no servidor |
| `storageMode: 'remote'` | Somente se quiser usar Supabase ao testar em localhost |

`.dev.vars.example` contém o modelo. O arquivo real de segredos não foi modificado. Publique frontend e Function da mesma versão e apontando para o mesmo projeto. Sem login nesta fase: leituras são públicas; a Function pública aceita as operações previstas, com validação e transação. A publishable key não pode escrever diretamente nas tabelas nem executar RPCs mutantes.

Mantenha `JB_KEY`/`JB_BIN_ID` somente durante a transição/rollback. A origem anterior não foi desativada porque os testes hospedados ainda dependem da criação do projeto.

## Consistência, execução e checklist

O PostgreSQL mantém cultos, seções, itens, seleções de músicas, estado ao vivo e checklist em tabelas relacionadas. FKs compostas impedem relações entre cultos diferentes. As RPCs usam transação, lock de revisão e comparação de versão; uma falha desfaz toda a operação. Dois avanços com a mesma revisão não avançam dois itens.

O timer usa início real do item + duração; sem duração definida, informa essa ausência em vez de inventar contagem. Horários previstos continuam calculados pelo módulo compartilhado. Avanço/retorno/finalização registram estados e horários reais. Duplicações sugerem a data sete dias depois e não copiam checklist, execução ou tempos reais; finalizados permanecem no histórico.

O checklist agora usa a mesma origem da programação. No Supabase é compartilhado entre dispositivos; no JSONBin é persistido na coleção; no modo local é compartilhado entre abas do mesmo navegador. A chave antiga por culto pode ser exportada e incluída na primeira migração, mas não é mais a fonte principal. Marcações não alteram a revisão da programação e não reiniciam o timer.

Realtime publica somente `cultos` e `cerimonial_checklist`: a atualização do pai sinaliza a transação completa dos filhos. Telas operacionais com ID filtram o culto, e somente Cerimonial assina checklist. Sem conexão, a tela mantém o último estado conhecido e indica Reconectando; polling de 30 segundos atua até a recuperação. Não há polling periódico enquanto Realtime e leitura estão saudáveis. JSONBin continua usando polling.

## Migração e rollback

```bash
node scripts/migrate-jsonbin-to-supabase.mjs --source /tmp/jsonbin-export.json --out /tmp/plano-supabase.json
```

Sem `--apply`, nenhuma gravação é executada. O script aceita registro antigo, coleção V2 e envelope JSONBin. Preserva o original num schema privado, mapeia IDs legados para UUID e recusa sobrescrever IDs existentes. O mesmo export não é importado duas vezes. Consulte o guia para incluir checklists antigos por culto e aplicar o plano com as credenciais do servidor.

`data/musicas.json` permanece intacto: **1.889 músicas com IDs únicos**, sem catálogo no banco. A tabela de seleções guarda `song_id` quando conhecido e o título histórico; títulos legados ambíguos preservam o texto com ID nulo.

Não há sincronização de escrita entre JSONBin e Supabase. Após novas gravações no Supabase, fazer rollback exige exportar/revisar o estado antes de restaurar o bin; apenas trocar a configuração retornaria a dados antigos. Nenhuma reversão destrutiva é executada automaticamente.

## Validação

```bash
node tests/real-program.mjs
node tests/flows.mjs
node --experimental-vm-modules tests/realtime.mjs
PGLITE_MODULE=/caminho/pglite/dist/index.js node tests/supabase-sql.mjs
```

O último comando usa uma ferramenta opcional externa de PostgreSQL em WebAssembly; o produto não depende dela nem de npm/build. Foram verificados SQL real, RLS/grants, CAS, rollback, timestamps, checklist, migração idempotente e contrato da Function. Realtime foi testado com callbacks simulados; a publicação/WebSocket e aparelhos reais ainda exigem homologação do projeto criado.

Os fluxos em Chrome local cobrem as nove telas em 375, 768 e 1440 px e o checklist compartilhado entre abas. Evidências e limites em [docs/VALIDACAO-SUPABASE.md](docs/VALIDACAO-SUPABASE.md). Os testes A–F em dois dispositivos estão explicitamente pendentes da configuração manual.

## Documentação e histórico

- [Arquitetura vigente e transição](docs/ARQUITETURA-V2.md)
- [Configuração Supabase e rollback](docs/SUPABASE.md)
- [Arquitetura anterior JSONBin](docs/ARQUITETURA-V2-JSONBIN.md)
- [Identidade visual](docs/UI-UX-V2.md)

Os documentos anteriores preservam o contexto histórico; suas descrições de senha, checklist local e leitura direta do JSONBin não descrevem a integração Supabase preparada nesta etapa.

## Programação real de sábado

A fixture `fixtures/exemplo-sabado-2026-10-10.json` reproduz os 13 momentos, cinco músicas, três vídeos e a transição de um minuto, com responsáveis e observações fornecidos. Não é carregada automaticamente em produção. Veja [MODELO-DE-PROGRAMACAO.md](docs/MODELO-DE-PROGRAMACAO.md) para modelo, horários, testes e carregamento local explícito.

A migration `005-real-program.sql` é necessária para mídia, referência musical e duração opcional no Supabase. Programações antigas continuam no modo de horários por seção até conversão explícita; novas programações usam sequência contínua.
