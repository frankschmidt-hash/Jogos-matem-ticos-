# Relatório Final — Prompt 09 / Release V1

## Status

**APROVADO PARA RELEASE.**

URL pública: https://jogos-matematicos-production.up.railway.app

Branch validada: `feat/prompt-09-release`

Commit validado antes do merge: `83ba0c314fd5440a5ebd4c77bb656c0b55050851`

Release planejada após integração: `v1.0.0`

CI final com smoke na URL publicada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37706901641

## Stack

- Frontend: React 19 + TypeScript + Vite 7.3.7.
- Backend: Fastify 5 + Socket.IO + Zod.
- Testes: Vitest 4.1.11.
- Build/release: Docker multi-stage com Node 22.
- Hospedagem: Railway, serviço único para frontend + API + Socket.IO.
- Persistência V1: memória do processo; não há banco de dados ou migration.

## Serviços utilizados

- GitHub: repositório, branches, pull request, CI e release.
- Railway: um projeto dedicado, um serviço web, um domínio público, sem volume e sem banco.
- Nenhuma API paga é necessária para o funcionamento do jogo.

## Custo esperado

A arquitetura utiliza um único serviço pequeno, com limite de 0,5 vCPU e 0,5 GB e suspensão por inatividade habilitada. Nenhum recurso pago adicional foi criado. A conta Railway está no fluxo de crédito gratuito/trial; o consumo real depende do tempo de atividade e deve ser acompanhado no painel da Railway.

## Variáveis de ambiente

Produção:
- `NODE_ENV=production`
- `SERVE_WEB=true`
- `WEB_ORIGIN=*`
- `SESSION_RECONNECT_GRACE_MS=30000`
- `SESSION_TTL_MS=90000`
- `PORT` é fornecida pela Railway.

No desenvolvimento local, consulte `.env.example`. O frontend usa `VITE_API_URL=http://localhost:3001`; em produção, por padrão usa a mesma origem do site.

## Execução local

1. Instale Node 22.
2. Execute `npm install --legacy-peer-deps`.
3. Em desenvolvimento, execute `npm run dev`.
4. Para validar o release: `npm run release:check`.
5. Para simular produção: `npm run build` e depois `NODE_ENV=production SERVE_WEB=true npm start`.

## Deploy/redeploy

O serviço Railway está conectado ao repositório GitHub. A fonte definitiva da produção é a branch `main`. Um novo push aprovado em `main` pode gerar novo deploy; o healthcheck obrigatório é `/health`.

A imagem de produção também pode ser reconstruída pelo `Dockerfile`. O build executa auditoria, typecheck, regressão, build, auditoria de segredos e auditoria das dependências de runtime.

## Resultados dos testes

Gate final:
- instalação: passou;
- auditoria de dependências: passou;
- typecheck global: passou;
- regressão global: passou;
- build de produção: passou;
- auditoria de segredos/source maps: passou;
- smoke local da topologia de produção: passou;
- smoke da URL pública: passou.

O smoke público valida:
- home e rotas principais;
- CSP/header de segurança;
- criação de sessão;
- rejeição de nickname duplicado;
- Socket.IO;
- criação e entrada de segundo jogador;
- Corrida Maluca online com 6 competidores e rodada de 20 s;
- Corrida Numérica online com 6 competidores, rodada de 20 s e reconexão;
- Futebol Matemático PvP com dois humanos e deadline de cobrança.

O motor matemático mantém a auditoria de 1.200 questões por nível/modo, incluindo 5º, 6º, 7º e misto.

## Segurança final

- Payloads Socket.IO validados com Zod.
- Autoridade de estado permanece no servidor nos modos multiplayer.
- Rate limit de ações/senha já existente e rate limit adicional no claim de nickname.
- Proteção contra replay/duplicidade mantida.
- Comparação segura de senha de sala mantida.
- Fastify Helmet/CSP habilitados.
- Auditoria de segredos integrada ao release.
- Build Docker final: 0 vulnerabilidades conhecidas antes do build e 0 vulnerabilidades nas dependências de runtime após o prune.
- Source maps públicos não são habilitados.

## Performance e assets

O frontend separa os bundles React e Socket.IO. No build final:
- CSS: ~41 kB;
- bundle principal: ~183 kB;
- Socket.IO vendor: ~48 kB;
- React vendor: ~468 kB.

Todos ficam abaixo do limite de alerta de 500 kB individualmente.

## Limitações conhecidas da V1

1. Salas e sessões são mantidas em memória. Reinício, novo deploy ou suspensão completa do container descarta salas ativas; os estudantes precisarão criar/entrar novamente.
2. O modelo em memória pressupõe uma única réplica. Escala horizontal exigirá armazenamento compartilhado/adapter Socket.IO.
3. Não há contas permanentes, histórico persistente ou painel analítico do professor.
4. O CI cobre contratos responsivos e o build do frontend, mas a inspeção visual em dispositivos físicos específicos continua sendo uma validação de uso real recomendada.
5. Cenários extremos de jitter/perda de rede e soak prolongado devem continuar sendo observados em uso real; há reconexão, TTL e limpeza de timers implementados.

## Sugestões para V2

- Persistência gratuita/baixo custo para salas/sessões caso seja necessário sobreviver a reinícios.
- Painel do professor com criação de turma, códigos e resultados agregados.
- Relatórios pedagógicos por habilidade/nível.
- Testes browser E2E com Playwright em matriz mobile/tablet/desktop.
- Telemetria opt-in e sem dados pessoais.
- PWA/offline para modos solo.
