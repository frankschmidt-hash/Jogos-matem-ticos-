# CHECKPOINT 07 — UI/UX, Arte, Áudio, Responsividade e Acessibilidade

## Status
**IMPLEMENTADO E VALIDADO**

Branch:
\`feat/prompt-07-ui-ux-a11y\`

## Objetivo cumprido
A qualidade visual e de uso dos quatro jogos foi elevada sem alterar suas regras fundamentais.

## Portal e lobby
- identidade visual unificada, colorida e moderna;
- linguagem escolar sem infantilização excessiva;
- página de entrada redesenhada;
- arte SVG original;
- nickname com orientação de privacidade;
- seletor de nível;
- loading com estado textual;
- erro acessível;
- offline/reconexão;
- lobby com cards individuais por jogo;
- hover/focus/touch;
- ajuda;
- skip link de teclado;
- fallback visual de card se um asset não carregar.

## Identidade visual por jogo

### Banco Imobiliário Matemático — Cidade Prisma
- tabuleiro e casas preservados/refinados;
- propriedades e grupos com contraste visual;
- Créditos Prisma;
- dado estilizado;
- peão SVG original;
- carta/evento SVG original;
- painéis de saldo, jogadores e propriedades;
- tabuleiro com scroll/pan para telas estreitas;
- foco/hover de casas;
- controles touch ampliados.

Assets novos:
- \`dado-prisma.svg\`;
- \`peao-prisma.svg\`;
- \`carta-prisma.svg\`.

### Corrida Maluca
- carros e pista refinados;
- HUD responsivo;
- bomba matemática preservada;
- linhas/partículas de velocidade;
- trail visual do veículo do jogador;
- feedback textual de bloqueio;
- campos e botões ampliados para touch.

### Corrida Numérica
- veículos distintos;
- pista numérica;
- portais/checkpoints com brilho;
- combo/progresso reforçados;
- HUD responsivo;
- trail do veículo do jogador;
- campos touch ampliados.

### Futebol Matemático
- estádio e gramado refinados;
- gol/rede;
- goleiro;
- cobrador;
- bola;
- torcida abstrata;
- placar de pênaltis;
- animações de gol e defesa;
- dimensões específicas para mobile;
- estádio com overflow contido.

## Áudio opcional
Implementado em:
\`apps/web/src/experience.tsx\`

Sistema procedural original com Web Audio:
- ambiente leve;
- clique;
- dado;
- motor;
- acerto;
- erro;
- gol;
- defesa;
- compra;
- vitória.

Regras cumpridas:
- contexto de áudio é armado somente após gesto do usuário;
- volume padrão baixo: 0,14;
- mute persistente em localStorage;
- nenhuma informação essencial depende do áudio;
- nenhum áudio externo ou de terceiros;
- funcionamento não depende de arquivos sonoros remotos.

## Preferências de experiência
Toolbar global:
- ligar/desligar som;
- reduzir animações.

A redução de movimento:
- respeita \`prefers-reduced-motion\`;
- pode ser ativada manualmente;
- remove animações/transições relevantes sem eliminar conteúdo.

## Acessibilidade
- foco visível de alto contraste;
- navegação de teclado;
- skip link;
- ARIA em modal, conexão e feedback;
- modal com foco inicial;
- feedback de acerto/erro/timeout com símbolo + texto;
- estados de conexão em texto;
- contraste reforçado;
- inputMode decimal;
- touch target mínimo global;
- não depender apenas de cor;
- sem flashes intensos;
- animações curtas;
- modais com altura máxima e scroll.

## Responsividade
Contratos implementados e validados por código para:
- 360x800;
- 390x844;
- tablet;
- 1366x768;
- 1920x1080.

Garantias:
- botões grandes;
- teclado numérico;
- modal sem corte;
- tabuleiro navegável;
- HUD de corrida legível;
- nomes longos com ellipsis no mobile;
- estádio sem overflow.

## Assets e resiliência
- assets essenciais são SVG locais;
- card do lobby possui fallback se imagem falhar;
- nenhum CSS ou sistema de áudio depende de URL externa;
- prompts finais para produção futura documentados em \`docs/ART_PROMPTS_FINAL.md\`.

## Validação focada

Workflow:
\`Prompt 07 CI\`

Execução aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37700008879

Resultados:
- instalação: passou;
- typecheck: passou;
- **12/12 contratos focados de UI/UX/acessibilidade: passaram**;
- **13/13 cenários focados de compatibilidade multiplayer: passaram**;
- build completo: passou.

Contratos verificados:
- portal/lobby e fallback de asset;
- mobile 360/390;
- desktop amplo;
- touch targets;
- teclado numérico;
- foco visível;
- skip link;
- redução de movimento;
- modal matemático;
- overflow;
- tabuleiro navegável;
- HUDs de corrida;
- estádio mobile;
- assets ausentes/fallback;
- áudio mutado;
- volume padrão;
- ausência de mídia remota;
- reconexão visível;
- feedback textual.

## Deliberações
- não houve regressão completa;
- não houve deploy;
- não houve publicação.

## Próximo ponto
O próximo prompt deve preservar:
- fundação dos Prompts 01–07;
- identidade visual comum;
- identidades próprias dos quatro jogos;
- áudio opcional;
- preferências de movimento;
- acessibilidade;
- responsividade;
- multiplayer consolidado do Prompt 06;
- regras fundamentais dos jogos.
