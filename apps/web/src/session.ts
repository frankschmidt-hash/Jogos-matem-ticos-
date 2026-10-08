export type ClientSession = {
  sessionId:string;
  reconnectToken:string;
  nickname:string;
  gradeLevel:5|6|7|"mixed";
  connectionState:string;
  createdAt:number;
  lastSeenAt:number
};

const KEY="jogos-matematicos-session";
const configuredApi=import.meta.env.VITE_API_URL;
// The production frontend and API share one host; never send player data to a build-time external URL.
export const apiBase=import.meta.env.PROD ? "" : (configuredApi?.trim() || "http://localhost:3001");

export const saveSession=(s:ClientSession)=>localStorage.setItem(KEY,JSON.stringify(s));
export const loadSession=():ClientSession|null=>{
  try { const raw=localStorage.getItem(KEY); return raw?JSON.parse(raw):null; }
  catch { return null; }
};
export const clearSession=()=>localStorage.removeItem(KEY);

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
  if(!response.ok) throw new Error(data.error??"Falha de sessão.");
  if(data.session) saveSession(data.session);
  return data.session as ClientSession;
}

export async function claimSession(nickname:string,gradeLevel:5|6|7|"mixed") {
  return postSession("/api/session/claim",{nickname,gradeLevel});
}

export async function reconnectSession(session:ClientSession) {
  try {
    return await postSession("/api/session/reconnect",{sessionId:session.sessionId,reconnectToken:session.reconnectToken});
  } catch (error) {
    clearSession();
    throw error;
  }
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
