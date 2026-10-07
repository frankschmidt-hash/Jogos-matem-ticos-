export type PropertyGroup = "horizonte" | "prisma" | "aurora" | "circuito" | "orbita" | "saber";

export type BoardSpace =
  | {index:number; type:"start"; name:string}
  | {index:number; type:"property"; name:string; group:PropertyGroup; price:number; rent:number; upgradeCost:number}
  | {index:number; type:"tax"; name:string; amount:number}
  | {index:number; type:"bonus"; name:string; amount:number}
  | {index:number; type:"event"; name:string}
  | {index:number; type:"rest"; name:string}
  | {index:number; type:"penalty"; name:string; amount:number}
  | {index:number; type:"transport"; name:string; amount:number}
  | {index:number; type:"service"; name:string; amount:number};

export const BOARD: readonly BoardSpace[] = [
  {index:0,type:"start",name:"Portal de Partida"},
  {index:1,type:"property",name:"Rua do Compasso",group:"horizonte",price:120,rent:20,upgradeCost:80},
  {index:2,type:"event",name:"Carta da Cidade"},
  {index:3,type:"property",name:"Praça das Frações",group:"horizonte",price:130,rent:22,upgradeCost:80},
  {index:4,type:"tax",name:"Taxa de Conservação",amount:80},
  {index:5,type:"transport",name:"Estação Vetor",amount:40},
  {index:6,type:"property",name:"Alameda Prisma",group:"prisma",price:160,rent:28,upgradeCost:100},
  {index:7,type:"bonus",name:"Bolsa de Estudos",amount:100},
  {index:8,type:"property",name:"Jardim Decimal",group:"prisma",price:170,rent:30,upgradeCost:100},
  {index:9,type:"rest",name:"Biblioteca Central"},
  {index:10,type:"property",name:"Avenida Aurora",group:"aurora",price:200,rent:36,upgradeCost:120},
  {index:11,type:"event",name:"Carta da Cidade"},
  {index:12,type:"property",name:"Parque Pitágoras",group:"aurora",price:210,rent:38,upgradeCost:120},
  {index:13,type:"service",name:"Centro de Energia",amount:45},
  {index:14,type:"property",name:"Vila Equação",group:"circuito",price:230,rent:42,upgradeCost:140},
  {index:15,type:"penalty",name:"Manutenção Urbana",amount:100},
  {index:16,type:"property",name:"Rua dos Algoritmos",group:"circuito",price:240,rent:44,upgradeCost:140},
  {index:17,type:"bonus",name:"Feira de Ciências",amount:120},
  {index:18,type:"rest",name:"Praça do Intervalo"},
  {index:19,type:"property",name:"Boulevard Órbita",group:"orbita",price:270,rent:50,upgradeCost:160},
  {index:20,type:"event",name:"Carta da Cidade"},
  {index:21,type:"property",name:"Largo do Infinito",group:"orbita",price:280,rent:52,upgradeCost:160},
  {index:22,type:"tax",name:"Fundo de Melhorias",amount:110},
  {index:23,type:"transport",name:"Terminal Tangente",amount:50},
  {index:24,type:"property",name:"Avenida do Saber",group:"saber",price:320,rent:60,upgradeCost:180},
  {index:25,type:"event",name:"Carta da Cidade"},
  {index:26,type:"property",name:"Mirante da Lógica",group:"saber",price:340,rent:64,upgradeCost:180},
  {index:27,type:"service",name:"Laboratório Municipal",amount:55},
  {index:28,type:"property",name:"Travessa Horizonte",group:"horizonte",price:145,rent:25,upgradeCost:80},
  {index:29,type:"bonus",name:"Prêmio de Projeto",amount:90},
  {index:30,type:"property",name:"Galeria Prisma",group:"prisma",price:185,rent:33,upgradeCost:100},
  {index:31,type:"event",name:"Carta da Cidade"},
  {index:32,type:"property",name:"Bosque Aurora",group:"aurora",price:220,rent:40,upgradeCost:120},
  {index:33,type:"property",name:"Distrito Circuito",group:"circuito",price:255,rent:47,upgradeCost:140},
  {index:34,type:"property",name:"Observatório Órbita",group:"orbita",price:300,rent:56,upgradeCost:160},
  {index:35,type:"property",name:"Campus do Saber",group:"saber",price:360,rent:68,upgradeCost:180}
] as const;

export const GROUP_LABELS: Record<PropertyGroup,string> = {
  horizonte:"Horizonte",
  prisma:"Prisma",
  aurora:"Aurora",
  circuito:"Circuito",
  orbita:"Órbita",
  saber:"Saber"
};

export function getSpace(index:number): BoardSpace {
  const space=BOARD[index];
  if(!space) throw new Error("Casa inválida.");
  return space;
}

export function groupPropertyIndexes(group:PropertyGroup): number[] {
  return BOARD.filter((space): space is Extract<BoardSpace,{type:"property"}> => space.type==="property" && space.group===group).map(space=>space.index);
}
