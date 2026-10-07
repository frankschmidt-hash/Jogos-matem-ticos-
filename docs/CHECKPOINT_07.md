# CHECKPOINT 07 — UI/UX, Arte, Áudio, Responsividade e Acessibilidade

## Status
**IMPLEMENTAÇÃO CONCLUÍDA — aguardando validação focada do CI**

Branch:
\`feat/prompt-07-ui-ux-a11y\`

## Escopo
A camada visual e de experiência foi elevada sem alterar regras fundamentais dos quatro jogos.

## Portal e lobby
- identidade visual unificada;
- página de entrada redesenhada;
- arte SVG original;
- nickname e série com instruções;
- loading e erro;
- estado de reconexão/offline;
- cards responsivos por jogo;
- hover/focus/touch;
- ajuda;
- skip link de teclado.

## Identidade por jogo
### Banco Imobiliário Matemático
- Cidade Prisma preservada;
- tabuleiro com scroll/pan;
- dado, peão e carta SVG originais;
- moeda existente preservada;
- painéis refinados;
- feedback de foco/hover no tabuleiro.

### Corrida Maluca
- pista e carros preservados/refinados;
- partículas/linhas de velocidade;
- trail do carro do jogador;
- bomba e bloqueio com feedback textual;
- HUD móvel otimizado.

### Corrida Numérica
- veículos distintos preservados;
- pista numérica;
- portais com glow;
- feedback de combo/progresso;
- HUD móvel otimizado.

### Futebol Matemático
- estádio, gramado, gol, goleiro, cobrador e bola preservados/refinados;
- placar responsivo;
- efeitos de gol/defesa;
- dimensões específicas para 360–420 px;
- overflow contido.

## Áudio
Sistema procedural original via Web Audio:
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

Regras:
- só é armado após gesto do usuário;
- volume padrão baixo (0,14);
- mute persistente;
- informação essencial permanece textual;
- nenhum arquivo ou serviço externo de áudio.

## Acessibilidade
- foco visível;
- skip link;
- ARIA em modal/feedback/conexão;
- feedback com símbolo + texto;
- contraste reforçado;
- touch targets mínimos;
- inputMode decimal;
- opção manual de reduzir animação;
- preferência do sistema respeitada;
- sem flashes intensos;
- modais com max-height/overflow.

## Responsividade
Contratos implementados para:
- 360x800;
- 390x844;
- tablet;
- 1366x768;
- 1920x1080.

## Assets
Assets SVG originais permanecem funcionais sem rede.
Prompts finais de arte documentados em:
\`docs/ART_PROMPTS_FINAL.md\`.

## Testes
A preencher após workflow \`Prompt 07 CI\`.

## Restrições
- não executar regressão completa;
- não publicar.
