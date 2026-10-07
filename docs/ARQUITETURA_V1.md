# Arquitetura V1

## Organização
- Monorepo com npm workspaces.
- `apps/web`: React + Vite; Phaser será usado nas cenas dos jogos a partir dos prompts específicos.
- `apps/server`: Fastify + Socket.IO, autoridade de sessão e futuramente de partidas.
- `packages/math-engine`: geração e validação determinística das questões.
- `packages/protocol`: contratos Zod compartilhados.
- `packages/game-core`: catálogo e tipos comuns.
- `packages/ui`: componentes reutilizáveis.

## Decisões
- acesso sem cadastro;
- nickname temporário exclusivo;
- reconnectToken separado do apelido;
- heartbeat e janela de reconexão;
- servidor autoritativo;
- questões geradas por código, sem API paga;
- persistência da sessão em memória nesta fundação, abstraível para armazenamento externo antes de escala horizontal;
- arte definitiva e regras internas dos jogos ficam para prompts posteriores.
