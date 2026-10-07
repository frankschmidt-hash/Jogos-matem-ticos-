import { describe, expect, it } from "vitest";
import { generateQuestion, validateAnswer } from "./index";

describe("math engine", () => {
  it("gera questões determinísticas com seed", () => {
    const a = generateQuestion(5, { seed: "same-seed", difficulty: 2 });
    const b = generateQuestion(5, { seed: "same-seed", difficulty: 2 });
    expect(a.expression).toBe(b.expression);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });
  it("gera e valida 300 questões por série", () => {
    for (const grade of [5, 6, 7] as const) {
      for (let i=0;i<300;i++) {
        const question = generateQuestion(grade, { seed: `${grade}-${i}`, difficulty: ((i%3)+1) as 1|2|3 });
        expect(question.expression.length).toBeGreaterThan(0);
        expect(validateAnswer(question, question.correctAnswer)).toBe(true);
        expect(question.expression).not.toMatch(/÷ 0/);
      }
    }
  });
  it("aceita vírgula ou ponto em decimal", () => {
    const question = { id:"x", gradeLevel:5 as const, category:"decimal", expression:"1,2 + 1,3", correctAnswer:"2.5", acceptedAnswers:["2,5"], difficulty:1 as const, generatedAt:0 };
    expect(validateAnswer(question, "2,5")).toBe(true);
    expect(validateAnswer(question, "2.5")).toBe(true);
  });
  it("aceita frações equivalentes", () => {
    const question = { id:"x", gradeLevel:6 as const, category:"fraction", expression:"1/4 + 1/4", correctAnswer:"1/2", difficulty:1 as const, generatedAt:0 };
    expect(validateAnswer(question, "2/4")).toBe(true);
  });
});
