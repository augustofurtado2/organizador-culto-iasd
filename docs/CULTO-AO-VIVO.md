# Tela Culto ao Vivo

A implementação continua em HTML/CSS/JS puro, sem dependências de build. A tela
usa `shared/live-screen.js` para renderização e `shared/live-screen.css` para
estilos restritos ao body `live-operator`. `shared/operational.js` mantém a
assinatura, a leitura e os comandos compartilhados com as telas operacionais.

## Origem dos dados

`subscribe()` de `shared/live-sync.js` entrega snapshots da coleção. Sem `?id`,
a tela seleciona o culto apontado por `liveState.cultoId`. Com `?id`, respeita
esse identificador ou seu alias legado, sem substituir um ID inválido por outro
culto. `liveView()` só retorna um momento se o culto estiver `live` e o estado
compartilhado pertencer a ele. Na ausência desse estado, os cards ativos somem;
a tela apresenta um estado vazio e acesso às programações. Um culto selecionado
planejado/finalizado pode ser iniciado com o comando existente.

No modo local, a assinatura reage a BroadcastChannel/storage. Em JSONBin, usa
o polling já configurado. Em Supabase, usa Realtime com fallback durante
reconexão. Não houve troca de provider nem publicação nesta etapa. A sidebar
específica desta tela apresenta as oito entradas solicitadas; outras telas
preservam sua navegação atual.

## Tempo e sequência

`liveView()` calcula decorridos usando `liveState.activeStartedAt`, equivalente
a `active_item_started_at` no armazenamento SQL. O restante usa a duração do
momento, limitado a zero. A página atualiza os números e a barra a cada segundo,
sem reconstruir o DOM nem usar o horário previsto como origem. Se o tempo exceder
a duração, mostra uma mensagem e aguarda avanço manual. Duração ausente mantém o
tempo decorrido, exibe `—:—` no restante e esconde a barra percentual.

O próximo/anterior vem da sequência central de `enabledItems()` e `liveView()`.
`saveLiveState('next'/'previous', id, revision)` aplica as operações centrais,
com revisão e registro real de início/término. Voltar reinicia a contagem do
momento reativado, conforme o comportamento central existente.

“Marcar como concluído” usa `next` quando houver sucessor; o texto do controle
explica que também o ativa. No último momento, usa `finish`, com confirmação.
Finalizar preserva `lastLiveState` e os horários reais e limpa `liveState`.
Nenhum comando altera arrays diretamente na página.

## Estados, filtros e progresso

A timeline prioriza: ID ativo → AO VIVO; `completedItemIds` → Concluído;
ID de próximo → Próximo; demais habilitados → Pendente. Cores têm texto e badge;
o atual também tem `aria-current="step"`. O filtro seleciona seções localmente,
sem operações de persistência e sem alterar o momento ativo. A seleção é
preservada entre snapshots.

O progresso percentual conta somente momentos concluídos. Com Boas-vindas
concluído e Louvor inicial ativo, mostra 1/13 (8%) concluído, além da posição
operacional 2/13. Não apresenta 2/13 como concluídos durante o louvor.

O resumo de duração soma os valores definidos e usa `sectionSchedule()` para
as faixas. Na fixture, soma 2h30min, Culto 1h35min e Escola Sabatina 55min.
O encerramento às 12:00 não tem duração definida: o texto identifica essa
limitação e não afirma um término preciso para o último momento.

## Conexão e celular

O indicador diferencia sincronização, modo local, polling e reconexão.
Falha de leitura preserva o último snapshot, identifica reconexão e desabilita
as gravações até uma leitura bem-sucedida. Os relógios do último estado continuam
visíveis; não são apresentados como uma nova confirmação do servidor.

Até 760px, o conteúdo de operação segue AGORA/timer, próximo, controles, músicas,
timeline e informações complementares. Anterior e Próximo têm 52px de altura.
A sidebar usa a navegação horizontal compacta do design system.

## Validação

- `node tests/flows.mjs`
- `node tests/real-program.mjs`
- `node --experimental-vm-modules tests/realtime.mjs`
- `node tests/browser-live-screen.mjs`, com servidor local em 8097 e Chrome de
  depuração em 9227, no perfil isolado de testes.
- `node tests/browser.mjs`, regressão dos fluxos anteriores.

O teste dedicado usa a fixture de 10/10/2026, inicia e avança centralmente até o
louvor, simula início real há 6min30 e verifica os quatro estados, músicas,
barra/relógios, filtro sem gravação, mídia, avançar/voltar/concluir, duas abas,
falha/recuperação de leitura, confirmação/cancelamento, histórico, último momento
sem duração e larguras 375/768/1440px. Nenhum dado foi semeado no ambiente
publicado. A validação entre aparelhos no Supabase depende da configuração real.

## Ações futuras

Pausar tempo não aparece: não existe operação central nem persistência de pausa.
Uma implementação futura deve guardar intervalos de pausa e sincronizar a mesma
regra no timer e na tela de palco. Não há controles fictícios nesta tela.
Recomenda-se depois homologar dois aparelhos com o provider publicado e avaliar
pausa persistida se houver necessidade operacional.
