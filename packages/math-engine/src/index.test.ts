import { describe, expect, it } from "vitest";
import { generateQuestion, generateRaceQuestion, satisfiesIntegerMultiplicationAndDivision, satisfiesSimpleOperations, validateAnswer, GRADE_LEVELS, type GradeLevel } from "./index";

describe("math engine", () => {
  it("gera questões determinísticas com seed", () => {
    const a = generateQuestion(5, { seed: "same-seed", difficulty: 2 });
    const b = generateQuestion(5, { seed: "same-seed", difficulty: 2 });
    expect(a.expression).toBe(b.expression);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it("audita 1.200 questões por nível, incluindo modo misto", () => {
    const modes:GradeLevel[]=[...GRADE_LEVELS,"mixed"];
    for(const mode of modes){
      const expressions=new Set<string>();
      const categories=new Set<string>();
      const grades=new Set<number>();
      for(let i=0;i<1200;i++){
        const difficulty=((i%3)+1) as 1|2|3;
        const question=generateQuestion(mode,{seed:`qa-${mode}-${i}`,difficulty});
        expressions.add(question.expression);
        categories.add(question.category);
        grades.add(question.gradeLevel);

        expect(question.expression.length).toBeGreaterThan(0);
        expect(question.expression.length).toBeLessThan(140);
        expect(question.correctAnswer).not.toMatch(/NaN|Infinity|undefined/);
        expect(question.expression).not.toMatch(/NaN|Infinity|undefined/);
        expect(question.expression).not.toMatch(/÷\s*0(?:\D|$)/);
        expect(question.expression).not.toMatch(/\/0(?:\D|$)/);
        expect(question.difficulty).toBe(difficulty);
        expect(validateAnswer(question,question.correctAnswer)).toBe(true);
      }

      expect(expressions.size).toBeGreaterThan(500);
      expect(categories.size).toBeGreaterThanOrEqual(mode===5?5:6);
      if(mode==="mixed") expect([...grades].sort()).toEqual([5,6,7,8,9]);
      else expect(grades).toEqual(new Set([mode]));
    }
  });

  it("faz dificuldade 3 produzir amostras materialmente diferentes da dificuldade 1",()=>{
    for(const grade of GRADE_LEVELS){
      let changed=0;
      for(let i=0;i<120;i++){
        const seed=`difficulty-${grade}-${i}`;
        const easy=generateQuestion(grade,{seed,difficulty:1});
        const hard=generateQuestion(grade,{seed,difficulty:3});
        if(easy.expression!==hard.expression) changed++;
      }
      expect(changed).toBeGreaterThan(75);
    }
  });

  it("aceita vírgula ou ponto em decimal", () => {
    const question = {
      id:"x", gradeLevel:5 as const, category:"decimal", expression:"1,2 + 1,3",
      correctAnswer:"2.5", acceptedAnswers:["2,5"], difficulty:1 as const, generatedAt:0
    };
    expect(validateAnswer(question, "2,5")).toBe(true);
    expect(validateAnswer(question, "2.5")).toBe(true);
  });

  it("aceita frações equivalentes e equivalente decimal", () => {
    const question = {
      id:"x", gradeLevel:6 as const, category:"fraction", expression:"1/4 + 1/4",
      correctAnswer:"1/2", difficulty:1 as const, generatedAt:0
    };
    expect(validateAnswer(question, "2/4")).toBe(true);
    expect(validateAnswer(question, "0,5")).toBe(true);
    expect(validateAnswer(question, "0.5")).toBe(true);
  });

  it("rejeita entradas inválidas e divisão por zero",()=>{
    const question = {
      id:"x", gradeLevel:6 as const, category:"fraction", expression:"1/4 + 1/4",
      correctAnswer:"1/2", difficulty:1 as const, generatedAt:0
    };
    expect(validateAnswer(question,"1/0")).toBe(false);
    expect(validateAnswer(question,"abc")).toBe(false);
    expect(validateAnswer(question,"1/2/3")).toBe(false);
  });

  it("não gera razões, porcentagens, frações nem enunciados longos",()=>{
    for(let i=0;i<600;i++){
      const question=generateQuestion(7,{seed:"old-ratio-"+i,difficulty:3});
      expect(satisfiesSimpleOperations(question)).toBe(true);
      expect(question.expression).not.toMatch(/razão|fator|por qual|%|de /i);
      expect(question.expression.length).toBeLessThanOrEqual(9);
    }
  });
});

describe("Contrato pedagógico: quatro jogos, bombas, séries e dificuldades",()=>{
  const games=[
    {name:"Banco Imobiliário",create:generateQuestion},
    {name:"Corrida Maluca e bombas",create:generateRaceQuestion},
    {name:"Corrida Numérica",create:generateQuestion},
    {name:"Futebol Matemático",create:generateQuestion}
  ] as const;
  const categories=["addition","subtraction","multiplication","exact-division","exponentiation","radication"];
  for(const game of games){
    it(game.name+" gera apenas as seis operações dentro dos limites",()=>{
      for(const grade of [...GRADE_LEVELS,"mixed"] as const){
        for(const difficulty of [1,2,3] as const){
          const seen=new Set<string>(),grades=new Set<number>();
          for(let i=0;i<250;i++){
            const seed="six-ops-"+game.name+"-"+grade+"-"+difficulty+"-"+i;
            const question=game.create(grade,{difficulty,seed});
            seen.add(question.category);grades.add(question.gradeLevel);
            expect(question.expression).toMatch(/^(?:\d{1,3} [+-] \d{1,3}|\d{1,2} [×÷] \d{1,2}|\d{1,2}²|[√∛]\d{1,3})$/);
            expect(question.expression.length).toBeLessThanOrEqual(9);
            expect(question.correctAnswer).toMatch(/^\d+$/);
            expect(satisfiesSimpleOperations(question)).toBe(true);
            expect(validateAnswer(question,question.correctAnswer)).toBe(true);
            expect(game.create(grade,{difficulty,seed}).expression).toBe(question.expression);
            expect(question.difficulty).toBe(difficulty);
            if(grade!=="mixed")expect(question.gradeLevel).toBe(grade);
          }
          expect(seen).toEqual(new Set(categories));
          if(grade==="mixed")expect(grades).toEqual(new Set(GRADE_LEVELS));
        }
      }
    });
  }
  it("potências só têm expoente 2 inclusive no 8º, 9º e modo misto",()=>{
    for(const game of games){
      for(const grade of [...GRADE_LEVELS,"mixed"] as const){
        let powerCount=0;
        for(let i=0;i<600;i++){
          const question=game.create(grade,{seed:"quadratic-"+game.name+"-"+grade+"-"+i,difficulty:3});
          expect(question.expression).not.toMatch(/[³⁴]/);
          if(question.category==="exponentiation"){
            powerCount++;
            expect(question.expression).toMatch(/^\d{1,2}²$/);
            expect(question.correctAnswer).toBe(String(Number(question.expression.slice(0,-1))**2));
          }
        }
        expect(powerCount).toBeGreaterThan(50);
      }
    }
  });
  it("barra enunciados, excesso de algarismos e raízes não exatas",()=>{
    const valid=(expression:string,correctAnswer:string)=>satisfiesSimpleOperations({expression,correctAnswer});
    for(const [expression,answer] of [
      ["A razão 13:9 foi ampliada para 52:36. Por qual fator?","4"],
      ["25% de 100","25"],["1/2 + 1/2","1"],
      ["100 × 2","200"],["100 ÷ 2","50"],["3 × 100","300"],
      ["2³","8"],["2⁴","16"],["99³","970299"],
      ["1000 + 1","1001"],["1000 - 1","999"],["100²","10000"],
      ["√1000","31"],["√10","3"],["∛10","2"],["7 ÷ 2","3"]
    ] as const) expect(valid(expression,answer)).toBe(false);
    for(const [expression,answer] of [
      ["64 ÷ 8","8"],["99 × 99","9801"],["999 + 999","1998"],
      ["99²","9801"],["√961","31"],["∛729","9"]
    ] as const)expect(valid(expression,answer)).toBe(true);
  });
});

describe("Divisão e multiplicação inteiras em todos os jogos", () => {
  const gameModes = [
    { name: "Banco Imobiliário", create: generateQuestion },
    { name: "Corrida Maluca (incluindo bombas)", create: generateRaceQuestion },
    { name: "Corrida Numérica", create: generateQuestion },
    { name: "Futebol Matemático", create: generateQuestion }
  ] as const;

  for (const game of gameModes) {
    it(`${game.name}: audita resultados e operandos de 5º a 9º ano e modo misto`, () => {
      for (const grade of [...GRADE_LEVELS, "mixed"] as const) {
        for (const difficulty of [1, 2, 3] as const) {
          let multiplications = 0, divisions = 0;
          for (let i = 0; i < 360; i++) {
            const seed = `integer-rule-${game.name}-${grade}-${difficulty}-${i}`;
            const question = game.create(grade, { difficulty, seed });
            expect(satisfiesIntegerMultiplicationAndDivision(question)).toBe(true);
            expect(validateAnswer(question, question.correctAnswer)).toBe(true);
            if (question.expression.includes("×")) {
              multiplications++;
              expect(Number.isInteger(Number(question.correctAnswer))).toBe(true);
            }
            if (question.expression.includes("÷")) {
              divisions++;
              const match = question.expression.match(/^(-?\d+) ÷ (-?\d+)$/);
              expect(match).not.toBeNull();
              const dividend = Number(match?.[1]), divisor = Number(match?.[2]);
              expect(Number.isInteger(dividend)).toBe(true);
              expect(Number.isInteger(divisor)).toBe(true);
              expect(divisor).not.toBe(0);
              expect(dividend % divisor).toBe(0);
              expect(question.correctAnswer).toBe(String(dividend / divisor));
            }
          }
          expect(multiplications).toBeGreaterThan(0);
          expect(divisions).toBeGreaterThan(0);
        }
      }
    });
  }

  it("rejeita decimais, divisões não exatas e respostas não inteiras apenas em × e ÷", () => {
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "1,5 × 2", correctAnswer: "3" })).toBe(false);
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "7 ÷ 2", correctAnswer: "3.5" })).toBe(false);
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "9 ÷ 0", correctAnswer: "0" })).toBe(false);
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "2 × 3", correctAnswer: "7" })).toBe(false);
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "8 ÷ 2", correctAnswer: "4" })).toBe(true);
  });

  it("preserva adição e subtração de decimais e adição de frações", () => {
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "1,5 + 2,3", correctAnswer: "3.8" })).toBe(true);
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "5,2 - 2,7", correctAnswer: "2.5" })).toBe(true);
    expect(satisfiesIntegerMultiplicationAndDivision({ expression: "1/2 + 1/4", correctAnswer: "3/4" })).toBe(true);
  });
});
