# Contrato de contas diretas — cinco jogos

Fonte única: packages/math-engine/src/index.ts. Aplicável a partidas individuais, salas online e bombas.

| Série | Operações básicas (algarismos por operando) | Base da potência | Resultado da raiz |
|---|---|---|---|
| 5º | Adição e subtração: 1–2 | — | — |
| 6º | Adição, subtração, multiplicação e divisão: 1–2 | — | — |
| 7º | Quatro operações: 1–3 | — | — |
| 8º | Quatro operações: 1–4 | 1 algarismo | 1 algarismo |
| 9º | Quatro operações: 1–4 | 1–2 algarismos | 1–2 algarismos |

- Misto: sorteia primeiro uma série de 5 a 9 e usa somente suas operações e limites.
- Cada dificuldade interna (1, 2, 3) aumenta as faixas de amostragem sem romper o teto da série. Números menores continuam aparecendo.
- Subtrações não negativas; divisão exata e divisor não nulo; resultados inteiros. O limite dos operandos não restringe o resultado da multiplicação/adição.
- Potenciação sempre ao quadrado; raízes quadradas e cúbicas exatas. O limite da raiz se refere ao resultado, não ao radicando.
- Validação da série, da categoria, da expressão e do resultado a cada geração; testes de regressão por série, nível de dificuldade e ambos os pontos de entrada do motor.
- Salas online mantêm o nível definido pelo anfitrião; partidas individuais mantêm a série da sessão.
