# RELATÓRIO DE PRÉ-RELEASE — PROMPT 08

## Status

**APROVADO PARA SEGUIR AO PROMPT 09.**

Este checkpoint é exclusivamente de QA pedagógico, balanceamento e endurecimento pré-release.
Não houve deploy nem publicação.

Branch validada:
`feat/prompt-08-qa-balance`

GitHub Actions:
`Prompt 08 CI`

Execução aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37701924080

Commit validado pela CI:
`17d1bcb22f58cac46323ab16936f85522648d5c0`

## 1. Motor matemático

### Auditoria aprovada
A suíte agora gera **1.200 questões por modo** para:
- 5º ano;
- 6º ano;
- 7º ano;
- modo misto.

Total da amostragem automatizada principal: **4.800 questões**.

Validações cobrem:
- resposta oficial válida;
- divisão por zero;
- NaN/Infinity;
- legibilidade básica;
- variedade;
- repetição excessiva;
- cobertura de categorias;
- decimal;
- fração;
- números com sinal;
- vírgula/ponto;
- frações equivalentes;
- equivalência fração/decimal;
- entradas inválidas.

### Correções realizadas
- validação numérica passou a reconhecer equivalência entre fração e decimal;
- dificuldade do 5º ano passou a alterar também a faixa dos decimais;
- dificuldade do 6º ano passou a variar faixas de inteiros, decimais, porcentagens, frações, expressões e operações;
- dificuldade do 7º ano passou a variar faixas de números, frações, porcentagens, razão e expressões;
- questão de razão do 7º ano foi reescrita para remover formulação ambígua.

## 2. Banco Imobiliário Matemático

### Aprovado
- dado de 1 a 6;
- acerto avança o valor do dado;
- erro recua o mesmo valor;
- limite no início;
- penalidade de 200 CP ao não haver casas para recuar;
- compra;
- aluguel sem cobrança duplicada;
- patrimônio e liquidação;
- NPC;
- partida curta;
- venda e melhoria;
- vitória por patrimônio/falência.

### Balanceamento escolar
- partida curta continua com opções de 8, 12 e 16 rodadas;
- **8 rodadas passou a ser o padrão de aula**;
- modo completo foi preservado como opção;
- timer curto da animação do dado agora é limpo ao desmontar a tela.

## 3. Corrida Maluca

### Aprovado
- rodada de 20 s;
- movimento somente após a resolução;
- erro/timeout sem avanço;
- 1 a 6 humanos;
- NPC fill até 6 competidores;
- bomba;
- alvo adjacente;
- cooldown;
- proteção;
- bloqueio da rodada;
- desempate;
- idempotência;
- autoridade do servidor;
- reconexão.

### Correções
- feedback entre rodadas ampliado para aproximadamente 1,6 s;
- resposta correta é exibida após erro no solo;
- no online, a resposta correta só é exposta após o fechamento oficial da rodada;
- desafio de bomba passou a devolver correção após erro;
- resposta duplicada da bomba com o mesmo `clientSubmissionId` tornou-se idempotente.

## 4. Corrida Numérica

### Aprovado
- rodada de 20 s;
- acerto como principal fator de avanço;
- combo;
- bônus de rapidez;
- bônus máximo de 20% do avanço-base;
- erro/timeout quebra sequência;
- 1 a 6 humanos;
- NPC fill;
- estatísticas finais;
- desempate.

### Balanceamento e correção
- combo permanece limitado e não supera a importância do acerto;
- feedback entre rodadas ampliado para aproximadamente 1,6 s;
- resposta correta é exibida após erro no solo;
- online libera a correção somente depois do deadline oficial.

## 5. Futebol Matemático

### Aprovado
- 5 cobranças por lado;
- encerramento antecipado;
- morte súbita;
- PvP;
- NPC;
- placar;
- timeout online de 30 s;
- abandono;
- reconexão;
- revanche;
- estatísticas.

### Balanceamento escolar
- o tempo padrão do modo solo passou de 60 s para **30 s por cobrança**;
- 60 s, 90 s e modo sem cronômetro continuam disponíveis;
- feedback entre cobranças ampliado para aproximadamente 1,6 s;
- correção da resposta após erro/timeout foi preservada.

## 6. Salas, mensagens e segurança

Aprovado:
- código;
- senha com derivação segura;
- nickname;
- host;
- transferência de host;
- reconexão;
- expiração;
- sala cheia;
- bloqueio de entrada após início;
- servidor autoritativo;
- rate limit;
- replay simples;
- `clientSubmissionId`;
- múltiplas mensagens sem duplicar ações críticas;
- tolerância de rede existente.

## 7. Experiência pedagógica

Aprovado/ajustado:
- regras visíveis antes de iniciar;
- questões em área de destaque;
- correção exibida após erro;
- no multiplayer, resposta correta não vaza antes do fim da rodada;
- feedback não desaparece imediatamente;
- progressão de dificuldade agora altera materialmente as amostras;
- sem textos longos novos durante a ação;
- português brasileiro mantido;
- punições continuam ligadas às regras dos jogos, sem feedback humilhante.

## 8. Configuração escolar

Confirmado:
- entrada sem cadastro de conta;
- partidas curtas como padrão onde há configuração;
- reinício rápido;
- sem ranking global persistente;
- sem chat livre;
- sem anúncios;
- sem compras;
- regras simples acessíveis antes da partida.

## 9. Performance e resiliência

### Correções
- criado utilitário para remover timers associados a salas já eliminadas;
- timers órfãos das duas corridas e do futebol são cancelados no ciclo de cleanup;
- timer da animação do dado do Banco Imobiliário possui cleanup no cliente;
- listeners Socket.IO auditados permanecem com `off` no cleanup;
- intervalos de relógio do cliente permanecem cancelados ao desmontar componentes;
- salas continuam sujeitas a TTL/cleanup;
- assets essenciais permanecem locais e leves.

## 10. Validação automatizada do Prompt 08

Workflow aprovado:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37701924080

Etapas aprovadas:
- instalação;
- typecheck;
- auditoria pedagógica do motor matemático;
- testes focados do Banco Imobiliário Matemático;
- testes focados da Corrida Maluca;
- testes focados da Corrida Numérica;
- testes focados do Futebol Matemático;
- testes do núcleo de salas;
- consolidação multiplayer;
- gerenciadores de sala dos três jogos online;
- cleanup de timers;
- contratos de pré-release;
- build.

## 11. Riscos restantes

Estes itens ficam deliberadamente para a regressão definitiva do Prompt 09:
- E2E real em navegadores;
- teste manual em aparelhos móveis reais;
- latência/jitter/perda de conexão em rede real;
- soak test de sessão longa com observação de memória;
- medição de performance de carregamento em ambiente publicado;
- conferência final de assets após empacotamento;
- smoke test do ambiente de publicação;
- playtest presencial com alunos para confirmar duração percebida e dificuldade;
- regressão global conjunta de todos os fluxos.

O modo completo do Banco Imobiliário continua intencionalmente mais longo e não é o padrão de aula.

## 12. Testes obrigatórios no Prompt 09

Executar antes de qualquer publicação:
1. regressão global de todas as suítes;
2. typecheck global;
3. build global;
4. E2E solo dos quatro jogos;
5. E2E multiplayer das duas corridas e do futebol;
6. matriz de 1 a 6 humanos nas corridas;
7. reconexão, host, expiração, duplicidade, replay e deadlines sob atraso de rede;
8. viewport 360x800, 390x844, tablet, 1366x768 e 1920x1080;
9. soak test de timers/listeners/salas;
10. inspeção de bundle e assets;
11. smoke test no ambiente de destino;
12. somente após aprovação, deploy e publicação.

## Deliberação final

O Prompt 08 está encerrado como **pré-release aprovado**.

**Nenhum deploy ou publicação foi realizado.**
A regressão global definitiva e a publicação continuam reservadas ao Prompt 09.
