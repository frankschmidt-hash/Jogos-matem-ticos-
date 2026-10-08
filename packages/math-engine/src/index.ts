export type GradeLevel = 5 | 6 | 7 | "mixed";
export type ConcreteGradeLevel = 5 | 6 | 7;
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

const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

const fraction = (num: number, den: number): string => {
  if (den === 0) throw new Error("Denominador não pode ser zero");
  if (den < 0) { num *= -1; den *= -1; }
  const d = gcd(num, den);
  return `${num / d}/${den / d}`;
};

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

const q = (gradeLevel: ConcreteGradeLevel, category: string, expression: string, correctAnswer: string, difficulty: Difficulty, seed?: string, acceptedAnswers?: string[]): MathQuestion => ({
  id: `${gradeLevel}-${category}-${seed ?? crypto.randomUUID()}`,
  gradeLevel, category, expression, correctAnswer, acceptedAnswers, difficulty, generatedAt: Date.now(), seed
});

const grade5 = (r: Random, difficulty: Difficulty, seed?: string): MathQuestion => {
  const category = pick(r, ["addition", "subtraction", "multiplication", "exact-division", "decimal"] as const);
  const max = difficulty === 1 ? 50 : difficulty === 2 ? 200 : 1000;
  if (category === "addition") { const a=int(r,1,max), b=int(r,1,max); return q(5,category,`${a} + ${b}`,String(a+b),difficulty,seed); }
  if (category === "subtraction") { const a=int(r,10,max), b=int(r,0,a); return q(5,category,`${a} - ${b}`,String(a-b),difficulty,seed); }
  if (category === "multiplication") {
    const lim=difficulty===1?10:difficulty===2?12:20; const a=int(r,2,lim), b=int(r,2,lim);
    return q(5,category,`${a} × ${b}`,String(a*b),difficulty,seed);
  }
  if (category === "exact-division") {
    const divisor=int(r,2,difficulty===3?20:12), quotient=int(r,2,difficulty===1?10:20);
    return q(5,category,`${divisor*quotient} ÷ ${divisor}`,String(quotient),difficulty,seed);
  }
  const decimalMax=difficulty===1?49:difficulty===2?99:199;
  const a=int(r,1,decimalMax)/10, b=int(r,1,decimalMax)/10;
  const answer=(a+b).toFixed(1).replace(/\.0$/,"");
  return q(5,category,`${a.toFixed(1).replace('.', ',')} + ${b.toFixed(1).replace('.', ',')}`,answer,difficulty,seed,[answer.replace('.', ',')]);
};

const grade6 = (r: Random, difficulty: Difficulty, seed?: string): MathQuestion => {
  const category = pick(r, ["four-operations", "integer", "decimal", "fraction", "percentage", "expression"] as const);
  if (category === "fraction") {
    const denominators=difficulty===1?[2,3,4,5,6]:difficulty===2?[2,3,4,5,6,8,10]:[3,4,5,6,8,9,10,12];
    const den = pick(r,denominators); const a=int(r,1,den-1), b=int(r,1,den-1);
    return q(6,category,`${a}/${den} + ${b}/${den}`,fraction(a+b,den),difficulty,seed);
  }
  if (category === "percentage") {
    const percentages=difficulty===1?[10,20,25,50]:difficulty===2?[5,10,15,20,25,30,40,50]:[5,10,15,20,25,30,35,40,45,50];
    const bases=difficulty===1?[20,40,60,80,100]:difficulty===2?[40,60,80,100,120,160,200]:[80,100,120,160,200,240,300,400];
    const pct=pick(r,percentages), base=pick(r,bases);
    return q(6,category,`${pct}% de ${base}`,String(base*pct/100),difficulty,seed);
  }
  if (category === "integer") {
    const limit=difficulty===1?10:difficulty===2?25:50;
    const a=int(r,-limit,limit), b=int(r,-limit,limit);
    return q(6,category,`${a} + (${b})`,String(a+b),difficulty,seed);
  }
  if (category === "decimal") {
    const maxA=difficulty===1?200:difficulty===2?500:1000;
    const maxB=difficulty===1?100:difficulty===2?250:500;
    const a=int(r,10,maxA)/10, b=int(r,1,maxB)/10; const result=a-b; const ans=Number(result.toFixed(1)).toString();
    return q(6,category,`${a.toFixed(1).replace('.', ',')} - ${b.toFixed(1).replace('.', ',')}`,ans,difficulty,seed,[ans.replace('.', ',')]);
  }
  if (category === "expression") {
    const aMax=difficulty===1?12:difficulty===2?20:35, bMax=difficulty===1?8:difficulty===2?12:18, cMax=difficulty===1?6:difficulty===2?10:15;
    const a=int(r,2,aMax), b=int(r,2,bMax), c=int(r,2,cMax);
    return q(6,category,`${a} + ${b} × ${c}`,String(a+b*c),difficulty,seed);
  }
  const aMax=difficulty===1?25:difficulty===2?50:80, bMax=difficulty===1?12:difficulty===2?20:30;
  const a=int(r,2,aMax), b=int(r,2,bMax); return q(6,category,`${a} × ${b}`,String(a*b),difficulty,seed);
};

const grade7 = (r: Random, difficulty: Difficulty, seed?: string): MathQuestion => {
  const category = pick(r, ["signed", "rational", "fraction", "decimal", "percentage", "ratio", "expression"] as const);
  if (category === "fraction") {
    const denominators=difficulty===1?[2,3,4,5,6]:difficulty===2?[2,3,4,5,6,8,10]:[3,4,5,6,8,9,10,12];
    const d1=pick(r,denominators), d2=pick(r,denominators); const a=int(r,1,d1), b=int(r,1,d2);
    return q(7,category,`${a}/${d1} + ${b}/${d2}`,fraction(a*d2+b*d1,d1*d2),difficulty,seed);
  }
  if (category === "percentage") {
    const percentages=difficulty===1?[10,20,25,50]:difficulty===2?[10,15,20,25,30,40,50]:[5,10,15,20,25,30,35,40,45,50];
    const bases=difficulty===1?[40,60,80,100,120]:difficulty===2?[60,80,100,120,160,200,240]:[100,120,160,200,240,300,400];
    const pct=pick(r,percentages), base=pick(r,bases);
    return q(7,category,`${pct}% de ${base}`,String(base*pct/100),difficulty,seed);
  }
  if (category === "ratio") {
    const factor=int(r,2,difficulty===1?5:difficulty===2?8:12);
    const maxTerm=difficulty===1?6:difficulty===2?10:14;
    const a=int(r,2,maxTerm), b=int(r,2,maxTerm);
    return q(7,category,`A razão ${a}:${b} foi ampliada para ${a*factor}:${b*factor}. Por qual fator os dois termos foram multiplicados?`,String(factor),difficulty,seed);
  }
  if (category === "signed") {
    const limit=difficulty===1?20:difficulty===2?40:80;
    const a=int(r,-limit,limit), b=int(r,-limit,limit);
    return q(7,category,`${a} - (${b})`,String(a-b),difficulty,seed);
  }
  if (category === "decimal" || category === "rational") {
    const aLimit=difficulty===1?100:difficulty===2?200:500, bLimit=difficulty===1?60:difficulty===2?120:300;
    const a=int(r,-aLimit,aLimit)/10, b=int(r,-bLimit,bLimit)/10; const result=a+b; const ans=Number(result.toFixed(1)).toString();
    return q(7,category,`${a.toFixed(1).replace('.', ',')} + (${b.toFixed(1).replace('.', ',')})`,ans,difficulty,seed,[ans.replace('.', ',')]);
  }
  const aMax=difficulty===1?10:difficulty===2?15:22, bMax=difficulty===1?8:difficulty===2?12:18, cLimit=difficulty===1?6:difficulty===2?10:15;
  const a=int(r,2,aMax), b=int(r,2,bMax), c=int(r,-cLimit,cLimit);
  return q(7,category,`${a} × (${b} + ${c})`,String(a*(b+c)),difficulty,seed);
};

export const generateQuestion = (grade: GradeLevel, options: {difficulty?: Difficulty; seed?: string} = {}): MathQuestion => {
  const difficulty = options.difficulty ?? 1;
  const seed = options.seed;
  const r = seed ? seededRandom(seed) : Math.random;
  const concrete: ConcreteGradeLevel = grade === "mixed" ? pick(r,[5,6,7] as const) : grade;
  if (concrete === 5) return grade5(r,difficulty,seed);
  if (concrete === 6) return grade6(r,difficulty,seed);
  return grade7(r,difficulty,seed);
};

/** Contas diretas da Corrida Maluca: apenas +, -, × e ÷, sem problemas escritos. */
export const generateRaceQuestion = (
  grade: GradeLevel, options: {difficulty?: Difficulty; seed?: string} = {}
): MathQuestion => {
  const difficulty=options.difficulty??1;
  const seed=options.seed;
  const r=seed?seededRandom(seed):Math.random;
  const level:ConcreteGradeLevel=grade==="mixed"?pick(r,[5,6,7] as const):grade;
  const category=pick(r,["addition","subtraction","multiplication","exact-division"] as const);
  const base=level===5?25:level===6?40:60;
  const limit=base+(difficulty-1)*20;
  const maxFactor=Math.min(12,(level===5?8:level===6?9:10)+(difficulty-1)*2);
  if(category==="addition"){
    const a=int(r,1,limit),b=int(r,1,limit);
    return q(level,category,`${a} + ${b}`,String(a+b),difficulty,seed);
  }
  if(category==="subtraction"){
    const a=int(r,2,limit),b=int(r,0,a);
    return q(level,category,`${a} - ${b}`,String(a-b),difficulty,seed);
  }
  if(category==="multiplication"){
    const a=int(r,2,maxFactor),b=int(r,2,maxFactor);
    return q(level,category,`${a} × ${b}`,String(a*b),difficulty,seed);
  }
  const divisor=int(r,2,maxFactor),quotient=int(r,2,maxFactor);
  return q(level,category,`${divisor*quotient} ÷ ${divisor}`,String(quotient),difficulty,seed);
};
