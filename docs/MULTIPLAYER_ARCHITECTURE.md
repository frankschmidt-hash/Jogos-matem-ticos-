# Infraestrutura multiplayer consolidada — Prompt 06

## Escopo
A infraestrutura comum atende:
- Corrida Maluca;
- Corrida Numérica;
- Futebol Matemático.

O Banco Imobiliário Matemático permanece em modo solo/NPC nesta versão. Sua lógica atual não possui contrato de sala/turno online compatível com a consolidação sem ampliar o risco de regressão. A extensão futura deve reutilizar o mesmo núcleo de sala antes de adicionar transações multiplayer.

## Núcleo comum
Arquivo:
\`apps/server/src/room-infrastructure.ts\`

Responsabilidades:
- geração de código curto globalmente único entre jogos ativos;
- hash de senha com scrypt e salt aleatório;
- comparação segura;
- rate limit de tentativas de senha;
- estado de presença;
- janela de reconexão;
- transferência determinística de host;
- capacidade/vagas;
- máquina de estados de sala;
- rate limit de ações;
- idempotência e proteção simples contra replay;
- normalização de código;
- cleanup de caches de segurança.

## Máquina de estados
Estados disponíveis:
1. \`waiting\`
2. \`ready\`
3. \`countdown\`
4. \`playing\`
5. \`round-resolution\`
6. \`finished\`
7. \`closed\`

Os motores dos jogos continuam com seus subestados próprios.

## Presença
Estados:
- \`connected\`;
- \`reconnecting\`;
- \`disconnected\`;
- \`abandoned\`.

A vaga é preservada durante a janela de reconexão. Antes da partida, um host abandonado é removido e a liderança passa deterministicamente ao membro elegível mais antigo. Durante a partida, a perda do host não destrói a sessão dos demais.

## Tempo
O servidor mantém autoridade sobre:
- início;
- deadline;
- validação;
- movimento;
- bombas/cooldowns;
- placar/gol;
- resultado.

Snapshots incluem \`serverNow\`, início e deadline. O cliente deriva o relógio visual a partir do deslocamento em relação ao relógio do servidor. Há tolerância máxima de 250 ms para atraso de rede; a ação competitiva é registrada no máximo no deadline oficial.

## Segurança
- Zod em payloads;
- limite de 16 KiB para HTTP e Socket.IO;
- CORS por lista de origens configuradas;
- senha nunca retornada em snapshots;
- códigos normalizados;
- limite de tentativas;
- idempotência em respostas e bombas;
- proteção contra replay simples;
- mensagens de autenticação de sala sem distinguir código/senha;
- cleanup periódico.

## Corridas
Ao iniciar:
- humanos conectados ocupam vagas;
- NPCs completam até 6;
- depois da largada, abandono/reconexão não substitui participantes por NPC de forma inconsistente.

## Banco Imobiliário Matemático
Não integrado online no Prompt 06. Extensão recomendada:
1. separar transações/turnos do estado local;
2. tornar dinheiro, propriedade, turno e compra servidor-autoritativos;
3. implementar snapshot de recuperação;
4. conectar ao núcleo comum de salas;
5. adicionar testes de concorrência de compra/turno.
