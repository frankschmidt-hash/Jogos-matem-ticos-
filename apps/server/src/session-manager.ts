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

const OFFENSIVE = new Set(["idiota", "burro", "merda", "porra"]);

export const normalizeNickname = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export const validateNickname = (value: string): {ok:true; clean:string; normalized:string} | {ok:false; reason:string} => {
  const clean = value.normalize("NFKC").trim().replace(/\s+/g," ");
  if (clean.length < 2 || clean.length > 20) return {ok:false, reason:"O nome deve ter entre 2 e 20 caracteres."};
  if (!/^[\p{L}\p{N}_ -]+$/u.test(clean)) return {ok:false, reason:"Use apenas letras, números, espaço, _ ou -."};
  const normalized = normalizeNickname(clean);
  const terms = normalized.split(/[ _-]+/);
  if (terms.some(term => OFFENSIVE.has(term))) return {ok:false, reason:"Escolha outro nome de jogador."};
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
