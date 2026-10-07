# CHECKPOINT 04 — Corrida Numérica

## Status
**IMPLEMENTADO E VALIDADO**

Branch:
`feat/prompt-04-number-race`

## Objetivo cumprido
Criada uma corrida matemática competitiva mais limpa e pedagógica que a Corrida Maluca.

A Corrida Numérica:
- NÃO possui bomba matemática;
- NÃO possui item de ataque;
- NÃO possui bloqueio ofensivo;
- baseia progressão principalmente em acertos;
- usa rapidez apenas como bônus secundário e limitado.

## Participantes
- 6 competidores por corrida;
- 1 a 6 humanos;
- humanos substituem NPCs;
- vagas restantes são completadas por NPCs.

## Modos
Implementados:
- jogar contra 5 NPCs;
- criar sala;
- entrar por código + senha.

## Rodadas
- 20 segundos;
- pergunta matemática;
- resposta única;
- acerto: avanço;
- erro: zero avanço;
- timeout: zero avanço;
- movimento aplicado após a resolução da rodada;
- dificuldade cresce progressivamente.

## Impulso numérico
Balanceamento implementado:
- avanço-base por acerto: 100;
- resposta rápida até 10 s: bônus leve;
- resposta muito rápida até 5 s: bônus levemente maior;
- 3 acertos seguidos: bônus de combo;
- 5 ou mais acertos: bônus moderado;
- bônus total máximo: 20;
- bônus máximo equivale a apenas 20% do avanço-base;
- erro ou timeout zera a sequência.

Assim, acertar continua sendo muito mais importante que responder rapidamente.

## Justiça pedagógica
### Solo
Usa o nível selecionado na entrada:
- 5º ano;
- 6º ano;
- 7º ano;
- misto.

### Sala privada
- host escolhe o nível antes de criar a sala;
- nível pertence à sala inteira;
- todos recebem questão equivalente da mesma regra de nível;
- nível não pode ser alterado após a largada;
- questão, resposta e deadline são servidor-autoritativos.

## NPCs
Perfis:
- beginner;
- intermediate;
- advanced.

Simulam:
- chance de acerto;
- tempo de resposta;
- variação controlada;
- nenhuma resposta instantânea.

Não existem itens ou ataques para NPCs.

## Vitória
Ordem de resolução:
1. progresso;
2. mais respostas corretas;
3. menor tempo acumulado entre respostas corretas;
4. rodada extra quando permanece empate exato.

## Estatísticas finais
Exibidas para os participantes:
- posição final;
- acertos;
- erros;
- aproveitamento;
- melhor sequência;
- tempo médio das respostas corretas.

Nenhum ranking global persistente foi criado.

## Multiplayer provisório
Implementação específica da Corrida Numérica:
- código de 6 caracteres;
- senha;
- até 6 humanos;
- preenchimento por NPCs;
- somente host inicia;
- reconexão básica;
- status de conexão;
- servidor controla a passagem das rodadas.

A consolidação geral das salas permanece reservada ao Prompt 06.

## Segurança da sala
- senha não armazenada em texto puro;
- salt aleatório;
- derivação com scrypt;
- comparação segura;
- resposta duplicada rejeitada;
- clientSubmissionId idempotente;
- resposta após deadline rejeitada.

## UI
- pista própria;
- portais matemáticos;
- seis faixas;
- HUD;
- posição;
- progresso;
- combo;
- melhor sequência;
- cronômetro;
- questão;
- painel de impulso;
- lobby de sala;
- status de conexão;
- estatísticas finais;
- responsividade.

## Assets originais
- `number-emblem.svg`;
- `boost.svg`;
- `number-trophy.svg`;
- pista e carros construídos por CSS.

## Validação focada

Workflow:
`Prompt 04 CI`

Execução inicial aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37695742597

Resultados:
- instalação: passou;
- typecheck: passou;
- **16/16 testes do motor Corrida Numérica: passaram**;
- **10/10 testes das salas em tempo real: passaram**;
- **4/4 testes do motor matemático: passaram**;
- build completo: passou.

Testes cobrem:
- cronômetro;
- acerto;
- erro;
- timeout;
- combo de 3;
- combo de 5;
- quebra de combo;
- bônus de rapidez;
- limite de bônus;
- 6 participantes;
- substituição de NPC;
- perfis NPC;
- preenchimento de respostas NPC;
- vitória;
- empate;
- estatísticas;
- criação/entrada de sala;
- nível escolhido pelo host;
- senha;
- lotação;
- host;
- deadline servidor-autoritativo;
- idempotência;
- reconexão;
- passagem de rodada.

## Deliberações
- não foi criado ranking global;
- não houve regressão global;
- não houve deploy;
- não houve publicação.

## Próximo ponto
O Prompt 05 deve preservar:
- fundação dos Prompts 01–04;
- Banco Imobiliário Matemático;
- Corrida Maluca;
- Corrida Numérica;
- motor matemático;
- sessões/nickname;
- infraestrutura provisória de salas;
- assets e rotas existentes.

A próxima implementação é o **Futebol Matemático**.
