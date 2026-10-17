# UI/UX V2 — Organizador de Culto · IASD Boa Vista

> Atualização — reestruturação funcional V2: este documento preserva o contexto da etapa anterior. Hoje existe backend em Cloudflare Pages Functions, não há senha nas telas e a aplicação usa uma coleção de cultos. As instruções históricas de colocar chaves no HTML não se aplicam: `JB_KEY` pertence exclusivamente ao servidor. Consulte [ARQUITETURA-V2.md](ARQUITETURA-V2.md) e o [README](../README.md) para o estado vigente.
Reforma visual em HTML, CSS e JavaScript puro, sem instalação ou build. Nenhuma alteração nos contratos de dados, APIs, autenticação, cálculo de horários, salvamento, banco de músicas ou persistência do checklist.

## Paleta e tokens

`shared/tokens.css` é a fonte dos tokens semânticos, com aliases para os nomes antigos.

| Papel | Token | Cor |
| --- | --- | --- |
| Institucional | `--color-primary` | `#062B49` |
| Links e seleção | `--color-secondary` | `#1F6FC2` |
| Sucesso em texto | `--color-success` | `#237E53` |
| Sucesso decorativo | `--color-success-accent` | `#2FA36B` |
| Ao vivo, erro e destruição | `--color-danger` | `#D9363E` |
| Detalhe institucional | `--color-gold` | `#C89B52` |
| Fundo | `--color-bg` | `#F7F9FC` |
| Card | `--color-surface` | `#FFFFFF` |
| Borda | `--color-border` | `#E2E8F0` |
| Texto | `--color-text` | `#10233D` |
| Apoio | `--color-text-muted` | `#64748B` |

Verde mais escuro para leitura em fundos claros. Dourado restrito à marca e bordas de destaque. Tema escuro mantido no palco e compatível com a página legada de mesa, sem reformulá-la.

Escala de espaçamento: 4, 8, 12, 16, 20, 24, 32 e 40 px (`--space-*`). Raios: 8, 12 e 16 px. Sombras `--shadow-sm` e `--shadow-md`, usadas com moderação.

## Tipografia e ícones

Stack local: Inter quando instalada, system-ui, fontes do sistema e Segoe UI. Removidas requisições de fontes externas das telas reformuladas. Títulos de página em 20–24 px, títulos de cards em 18 px e conteúdo principal em 14–15 px. Horários usam fonte monoespaçada e algarismos tabulares.

SVG inline de traço uniforme, `currentColor` e `aria-hidden` para decoração. Botões só com ícone recebem nome acessível. Nomes de músicas são texto; sem letra, cifra ou projeção. Dados antigos de ícone da equipe continuam armazenados sem mudança.

## Arquitetura CSS

Ordem de carregamento: `tokens.css`, CSS da página e `ui.css`. Os estilos antes embutidos foram extraídos para `shared/index.css`, `shared/sonoplastia.css`, `shared/cerimonial.css` e `shared/timer-culto.css`. `ui.css` contém os padrões compartilhados e ajustes V2.

Foram encontrados estilos duplicados de botões, sombras, cores e raios, além de gradientes locais sobrepondo o design system. Os aliases de tokens do index foram centralizados e os gradientes dos arquivos extraídos foram substituídos. Ainda existem declarações históricas de tamanho, cor e sombra nos layouts; a camada V2 tem precedência. Uma limpeza seletiva futura deve ser acompanhada de inspeção visual no navegador.

## Componentes e estados

- Botões: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` e `.btn-danger`. Marinho para ação principal, superfície clara para secundária e vermelho para destruição. Estados de hover, desabilitado e foco visível.
- Cards: fundo de superfície, borda sutil, raio consistente e sombra discreta. Timelines preservam horários e ordem existentes.
- Badges: `.chip` para contexto/próximo, `.chip-live` para ao vivo; `.checked` comunica conclusão com texto e check. Pendente também tem texto explícito. Não comunicar estado só pela cor.
- Formulários: altura mínima de 44 px, labels associados nos campos gerais, nomes acessíveis nos controles dinâmicos e foco visível. Erros de senha anunciados por `role="alert"`.
- Carregamento, vazio e erro: mantidos os fluxos existentes; status de atualização usa `role="status"`. Respeitar preferência de movimento reduzido.
- Checklist: acessível por Tab, Enter e Espaço; mesma função de clique e mesma persistência anterior.

## Navegação

Sidebar institucional no desktop com links para páginas existentes. No index, Programações usa a aba autenticada existente. Nas demais telas, aponta para o editor. Culto ao Vivo e Sonoplastia apontam para a mesma visão operacional existente. Músicas e Configurações são indicações textuais de contexto, sem rotas fictícias.

Até 1024 px, navegação horizontal no fluxo da página, sem sidebar fixa. A faixa de navegação pode rolar horizontalmente; o conteúdo principal deve permanecer na largura da tela. Palco não recebe navegação.

Entradas visuais de mesa de som removidas da home e ocultadas no compartilhamento. Na etapa visual, a página legada e o elemento `link-mesa` foram preservados. Na reestruturação funcional, essa dependência foi retirada; na limpeza posterior, `mesa-de-som.html` foi excluído. Nenhuma nova interface de mesa foi criada.

## Responsividade

Breakpoints: 1024 px para navegação compacta; 600 px para cards e formulários empilhados. Padding reduzido no celular, controles com alvo mínimo de 44 px e campos flexíveis. Zoom habilitado nas telas de campo. Nomes longos podem quebrar linha. Timer com fonte fluida, fundo escuro e contraste alto; vermelho limitado à advertência já existente.

## Padrões para próximas telas

Usar tokens semânticos, os mesmos componentes e a mesma ordem CSS. Reutilizar rotas reais; não exibir controles que aparentem uma funcionalidade inexistente. Manter navegação fora da tela de palco. Associar labels e controles, prever foco, estados vazios, carregamento e erro. Evitar cores literais e gradientes em novos estilos.

## Validação e limites desta etapa

Scripts verificados sintaticamente com Node, sem dependência adicionada ao projeto. Arquivos de configuração, Function e músicas comparados com cópia anterior à edição. Funções de cálculo, payload, leitura/escrita e persistência mantidas. Verificados também os caminhos dos estilos, unicidade de IDs e balanceamento de blocos CSS.

Não foi possível executar o navegador nesta sessão: Chrome headless encerrou ao iniciar e o ambiente bloqueou a abertura de servidor local. Portanto, a renderização e os fluxos visuais ainda precisam de revisão em navegador, especialmente em 375, 768 e 1440 px, com nomes longos e programação completa.

Recomendações: validar em celular real, revisar foco dos modais e navegação por teclado do seletor de músicas em etapa própria. A Sonoplastia mantém sua atualização de 30 segundos e apresenta a duração prevista; contadores de tempo decorrido/restante e alterações na identificação do próximo momento exigem uma etapa funcional autorizada. A contagem regressiva existente permanece no palco. A correção da persistência do checklist continua fora deste escopo.
