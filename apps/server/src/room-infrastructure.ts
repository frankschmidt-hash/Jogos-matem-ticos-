import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type RoomLifecycleState =
  | "waiting"
  | "ready"
  | "countdown"
  | "playing"
  | "round-resolution"
  | "finished"
  | "closed";

export type PresenceState =
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "abandoned";

export type StoredPassword={salt:string;hash:string};

export type CoreRoomMember={
  sessionId:string;
  nickname:string;
  connected:boolean;
  presence:PresenceState;
  joinedAt:number;
  lastSeenAt:number;
  disconnectedAt?:number;
  reconnectUntil?:number;
};

export type MemberInput={
  sessionId:string;
  nickname:string;
  connected?:boolean;
};

export type LifecycleCarrier={
  lifecycleState:RoomLifecycleState;
  lifecycleHistory:RoomLifecycleState[];
};

export const ROOM_CODE_LENGTH=6;
export const RECONNECT_GRACE_MS=30_000;
export const NETWORK_GRACE_MS=250;
export const EMPTY_ROOM_TTL_MS=60_000;
export const ROOM_TTL_MS=2*60*60*1000;

const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TRANSITIONS:Record<RoomLifecycleState,RoomLifecycleState[]>={
  waiting:["ready","closed"],
  ready:["waiting","countdown","closed"],
  countdown:["playing","closed"],
  playing:["round-resolution","finished","closed"],
  "round-resolution":["playing","finished","closed"],
  finished:["ready","closed"],
  closed:[]
};

export class RoomInfrastructure{
  private allocatedCodes=new Map<string,string>();
  private rateBuckets=new Map<string,number[]>();
  private replayKeys=new Map<string,number>();

  allocateCode(scope:string):string{
    for(let attempt=0;attempt<100;attempt++){
      const bytes=randomBytes(ROOM_CODE_LENGTH);
      let code="";
      for(let i=0;i<ROOM_CODE_LENGTH;i++) code+=ALPHABET[bytes[i]!%ALPHABET.length]!;
      if(!this.allocatedCodes.has(code)){
        this.allocatedCodes.set(code,scope);
        return code;
      }
    }
    throw new Error("Não foi possível gerar código de sala.");
  }

  releaseCode(code:string):void{
    this.allocatedCodes.delete(this.normalizeCode(code));
  }

  normalizeCode(code:string):string{
    return code.normalize("NFKC").trim().toUpperCase().replace(/[^A-Z2-9]/g,"");
  }

  createPassword(password:string):StoredPassword{
    if(password.length<4||password.length>32) throw new Error("A senha deve ter entre 4 e 32 caracteres.");
    const salt=randomBytes(16).toString("hex");
    return {salt,hash:scryptSync(password,salt,32).toString("hex")};
  }

  verifyPassword(
    scope:string,code:string,sessionId:string,password:string,stored:StoredPassword,now=Date.now()
  ):void{
    const key="password:"+scope+":"+this.normalizeCode(code)+":"+sessionId;
    this.assertRateLimit(key,5,60_000,now,"Muitas tentativas. Aguarde um momento.");
    const candidate=scryptSync(password,stored.salt,32);
    const expected=Buffer.from(stored.hash,"hex");
    const ok=candidate.length===expected.length&&timingSafeEqual(candidate,expected);
    if(!ok) throw new Error("Código ou senha inválidos.");
    this.rateBuckets.delete(key);
  }

  createMember(input:MemberInput,now=Date.now()):CoreRoomMember{
    return {
      sessionId:input.sessionId,
      nickname:input.nickname.normalize("NFKC").trim().replace(/\s+/g," "),
      connected:true,
      presence:"connected",
      joinedAt:now,
      lastSeenAt:now
    };
  }

  reconnectMember(member:CoreRoomMember,now=Date.now()):void{
    if(member.presence==="abandoned") throw new Error("A vaga deste jogador expirou.");
    member.connected=true;
    member.presence="connected";
    member.lastSeenAt=now;
    delete member.disconnectedAt;
    delete member.reconnectUntil;
  }

  disconnectMember(member:CoreRoomMember,now=Date.now()):void{
    if(member.presence==="abandoned") return;
    member.connected=false;
    member.presence="reconnecting";
    member.lastSeenAt=now;
    member.disconnectedAt=now;
    member.reconnectUntil=now+RECONNECT_GRACE_MS;
  }

  abandonMember(member:CoreRoomMember,now=Date.now()):void{
    member.connected=false;
    member.presence="abandoned";
    member.lastSeenAt=now;
    delete member.reconnectUntil;
  }

  sweepPresence(members:CoreRoomMember[],now=Date.now()):boolean{
    let changed=false;
    for(const member of members){
      if(member.presence!=="reconnecting"&&member.presence!=="disconnected") continue;
      const disconnectedAt=member.disconnectedAt??member.lastSeenAt;
      const reconnectUntil=member.reconnectUntil??(disconnectedAt+RECONNECT_GRACE_MS);
      if(now>=reconnectUntil){
        this.abandonMember(member,now);
        changed=true;
      }else if(now-disconnectedAt>=RECONNECT_GRACE_MS/2&&member.presence==="reconnecting"){
        member.presence="disconnected";
        member.lastSeenAt=now;
        changed=true;
      }
    }
    return changed;
  }

  waitingState(members:CoreRoomMember[],minimumConnected:number):"waiting"|"ready"{
    return members.filter(m=>m.connected&&m.presence==="connected").length>=minimumConnected?"ready":"waiting";
  }

  nextHost(members:CoreRoomMember[],currentHost:string):string|null{
    const current=members.find(m=>m.sessionId===currentHost);
    if(current&&current.presence!=="abandoned") return currentHost;
    const eligible=members
      .filter(m=>m.presence!=="abandoned")
      .sort((a,b)=>a.joinedAt-b.joinedAt||a.sessionId.localeCompare(b.sessionId));
    return eligible[0]?.sessionId??null;
  }

  transition(room:LifecycleCarrier,next:RoomLifecycleState):void{
    if(room.lifecycleState===next) return;
    if(!TRANSITIONS[room.lifecycleState].includes(next)){
      throw new Error("Transição de estado de sala inválida.");
    }
    room.lifecycleState=next;
    room.lifecycleHistory.push(next);
  }

  capacity(members:CoreRoomMember[],max:number){
    const occupied=members.filter(m=>m.presence!=="abandoned").length;
    return {max,occupied,available:Math.max(0,max-occupied)};
  }

  assertActionRate(scope:string,sessionId:string,now=Date.now(),limit=30,windowMs=10_000):void{
    this.assertRateLimit("action:"+scope+":"+sessionId,limit,windowMs,now,"Muitas ações em sequência. Aguarde um momento.");
  }

  isReplay(scope:string,sessionId:string,clientSubmissionId:string,now=Date.now(),ttlMs=5*60_000):boolean{
    const key=scope+":"+sessionId+":"+clientSubmissionId;
    const existing=this.replayKeys.get(key);
    if(existing!==undefined&&existing>now) return true;
    this.replayKeys.set(key,now+ttlMs);
    return false;
  }

  cleanup(now=Date.now()):void{
    for(const [key,times] of this.rateBuckets){
      const fresh=times.filter(t=>now-t<60_000);
      if(fresh.length) this.rateBuckets.set(key,fresh);
      else this.rateBuckets.delete(key);
    }
    for(const [key,expiresAt] of this.replayKeys){
      if(now>=expiresAt) this.replayKeys.delete(key);
    }
  }

  private assertRateLimit(key:string,limit:number,windowMs:number,now:number,message:string):void{
    const fresh=(this.rateBuckets.get(key)??[]).filter(t=>now-t<windowMs);
    if(fresh.length>=limit) throw new Error(message);
    fresh.push(now);
    this.rateBuckets.set(key,fresh);
  }
}

export const roomInfrastructure=new RoomInfrastructure();
