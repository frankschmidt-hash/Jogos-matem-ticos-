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
  9:{operations:SIX,operandMax:9999,rootMax:99,powerBaseMax:9,progression:[6999,8999,9999]}
};
export const GRADE_DESCRIPTIONS:Readonly<Record<GradeLevel,string>> = {
  5:"Adição e subtração • operandos de 1 a 2 algarismos",
  6:"Quatro operações • operandos de 1 a 2 algarismos",
  7:"Quatro operações • operandos de 1 a 3 algarismos",
  8:"Quatro operações • até 4 algarismos; quadrado com base de 1 algarismo; raiz quadrada com resultado de 1 algarismo",
  9:"Quatro operações • até 4 algarismos; quadrado e raiz quadrada com resultados de até 2 algarismos",
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
  m=/^([1-9])²$/.exec(question.expression);
  if(m) return allowed("exponentiation")&&Number(m[1])<=rules.powerBaseMax&&answer<=99&&Number(m[1])**2===answer;
  m=/^√([1-9]\d{0,3})$/.exec(question.expression);
  if(m){
    const value=Number(m[1]);
    return allowed("radication")&&answer>=1&&answer<=rules.rootMax&&answer**2===value;
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

export type QuestionOptions={difficulty?:Difficulty;seed?:string;sequenceKey?:string};

/** Todos os quadrados de 1 a 9 estão disponíveis em qualquer dificuldade.
 * A dificuldade altera a frequência, não exclui os quadrados pequenos. */
const smallSquareBase=(r:Random,difficulty:Difficulty):number=>{
  const biased=r()<0.7;
  return difficulty===1&&biased?int(r,1,5):difficulty===3&&biased?int(r,5,9):int(r,1,9);
};

const generateCandidate=(level:ConcreteGradeLevel,difficulty:Difficulty,r:Random,seed?:string,operation?:Operation):MathQuestion=>{
  const rules=GRADE_RULES[level],max=rules.progression[difficulty-1]!;
  const category=operation??pick(r,rules.operations);
  if(category==="addition"){
    const a=operand(r,max),b=operand(r,max);
    return q(level,category,a+" + "+b,String(a+b),difficulty,seed);
  }
  if(category==="subtraction"){
    const a=operand(r,max),b=operand(r,a,0);
    return q(level,category,a+" - "+b,String(a-b),difficulty,seed);
  }
  if(category==="multiplication"){
    const a=operand(r,max),b=operand(r,max);
    return q(level,category,a+" × "+b,String(a*b),difficulty,seed);
  }
  if(category==="exact-division"){
    const factor=operand(r,Math.floor(max/2),2);
    const other=operand(r,Math.floor(max/factor),2);
    // Varia tanto o dividendo quanto o divisor e o quociente.
    const [divisor,quotient]=r()<0.5?[factor,other]:[other,factor];
    return q(level,category,(divisor*quotient)+" ÷ "+divisor,String(quotient),difficulty,seed);
  }
  if(category==="exponentiation"){
    const base=smallSquareBase(r,difficulty);
    return q(level,category,base+"²",String(base**2),difficulty,seed);
  }
  // Apenas índice 2. O limite aplica-se ao resultado, não ao radicando.
  const value=level===8?smallSquareBase(r,difficulty):
    operand(r,[39,69,99][difficulty-1]!);
  return q(level,category,"√"+String(value**2),String(value),difficulty,seed);
};

/** Histórico limitado por jogador/sala; não interfere com o gerador puro.
 * Mesmo seed dentro da mesma sequência devolve a mesma questão (re-render/reenvio).
 * Inverter parcelas ou fatores não constitui uma questão nova. */
export const RECENT_QUESTION_LIMIT=40;
const MAX_SEQUENCE_COUNT=512,MAX_SEED_CACHE=64;
type Sequence={recent:string[];cache:Map<string,MathQuestion>};
const sequences=new Map<string,Sequence>();
const sequenceFor=(key:string):Sequence=>{
  const existing=sequences.get(key);
  const state=existing??{recent:[],cache:new Map<string,MathQuestion>()};
  sequences.delete(key);sequences.set(key,state);
  while(sequences.size>MAX_SEQUENCE_COUNT)sequences.delete(sequences.keys().next().value!);
  return state;
};
export const questionVarietyKey=(question:Pick<MathQuestion,"expression">):string=>{
  const m=/^(\d+) ([+×]) (\d+)$/.exec(question.expression);
  if(!m)return question.expression;
  const a=Number(m[1]),b=Number(m[3]);
  return Math.min(a,b)+" "+m[2]+" "+Math.max(a,b);
};

/** Misto sorteia a série uma vez; novas tentativas nunca mudam sua série. */
export const generateQuestion=(grade:GradeLevel,options:QuestionOptions={}):MathQuestion=>{
  const difficulty=options.difficulty??1,seed=options.seed;
  if(![1,2,3].includes(difficulty))throw new RangeError("Dificuldade inválida");
  if(grade!=="mixed"&&!GRADE_LEVELS.includes(grade))throw new RangeError("Série escolar inválida");
  const r=seed!==undefined?seededRandom(seed):Math.random;
  const level:ConcreteGradeLevel=grade==="mixed"?pick(r,GRADE_LEVELS):grade;
  if(options.sequenceKey===undefined)return generateCandidate(level,difficulty,r,seed);
  const state=sequenceFor(options.sequenceKey);
  const cacheKey=seed===undefined?undefined:JSON.stringify([grade,difficulty,seed]);
  if(cacheKey!==undefined){
    const previous=state.cache.get(cacheKey);
    if(previous)return previous;
  }
  const idSeed=seed??crypto.randomUUID();
  let candidate=generateCandidate(level,difficulty,r,idSeed);
  const category=candidate.category as Operation;
  const used=(question:MathQuestion)=>state.recent.includes(questionVarietyKey(question));
  // Mantém a categoria inicial sempre que há variedade suficiente.
  for(let i=0;i<32&&used(candidate);i++)candidate=generateCandidate(level,difficulty,r,idSeed,category);
  // Para quadrados e raízes pequenas, a categoria pode esgotar; use outra permitida.
  for(let i=0;i<64&&used(candidate);i++)candidate=generateCandidate(level,difficulty,r,idSeed);
  if(used(candidate)){
    // Garantia matemática: 41 somas distintas cabem até no 5º ano, nível 1.
    for(let b=1;b<=RECENT_QUESTION_LIMIT+1;b++){
      const fallback=q(level,"addition","1 + "+b,String(1+b),difficulty,idSeed);
      if(!used(fallback)){candidate=fallback;break;}
    }
  }
  state.recent.push(questionVarietyKey(candidate));
  if(state.recent.length>RECENT_QUESTION_LIMIT)state.recent.shift();
  if(cacheKey!==undefined){
    state.cache.set(cacheKey,candidate);
    while(state.cache.size>MAX_SEED_CACHE)state.cache.delete(state.cache.keys().next().value!);
  }
  return candidate;
};

/** Corrida Maluca e bombas usam exatamente a mesma matriz e histórico. */
export const generateRaceQuestion=(grade:GradeLevel,options:QuestionOptions={}):MathQuestion=>generateQuestion(grade,options);
