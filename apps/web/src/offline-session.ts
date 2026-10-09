import { validateNickname, normalizeNickname } from "../../server/src/session-manager";

export type ClientSession = {
  sessionId:string;
  reconnectToken:string;
  nickname:string;
  gradeLevel:5|6|7|8|9|"mixed";
  connectionState:string;
  createdAt:number;
  lastSeenAt:number;
};
export type LeaderboardGame="property-math"|"crazy-race"|"number-race"|"math-football";
export type LeaderboardEntry={nickname:string;score:number;secondary:number;achievedAt:number};
export type Leaderboards=Record<LeaderboardGame,LeaderboardEntry[]>;

const SESSION_KEY="jogos-matematicos-offline-session-v1";
const RANKING_KEY="jogos-matematicos-offline-rankings-v1";
const GAMES:LeaderboardGame[]=["property-math","crazy-race","number-race","math-football"];
const SCORE_LIMITS:Record<LeaderboardGame,number>={
  "property-math":10_000_000,"crazy-race":3_000,"number-race":3_000,"math-football":1_000
};
const empty=():Leaderboards=>({
  "property-math":[],"crazy-race":[],"number-race":[],"math-football":[]
});
const compare=(a:LeaderboardEntry,b:LeaderboardEntry):number=>
  b.score-a.score||b.secondary-a.secondary||a.achievedAt-b.achievedAt||a.nickname.localeCompare(b.nickname,"pt-BR");

let inMemorySession:ClientSession|null=null;
let inMemoryRankings:Leaderboards=empty();
const storage={
  read(key:string):string|null { try{return localStorage.getItem(key);}catch{return null;} },
  write(key:string,value:string):void {try{localStorage.setItem(key,value);}catch{/* Política local restringe armazenamento: mantém sessão em memória. */}},
  remove(key:string):void {try{localStorage.removeItem(key);}catch{/* ignora */}}
};
const newId=()=>{
  if(typeof crypto.randomUUID==="function") return crypto.randomUUID();
  const bytes=new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
};
const readBoards=():Leaderboards=>{
  const result=empty();
  try{
    const value=storage.read(RANKING_KEY);
    const saved=value?JSON.parse(value):inMemoryRankings;
    for(const game of GAMES){
      const rows=saved?.[game];
      if(!Array.isArray(rows)) continue;
      result[game]=rows.filter((row:unknown):row is LeaderboardEntry=>{
        if(!row||typeof row!=="object") return false;
        const x=row as LeaderboardEntry;
        return typeof x.nickname==="string"&&validateNickname(x.nickname).ok&&
          Number.isSafeInteger(x.score)&&x.score>0&&x.score<=SCORE_LIMITS[game]&&
          Number.isSafeInteger(x.secondary)&&Math.abs(x.secondary)<=10_000_000&&
          Number.isSafeInteger(x.achievedAt)&&x.achievedAt>=0;
      }).sort(compare).slice(0,10);
    }
  }catch{/* Ignora dados corrompidos, mantém edição offline operacional. */}
  return result;
};
export const apiBase="";
export const saveSession=(s:ClientSession):void=>{
  inMemorySession=s;
  storage.write(SESSION_KEY,JSON.stringify(s));
};
export const loadSession=():ClientSession|null=>{
  try{
    const raw=storage.read(SESSION_KEY);
    const candidate=raw?JSON.parse(raw) as ClientSession:inMemorySession;
    if(!candidate||!validateNickname(candidate.nickname).ok||
      ![5,6,7,8,9,"mixed"].includes(candidate.gradeLevel)) return null;
    return {...candidate,connectionState:"connected"};
  }catch{return inMemorySession;}
};
export const clearSession=():void=>{
  inMemorySession=null;
  storage.remove(SESSION_KEY);
};
export async function claimSession(nickname:string,gradeLevel:ClientSession["gradeLevel"]):Promise<ClientSession>{
  const name=validateNickname(nickname);
  if(!name.ok) throw new Error(name.reason);
  if(![5,6,7,8,9,"mixed"].includes(gradeLevel)) throw new Error("Selecione uma série válida.");
  const now=Date.now();
  const session:ClientSession={
    sessionId:newId(),reconnectToken:newId()+newId(),nickname:name.clean,
    gradeLevel,connectionState:"connected",createdAt:now,lastSeenAt:now
  };
  saveSession(session);
  return session;
}
export async function reconnectSession(session:ClientSession):Promise<ClientSession>{
  const updated={...session,connectionState:"connected",lastSeenAt:Date.now()};
  saveSession(updated);
  return updated;
}
export async function heartbeatSession(session:ClientSession):Promise<ClientSession>{
  return reconnectSession(session);
}
export async function disconnectSession(_session:ClientSession):Promise<ClientSession>{
  return _session;
}
export function notifyDisconnect(_session:ClientSession):void{/* Nenhuma conexão remota na edição offline. */}
export async function fetchLeaderboards():Promise<Leaderboards>{return readBoards();}
export async function recordSoloResult(
  session:ClientSession,gameId:LeaderboardGame,score:number,_runId:string,secondary=0
):Promise<void>{
  if(!GAMES.includes(gameId)||!Number.isSafeInteger(score)||score<=0||score>SCORE_LIMITS[gameId]||
    !Number.isSafeInteger(secondary)||Math.abs(secondary)>10_000_000) return;
  const valid=validateNickname(session.nickname);
  if(!valid.ok) return;
  const boards=readBoards();
  const candidate:LeaderboardEntry={nickname:valid.clean,score,secondary,achievedAt:Date.now()};
  const current=boards[gameId].find(row=>normalizeNickname(row.nickname)===valid.normalized);
  if(current&&compare(candidate,current)>=0) return;
  boards[gameId]=[...boards[gameId].filter(row=>normalizeNickname(row.nickname)!==valid.normalized),candidate]
    .sort(compare).slice(0,10);
  inMemoryRankings=boards;
  storage.write(RANKING_KEY,JSON.stringify(boards));
}
export function downloadOfflineResults():void{
  const rows=["Jogo;Posição;Apelido;Pontuação;Desempate;Data"];
  const clean=(value:string):string=>{
    const safe=/^[=+\-@\t\r]/.test(value)?"'"+value:value;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  const titles:Record<LeaderboardGame,string>={
    "property-math":"Banco Imobiliário","crazy-race":"Corrida Maluca",
    "number-race":"Corrida Numérica","math-football":"Futebol Matemático"
  };
  const boards=readBoards();
  for(const game of GAMES) boards[game].forEach((row,i)=>{
    rows.push([clean(titles[game]),i+1,clean(row.nickname),row.score,row.secondary,
      clean(new Date(row.achievedAt).toLocaleString("pt-BR"))].join(";"));
  });
  const blob=new Blob(["\uFEFF"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download="Jogos-Matematicos-Ranking-Offline.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
