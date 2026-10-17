# Modelo de programação — sábado 10/10/2026

A referência real fornecida pela IASD Boa Vista está em `fixtures/exemplo-sabado-2026-10-10.json`. Ela é somente fixture de desenvolvimento/teste e não é carregada pelo aplicativo nem salva automaticamente em produção.

Dados gerais: **Ancião Decio**, **Cerimonial Carol**. Esses campos não são atribuídos automaticamente aos responsáveis dos momentos.

## Programação de referência

| Seção | Horário | Momento | Responsável | Duração |
| --- | --- | --- | --- | --- |
| Culto | 09:30 | Boas-vindas | Decio | 2 min |
| Culto | 09:32 | Louvor inicial | Ricardo | 10 min |
| Culto | 09:42 | Momento oração intercessora em duplas/trios | Decio | 5 min |
| Culto | 09:47 | Ofertório | | 5 min |
| Culto | 09:52 | Mensagem musical | Grupo Vocal Boa Vista | 4 min |
| Culto | 09:56 | Adoração Infantil | | 9 min |
| Culto | 10:05 | Louvor | Ricardo | 10 min |
| Culto | 10:15 | Sermão | Pastor Marcelo | 40 min |
| Culto | 10:55 | Oração final | Pastor Marcelo | 5 min |
| Culto | 11:00 | Informativo Mundial das Missões | | 4 min |
| Culto | 11:04 | Transição do culto para a Escola Sabatina | | 1 min |
| Escola Sabatina | 11:05 | Início da Escola Sabatina / Divisão em classes | | 55 min |
| Escola Sabatina | 12:00 | Encerramento da Escola Sabatina | | Não informada |

O intervalo da primeira seção é 09:30 → 11:05. A segunda começa em 11:05 e seu último início informado é 12:00. Não se conhece o horário final do encerramento; a interface distingue esse marcador de um término calculado.

## Seções e ordem

Cada seção tem `id`, `type`, `label`, `position` e `enabled`. O tipo é uma chave técnica estável; a pessoa pode mudar o nome sem perder os momentos. O editor permite adicionar, renomear, habilitar, subir/descer e remover seções com confirmação. A ordem é `position`, sem regra que imponha Culto ou Escola Sabatina primeiro.

O campo antigo `startTime` da seção continua disponível para compatibilidade. Em programas novos, a fonte de tempo é o horário inicial da programação inteira, não relógios separados por seção.

## Momentos e tipos

Momentos possuem identidade própria, vínculo com seção, ordem, nome, tipo, responsável opcional, duração opcional, habilitação, músicas, mídia e observação. `order` é a ordem global do programa e vira `position` no SQL; IDs nunca dependem do índice.

Tipos sugeridos: `welcome`, `worship`, `prayer`, `offering`, `special_music`, `children`, `sermon`, `video`, `information`, `transition`, `school`, `closing`, `other`. Atalhos preenchem somente tipo e nome inicial. O título continua livre, e tipos antigos/desconhecidos permanecem preservados ao reabrir.

Novos momentos não recebem duração suposta: o campo começa vazio. `null` significa desconhecida; `0` significa duração explicitamente zero. Não são equivalentes.

## Músicas

Louvor inicial:

1. 564 — Vamos adorar
2. CD Jovem — A alegria
3. 362 — O melhor lugar do mundo

Louvor:

1. 55 — Tua palavra
2. 135 — Vinde as águas

A seleção guarda `{id, songId, title, reference}`. `id` identifica a associação; `songId` identifica o registro do catálogo; `reference` é uma informação textual da programação, como número do hinário ou CD. **564 não é o ID do banco.**

A fixture vincula os quatro títulos do Hinário aos IDs existentes 2311, 2099, 1782 e 1872, escolhidos por título/álbum. Os números da programação vieram da referência fornecida; o JSON não tem uma coluna própria de número do hinário.

A busca não encontrou título exatamente “A alegria”; existe “Verdadeira Alegria”, que é outro título. A fixture preserva “A alegria” com referência “CD Jovem” e `songId: null`. O seletor permite cadastrar essa exceção apenas no momento/culto. Não modifica `data/musicas.json`, não obriga número e não inclui letra/cifra. A ordem da seleção é mantida e pode ser alterada.

## Mídia e observações

`mediaType`: `none`, `video`, `audio`, `image`, `other`. `mediaTitle` é opcional e só aparece no editor quando a mídia não é “Nenhuma”. A escolha é informação operacional, sem upload, player ou arquivo.

- Ofertório: vídeo “Provai e Vede”; observação “Música instrumental após o vídeo”.
- Adoração Infantil: vídeo sem título informado.
- Informativo Mundial das Missões: vídeo sem título informado.

`note` continua separado da mídia e é mostrado de forma secundária no editor, Sonoplastia e Cerimonial. Responsável vazio simplesmente não produz um bloco na timeline/AGORA/palco.

## Horários em cascata

`timingMode: "continuous"` é o padrão das novas programações e desta fixture. `computeTimes()` usa um cursor único:

```text
horário inicial
+ duração dos habilitados da primeira seção
+ duração dos habilitados da seção seguinte
+ ...
```

Trocar a ordem de seções ou momentos recalcula a sequência inteira. Itens/seções desabilitados não consomem tempo. Se uma duração desconhecida tiver itens depois dela, os horários posteriores ficam por calcular; o sistema não assume zero nem congela horários antigos.

`inferDurationsFromTimes()` serve para importar/conferir os horários explícitos da referência, inclusive a fronteira entre seções. A diferença 11:04 → 11:05 produz a transição de 1 minuto. O último encerramento permanece `null`. `referenceTime` só documenta o caso de teste; após edição, os horários são calculados pelas durações, sem usar esses horários como travas.

Programações antigas sem `timingMode` mantêm `independent`, evitando mudar horários já salvos silenciosamente. O editor informa essa compatibilidade e permite escolher sequência contínua. Nesse modo legado, horários independentes podem continuar fixos por seção; a fixture e todas as novas programações usam o modo contínuo.

## Testes obrigatórios executados

- Horários originais: todos os 13 batem com a referência.
- Sermão 40 → 45: oração final 11:00, informativo 11:05, transição 11:09, Escola Sabatina 11:10 e encerramento 12:05.
- Louvor inicial 10 → 12: todos os seguintes, inclusive Escola Sabatina, avançam 2 minutos.
- Mensagem musical depois da Adoração Infantil: Infantil 09:52, Mensagem musical 10:01, mantendo o Grupo Vocal e a mídia do Infantil.
- Seções em ordem inversa: a Escola Sabatina pode ser primeira. Sua duração final desconhecida impede inventar o início posterior do Culto; informar zero ou uma duração conhecida permite completar o cálculo.
- Duplicação: novos IDs, próxima data padrão 17/10/2026, status planejado, estrutura/copias editáveis e nenhum checklist/tempo real herdado. A data pode ser alterada depois.
- Transição fica ativa no controle/sonoplastia/cerimonial/palco como qualquer momento.
- Encerramento sem duração: palco mostra “Duração não definida” e `—:—`, sem contagem inventada.
- SQL real: fixture salva e relida com mídia, referências e duração nula; alteração do sermão desloca a próxima seção.

## Executar testes

```bash
node tests/real-program.mjs
node tests/flows.mjs
PGLITE_MODULE=/caminho/pglite/dist/index.js node tests/supabase-sql.mjs
```

`tests/browser-real-program.mjs` carrega a fixture somente em perfil Chrome descartável no servidor local de teste. Exercita o editor, campos contextuais, música manual, ordem, transição, palco, duplicação e larguras 375/768/1440 px. A regressão dos oito fluxos anteriores também passou.

### Carregar manualmente para desenvolvimento

Sirva a raiz por HTTP e use um navegador local de desenvolvimento. No console da aplicação:

```js
const storage = await import('./shared/storage.js');
if (!storage.isLocal) throw new Error('Use somente o modo local de desenvolvimento.');
const fixture = await fetch('fixtures/exemplo-sabado-2026-10-10.json').then(r => r.json());
const db = await storage.loadCollection();
await storage.saveCulto(fixture, db.revision);
location.href = 'programacao.html?id=' + encodeURIComponent(fixture.id);
```

Isso carrega apenas por ação explícita, em modo local. A aplicação normal não importa a fixture.

## Persistência e limites

A migration incremental `supabase/005-real-program.sql` adiciona modo de horários, mídia e referência musical, aceita duração nula e atualiza as RPCs. Não reescreve as migrations antigas. Frontend, servidor e script de importação exigem essa versão antes de usar Supabase para evitar perda silenciosa dos novos campos.

O projeto Supabase continua pendente de configuração manual; não houve escrita/deploy em produção nesta etapa. A sequência contínua e os novos campos já funcionam nos adaptadores local/JSONBin.

Limites: sem duração conhecida não se calcula um horário posterior nem um timer restante confiável; o catálogo não fornece números de hinário; relógios planejados usam hora local e voltam a 00:00 após a meia-noite; reordenar um culto ao vivo exige finalizar primeiro. Não há cadastro de pessoas, upload de mídia ou biblioteca de templates.

## Editor compacto

A programação apresenta uma linha por momento, agrupada por seção, com horário,
duração, nome, responsável e tipo. O cabeçalho informa a quantidade real de momentos
de cada seção. Selecionar o nome ou o botão de edição abre os campos no painel
lateral; abaixo de 1200 px, o painel aparece sobre a lista e pode ser fechado.
Alterações no painel entram no rascunho e atualizam imediatamente a sequência.
O botão **Salvar culto** persiste o rascunho completo; fechar o painel preserva as
alterações ainda não salvas. Seções e equipe ficam na área recolhível própria.

Verificação do layout e dos fluxos: `node tests/browser-compact-editor.mjs`, usando
o mesmo servidor local e Chrome de depuração descritos nos outros testes de navegador.
O teste usa somente o perfil de navegador de testes e dados locais.

A navegação compartilhada segue a referência visual: barra lateral azul escura,
marca institucional, destaque ciano e links Programação, Culto ao vivo,
Sonoplastia, Cerimonial, Músicas e Cultos. Início, Novo culto, Tela de palco e
Configurações ficam no menu de mais opções do cabeçalho. Links operacionais
preservam o culto selecionado; data e status representam esse mesmo culto.
No celular, a navegação é horizontal. O símbolo oficial está em `assets/`, com
sua origem documentada em `assets/README.md` e sem dependência de CDN em execução.
