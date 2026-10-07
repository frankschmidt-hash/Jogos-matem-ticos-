# CHECKPOINT 06 — Multiplayer, Salas, Tempo Real e Segurança

## Status
**IMPLEMENTADO E VALIDADO**

Branch:
\`feat/prompt-06-multiplayer-core\`

## Objetivo cumprido
As implementações temporárias de multiplayer foram consolidadas em uma infraestrutura única, segura e reutilizável para:
- Corrida Maluca;
- Corrida Numérica;
- Futebol Matemático.

O Banco Imobiliário Matemático permanece solo/NPC nesta versão porque sua arquitetura atual de dinheiro, propriedade e turnos ainda não possui contrato servidor-autoritativo compatível com a consolidação sem ampliar o risco de regressão. A extensão foi documentada em \`docs/MULTIPLAYER_ARCHITECTURE.md\`.

## Núcleo compartilhado
Arquivo:
\`apps/server/src/room-infrastructure.ts\`

Responsabilidades consolidadas:
- geração de código curto;
- reserva global de códigos entre jogos ativos;
- prevenção de colisão/reuso de sala ativa;
- senha com scrypt + salt;
- comparação segura;
- rate limit de tentativa de senha;
- presença;
- janela de reconexão;
- transferência determinística de host;
- capacidade/vagas;
- máquina de estados;
- rate limit de ações;
- idempotência;
- proteção simples contra replay;
- normalização/sanitização do código;
- cleanup dos controles de segurança.

## Máquina de estados
Estados disponíveis:
1. waiting;
2. ready;
3. countdown;
4. playing;
5. round-resolution;
6. finished;
7. closed.

Cada jogo mantém seus subestados internos próprios.

## Presença
Estados:
- connected;
- reconnecting;
- disconnected;
- abandoned.

A vaga é preservada durante a janela de reconexão.

Antes da partida:
- abandono remove a vaga;
- se o host abandonar, a liderança passa de forma determinística ao próximo membro elegível;
- se ninguém permanecer, a sala é encerrada e o código liberado.

Durante a partida:
- desconexão do host não destrói a sessão;
- os demais continuam;
- host pode ser transferido sem alterar o estado competitivo;
- corrida não substitui humano por NPC depois da largada.

## Sistema de salas
Fluxo consolidado:
- criar sala;
- receber código de 6 caracteres;
- definir senha;
- copiar código;
- entrar por código + senha;
- mostrar jogadores;
- mostrar presença;
- mostrar vagas ocupadas/disponíveis;
- somente host inicia quando a sala atende os requisitos;
- entrada é bloqueada após início incompatível.

## Segurança
Implementado:
- Zod/schema validation;
- limite de payload HTTP de 16 KiB;
- limite Socket.IO de 16 KiB;
- CORS por allowlist configurável;
- senha nunca retornada em snapshot;
- hash nunca retornado ao cliente;
- rate limit de senha;
- rate limit de ações competitivas;
- idempotência por clientSubmissionId;
- proteção contra replay simples;
- código normalizado;
- tratamento de erro sem diferenciar código/senha inválidos;
- cleanup periódico;
- expiração de sala;
- saída explícita de sala.

## Servidor autoritativo
Permanece obrigatório para:
- início/deadline;
- questão;
- validação;
- movimento;
- posição;
- bomba;
- cooldown;
- placar;
- gol;
- turno;
- resultado final.

O cliente não toma decisões competitivas.

## Sincronização de tempo
Snapshots transmitem:
- serverNow;
- início da rodada/cobrança;
- deadline.

O relógio visual do cliente usa o deslocamento em relação ao horário recebido do servidor.

Tolerância de rede:
- máximo de 250 ms;
- ações dentro da tolerância são registradas no máximo no deadline oficial;
- ações além da tolerância são rejeitadas.

## Corridas e NPC fill
Ao iniciar Corrida Maluca ou Corrida Numérica:
- humanos conectados ocupam as vagas;
- NPCs completam até 6 competidores;
- após a largada a composição fica congelada;
- desconexão/reconexão não cria substituição inconsistente.

## Bomba multiplayer
Corrida Maluca:
- ação de bomba recebe clientSubmissionId;
- resposta à bomba recebe clientSubmissionId;
- reenvio da mesma ação não consome segunda bomba;
- questão/target/deadline permanecem servidor-autoritativos.

## Futebol PvP
- sala de dois jogadores;
- host inicia somente quando ambos estão conectados;
- placar e vez permanecem no servidor;
- abandono após início encerra a partida a favor do adversário;
- revanche continua disponível após encerramento normal com os dois jogadores presentes.

## Validação focada

Workflow:
\`Prompt 06 CI\`

Execução final aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37698848763

Resultados:
- instalação: passou;
- typecheck: passou;
- **8/8 testes do núcleo compartilhado: passaram**;
- **13/13 testes de consolidação multiplayer/segurança: passaram**;
- **32/32 testes focados anteriores de salas/sessão: passaram**;
- **53/53 testes focados do servidor no total: passaram**;
- build completo: passou.

Cobertura focada:
- duas abas da mesma sessão;
- dois navegadores/sessões simulados;
- mesmo nickname;
- sala correta;
- senha errada;
- rate limit;
- host disconnect;
- transferência de host;
- player disconnect/reconnect;
- timeout;
- tolerância de rede;
- mensagem duplicada;
- resposta duplicada;
- payload inválido;
- corrida com múltiplos humanos;
- NPC fill;
- futebol PvP;
- bomba multiplayer;
- replay;
- expiração da sala;
- máquina de estados.

## Deliberações
- Banco Imobiliário Matemático não foi convertido para online neste prompt;
- não houve regressão completa;
- não houve deploy;
- não houve publicação.

## Próximo ponto
O próximo prompt deve preservar:
- fundação dos Prompts 01–06;
- multiplayer consolidado;
- núcleo de salas compartilhado;
- segurança e idempotência;
- regras específicas dos quatro jogos;
- checkpoints e testes focados existentes.
