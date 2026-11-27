export type ClientSession = {
  sessionId:string;
  reconnectToken:string;
  nickname:string;
  gradeLevel:5|6|7|8|9|"mixed";
  connectionState:string;
  createdAt:number;
  lastSeenAt:number
};

const KEY="jogos-matematicos-session";
const configuredApi=import.meta.env.VITE_API_URL;
// The production frontend and API share one host; never send player data to a build-time external URL.
// The Docker build stage may use NODE_ENV=development even for a public deployment.
// Detect local development using the browser hostname, never the compile-time PROD flag.
const localBrowser=typeof window!=="undefined" && ["localhost","127.0.0.1","[::1]"].includes(window.location.hostname);
export const apiBase=localBrowser ? (configuredApi?.trim() || "http://localhost:3001") : "";

// Each browser tab has its own credentials; reloading the same tab retains them.
// Migrate a legacy shared session once, then stop sharing credentials across tabs.
export const saveSession=(s:ClientSession)=>sessionStorage.setItem(KEY,JSON.stringify(s));
export const loadSession=():ClientSession|null=>{
  try {
    let raw=sessionStorage.getItem(KEY);
    if(!raw){
      raw=localStorage.getItem(KEY);
      if(raw){sessionStorage.setItem(KEY,raw);localStorage.removeItem(KEY);}
    }
    return raw?JSON.parse(raw):null;
  }catch{return null;}
};
export const clearSession=()=>sessionStorage.removeItem(KEY);
export class SessionRequestError extends Error{
  constructor(message:string,public status:number){super(message);}
}
export const isSessionExpired=(error:unknown)=>error instanceof SessionRequestError&&error.status===401;
export const isNicknameUnavailable=(error:unknown)=>error instanceof SessionRequestError&&error.status===409;

async function postSession(path:string, body:object) {
  let response:Response;
  try {
    response=await fetch(`${apiBase}${path}`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body)
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Atualize a página e verifique a conexão.");
  }
  const data=await response.json();
  if(!response.ok) throw new SessionRequestError(data.error??"Falha de sessão.",response.status);
  return data.session as ClientSession;
}

export type LeaderboardGame="property-math"|"crazy-race"|"number-race"|"math-football";
export type LeaderboardEntry={nickname:string;score:number;secondary:number;achievedAt:number};
export type Leaderboards=Record<LeaderboardGame,LeaderboardEntry[]>;

export async function fetchLeaderboards():Promise<Leaderboards>{
  const response=await fetch(apiBase+"/api/leaderboards",{cache:"no-store"});
  if(!response.ok) throw new Error("Ranking indisponível.");
  const data=await response.json() as {ok:boolean;rankings:Leaderboards};
  if(!data.ok) throw new Error("Ranking indisponível.");
  return data.rankings;
}

export async function recordSoloResult(session:ClientSession,gameId:LeaderboardGame,
  score:number,runId:string,secondary=0):Promise<void>{
  const response=await fetch(apiBase+"/api/leaderboards/solo",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({sessionId:session.sessionId,reconnectToken:session.reconnectToken,gameId,score,secondary,runId})
  });
  if(!response.ok) throw new Error("Não foi possível registrar a pontuação.");
}

export async function claimSession(nickname:string,gradeLevel:5|6|7|8|9|"mixed") {
  const session=await postSession("/api/session/claim",{nickname,gradeLevel});
  saveSession(session);
  return session;
}

export async function reconnectSession(session:ClientSession) {
  return postSession("/api/session/reconnect",{sessionId:session.sessionId,reconnectToken:session.reconnectToken});
}

export async function heartbeatSession(session:ClientSession) {
  return postSession("/api/session/heartbeat",{sessionId:session.sessionId,reconnectToken:session.reconnectToken});
}

export async function disconnectSession(session:ClientSession) {
  return postSession("/api/session/disconnect",{sessionId:session.sessionId,reconnectToken:session.reconnectToken});
}

export function notifyDisconnect(session:ClientSession) {
  const body=JSON.stringify({sessionId:session.sessionId,reconnectToken:session.reconnectToken});
  navigator.sendBeacon?.(`${apiBase}/api/session/disconnect`,new Blob([body],{type:"application/json"}));
}

// Single flight: heartbeat, focus and the football lobby must not create competing sessions.
const recoveries=new Map<string,Promise<ClientSession>>();
export function ensureActiveSession(session:ClientSession):Promise<ClientSession>{
  const saved=loadSession();
  if(saved&&saved.sessionId!==session.sessionId&&saved.nickname===session.nickname&&saved.gradeLevel===session.gradeLevel)
    return ensureActiveSession(saved);
  const existing=recoveries.get(session.sessionId);
  if(existing)return existing;
  const promise=(async()=>{
    let active:ClientSession;
    try{active=await heartbeatSession(session);}
    catch(error){
      if(!isSessionExpired(error))throw error;
      // A lost session cannot recover its old rooms or inherit another player's identity.
      // Only a free nickname can be claimed, through the same validated endpoint.
      active=await claimSession(session.nickname,session.gradeLevel);
    }
    saveSession(active);
    return active;
  })().finally(()=>recoveries.delete(session.sessionId));
  recoveries.set(session.sessionId,promise);
  return promise;
}
