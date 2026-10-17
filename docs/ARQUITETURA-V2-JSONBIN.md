> Histórico da etapa anterior. Para a integração Supabase e o estado de ativação, veja [ARQUITETURA-V2.md](ARQUITETURA-V2.md).

# Arquitetura V2 — Organizador de Culto

## Estrutura do produto

Dashboard, coleção de programações, editor, controle ao vivo, Sonoplastia, Cerimonial, músicas, palco e configurações. Sem contas, senhas ou bloqueio de acesso. A integração com mesa de som foi retirada e o HTML legado foi excluído na limpeza posterior.

O editor mantém uma cópia em memória, salva por ação explícita e alerta ao sair com alterações. Não recebe polling que possa substituir campos em edição. Cultos ao vivo são imutáveis no editor até a finalização. A operação de duplicar gera IDs novos, status planejado e remove os dados do último acompanhamento.

## Fluxo de dados

As páginas importam `app.js`. Edição e controles chamam `storage.js`; leituras das telas operacionais usam `live-sync.js`. A persistência compartilhada ocorre exclusivamente pela Function `/api/culto` e o JSONBin. No modo local explicitamente indicado, a mesma API de módulos utiliza `localStorage`.

Um erro remoto não ativa fallback local nem exibe silenciosamente um culto antigo como atual. As telas operacionais suspendem os controles e cronômetros até a próxima leitura válida. Uma URL com ID inexistente não é substituída por outro culto.

## Estrutura da coleção

```json
{
  "schemaVersion": 2,
  "revision": 3,
  "cultos": [],
  "liveState": null,
  "legacySnapshot": {}
}
```

`legacySnapshot` só existe quando houve importação do registro legado. A revisão é incrementada a cada comando persistido, não a cada leitura ou tick do timer.

## Estrutura de um culto

```json
{
  "id": "UUID",
  "title": "Culto de Adoração",
  "date": "2026-10-17",
  "status": "planned",
  "startTime": "09:00",
  "sabbathStartTime": "11:15",
  "elder": "",
  "ceremonyLead": "",
  "soundTeam": [{"role": "Sonoplastia", "nome": ""}],
  "notes": "",
  "items": [],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Status: `planned`, `live`, `finished`, apresentados como Planejado, Ao vivo e Finalizado. Um culto finalizado mantém `finishedAt` e `lastLiveState` com a última execução; não representa um log de múltiplas execuções do mesmo culto. Para um novo evento, prefira duplicar a programação e ajustar a data.

IDs novos usam `crypto.randomUUID()` com fallback independente de índice. Duplicações criam novos IDs de culto e momentos. O ID vai no parâmetro `?id=…` e é preservado nos links de acompanhamento.

## Estrutura de um item

```json
{
  "id": "UUID",
  "order": 0,
  "section": "culto",
  "type": "prayer",
  "label": "Oração Intercessora",
  "responsible": "",
  "duration": 5,
  "computedTime": "09:20",
  "enabled": true,
  "note": "",
  "hasSongs": false,
  "songs": []
}
```

Seções `culto` e `ss` têm horários iniciais e contadores separados, preservando a Escola Sabatina. `computeTimes()` atualiza ordem e horários em cascata; itens desabilitados não consomem tempo. Durações inteiras de 0 a 999 minutos, com validação no cliente e no servidor. Horários são locais, no formato HH:MM, como no produto anterior; ao cruzar meia-noite, o mostrador volta a 00:00. Não há agenda multitimezone.

O tipo prepara classificação, sem restringir o nome livre. Subir/descer reorganiza momentos dentro da mesma seção. Escola Sabatina e Culto permanecem visualmente separados. Os itens são agrupados de forma estável em Culto → Escola Sabatina, como na versão anterior. Dentro de cada seção, a sequência operacional segue a ordem persistida dos habilitados; não é reordenada automaticamente pelo relógio.

## Estado ao vivo

```json
{
  "cultoId": "UUID",
  "activeItemId": "UUID",
  "startedAt": "ISO-8601",
  "activeStartedAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "completedItemIds": []
}
```

Somente um culto pode estar ao vivo. Iniciar escolhe o primeiro habilitado e registra os horários reais. Próximo conclui o item atual e ativa o seguinte; Anterior reabre o anterior e remove as marcações operacionais dos itens reabertos. Ambos reiniciam o tempo real do momento de destino. Anterior/próximo são derivados da lista de itens habilitados, não do horário previsto.

A contagem usa `activeStartedAt + duration`. O relógio dos dispositivos deve estar correto. O contador chega a zero e informa tempo esgotado, sem avanço automático. O horário programado continua visível para comparação. Finalizar marca o culto como concluído no histórico e limpa `liveState`; a última execução é copiada para `lastLiveState`.

## Persistência

`storage.js` expõe `getCultos`, `getCulto`, `saveCulto`, `deleteCulto`, `duplicateCulto`, `getLiveState`, `saveLiveState`, `loadCollection` e `mutate`. Estado ao vivo é salvo por transições explícitas, não por objetos arbitrários.

O navegador envia `{ operation, expectedRevision }` para a Function. A Function lê o registro atual, normaliza, compara a revisão, aplica as regras e escreve a coleção completa. Validação rejeitada ou revisão divergente não altera o registro. Uma chave inválida produz erro explícito; detalhes secretos não são retornados.

Nenhuma chave secreta no frontend. `ADMIN_PASSWORD` removida. O servidor usa `JB_KEY` e opcionalmente `JB_BIN_ID`. O código da Function foi adaptado para gravação sem senha, conforme o escopo. Sem autenticação, o endpoint pode ser usado por qualquer pessoa que alcance a aplicação; o teste de Origin é apenas uma restrição de origem do navegador.

Limite interno de 2 MB por requisição/coleção. O plano do JSONBin pode impor outros limites. Não foi feita alteração na produção. Publicação exige frontend e Function da mesma versão e chave válida.

A verificação de revisão reduz perdas por edição desatualizada, mas não torna atômico o ciclo de leitura/escrita distribuído. Não existe transação nem mutex global no JSONBin nesta implementação. Uma próxima etapa pode serializar operações no backend (por exemplo, um componente coordenador) ou migrar a um armazenamento transacional. Não há dependência obrigatória de Supabase.

## Sincronização

`live-sync.js` implementa polling de 30 segundos, atualização ao voltar à aba/ficar online e assinatura de eventos locais. A frequência anterior foi mantida para não multiplicar requisições sem conhecer a cota do JSONBin. `CONFIG.pollInterval` permite uma redução futura após medir consumo. Cronômetros são atualizados localmente a cada segundo; não fazem requests a cada tick.

Após uma gravação, BroadcastChannel notifica outras abas da mesma origem. No modo local, eventos de storage também disparam recarga e Web Locks serializa gravações quando disponível. Aparelhos distintos sincronizam via Function no polling; não há realtime verdadeiro. O checklist continua separado por navegador.

## Músicas

`data/musicas.json` permanece intacto. `music.js` carrega o banco original sob demanda e pesquisa nome/álbum, tolerando acentos. Até 100 resultados são exibidos por busca; a contagem informa o total para refinamento. Diálogo nativo, resultados em botões, operação por teclado.

Momentos armazenam títulos em `songs: string[]`. Adicionar, remover e subir/descer não alteram o banco. Nenhuma letra ou cifra é lida ou criada. Desmarcar “possui músicas” preserva a seleção no dado, mas não a apresenta nas telas operacionais até reabilitar.

## Compatibilidade com dados antigos

`normalizeLegacyData()` detecta `cultoItems`/`ssItems`, converte em memória e mantém a cópia integral original em `legacySnapshot`. IDs legados são determinísticos para o mesmo registro: hash do registro para o culto e IDs estáveis por seção e posição original para os momentos. Após a primeira gravação V2, os IDs ficam persistidos e não dependem mais da posição.

Campos mapeados: `data`, `horarioCulto`, `horarioSS`, `anciao`, `liderCerimonial`, `equipeSom`, `label`, `resp`, `duration`, `enabled`, `note`, `hasSongs`, `songs`. Horários são recalculados centralmente; ausência de duração usa 5 minutos. Horários ausentes/inválidos usam os padrões anteriores (09:30 e 11:15). Data ausente usa 1970-01-01 como marcador legado e deve ser corrigida no editor; o original continua no snapshot. Campos desconhecidos ficam recuperáveis na cópia integral.

Um registro legado nunca é considerado ao vivo automaticamente. Ler não grava nem migra o backend. O primeiro comando válido grava a coleção e o snapshot juntos. Formatos desconhecidos e versões futuras são recusados para evitar substituição de dados. Não há importação implícita do antigo checklist global, pois não é possível atribuí-lo confiavelmente a uma semana.

Antes de publicar, faça um backup/exportação do bin. Não misture versões antigas de clientes gravando o formato anterior: a Function V2 rejeita o contrato antigo.

## Checklist do Cerimonial

`cerimonialChecklist_<cultoId>` contém apenas IDs de momentos. A leitura filtra IDs que não pertencem aos itens habilitados do culto selecionado. Progresso é o tamanho desse conjunto sobre a quantidade atual de habilitados. Excluir um culto na listagem remove seu checklist somente no navegador que executou a exclusão. Checklist não controla `liveState`; são ações diferentes.

## Páginas

- `index.html`: próximo culto planejado a partir da data local, culto ao vivo e últimas programações.
- `programacoes.html`: coleção, abrir/editar, duplicar e excluir com confirmação.
- `programacao.html`: editor por ID ou criação por `?new=1`. Sem parâmetros, lista para seleção.
- `ao-vivo.html`: controle principal. Sem ID, segue o culto ao vivo ou oferece seleção.
- `sonoplastia.html`: somente leitura, mesma seleção por ID ou culto ao vivo.
- `cerimonial.html`: progresso, momento atual, próximo e timeline com checklist.
- `timer-culto.html`: sem interação; usa ID quando informado ou descobre o culto ao vivo. Sem culto em andamento, mostra estado vazio.
- `musicas.html`: catálogo de consulta.
- `configuracoes.html`: informa modo, frequência e versão dos dados, sem controles fictícios.

## Responsabilidades de cada módulo JS

| Módulo | Responsabilidade |
| --- | --- |
| `config.js` | Endpoint, modo, chave local e intervalo |
| `culto.js` | Regras puras, modelo, IDs, validação e conversão |
| `storage.js` | Adaptação local/servidor e comandos de persistência |
| `live-sync.js` | Recarga/polling compartilhados |
| `ui.js` | Shell, componentes, escape e apresentação |
| `music.js` | Carregamento/busca e diálogo do banco de músicas |
| `editor.js` | Formulário em memória, reordenação e salvamento |
| `dashboard.js` | Dashboard/lista, duplicação, início e exclusão |
| `operational.js` | Ao vivo, Sonoplastia, palco e checklist |
| `app.js` | Inicialização da página e catálogo/configurações |

## Melhorias futuras

Serializar as gravações no backend; validar deploy e chave atual do JSONBin; medir polling e cotas; backup/exportação do histórico; acordar se o checklist deve sincronizar aparelhos; registrar múltiplas execuções se houver necessidade de reiniciar um mesmo culto. Qualquer etapa de autenticação depende de uma decisão posterior do produto.
