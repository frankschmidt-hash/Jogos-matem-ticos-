# CHECKPOINT 03 — Corrida Maluca

## Status
**IMPLEMENTADO E VALIDADO**

Branch:
`feat/prompt-03-crazy-race`

## Núcleo da corrida
Criado o pacote `@jogos/crazy-race`.

Implementado:
- 6 competidores fixos por corrida;
- 1 a 6 humanos;
- NPCs preenchem automaticamente as vagas restantes;
- humanos substituem NPCs;
- pista com progresso numérico;
- linha de chegada;
- checkpoints;
- ranking;
- registro de ultrapassagens;
- vitória e desempate.

## Rodadas matemáticas
- cada rodada dura exatamente 20 segundos;
- resposta pode ser enviada durante a janela;
- o movimento só é aplicado ao encerrar os 20 segundos;
- acerto: carro avança;
- erro: não avança;
- timeout: não avança;
- respostas duplicadas são rejeitadas;
- dificuldade progride por rodadas;
- motor matemático compartilhado do Prompt 01 foi preservado.

## NPCs
Perfis:
- beginner;
- intermediate;
- advanced.

Cada perfil possui:
- chance de acerto própria;
- tempo de reação simulado;
- resposta nunca instantânea;
- integração com rodadas e bombas.

## Bomba matemática
Implementado:
- cargas limitadas;
- obtenção por checkpoints e sequência de acertos;
- alvo imediatamente à frente;
- alvo imediatamente atrás;
- questão matemática adicional;
- acerto neutraliza;
- erro/timeout bloqueia avanço da rodada;
- cooldown;
- proteção breve após ataque;
- bloqueio de spam;
- registro no histórico;
- NPC pode resolver desafio segundo seu perfil.

## Modo solo
- jogador humano + 5 NPCs;
- 20 segundos por rodada;
- pergunta do nível escolhido no lobby;
- HUD;
- pista de seis faixas;
- ranking;
- bombas;
- histórico;
- tela final;
- nova corrida.

## Multiplayer provisório
Implementação específica desta Corrida Maluca, sem substituir a consolidação planejada do Prompt 06.

Fluxos:
- criar sala;
- código curto de 6 caracteres;
- senha da sala;
- entrar por código + senha;
- até 6 humanos;
- vagas restantes preenchidas com NPCs;
- somente host inicia;
- reconexão básica preservando o mesmo membro;
- status de conexão.

## Autoridade do servidor
No multiplayer, o backend controla:
- geração/seleção da questão;
- início da rodada;
- deadline;
- validação da resposta;
- submissão única;
- movimento;
- NPCs;
- bomba;
- desafio de bomba;
- cooldown;
- proteção;
- ranking;
- vitória;
- passagem para a próxima rodada.

O cliente não envia posição, avanço, vitória ou resultado de acerto como fato.

## Senha
A senha não é armazenada em texto puro:
- salt aleatório;
- derivação com `scrypt`;
- comparação segura.

## Reconexão
- sala é lembrada temporariamente no navegador;
- reconexão usa sessionId + reconnectToken;
- não duplica jogador;
- servidor restaura snapshot da sala;
- bomba pendente pode ser recuperada.

## UI
Implementado:
- posição;
- progresso;
- rodada;
- cronômetro;
- questão;
- carro do jogador destacado;
- 5 adversários no modo solo;
- participantes online;
- bombas disponíveis;
- alvos frente/atrás;
- cooldown;
- conexão;
- histórico de ultrapassagens e eventos;
- tela de espera da sala;
- tela final.

## Assets originais
- `race-emblem.svg`;
- `math-bomb.svg`;
- `finish-flag.svg`;
- pista e carros por CSS com identidade própria.

## Validação focada

Workflow:
`Prompt 03 CI`

Execução aprovada inicial:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37694669052

Resultados:
- instalação: passou;
- typecheck: passou;
- **18/18 testes do motor Corrida Maluca: passaram**;
- **9/9 testes focados das salas em tempo real: passaram**;
- **4/4 testes do motor matemático: passaram**;
- build completo: passou.

Testes cobrem:
- 20 segundos;
- acerto;
- erro;
- timeout;
- 6 participantes;
- substituição NPC por humano;
- alvo à frente;
- alvo atrás;
- bomba correta;
- bomba errada;
- cooldown;
- proteção;
- reação não instantânea de NPC;
- chegada;
- empate e rodada extra;
- resposta duplicada;
- criação/entrada de sala;
- senha;
- lotação;
- host;
- deadline servidor-autoritativo;
- idempotência;
- reconexão;
- passagem de rodada.

## Deliberações
- a infraestrutura online criada aqui é específica da Corrida Maluca;
- a consolidação/reutilização geral de salas continua reservada ao Prompt 06;
- não foi executada regressão global;
- não houve deploy;
- não houve publicação.

## Próximo ponto
O Prompt 04 deve preservar:
- toda a fundação dos Prompts 01–03;
- Cidade Prisma;
- pacote `@jogos/crazy-race`;
- eventos Socket.IO da Corrida Maluca;
- rota `/game/crazy-race`;
- assets e estilos da corrida;
- motor matemático compartilhado.

A próxima implementação é a **Corrida Numérica**.
