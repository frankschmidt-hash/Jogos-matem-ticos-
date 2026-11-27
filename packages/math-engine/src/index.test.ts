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

      expect(expressions.size).toBeGreaterThan(300);
      expect(categories.size).toBe(mode===5?2:mode===6||mode===7?4:6);
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
      expect(question.expression.length).toBeLessThanOrEqual(11);
    }
  });
});


describe("Matriz pedagógica: cinco jogos, bombas, séries e dificuldades",()=>{
  const expected={
    5:["addition","subtraction"],
    6:["addition","subtraction","multiplication","exact-division"],
    7:["addition","subtraction","multiplication","exact-division"],
    8:["addition","subtraction","multiplication","exact-division","exponentiation","radication"],
    9:["addition","subtraction","multiplication","exact-division","exponentiation","radication"]
  } as const;
  const max={5:99,6:99,7:999,8:9999,9:9999};
  for(const create of [generateQuestion,generateRaceQuestion]){
    for(const mode of [...GRADE_LEVELS,"mixed"] as const){
      for(const difficulty of [1,2,3] as const){
        it(create.name+" série "+mode+" dificuldade "+difficulty,()=>{
          const seen=new Map<number,Set<string>>();
          for(let i=0;i<1000;i++){
            const seed="grade-rule-"+mode+"-"+difficulty+"-"+i;
            const question=create(mode,{seed,difficulty});
            const level=question.gradeLevel;
            if(mode!=="mixed")expect(level).toBe(mode);
            const categories=seen.get(level)??new Set<string>();
            categories.add(question.category);seen.set(level,categories);
            expect(expected[level] as readonly string[]).toContain(question.category);
            expect(question.correctAnswer).toMatch(/^\d+$/);
            expect(satisfiesSimpleOperations(question)).toBe(true);
            expect(satisfiesIntegerMultiplicationAndDivision(question)).toBe(true);
            expect(validateAnswer(question,question.correctAnswer)).toBe(true);
            expect(create(mode,{seed,difficulty}).expression).toBe(question.expression);
            const answer=Number(question.correctAnswer);
            const binary=/^(\d+) ([+\-×÷]) (\d+)$/.exec(question.expression);
            if(binary){
              const a=Number(binary[1]),b=Number(binary[3]);
              expect(a).toBeLessThanOrEqual(max[level]);expect(b).toBeLessThanOrEqual(max[level]);
              if(binary[2]==="+")expect(answer).toBe(a+b);
              if(binary[2]==="-")expect(answer).toBe(a-b);
              if(binary[2]==="×")expect(answer).toBe(a*b);
              if(binary[2]==="÷"){expect(b).toBeGreaterThan(0);expect(a%b).toBe(0);expect(answer).toBe(a/b);}
            }else if(question.category==="exponentiation"){
              expect(level).toBeGreaterThanOrEqual(8);
              expect(question.expression).toMatch(level===8?/^\d²$/:/^\d{1,2}²$/);
              expect(answer).toBe(Number(question.expression.slice(0,-1))**2);
            }else{
              expect(question.category).toBe("radication");
              expect(level).toBeGreaterThanOrEqual(8);
              expect(answer).toBeLessThanOrEqual(level===8?9:99);
              expect(question.expression).toMatch(/^[√∛]\d+$/);
              expect(Number(question.expression.slice(1))).toBe(answer**(question.expression.startsWith("√")?2:3));
            }
          }
          expect([...seen.keys()].sort()).toEqual(mode==="mixed"?[5,6,7,8,9]:[mode]);
          for(const [level,categories] of seen)expect(categories).toEqual(new Set(expected[level as keyof typeof expected]));
        });
      }
    }
  }
  it("rejeita operações de outra série, excesso de algarismos e respostas erradas",()=>{
    const valid=(gradeLevel:5|6|7|8|9,expression:string,correctAnswer:string)=>satisfiesSimpleOperations({gradeLevel,expression,correctAnswer});
    for(const [grade,expression,answer] of [
      [5,"2 × 3","6"],[5,"100 + 1","101"],[6,"100 ÷ 2","50"],[6,"3²","9"],
      [7,"1000 × 2","2000"],[7,"√81","9"],[8,"10²","100"],[8,"√100","10"],
      [8,"∛1000","10"],[9,"10000 + 1","10001"],[9,"100²","10000"],
      [9,"√10000","100"],[9,"7 ÷ 2","3"],[9,"9 ÷ 0","0"],[9,"2³","8"],
      [9,"3 - 4","-1"],[9,"√10","3"],[9,"25% de 100","25"]
    ] as const)expect(valid(grade,expression,answer)).toBe(false);
    for(const [grade,expression,answer] of [
      [5,"99 + 99","198"],[5,"5 - 5","0"],[6,"99 × 99","9801"],[6,"96 ÷ 12","8"],
      [7,"999 × 999","998001"],[8,"9999 × 9999","99980001"],[8,"√81","9"],
      [8,"∛729","9"],[9,"99²","9801"],[9,"√9801","99"],[9,"∛970299","99"],
      [9,"9999 ÷ 3333","3"]
    ] as const)expect(valid(grade,expression,answer)).toBe(true);
  });
  it("não aceita resposta vazia para uma conta cujo resultado é zero",()=>{
    const question={id:"zero",gradeLevel:5 as const,category:"subtraction",expression:"5 - 5",correctAnswer:"0",difficulty:1 as const,generatedAt:0};
    expect(validateAnswer(question,"")).toBe(false);
    expect(validateAnswer(question,"  ")).toBe(false);
    expect(validateAnswer(question,"0")).toBe(true);
  });
  it("rejeita níveis inválidos sem cair no misto",()=>{
    expect(()=>generateQuestion(4 as GradeLevel)).toThrow();
  });
});
