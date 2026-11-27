# Contrato de contas diretas — cinco jogos

Fonte única: packages/math-engine/src/index.ts. Aplicável a partidas individuais, salas online e bombas.

| Série | Operações básicas (algarismos por operando) | Base da potência | Resultado da raiz |
|---|---|---|---|
| 5º | Adição e subtração: 1–2 | — | — |
| 6º | Adição, subtração, multiplicação e divisão: 1–2 | — | — |
| 7º | Quatro operações: 1–3 | — | — |
| 8º | Quatro operações: 1–4 | 1 algarismo | 1 algarismo |
| 9º | Quatro operações: 1–4 | 1 algarismo (resultado até 2) | 1–2 algarismos |

- Misto: sorteia primeiro uma série de 5 a 9 e usa somente suas operações e limites.
- Cada dificuldade interna (1, 2, 3) aumenta as faixas de amostragem sem romper o teto da série. Números menores continuam aparecendo.
- Subtrações não negativas; divisão exata e divisor não nulo; resultados inteiros. O limite dos operandos não restringe o resultado da multiplicação/adição.
- Potenciação sempre ao quadrado, com base de 1 a 9 e resultado de 1 a 81. O 9º ano tem resultado de até dois algarismos, portanto 10² não é permitido. Radiciação exclusivamente quadrada, exata e positiva: 8º ano resultado 1–9; 9º ano 1–99. O limite da raiz se refere ao resultado, não ao radicando. Índices acima de 2 são rejeitados.
- Em partidas individuais, salas e bombas, o histórico por jogador/sala impede repetir as últimas 40 questões (inclusive parcelas e fatores invertidos). Mantém a categoria sempre que possível; quando os poucos quadrados ou raízes se esgotam, usa outra operação válida. Histórico em memória com limite de 512 sequências, não persistido após reiniciar o servidor ou recarregar a página.
- Validação da série, da categoria, da expressão e do resultado a cada geração; testes de regressão por série, nível de dificuldade e ambos os pontos de entrada do motor.
- Salas online mantêm o nível definido pelo anfitrião; partidas individuais mantêm a série da sessão.
