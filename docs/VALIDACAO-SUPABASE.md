# Validação da integração Supabase

Implementação testada em 16/10/2026. **Não houve acesso, migração ou escrita em produção. O projeto Supabase ainda não foi criado.**

## PostgreSQL e transporte server-side

As migrations 001–004 foram executadas inicialmente. A evolução 005 do sábado real também foi executada em PostgreSQL WebAssembly isolado (PGlite 0.5.10). `tests/supabase-sql.mjs` exercita SQL real, não um mock das regras do banco.

Passaram: criação do schema, snapshot SQL, seções separadas, músicas com ID/título, isolamento de dois cultos, transições ao vivo, timestamps reais, CAS, rollback integral após FK inválida, checklist idempotente, FKs compostas, cascades, duplicação com dados operacionais limpos, finalização e histórico.

Foram verificados SELECT anônimo permitido, UPDATE anônimo negado, RPCs mutantes negadas ao anônimo e snapshot de migração privado. A importação é idempotente por hash e preserva o original. Somente cultos/checklist entram na publicação.

O contrato Cloudflare → Supabase foi ligado ao mesmo PostgreSQL por transporte HTTP simulado. Dois “Próximo” concorrentes com a mesma revisão retornaram **200 e 409**; só um avanço persistiu. Provedor/URL de projeto divergentes foram rejeitados e chave ausente retornou erro explícito. Isso não testa o gateway real do Supabase nem o runtime Cloudflare publicado.

## Sincronização

`tests/realtime.mjs` executa o módulo real de sincronização com dependências/callbacks do SDK simulados. Passaram filtros de culto/checklist, invalidação por evento, ausência de polling saudável, fallback durante falha, cancelamento após recuperação, preservação do último snapshot e unsubscribe.

Essa simulação **não comprova** WebSocket, publicação, limites ou latência de um projeto hospedado. Esses pontos dependem da configuração manual.

## Navegador local

Chrome isolado: criação, edição/reabertura, músicas reais do catálogo, isolamento entre cultos, início/avanço/finalização, palco e Sonoplastia em abas separadas, checklist por culto e compartilhado entre abas, conflitos, duplicação/exclusão, IDs órfãos e recuperação de falhas preservando o último estado.

As nove telas foram abertas em 375, 768 e 1440 px sem overflow horizontal no documento. A identidade visual não foi alterada. Banco `data/musicas.json` comparado byte a byte com a cópia anterior, sem mudanças. Os testes de navegador são do modo local, não do serviço Supabase hospedado.

## Homologação manual obrigatória — pendente

**CONFIGURAÇÃO MANUAL NECESSÁRIA:** criar projeto, aplicar SQL, preencher URL/publishable key, configurar secret key na Cloudflare, importar backup revisado e publicar em homologação.

| Teste do pedido | Estado |
| --- | --- |
| A — Próximo no desktop atualiza Cerimonial no celular | Pendente em dois aparelhos; analogia entre abas local passou |
| B — Checklist entre dois dispositivos | Pendente hospedado; compartilhamento local entre abas passou |
| C — Palco muda momento/próximo e reinicia contador | Local passou; pendente por Realtime hospedado |
| D — Editar A preserva B | Local e PostgreSQL passaram; homologar ambiente publicado |
| E — Finalizar preserva histórico e limpa live | Local e PostgreSQL passaram; homologar ambiente publicado |
| F — Recarregar preserva estado vindo do banco | Snapshot PostgreSQL passou; pendente em páginas conectadas ao projeto real |

O JSONBin segue configurado como padrão até essa homologação. Não foi considerado desativado, nem a migração considerada concluída em produção.

## Reprodução

```bash
node tests/flows.mjs
node --experimental-vm-modules tests/realtime.mjs
PGLITE_MODULE=/caminho/pglite/dist/index.js node tests/supabase-sql.mjs
```

Os testes de Chrome em `tests/browser.mjs`/`tests/browser-edge.mjs` usam servidor em 127.0.0.1:8097 e perfil Chrome descartável com debugging em 9227, conforme a descrição no documento anterior. O teste inicial apaga os dados dessa origem no perfil isolado.

## Riscos documentados

Endpoint de escrita permanece público por decisão de escopo, embora a chave esteja protegida. Leituras públicas expõem as informações inseridas. Clock incorreto afeta contadores locais. Uma queda após commit pode impedir a confirmação no cliente; revisão protege contra repetição desatualizada, e recarga é necessária. Rollback sem exportar escritas recentes retornaria a dados antigos do JSONBin. Políticas/publicação reais e hospedagem precisam da verificação manual acima.

A validação específica da programação real, incluindo mídia/duração nula e recálculo entre seções, está em [MODELO-DE-PROGRAMACAO.md](MODELO-DE-PROGRAMACAO.md). O teste SQL atual aplica 001–005.
