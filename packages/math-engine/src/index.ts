export type ConcreteGradeLevel = 5 | 6 | 7 | 8 | 9;
export type GradeLevel = ConcreteGradeLevel | "mixed";
export const GRADE_LEVELS = [5, 6, 7, 8, 9] as const satisfies readonly ConcreteGradeLevel[];
export type Difficulty = 1 | 2 | 3;

export type MathQuestion = {
  id: string;
  gradeLevel: ConcreteGradeLevel;
  category: string;
  expression: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
  difficulty: Difficulty;
  generatedAt: number;
  seed?: string;
};

type Random = () => number;

export const normalizeNumericInput = (value: string): string =>
  value.trim().replace(/\s+/g, "").replace(",", ".");

const parseFraction = (value: string): number | null => {
  const normalized = normalizeNumericInput(value);
  if (!normalized.includes("/")) return null;
  const [a, b, ...rest] = normalized.split("/");
  if (rest.length || a === undefined || b === undefined) return null;
  const num = Number(a); const den = Number(b);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
};

const parseNumericValue = (value: string): number | null => {
  const fractionValue = parseFraction(value);
  if (fractionValue !== null) return fractionValue;
  const numberValue = Number(normalizeNumericInput(value));
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const validateAnswer = (question: MathQuestion, answer: string): boolean => {
  const normalized = normalizeNumericInput(answer);
  const accepted = [question.correctAnswer, ...(question.acceptedAnswers ?? [])].map(normalizeNumericInput);
  if (accepted.includes(normalized)) return true;
  const inputValue = parseNumericValue(normalized);
  const correctValue = parseNumericValue(question.correctAnswer);
  return inputValue !== null && correctValue !== null && Math.abs(inputValue - correctValue) < 1e-9;
};

const hashSeed = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export const seededRandom = (seed: string): Random => {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const int = (r: Random, min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
const pick = <T>(r: Random, items: readonly T[]): T => items[int(r, 0, items.length - 1)]!;

/** Verificação adicional: divisão e multiplicação com inteiros. */
export const satisfiesIntegerMultiplicationAndDivision = (
  question: Pick<MathQuestion, "expression" | "correctAnswer">
): boolean => {
  const { expression, correctAnswer } = question;
  if (!/[×÷]/.test(expression)) return true;
  const operands = expression.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  if (operands.length < 2 || operands.some(value => !Number.isSafeInteger(Number(value.replace(",", "."))))) return false;
  if (!Number.isSafeInteger(Number(correctAnswer))) return false;

  const divisions = [...expression.matchAll(/(-?\d+)\s*÷\s*(-?\d+)/g)];
  if (expression.includes("÷") && divisions.length === 0) return false;
  if (divisions.some(([, dividend, divisor]) => Number(divisor) === 0 || Number(dividend) % Number(divisor) !== 0)) return false;

  const direct = expression.match(/^\s*(-?\d+)\s*([×÷])\s*(-?\d+)\s*$/);
  if (direct) {
    const a = Number(direct[1]), b = Number(direct[3]), expected = Number(correctAnswer);
    return direct[2] === "×" ? a * b === expected : b !== 0 && a / b === expected;
  }
  return true;
};

const q = (gradeLevel: ConcreteGradeLevel, category: string, expression: string, correctAnswer: string, difficulty: Difficulty, seed?: string, acceptedAnswers?: string[]): MathQuestion => {
  const question: MathQuestion = {
    id: `${gradeLevel}-${category}-${seed ?? crypto.randomUUID()}`,
    gradeLevel, category, expression, correctAnswer, acceptedAnswers, difficulty, generatedAt: Date.now(), seed
  };
  if (!satisfiesIntegerMultiplicationAndDivision(question) || !satisfiesSimpleOperations(question)) {
    throw new Error("A questão deve ser somente uma conta das seis operações, dentro dos limites por algarismo.");
  }
  return question;
};


/**
 * Contrato de TODOS os quatro jogos, incluindo bombas e partidas online.
 * Somente uma conta; adição/subtração <= 3 algarismos;
 * multiplicação/divisão <= 2 algarismos em CADA operando;
 * potência com base <= 2 algarismos e expoente SEMPRE igual a 2;
 * radicando <= 3 algarismos com raiz inteira.
 */
export const satisfiesSimpleOperations = (
  question: Pick<MathQuestion, "expression" | "correctAnswer">
): boolean => {
  const answer=Number(question.correctAnswer);
  if(!Number.isSafeInteger(answer)||String(answer)!==question.correctAnswer) return false;
  let m=/^(\d{1,3}) \+ (\d{1,3})$/.exec(question.expression);
  if(m) return Number(m[1])+Number(m[2])===answer;
  m=/^(\d{1,3}) - (\d{1,3})$/.exec(question.expression);
  if(m) return Number(m[1])-Number(m[2])===answer;
  m=/^(\d{1,2}) × (\d{1,2})$/.exec(question.expression);
  if(m) return Number(m[1])*Number(m[2])===answer;
  m=/^(\d{1,2}) ÷ (\d{1,2})$/.exec(question.expression);
  if(m){
    const a=Number(m[1]),b=Number(m[2]);
    return b!==0&&a%b===0&&a/b===answer;
  }
  m=/^(\d{1,2})²$/.exec(question.expression);
  if(m) return Number(m[1])**2===answer;
  m=/^(√|∛)(\d{1,3})$/.exec(question.expression);
  if(m){
    const value=m[1]==="√"?Math.sqrt(Number(m[2])):Math.cbrt(Number(m[2]));
    return Number.isInteger(value)&&value===answer;
  }
  return false;
};

type Operation="addition"|"subtraction"|"multiplication"|"exact-division"|"exponentiation"|"radication";
type Limits={additive:number;factor:number;divisor:number;quotient:number;powerBase:number;squareRoot:number;cubeRoot:number};
const GRADE_LIMITS:Record<ConcreteGradeLevel,Record<Difficulty,Limits>>={
  5:{
    1:{additive:40,factor:9,divisor:8,quotient:9,powerBase:6,squareRoot:10,cubeRoot:0},
    2:{additive:200,factor:12,divisor:12,quotient:12,powerBase:12,squareRoot:15,cubeRoot:0},
    3:{additive:999,factor:19,divisor:19,quotient:19,powerBase:20,squareRoot:25,cubeRoot:0}
  },
  6:{
    1:{additive:120,factor:12,divisor:12,quotient:12,powerBase:8,squareRoot:15,cubeRoot:4},
    2:{additive:450,factor:25,divisor:20,quotient:20,powerBase:14,squareRoot:25,cubeRoot:6},
    3:{additive:999,factor:50,divisor:30,quotient:30,powerBase:25,squareRoot:31,cubeRoot:9}
  },
  7:{
    1:{additive:200,factor:20,divisor:20,quotient:20,powerBase:12,squareRoot:20,cubeRoot:5},
    2:{additive:650,factor:60,divisor:30,quotient:30,powerBase:22,squareRoot:31,cubeRoot:8},
    3:{additive:999,factor:99,divisor:33,quotient:49,powerBase:40,squareRoot:31,cubeRoot:9}
  },
  8:{
    1:{additive:300,factor:25,divisor:22,quotient:28,powerBase:20,squareRoot:24,cubeRoot:6},
    2:{additive:750,factor:65,divisor:33,quotient:42,powerBase:45,squareRoot:31,cubeRoot:8},
    3:{additive:999,factor:89,divisor:44,quotient:65,powerBase:70,squareRoot:31,cubeRoot:9}
  },
  9:{
    1:{additive:400,factor:35,divisor:27,quotient:35,powerBase:25,squareRoot:29,cubeRoot:7},
    2:{additive:850,factor:75,divisor:40,quotient:55,powerBase:70,squareRoot:31,cubeRoot:9},
    3:{additive:999,factor:99,divisor:49,quotient:75,powerBase:99,squareRoot:31,cubeRoot:9}
  }
};
const OPERATIONS:readonly Operation[]=[
  "addition","subtraction","multiplication","exact-division","exponentiation","radication"
];

/** Ano 5º a 9º ou sorteio entre os cinco anos por questão no modo misto. */
export const generateQuestion=(grade:GradeLevel,options:{difficulty?:Difficulty;seed?:string}={}):MathQuestion=>{
  const difficulty=options.difficulty??1,seed=options.seed;
  const r=seed?seededRandom(seed):Math.random;
  const level:ConcreteGradeLevel=grade==="mixed"?pick(r,GRADE_LEVELS):grade;
  const limits=GRADE_LIMITS[level][difficulty],category=pick(r,OPERATIONS);
  if(category==="addition"){
    const a=int(r,1,limits.additive),b=int(r,1,limits.additive);
    return q(level,category,String(a)+" + "+String(b),String(a+b),difficulty,seed);
  }
  if(category==="subtraction"){
    const a=int(r,2,limits.additive),b=int(r,0,a);
    return q(level,category,String(a)+" - "+String(b),String(a-b),difficulty,seed);
  }
  if(category==="multiplication"){
    const a=int(r,2,limits.factor),b=int(r,2,limits.factor);
    return q(level,category,String(a)+" × "+String(b),String(a*b),difficulty,seed);
  }
  if(category==="exact-division"){
    const divisor=int(r,2,limits.divisor);
    const quotient=int(r,1,Math.min(limits.quotient,Math.floor(99/divisor)));
    return q(level,category,String(divisor*quotient)+" ÷ "+String(divisor),String(quotient),difficulty,seed);
  }
  if(category==="exponentiation"){
    const base=int(r,2,limits.powerBase);
    return q(level,category,String(base)+"²",String(base**2),difficulty,seed);
  }
  const cubic=limits.cubeRoot>0&&r()<0.35;
  const value=int(r,2,cubic?limits.cubeRoot:limits.squareRoot);
  return q(level,category,(cubic?"∛":"√")+String(cubic?value**3:value**2),String(value),difficulty,seed);
};

/** Corrida Maluca e bombas: mesma fonte das seis operações dos demais jogos. */
export const generateRaceQuestion=(
  grade:GradeLevel,options:{difficulty?:Difficulty;seed?:string}={}
):MathQuestion=>generateQuestion(grade,options);
