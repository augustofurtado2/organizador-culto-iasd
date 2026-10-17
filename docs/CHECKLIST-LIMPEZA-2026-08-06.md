# Checklist — Auditoria e limpeza (2026-08-06)

> Atualização — reestruturação funcional V2: este documento preserva o contexto da etapa anterior. Hoje existe backend em Cloudflare Pages Functions, não há senha nas telas e a aplicação usa uma coleção de cultos. As instruções históricas de colocar chaves no HTML não se aplicam: `JB_KEY` pertence exclusivamente ao servidor. Consulte [ARQUITETURA-V2.md](ARQUITETURA-V2.md) e o [README](../README.md) para o estado vigente.
Passei o projeto inteiro a limpo: li os 5 HTML, testei os 3 fluxos reais
(admin, sonoplastia, cerimonial) com um servidor local + navegador
automatizado, e conferi contra a API do JSONBin em produção. Nada foi
commitado — está tudo no working tree pra você revisar e commitar quando
quiser.

---

## 🔴 Precisa de você — bloqueador

**A master key do JSONBin está inválida.** Testei "Salvar na Nuvem" de
ponta a ponta e a API respondeu:

```
401 — "Invalid X-Master-Key provided or the bin does not belong to your account"
```

Isso significa que **ninguém consegue salvar um culto novo agora** — e
provavelmente explica por que o bin público está parado desde
**15/05/2026** (o registro do culto de 16/05, ancião David). A chave deve
ter sido rotacionada ou trocada de conta no painel do JSONBin em algum
momento depois disso.

Não tentei "consertar" isso sozinho porque preciso da chave certa, que só
existe no seu painel em jsonbin.io. **Ação:** entra em jsonbin.io → sua
conta → gera/copia a Master Key atual → me manda ou troca direto em
`index.html`, na constante `JB_KEY` (perto da linha 1113).

O teste falhou com 401 antes de gravar nada — **o bin de produção continua
intacto**, nenhum dado foi perdido ou sobrescrito.

---

## ✅ Mantido

| Arquivo | Papel |
|---|---|
| `index.html` | App de edição (admin) — 5 abas: Home, Configuração, Sonoplastia (placeholder), Cerimonial (placeholder), UI24. **A aba UI24 estava com trabalho não commitado — preservei, não mexi no conteúdo dela.** |
| `sonoplastia.html` | View de campo, só leitura, pra equipe de som acompanhar ao vivo |
| `cerimonial.html` | View de campo, só leitura, com checklist interativo pro líder cerimonial |
| `musicas.json` | Banco de músicas do Louvor JA, usado no buscador de músicas do index.html |
| `shared/config.js` | **Novo** — config compartilhada entre os 3 HTMLs (ver seção de fixes) |
| `briefing.md` | Spec do manual de sonoplastia (projeto separado, ligado a `../03.UI24/manual-ui24r.md`) — **nunca foi versionado no git, só está no disco.** Se quiser guardar histórico dele, precisa de um `git add`. |

## 🗑 Removido — não usávamos mais

| Arquivo | Por quê |
|---|---|
| `organizador-culto.html` | Predecessor do `index.html`, superado desde o refactor pra SPA (commit `17f5077`). Nenhum link no projeto apontava mais pra ele. |
| `public/sonoplastia.html`<br>`public/cerimonial.html` | Cópias órfãs da primeiríssima versão do projeto (commit `25222e1`). Nunca foram tocadas de novo depois que as views "mudaram pra raiz" (commit `cc855ef` — é a raiz que o Cloudflare Pages publica). Comparei byte a byte: a única diferença pro commit era quebra de linha (CRLF), zero conteúdo novo. |

---

## 🐛 Bugs corrigidos

1. **O horário do culto nunca aparecia em Sonoplastia/Cerimonial.**
   As duas páginas liam `item.time`, mas o `index.html` atual grava o campo
   como `item.computedTime` desde o refactor SPA. "Funcionava" só por
   coincidência pro dado velho de maio, porque aquele registro específico
   ainda tinha o nome de campo antigo. Corrigido nas duas páginas
   (`buildCard`/`render` + `ikey` no cerimonial).

2. **Config duplicada em 3 arquivos** (senha, Bin ID, URL da API,
   função `esc()`) — isso é exatamente o tipo de coisa que gerou o
   `public/` desatualizado: alguém troca num arquivo e esquece os outros.
   Consolidei em `shared/config.js`, carregado pelos 3 HTMLs via
   `<script src="shared/config.js">`. A master key do JSONBin **não**
   entrou nesse arquivo compartilhado — continua isolada só no
   `index.html`, porque as views de campo só leem (bin público), não
   precisam de permissão de escrita.

3. **Bin ID "dinâmico e por dispositivo"** — o `index.html` antigo criava
   um bin novo do zero se o `localStorage` local estivesse vazio, e
   guardava o ID só naquele navegador. Se você abrisse o admin num
   celular novo ou limpasse os dados do site, criaria um bin diferente —
   e as páginas de campo (que têm um Bin ID fixo, sempre o mesmo) ficariam
   lendo pra sempre um bin errado, sem erro nenhum aparente. Troquei pra
   sempre usar o mesmo `BIN_ID` fixo do `shared/config.js`, dos 3 lados.
   Confirmei com você que o dado de maio é mesmo o mais recente, então não
   tem risco de ter "perdido" um bin mais novo com isso.

---

## 🔒 Risco conhecido — não corrigido de propósito

**Senha do admin e a master key do JSONBin ficam visíveis no código-fonte**
(basta abrir "Ver código-fonte" no navegador — não precisa nem "logar"). A
senha é só uma trava cosmética: qualquer pessoa com F12 aberto pode chamar
`switchTabDirect('culto')` direto no console e pular a autenticação.

Corrigir isso de verdade exige um backend que segure a master key (o
navegador nunca deveria vê-la) — esse projeto é 100% estático, sem servidor
próprio. Como é um manual interno de igreja sem dado sensível (não é
financeiro, não é dado pessoal de terceiros), decidi **não** construir um
backend só pra isso agora, e documentar o risco em vez de fingir que ele
não existe. Se um dia quiser fechar essa brecha de verdade, dá pra fazer
com **Cloudflare Pages Functions** (grátis, já que o projeto já está no
Cloudflare) fazendo de proxy pro JSONBin — aí a master key nunca chega no
navegador. Não é urgente pro uso atual, mas fica registrado.

---

## Resumo rápido

- 3 arquivos apagados (duplicados/mortos)
- 1 arquivo novo (`shared/config.js`)
- 2 bugs reais corrigidos (horário nunca aparecia; bin podia desalinhar)
- 1 bloqueador que só você resolve (master key do JSONBin expirada)
- 1 risco de segurança documentado, aceito conscientemente (senha
  client-side, sem backend)
