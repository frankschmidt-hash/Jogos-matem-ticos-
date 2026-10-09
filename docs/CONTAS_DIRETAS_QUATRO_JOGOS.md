# Contas dos quatro jogos — contrato de geração

Este contrato vale para Banco Imobiliário, Corrida Maluca (inclusive bombas), Corrida Numérica e Futebol Matemático, no modo solo e em salas multiplayer.

- Apenas uma expressão matemática por pergunta. Sem enunciado, razão, porcentagem, fração, texto descritivo ou composição de operações.
- Adição/subtração: operandos inteiros de até 3 algarismos (até 999).
- Multiplicação/divisão: ambos operandos inteiros com até 2 algarismos (até 99); divisão exata, resposta inteira, divisor diferente de zero.
- Potenciação: base com até 2 algarismos; expoente **sempre igual a 2**, como 12². Potências cúbicas ou superiores são rejeitadas pelo gerador e pelo validador.
- Radiciação: radicando de até 3 algarismos, raiz quadrada ou cúbica inteira exata.
- Anos: escolha entre **5º, 6º, 7º, 8º, 9º ano** ou **Misto**, que sorteia uniformemente um dos cinco anos para cada pergunta. Todos têm três dificuldades e as seis categorias disponíveis. Os limites numéricos variam por ano e dificuldade, mas nunca excedem os tetos absolutos definidos acima.
- Implementação: packages/math-engine/src/index.ts; validação obrigatória por satisfiesSimpleOperations. A Corrida Maluca utiliza o mesmo gerador dos demais jogos.
- Testes: packages/math-engine/src/index.test.ts, cobrindo quatro jogos, todos os anos, modo misto e dificuldades, condições de limite e casos inválidos.

As demais regras de gameplay, tempo de partida, pontuação, rankings e salas foram preservadas.
