# CHECKPOINT 06 — Multiplayer, Salas, Tempo Real e Segurança

## Status
**IMPLEMENTAÇÃO CONCLUÍDA — aguardando validação focada do CI**

Branch:
\`feat/prompt-06-multiplayer-core\`

## Consolidação
Corrida Maluca, Corrida Numérica e Futebol Matemático agora utilizam um núcleo comum de infraestrutura de sala e segurança.

## Implementado
- códigos de sala compartilhados e não reutilizados enquanto ativos;
- senhas com scrypt/salt;
- rate limit de senha;
- presença connected/reconnecting/disconnected/abandoned;
- janela de reconexão;
- recuperação sem duplicar jogador;
- transferência determinística de host;
- máquina de estados de sala;
- capacidade e vagas;
- copiar código no cliente;
- serverNow + deadline/início;
- tolerância de rede limitada;
- idempotência/replay;
- limites de payload;
- CORS por allowlist;
- cleanup e expiração;
- saída explícita de sala nas corridas;
- bomba multiplayer idempotente;
- host não destrói a partida ao desconectar;
- NPC fill congelado após início.

## Banco Imobiliário Matemático
Permanece solo/NPC. A extensão online está documentada em:
\`docs/MULTIPLAYER_ARCHITECTURE.md\`.

## Publicação
Não publicar.

## Regressão
Não executar regressão completa.

## Validação
A preencher após o workflow \`Prompt 06 CI\`.
