# CHECKPOINT 08 — QA PEDAGÓGICO, BALANCEAMENTO E REGRESSÃO FOCADA

## Status

**IMPLEMENTADO E VALIDADO**

Branch:
`feat/prompt-08-qa-balance`

Workflow:
`Prompt 08 CI`

Execução aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37701924080

Commit validado:
`17d1bcb22f58cac46323ab16936f85522648d5c0`

## Entregas principais

- auditoria de 4.800 questões no motor matemático;
- modo misto incluído na amostragem;
- equivalência fração/decimal corrigida;
- escalonamento real de dificuldade ampliado;
- razão do 7º ano reescrita;
- Banco Imobiliário com 8 rodadas como padrão escolar;
- Futebol solo com 30 s como padrão;
- feedback pedagógico ampliado para cerca de 1,6 s;
- resposta correta exibida após erro;
- correção online liberada somente depois do deadline;
- resposta de bomba duplicada tornada idempotente;
- cleanup de timers de salas órfãs;
- cleanup do timer curto do dado;
- contratos automatizados de pré-release;
- CI dedicada do Prompt 08;
- build aprovado.

## Preservado

- quatro jogos;
- regras fundamentais;
- motor matemático compartilhado;
- sessões sem cadastro;
- nickname;
- multiplayer consolidado;
- servidor autoritativo;
- segurança de salas;
- áudio opcional;
- acessibilidade;
- responsividade;
- ausência de ranking persistente;
- ausência de chat livre;
- ausência de anúncios e compras.

## Riscos transferidos ao Prompt 09

- regressão global definitiva;
- E2E em navegador;
- matriz real de dispositivos;
- rede com latência/jitter;
- soak/memória de longa duração;
- medição de carregamento em ambiente publicado;
- smoke test de release;
- playtest presencial.

## Regra para continuidade

O Prompt 09 deve partir deste checkpoint sem refazer as correções validadas aqui.

Não publicar antes de concluir a regressão global definitiva e os gates finais do Prompt 09.

## Publicação

**NÃO REALIZADA.**

Esta etapa respeitou a separação entre QA pré-release e deploy final.
