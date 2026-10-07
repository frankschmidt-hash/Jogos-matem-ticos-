# CHECKPOINT 02 — Banco Imobiliário Matemático

## Status
**IMPLEMENTADO E VALIDADO**

Branch de trabalho:
`feat/prompt-02-property-game`

## Implementação concluída

### Jogo
- tabuleiro original Cidade Prisma com 36 casas;
- 2 a 4 participantes totais;
- modo solo com 1 a 3 NPCs;
- modo escolar curto de 8, 12 ou 16 rodadas;
- modo completo por sobrevivência econômica;
- dado de 1 a 6;
- pergunta matemática obrigatória antes do movimento humano;
- dificuldade progressiva conforme as rodadas.

### Regra matemática
- resposta correta: avança exatamente o número do dado;
- resposta incorreta: recua exatamente o número do dado;
- se não houver casas suficientes para recuar:
  - posição volta ao início;
  - cobrança de 200 CP;
  - se necessário, patrimônio é liquidado;
  - insolvência ocorre se caixa + patrimônio não cobrirem a dívida.

### Economia
Moeda própria: **Créditos Prisma (CP)**.

Implementado:
- saldo inicial;
- preços;
- aluguel;
- seis grupos;
- melhorias até nível 3;
- aluguel crescente por melhoria;
- venda voluntária;
- liquidação automática de patrimônio para quitar dívidas;
- impostos;
- serviços;
- bônus;
- eventos;
- falência;
- patrimônio líquido;
- vitória.

### Propriedades
- compra após resolver o movimento matemático;
- opção comprar/recusar;
- aluguel automático ao cair em imóvel adversário;
- resolução de aluguel protegida pela máquina de estados contra cobrança repetida;
- melhoria exige propriedade de todo o grupo;
- venda ao banco devolve 70% do valor investido.

### Eventos
Eventos originais incluem:
- Projeto Premiado;
- Manutenção de Fachada;
- Atalho da Biblioteca;
- Feira Comunitária;
- Conserto de Equipamentos;
- Rota Interditada.

### NPCs
NPCs:
- têm níveis de precisão;
- simulam acerto/erro;
- mantêm reserva mínima de caixa;
- compram somente quando podem preservar a reserva;
- melhoram propriedades apenas quando possuem o grupo;
- não recebem informação privilegiada do resultado do jogador.

### Interface
Implementado:
- tabuleiro;
- tokens;
- saldo;
- propriedades;
- turno;
- dado animado;
- histórico das últimas ações;
- regras;
- pergunta matemática;
- feedback;
- compra/recusa;
- melhorias;
- venda;
- tela final e ranking por patrimônio;
- responsividade para larguras menores com tabuleiro rolável.

### Arte original
Criados:
- emblema Cidade Prisma;
- ícone Crédito Prisma;
- troféu Prisma;
- paleta própria por grupos;
- tabuleiro e tokens por CSS/SVG.

## Validação focada

GitHub Actions:
`Prompt 02 CI`

Execução aprovada:
https://github.com/frankschmidt-hash/Jogos-matem-ticos-/actions/runs/37692967980

Resultados:
- instalação: passou;
- typecheck: passou;
- **15/15 testes focados do Banco Imobiliário Matemático: passaram**;
- **4/4 testes de compatibilidade do motor matemático: passaram**;
- build da aplicação: passou.

Cobertura funcional dos testes:
- acerto e avanço;
- erro e recuo;
- retorno ao início + 200 CP;
- saldo insuficiente e liquidação;
- compra;
- aluguel sem duplicação;
- melhoria;
- evento;
- falência;
- passagem de turno;
- decisão de NPC;
- partida curta;
- venda;
- integridade das 36 casas;
- cálculo de patrimônio.

## Deliberações
- multiplayer online do Banco Imobiliário Matemático NÃO foi duplicado nesta etapa;
- a infraestrutura geral de salas será consolidada no Prompt 06;
- não houve deploy;
- não houve publicação;
- não foi executada regressão global.

## Próximo ponto
O Prompt 03 deve preservar:
- lobby;
- sessão/nickname;
- motor matemático;
- pacote `@jogos/property-game`;
- rota `/game/property-math`;
- assets Cidade Prisma;
- estilos e componentes compartilhados.

A próxima implementação é a **Corrida Maluca**.
