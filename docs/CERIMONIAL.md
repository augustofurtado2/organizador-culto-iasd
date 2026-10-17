# Cerimonial — acompanhamento e checklist

## Arquivos

- `cerimonial.html`: carrega o CSS específico.
- `shared/ceremony.js`: controlador e renderização exclusivos do Cerimonial.
- `shared/ceremony.css`: composição e acessibilidade da tela, com prioridade mobile.
- `shared/operational.js`: encaminha somente o modo `ceremony` ao novo controlador.
- `tests/browser-ceremony.mjs`: teste integrado com a fixture de 10/10/2026.
- Este documento.

A interface continua em HTML/CSS/JS puro e usa o design system existente. Não
foram adicionados comandos de operação do culto, edição da programação ou
serviços novos. As demais telas mantêm seu controlador existente.

## Atual e próximo

Sem `?id`, a assinatura de `shared/live-sync.js` seleciona o culto de
`liveState.cultoId`. Com `?id`, respeita esse culto ou o seu alias legado; não
substitui um ID inexistente por outro culto. `liveView()` determina o atual por
`activeItemId` e devolve o próximo na sequência de itens habilitados, respeitando
a ordem das seções. O responsável só aparece quando preenchido. O horário
previsto permanece visível; o início real é uma informação secundária.

Sem culto em andamento e sem seleção explícita, mostra o estado vazio e, quando
existe, acesso à próxima programação planejada. A prévia explícita permite
consultar a timeline e o checklist existentes, com indicação Planejado/Finalizado,
sem exibir itens antigos como AGORA. A página não inicia ou finaliza o culto.

## Checklist e progresso

A única gravação da página é `setChecklist(cultoId, itemId, completed, revision)`.
No banco Supabase preparado, a identidade do registro é `culto_id + item_id`.
No JSONBin e no modo local, o checklist fica em `checklistIds` dentro de cada
objeto de culto na coleção compartilhada. A origem local é a coleção já mantida
pela camada de armazenamento, e não uma chave global de checklist; não foi
criada uma segunda origem `cerimonialChecklist_*` que divergiria dessa camada.

A marcação nunca executa start/next/previous/finish e não escreve em `liveState`.
O AGORA continua identificado pelo estado ao vivo mesmo que seja marcado ou
desmarcado. Nesse caso, a lista conserva o badge AGORA e indica separadamente
“Marcado no checklist”. Próximo também mantém seu badge operacional.

O progresso conta IDs únicos marcados que ainda pertencem aos itens habilitados
do culto selecionado. Não incorpora automaticamente `liveState.completedItemIds`.
Assim, na simulação com Boas-vindas marcado e Louvor inicial ativo, o resultado
é **1 de 13, 8%**, e não 2 concluídos. IDs órfãos/desabilitados não aumentam o total.

Os campos de checklist ficam temporariamente desabilitados durante a gravação,
sem alterar o progresso antes da confirmação. Falhas não confirmam a marcação;
a tela mostra erro e relê a origem. O foco retorna ao checkbox sem rolar a página
quando a ação foi iniciada nele e o usuário não mudou para outro controle.

## Sincronização e conexão

`subscribe(..., {cultoId, checklist:true})` usa a camada compartilhada existente:

- local: storage/BroadcastChannel e Web Locks nas gravações;
- JSONBin: leitura periódica conforme a configuração existente;
- Supabase: eventos dos cultos/checklist com leitura de snapshot consistente,
  e fallback de leitura periódica durante reconexão.

A indicação distingue modo local, sincronização, leitura periódica e reconexão.
Na falha de leitura, preserva o último snapshot, identifica a reconexão e
suspende novas marcações até recuperar os dados. Não há fila offline ou
confirmação simulada. O modo local continua funcionando sem rede no mesmo
navegador, mas não compartilha dados entre aparelhos.

## Layout, detalhes e scroll

Até 899px, a sidebar desaparece e o cabeçalho compacto oferece um menu de
navegação. A sequência principal é progresso, AGORA com músicas, próximo com até
dois momentos posteriores e timeline completa. Acima disso, AGORA/PRÓXIMO e
checklist ficam em colunas, mantendo cards verticais.

Cada checkbox tem alvo de pelo menos 44×48px e nome acessível. A lista usa
`details/summary` nativos, preservados abertos durante snapshots. Músicas,
duração, mídia e observações ficam nos detalhes; mídia é apenas uma indicação,
sem player. Valores ausentes não geram campos de responsável vazios.

Ao mudar o item ativo, se a pessoa está no topo ou com o card AGORA totalmente
visível no celular, a tela acompanha o novo atual. Respeita movimento reduzido.
Se estiver consultando a timeline, preserva a posição visual do item consultado,
mesmo quando o card AGORA muda de altura. A ancoragem é feita pelo controlador
para evitar ajustes duplicados do navegador. No desktop, o resumo lateral
visível por ser sticky não força retorno ao topo durante uma consulta.

## Testes

- `node tests/flows.mjs`
- `node tests/real-program.mjs`
- `node --experimental-vm-modules tests/realtime.mjs`
- `node tests/browser-ceremony.mjs`
- `node tests/browser.mjs`

Os testes de navegador usam o servidor local na porta 8097 e o Chrome de
inspeção na porta 9227, em perfil descartável. A fixture de sábado é semeada
somente nesse perfil: Boas-vindas marcado, Louvor inicial ativo e Oração próxima.
Verificam músicas, três abas, marcação/desmarcação sem mudar liveState,
isolamento de cultos, atualizações remotas, mídia/observações expansíveis,
detalhes e posição da consulta preservados, falha/recuperação de leitura,
histórico e tamanhos 375/768/1440px. Não houve publicação ou alteração de dados
de produção.

## Limites da arquitetura existente

Não foi necessário alterar o modelo de dados ou adicionar operações de backend.
O JSONBin usa read/modify/write de toda a coleção, com verificação de revisão,
mas sem transação atômica entre aparelhos: operações simultâneas ainda podem
competir. O caminho Supabase já preparado usa registros de checklist por culto
+ item e transações; sua configuração e homologação reais continuam pendentes.
Esta etapa preserva o provider atual, sem prometer Realtime hospedado antes
da configuração. A homologação em dois aparelhos deve ser feita quando houver
um ambiente compartilhado configurado.
