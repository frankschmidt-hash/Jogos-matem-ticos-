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
  const normalized = normalizeNumericInput(value);
  if (!normalized) return null;
  const numberValue = Number(normalized);
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
    throw new Error("Questão incompatível com a matriz de operações da série.");
  }
  return question;
};


/** Matriz única de operações por série, para cliente e servidor. */
const BASIC = ["addition","subtraction"] as const;
const FOUR = [...BASIC,"multiplication","exact-division"] as const;
const SIX = [...FOUR,"exponentiation","radication"] as const;
type Operation = typeof SIX[number];
type GradeRule = {operations:readonly Operation[];operandMax:number;rootMax:number;powerBaseMax:number;progression:readonly [number,number,number]};
export const GRADE_RULES:Readonly<Record<ConcreteGradeLevel,GradeRule>> = {
  5:{operations:BASIC,operandMax:99,rootMax:0,powerBaseMax:0,progression:[49,79,99]},
  6:{operations:FOUR,operandMax:99,rootMax:0,powerBaseMax:0,progression:[59,79,99]},
  7:{operations:FOUR,operandMax:999,rootMax:0,powerBaseMax:0,progression:[399,699,999]},
  8:{operations:SIX,operandMax:9999,rootMax:9,powerBaseMax:9,progression:[3999,6999,9999]},
  9:{operations:SIX,operandMax:9999,rootMax:99,powerBaseMax:99,progression:[6999,8999,9999]}
};
export const GRADE_DESCRIPTIONS:Readonly<Record<GradeLevel,string>> = {
  5:"Adição e subtração • operandos de 1 a 2 algarismos",
  6:"Quatro operações • operandos de 1 a 2 algarismos",
  7:"Quatro operações • operandos de 1 a 3 algarismos",
  8:"Quatro operações • até 4 algarismos; potência e raiz de 1 algarismo (base/resultado)",
  9:"Quatro operações • até 4 algarismos; potência e raiz de até 2 algarismos (base/resultado)",
  mixed:"Todas as séries • cada questão segue as regras da série sorteada"
};

/** Sem série, valida a união dos conteúdos (9º); com série, valida também o currículo. */
export const satisfiesSimpleOperations = (
  question: Pick<MathQuestion,"expression"|"correctAnswer"> & Partial<Pick<MathQuestion,"gradeLevel"|"category">>
): boolean => {
  const rules=GRADE_RULES[question.gradeLevel??9];
  if(!rules) return false;
  const answer=Number(question.correctAnswer);
  if(!Number.isSafeInteger(answer)||answer<0||String(answer)!==question.correctAnswer) return false;
  const allowed=(op:Operation)=>rules.operations.includes(op)&&(question.category===undefined||question.category===op);
  let m=/^(\d{1,4}) ([+\-×÷]) (\d{1,4})$/.exec(question.expression);
  if(m){
    const a=Number(m[1]),b=Number(m[3]);
    if(a>rules.operandMax||b>rules.operandMax) return false;
    switch(m[2]){
      case "+":return allowed("addition")&&a+b===answer;
      case "-":return allowed("subtraction")&&a-b===answer;
      case "×":return allowed("multiplication")&&a*b===answer;
      case "÷":return allowed("exact-division")&&b!==0&&a%b===0&&a/b===answer;
    }
  }
  m=/^(\d{1,2})²$/.exec(question.expression);
  if(m) return allowed("exponentiation")&&Number(m[1])<=rules.powerBaseMax&&Number(m[1])**2===answer;
  m=/^(√|∛)(\d{1,6})$/.exec(question.expression);
  if(m){
    const value=Number(m[2]);
    return allowed("radication")&&answer<=rules.rootMax&&(m[1]==="√"?answer**2:answer**3)===value;
  }
  return false;
};

/** Amostra também números menores para variar o cálculo mental. */
const operand=(r:Random,max:number,min=1):number=>{
  if(max<min) throw new RangeError("Limite de operando inválido");
  const digits=String(max).length;
  const smaller=digits>1&&r()<0.25;
  const ceiling=smaller?Math.min(max,10**int(r,1,digits-1)-1):max;
  return int(r,min,Math.max(min,ceiling));
};

/** Misto sorteia a série primeiro; nenhum jogo pode ultrapassar sua matriz. */
export const generateQuestion=(grade:GradeLevel,options:{difficulty?:Difficulty;seed?:string}={}):MathQuestion=>{
  const difficulty=options.difficulty??1,seed=options.seed;
  if(![1,2,3].includes(difficulty)) throw new RangeError("Dificuldade inválida");
  const r=seed!==undefined?seededRandom(seed):Math.random;
  const level:ConcreteGradeLevel=grade==="mixed"?pick(r,GRADE_LEVELS):grade;
  const rules=GRADE_RULES[level];
  if(!rules) throw new RangeError("Série escolar inválida");
  const max=rules.progression[difficulty-1]!;
  const category=pick(r,rules.operations);
  if(category==="addition"){
    const a=operand(r,max),b=operand(r,max);
    return q(level,category,a+" + "+b,String(a+b),difficulty,seed);
  }
  if(category==="subtraction"){
    const a=operand(r,max),b=operand(r,a,0);
    return q(level,category,a+" - "+b,String(a-b),difficulty,seed);
  }
  if(category==="multiplication"){
    const a=operand(r,max,2),b=operand(r,max,2);
    return q(level,category,a+" × "+b,String(a*b),difficulty,seed);
  }
  if(category==="exact-division"){
    // Constrói o dividendo pelo produto, sem arredondar ou exceder o limite.
    const divisor=operand(r,Math.floor(max/2),2);
    const quotient=operand(r,Math.floor(max/divisor),2);
    return q(level,category,(divisor*quotient)+" ÷ "+divisor,String(quotient),difficulty,seed);
  }
  const advancedMax=level===9?[39,69,99][difficulty-1]!: [5,7,9][difficulty-1]!;
  if(category==="exponentiation"){
    const base=operand(r,Math.min(rules.powerBaseMax,advancedMax),2);
    return q(level,category,base+"²",String(base**2),difficulty,seed);
  }
  const value=operand(r,Math.min(rules.rootMax,advancedMax),2);
  const cubic=r()<0.35;
  return q(level,category,(cubic?"∛":"√")+String(cubic?value**3:value**2),String(value),difficulty,seed);
};

/** Corrida Maluca e bombas usam exatamente a mesma matriz. */
export const generateRaceQuestion=(
  grade:GradeLevel,options:{difficulty?:Difficulty;seed?:string}={}
):MathQuestion=>generateQuestion(grade,options);
