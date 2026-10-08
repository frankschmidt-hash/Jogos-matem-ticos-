# CHECKPOINT 09 — Integração Final, Release e Publicação

## Estado

Prompt 09 implementado e validado.

URL publicada:
https://jogos-matematicos-production.up.railway.app

CI final:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37706901641

Commit validado pré-merge:
`83ba0c314fd5440a5ebd4c77bb656c0b55050851`

## Gates aprovados

- regressão global;
- typecheck global;
- auditoria de dependências;
- build de produção;
- auditoria de segredos;
- smoke E2E local;
- smoke E2E na URL pública;
- healthcheck Railway;
- multiplayer real via Socket.IO na URL pública;
- headers/CSP;
- runtime Docker sem vulnerabilidades conhecidas.

## Infraestrutura

Railway:
- projeto: Jogos Matemáticos;
- serviço: jogos-matematicos;
- domínio: jogos-matematicos-production.up.railway.app;
- 0,5 vCPU / 0,5 GB;
- sleep por inatividade habilitado;
- sem banco e sem volume.

## Continuação

Após este checkpoint, alterações devem partir de `main` e ser tratadas como V1.x/V2. Não refazer os Prompts 01–09 sem uma regressão que demonstre necessidade.
