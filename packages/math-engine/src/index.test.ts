import { describe, expect, it } from "vitest";
import { generateQuestion, validateAnswer, type GradeLevel } from "./index";

describe("math engine", () => {
  it("gera questões determinísticas com seed", () => {
    const a = generateQuestion(5, { seed: "same-seed", difficulty: 2 });
    const b = generateQuestion(5, { seed: "same-seed", difficulty: 2 });
    expect(a.expression).toBe(b.expression);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it("audita 1.200 questões por nível, incluindo modo misto", () => {
    const modes:GradeLevel[]=[5,6,7,"mixed"];
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
      if(mode==="mixed") expect([...grades].sort()).toEqual([5,6,7]);
      else expect(grades).toEqual(new Set([mode]));
    }
  });

  it("faz dificuldade 3 produzir amostras materialmente diferentes da dificuldade 1",()=>{
    for(const grade of [5,6,7] as const){
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

  it("formula razão do 7º ano sem marcador ambíguo",()=>{
    const ratios=Array.from({length:200},(_,i)=>generateQuestion(7,{seed:`ratio-scan-${i}`,difficulty:2}))
      .filter(question=>question.category==="ratio");
    expect(ratios.length).toBeGreaterThan(0);
    for(const question of ratios){
      expect(question.expression).toMatch(/Por qual fator/);
      expect(question.expression).not.toContain("×?");
      expect(validateAnswer(question,question.correctAnswer)).toBe(true);
    }
  });
});
