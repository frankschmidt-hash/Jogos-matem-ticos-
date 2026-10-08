export type GradeSelection = 5 | 6 | 7 | "mixed";
export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export type PlayerSession = {
  sessionId: string;
  reconnectToken: string;
  nickname: string;
  normalizedNickname: string;
  gradeLevel: GradeSelection;
  connectionState: ConnectionState;
  createdAt: number;
  lastSeenAt: number;
  releaseAt?: number;
};

/**
 * Nicknames públicos precisam ser adequados ao ambiente escolar.
 * Normaliza acentos, separadores, letras repetidas e substituições numéricas
 * comuns para impedir tentativas simples de contornar o bloqueio.
 * Termos curtos só são comparados como palavras inteiras para preservar nomes
 * legítimos como "Paulo" e "Computador".
 */
const FORBIDDEN_WORDS = new Set([
  "merda","porra","caralho","buceta","piroca","vagabundo","vagabunda",
  "arrombado","arrombada","escroto","escrota","desgracado","desgracada",
  "otario","otaria","idiota","imbecil","babaca","bosta","cretino",
  "cretina","retardado","retardada","prostituta","prostituto",
  "fedorento","fedorenta","filhodaputa","filhadaputa",
  "cornudo","cornuda","pau no cu","paunocu","filhodamae"
]);
const SHORT_FORBIDDEN = new Set([
  "puta","puto","putinha","putinho","foda","foder","fudeu",
  "fdp","pqp","vsf","cuzao","cuzona","viado","viada",
  "bicha","rola","pica","pau","cu","lixo"
]);
const PROFANITY_FOLD:Record<string,string>={
  "0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","8":"b"
};
const foldForModeration=(value:string):string=>value.normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("pt-BR")
  .replace(/[0134578]/g,character=>PROFANITY_FOLD[character]??character)
  .replace(/[^a-z0-9]+/g,"");
export const hasOffensiveNickname=(nickname:string):boolean=>{
  const normal=nickname.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const words=normal.split(/[ _-]+/).filter(Boolean);
  const forms=[foldForModeration(nickname),...words.map(foldForModeration)];
  // Identifica letras intencionalmente repetidas (ex.: poorrra).
  const variants=forms.flatMap(word=>[word,word.replace(/([a-z])\1+/g,"$1")]);
  return variants.some(value=>
    [...FORBIDDEN_WORDS].some(word=>value.includes(word.replace(/ /g,""))) ||
    SHORT_FORBIDDEN.has(value) ||
    SHORT_FORBIDDEN.has(value.replace(/[0-9]+$/,""))
  );
};

export const normalizeNickname = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export const validateNickname = (value: string): {ok:true; clean:string; normalized:string} | {ok:false; reason:string} => {
  const clean = value.normalize("NFKC").trim().replace(/\s+/g," ");
  if (clean.length < 2 || clean.length > 20) return {ok:false, reason:"O nome deve ter entre 2 e 20 caracteres."};
  if (!/^[\p{L}\p{N}_ -]+$/u.test(clean)) return {ok:false, reason:"Use apenas letras, números, espaço, _ ou -."};
  const normalized = normalizeNickname(clean);
  if (hasOffensiveNickname(clean)) return {ok:false, reason:"Este nickname contém linguagem inadequada. Escolha outro nome para jogar."};
  return {ok:true, clean, normalized};
};

const token = () => crypto.randomUUID().replaceAll("-","") + crypto.randomUUID().replaceAll("-","");

export class SessionManager {
  private sessions = new Map<string, PlayerSession>();
  private nicknameToSession = new Map<string, string>();

  constructor(private reconnectGraceMs = 30_000, private ttlMs = 90_000) {}

  claim(nickname: string, gradeLevel: GradeSelection, now = Date.now()): PlayerSession {
    this.cleanup(now);
    const result = validateNickname(nickname);
    if (!result.ok) throw new Error(result.reason);
    if (this.nicknameToSession.has(result.normalized)) throw new Error("Este nome já está em uso.");
    const sessionId = crypto.randomUUID();
    const session: PlayerSession = {
      sessionId, reconnectToken: token(), nickname: result.clean, normalizedNickname: result.normalized,
      gradeLevel, connectionState:"connected", createdAt:now, lastSeenAt:now
    };
    this.sessions.set(sessionId, session);
    this.nicknameToSession.set(result.normalized, sessionId);
    return {...session};
  }

  heartbeat(sessionId: string, reconnectToken: string, now = Date.now()): PlayerSession {
    const session = this.auth(sessionId, reconnectToken);
    session.lastSeenAt = now; session.connectionState = "connected"; delete session.releaseAt;
    return {...session};
  }

  disconnect(sessionId: string, reconnectToken: string, now = Date.now()): PlayerSession {
    const session = this.auth(sessionId, reconnectToken);
    session.connectionState = "reconnecting"; session.lastSeenAt = now; session.releaseAt = now + this.reconnectGraceMs;
    return {...session};
  }

  reconnect(sessionId: string, reconnectToken: string, now = Date.now()): PlayerSession {
    this.cleanup(now);
    return this.heartbeat(sessionId, reconnectToken, now);
  }

  cleanup(now = Date.now()): number {
    let removed = 0;
    for (const [id, session] of this.sessions) {
      const stale = now - session.lastSeenAt > this.ttlMs;
      const graceExpired = session.releaseAt !== undefined && now >= session.releaseAt;
      if (stale || graceExpired) {
        this.sessions.delete(id);
        if (this.nicknameToSession.get(session.normalizedNickname) === id) this.nicknameToSession.delete(session.normalizedNickname);
        removed++;
      }
    }
    return removed;
  }

  get(sessionId: string): PlayerSession | undefined { const s=this.sessions.get(sessionId); return s ? {...s} : undefined; }

  private auth(sessionId: string, reconnectToken: string): PlayerSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.reconnectToken !== reconnectToken) throw new Error("Sessão inválida ou expirada.");
    return session;
  }
}
