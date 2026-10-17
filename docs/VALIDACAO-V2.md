# Validação da reestruturação funcional V2

Executada em 16/10/2026. Nenhuma chamada de escrita nem migração em produção. Rede do JSONBin simulada nos testes do backend. Chrome e servidor HTTP locais executados em ambiente isolado; dados dos testes permanecem somente no perfil temporário.

## Regras e contrato da Function

Comando reproduzível, sem instalar pacotes:

```bash
node tests/flows.mjs
```

Passaram: cálculos em cascata, alteração do horário inicial, habilitação/desabilitação, separação das seções, serialização/reabertura, associação de músicas, IDs, isolamento entre cultos, duplicação, início/avanço/retorno/finalização, preservação do histórico, migração determinística do legado e cópia integral original.

A Function foi exercitada com Request/Response reais e `fetch` simulado: GET não grava, primeira escrita converte sem perder o registro original, revisões divergentes retornam 409, operação malformada é rejeitada, chave ausente tem erro explícito, origem divergente é rejeitada, versões futuras não são sobrescritas. Banco de produção não acessado.

## Fluxos no navegador

Executados em Chrome isolado usando DevTools Protocol e WebSocket nativo do Node. Os testes estão em `tests/browser.mjs` e `tests/browser-edge.mjs`.

| Fluxo | Resultado |
| --- | --- |
| Criar → momentos → duração → salvar → reabrir | Dados e horários preservados |
| Buscar música real → selecionar → salvar → reabrir | Associação preservada |
| Criar dois cultos → editar um | Outro culto preservado |
| Iniciar → abrir Sonoplastia e palco | Mesmo item em três abas |
| Avançar no controle principal | Sonoplastia e palco atualizados |
| Checklist em um culto → abrir outro | Checklists independentes |
| Finalizar | Status finalizado e programação no histórico |
| Sem culto ao vivo | Sonoplastia e palco com estados vazios corretos |

Também passaram: conflito entre editores mantém alterações do formulário; ordenar/remover músicas; duplicar/excluir com IDs independentes; checklist com 12 IDs órfãos conta apenas itens válidos; ID inexistente não escolhe outro culto; falha de leitura suspende a apresentação operacional e recuperação restabelece o acompanhamento. O histórico mostra as conclusões operacionais e elas não marcam automaticamente o checklist independente. Não foram registradas exceções JavaScript nos testes de navegador.

As nove telas foram abertas em **375, 768 e 1440 px**, sem overflow horizontal no documento. A faixa de navegação compacta tem rolagem interna intencional. Capturas do editor foram inspecionadas, incluindo a versão de celular.

### Reproduzir os testes de navegador

1. Use um perfil Chrome descartável, sem dados pessoais, com remote debugging em `127.0.0.1:9227`. O teste apaga o armazenamento da origem local de teste.
2. Sirva a raiz em `http://127.0.0.1:8097` com `python3 -m http.server 8097 --bind 127.0.0.1`.
3. Execute `node tests/browser.mjs` e depois `node tests/browser-edge.mjs` no mesmo perfil. O segundo usa os dois cultos preparados pelo primeiro.
4. Encerre os processos de teste e descarte o perfil. Os scripts usam apenas APIs nativas do Node moderno (testados com Node 24), sem npm.

Os testes de navegador verificam o modo local e a sincronização entre abas. Eles não substituem uma homologação do endpoint publicado com aparelhos distintos.

## Integridade

`data/musicas.json` permaneceu byte a byte igual ao arquivo anterior à reforma. SHA-256:

```text
6e1ac4fd946827786bc6947f73339637c80aec7eae3c7d5b315a9871ac44ffe7
```

Sintaxe de todos os módulos JavaScript verificada com `node --check`. Caminhos estáticos e IDs dos HTMLs verificados. Sem erros de whitespace nos arquivos deste escopo. Alterações preexistentes em `.gitignore`, `docs/briefing.md`, arquivos removidos e movimentação do banco foram preservadas.

## Limites e próximos testes

Não foi publicado o projeto nem confirmada a validade da chave de produção. É necessário publicar a Function e as páginas juntas, conferir `JB_KEY`, fazer backup do bin e validar a primeira gravação V2 no ambiente escolhido. O limite/cota real do plano JSONBin também precisa ser conferido.

O JSONBin não oferece nesta implementação uma operação transacional de leitura/verificação/escrita: a revisão detecta clientes desatualizados, mas solicitações distribuídas simultâneas ainda exigem serialização futura. A sincronização entre aparelhos usa polling de 30 segundos. Checklist continua local ao navegador por decisão explícita desta etapa. Revisão visual em dispositivos físicos e validação operacional durante um ensaio são recomendadas.
