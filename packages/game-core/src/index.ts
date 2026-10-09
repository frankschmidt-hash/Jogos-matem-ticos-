export type GameId = "property-math" | "crazy-race" | "number-race" | "math-football";
export type ConnectionState = "connected" | "reconnecting" | "disconnected";
export type GradeSelection = 5 | 6 | 7 | 8 | 9 | "mixed";

export type PublicPlayer = {
  sessionId: string;
  nickname: string;
  gradeLevel: GradeSelection;
  connectionState: ConnectionState;
};

export const GAME_CATALOG: Array<{id: GameId; name: string; description: string}> = [
  {id:"property-math", name:"Banco Imobiliário Matemático", description:"Compre propriedades e avance resolvendo operações."},
  {id:"crazy-race", name:"Corrida Maluca", description:"Acerte contas, acelere e use desafios matemáticos na corrida."},
  {id:"number-race", name:"Corrida Numérica", description:"Precisão e sequência de acertos movem seu carro pela pista."},
  {id:"math-football", name:"Futebol Matemático", description:"Resolva a operação para converter a cobrança de pênalti."}
];
