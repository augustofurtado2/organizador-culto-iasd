# Comparativo — Planning Center Services vs. Organizador de Culto IASD

> Atualização — reestruturação funcional V2: este documento preserva o contexto da etapa anterior. Hoje existe backend em Cloudflare Pages Functions, não há senha nas telas e a aplicação usa uma coleção de cultos. As instruções históricas de colocar chaves no HTML não se aplicam: `JB_KEY` pertence exclusivamente ao servidor. Consulte [ARQUITETURA-V2.md](ARQUITETURA-V2.md) e o [README](../README.md) para o estado vigente.
Planning Center Services é o produto profissional (pago, SaaS) que faz a
mesma coisa que a gente construiu, só que maduro. Serve de checklist de
"pra onde evoluir", não de código pra copiar (é fechado).

## O que já temos

| Feature | Planning Center | Nosso app |
|---|---|---|
| Fluxo do culto com itens em ordem | ✅ | ✅ (`cultoItems`/`ssItems`) |
| Horário calculado automaticamente por item | ✅ | ✅ (`computeTimes`, cascata a partir do início) |
| Música/repertório anexado por item | ✅ | ✅ (buscador do Louvor JA embutido) |
| Notas/observações por item | ✅ | ✅ (`note-input`) |
| Reordenar itens (drag) | ✅ | ✅ |
| Escala de equipe (quem faz o quê) | ✅ (voluntários, com convite/confirmação) | ⚠️ parcial — só texto livre ("Equipe de Som da Semana"), sem convite/confirmação |
| Visão só-leitura ao vivo pra equipe de palco | ✅ (StageDisplay) | ✅ (`sonoplastia.html`, refresh 30s) |
| Checklist de progresso ao vivo | ❌ (não é o foco deles) | ✅ (`cerimonial.html` já tem, é diferencial nosso) |
| Mapa de canais da mesa de som | ❌ | ✅ (aba UI24 — bem nichado, eles não têm porque é agnóstico de hardware) |

## O que dá pra portar como próximo passo (por ordem de esforço)

1. **Anexar mídia por item** (link de vídeo do YouTube/Drive pro "Provai e
   Vede", por ex.) — hoje só tem texto. Baixo esforço: um campo `mediaUrl`
   a mais no item, e um link clicável na `sonoplastia.html`.
2. **Notificar a equipe quando o plano muda** — hoje quem quiser saber
   precisa abrir a página e dar "Atualizar" ou esperar os 30s. Dá pra
   simular com um toast mais chamativo/som quando o `updatedAt` muda entre
   um refresh e outro — sem precisar de push notification de verdade.
3. **Histórico de cultos passados** — hoje "Salvar" sobrescreve o único
   bin. Dava pra guardar um snapshot por data (outro bin ou uma lista
   dentro do mesmo bin) pra consultar "como foi o culto de 2 semanas
   atrás" — útil pra ver repetição de música/responsável.
4. **Escala com confirmação da pessoa** — a versão "de verdade" do
   Planning Center manda notificação pro voluntário aceitar/recusar. Isso
   já é escopo de backend de verdade (autenticação por pessoa), fora do
   que dá pra fazer só com JSONBin — só faz sentido se um dia migrar pra
   algo com mais estrutura.
5. **Sync instantâneo em vez de 30s** — WebSocket/Durable Object no
   Cloudflare, como comentei antes. Esforço médio, ganho perceptível
   (equipe vê a mudança sem esperar).

## O que não vale a pena perseguir

- Multi-igreja/multi-tenant, faturamento, relatórios financeiros — fora do
  escopo (isso é o mundo do "Dashboard Lucri", outro projeto seu, não
  deste)
- Editor de apresentação/slides embutido — já existe ProPresenter/FreeShow
  pra isso, não faz sentido reconstruir
