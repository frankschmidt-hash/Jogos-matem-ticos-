# CHECKPOINT 05 — Futebol Matemático

## Status
**IMPLEMENTADO E VALIDADO**

Branch:
\`feat/prompt-05-math-football\`

## Objetivo cumprido
Foi criado o Futebol Matemático como uma disputa de pênaltis em que a resolução da questão define o resultado da cobrança.

## Regras da disputa
- cada lado começa com 5 cobranças;
- acerto matemático = gol;
- erro matemático = defesa;
- alternância clara entre cobradores;
- encerramento antecipado quando um jogador não pode mais alcançar o adversário;
- empate após cinco cobranças por lado entra em morte súbita;
- na morte súbita, a decisão só ocorre depois de ambos cobrarem na mesma rodada.

## Modo solo
- jogador contra NPC;
- NPC fácil, médio ou difícil;
- desempenho do NPC deriva de probabilidade de acerto matemático coerente com o nível;
- tempo pedagógico configurável;
- padrão de 60 segundos;
- opção de 90 segundos;
- opção sem cronômetro;
- cronômetro é exibido apenas quando está ativo.

## Multiplayer
- jogador contra jogador;
- criação de sala;
- código de 6 caracteres;
- senha de 4 a 32 caracteres, seguindo o padrão atual do projeto;
- sala limitada a dois jogadores;
- somente o host inicia;
- nível da sala definido pelo host;
- servidor controla ordem, questão, validação, prazo, placar, cobranças e desempate;
- o cliente não declara gol sozinho;
- resposta correta da questão atual não é enviada ao cliente antes da resolução.

## Timeout, abandono e reconexão
- limite online de 30 segundos por cobrança;
- timeout = erro/defesa;
- reconexão preserva o jogador na sala;
- desconexão possui janela de reconexão antes de abandono definitivo;
- abandono encerra a partida a favor do adversário;
- cronômetro e transições são controlados no servidor.

## Feedback pedagógico
- feedback de correto/incorreto;
- em erro ou timeout, a resposta correta é mostrada após a resolução;
- animações distintas de gol e defesa;
- sem feedback visual humilhante;
- ritmo curto entre cobranças.

## Tela final
Exibe:
- vencedor;
- placar;
- acertos;
- erros;
- aproveitamento;
- revanche;
- retorno ao lobby.

## Visual
Implementado com arte original:
- estádio estilizado;
- gol e rede;
- goleiro;
- cobrador;
- bola;
- placar de cobranças;
- iluminação;
- torcida abstrata;
- animação de chute/gol;
- animação de defesa;
- troféu final;
- responsividade mobile.

Assets:
- \`apps/web/public/assets/math-football/football-emblem.svg\`;
- \`apps/web/public/assets/math-football/football-trophy.svg\`.

Direção de arte:
- \`docs/ART_DIRECTION_MATH_FOOTBALL.md\`.

## Validação focada

Workflow:
\`Prompt 05 CI\`

Execução aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37697120801

Resultados:
- instalação: passou;
- typecheck: passou;
- **11/11 testes do motor Futebol Matemático: passaram**;
- **9/9 testes do gerenciador de sala online: passaram**;
- **4/4 testes de compatibilidade do motor matemático: passaram**;
- build completo: passou.

Cobertura focada:
- cinco cobranças iniciais;
- gol por acerto;
- defesa por erro;
- alternância;
- encerramento antecipado;
- empate;
- morte súbita;
- timeout online;
- NPC fácil/médio/difícil;
- estatísticas;
- abandono;
- criação/entrada de sala;
- senha;
- lotação;
- permissão do host;
- questão e deadline servidor-autoritativos;
- vez do cobrador;
- reconexão;
- revanche.

## Deliberações
- não houve regressão global;
- não houve deploy;
- não houve publicação.

## Próximo ponto
O Prompt 06 deve preservar:
- fundação dos Prompts 01–05;
- Banco Imobiliário Matemático;
- Corrida Maluca;
- Corrida Numérica;
- Futebol Matemático;
- motor matemático;
- sessões/nickname;
- infraestrutura provisória de salas;
- assets e rotas existentes.
