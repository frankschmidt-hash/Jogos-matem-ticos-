# CHECKPOINT 01 — Plataforma, Lobby, Nickname e Motor Matemático

## Status
Fundação funcional implementada na branch `feat/prompt-01-foundation`.

## Arquitetura criada
- monorepo npm workspaces;
- React/Vite no portal;
- backend Fastify + Socket.IO;
- protocolo compartilhado com Zod;
- motor matemático isolado;
- tipos/regras comuns;
- UI compartilhada.

## Sessão e presença
Implementado `SessionManager` em memória com:
- normalização Unicode e case-insensitive;
- bloqueio de nickname simultâneo;
- caracteres permitidos e filtro ofensivo básico;
- heartbeat;
- grace period de reconexão;
- reconnectToken independente do nickname;
- cleanup por expiração.

## Endpoints/eventos
- `GET /health`
- `POST /api/session/claim`
- `POST /api/session/heartbeat`
- `POST /api/session/disconnect`
- `POST /api/session/reconnect`
- Socket.IO: `session:heartbeat`

## Motor matemático
Categorias implementadas para 5º, 6º e 7º anos e modo misto.
Inclui:
- seed opcional;
- divisão exata quando apropriado;
- inteiros;
- decimais;
- frações;
- porcentagens;
- razões e expressões curtas;
- vírgula/ponto em decimal;
- frações equivalentes na validação.

## Componentes compartilhados
- `MathQuestionModal`
- `CountdownTimer`
- `ResultFeedback`
- `PlayerBadge`
- `GameCard`
- `RoomCodeInput`
- `ConnectionStatus`
- `ConfirmDialog`
- `HelpRules`

## Navegação
- entrada sem cadastro;
- seletor 5º/6º/7º/misto;
- lobby com os quatro jogos;
- rotas reservadas para cada jogo;
- restauração da sessão após refresh;
- heartbeat periódico;
- tentativa de liberação controlada no pagehide.

## Validação focada executada localmente
Um harness independente compilou e executou as partes puras da fundação:
- 1.500 questões geradas e validadas (500 por série);
- nenhuma divisão explícita por zero nas amostras;
- determinismo por seed;
- decimal com vírgula/ponto;
- frações equivalentes;
- nickname case-insensitive;
- reserva durante reconexão;
- liberação após grace period;
- reconexão com token.

## CI
O workflow `.github/workflows/prompt-01-ci.yml` executa:
1. instalação;
2. typecheck;
3. testes;
4. build.

O Prompt 01 só deve ser considerado integralmente validado após esse workflow passar.

## Pendências deliberadas
- regras internas dos quatro jogos não pertencem ao Prompt 01;
- salas multiplayer completas ficam para o prompt específico;
- armazenamento distribuído será necessário antes de múltiplas instâncias do backend;
- arte definitiva fica para etapa visual;
- publicação continua proibida nesta etapa.

## Próximo ponto
Após CI verde, o Prompt 02 deve preservar esta fundação e implementar o Banco Imobiliário Matemático sobre os contratos existentes.
