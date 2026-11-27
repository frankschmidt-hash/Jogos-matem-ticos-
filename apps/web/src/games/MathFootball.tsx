import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_SOLO_KICK_MS, createPenaltyMatch, npcDecision, openNextKick, startKick,
  statsFor, submitKick, timeoutKick, type NpcSkill, type PenaltyMatchState,
  type PenaltyPlayer, type PenaltyTarget
} from "@jogos/math-football";
import { generateQuestion, validateAnswer } from "@jogos/math-engine";
import { recordSoloResult } from "../session";
import { HelpRules, ResultFeedback } from "@jogos/ui";
import { apiBase, ensureActiveSession, type ClientSession } from "../session";
import { playSound } from "../experience";
import { FootballStadium } from "./FootballStadium";
import { playFootballCrowd } from "./football-audio";
import "./math-football.css";
import "./math-football-v2.css";
import "./math-football-v3.css";

type RoomQuestion={
  id:string;
  expression:string;
  gradeLevel:number;
  difficulty:number;
  deadlineAt:number|null;
};
type FootballRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:5|6|7|8|9|"mixed";
  members:Array<{sessionId:string;nickname:string;connected:boolean;presence:"connected"|"reconnecting"|"disconnected"|"abandoned"}>;
  status:"waiting"|"playing"|"finished";
  lifecycleState:"waiting"|"ready"|"countdown"|"playing"|"round-resolution"|"finished"|"closed";
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  match:PenaltyMatchState|null;
  question:RoomQuestion|null;
  lastCorrectAnswer:string|null;
  updatedAt:number;
};
type AckResponse={ok:boolean;room?:FootballRoom;error?:string};

const ROOM_KEY="math-football-room-code:";
const roomKey=(session:ClientSession)=>ROOM_KEY+session.sessionId;
const auth=(session:ClientSession)=>({sessionId:session.sessionId,reconnectToken:session.reconnectToken});

function useNow(active:boolean,serverNow?:number){
  const offset=useRef(0);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{
    if(typeof serverNow==="number") offset.current=serverNow-Date.now();
  },[serverNow]);
  useEffect(()=>{
    if(!active) return;
    const timer=window.setInterval(()=>setNow(Date.now()+offset.current),200);
    return ()=>window.clearInterval(timer);
  },[active]);
  return now;
}

function secondsLeft(deadline:number|null|undefined,now:number){
  return deadline?Math.max(0,Math.ceil((deadline-now)/1000)):0;
}

function PlayerDots({match,player}:{match:PenaltyMatchState;player:PenaltyPlayer}){
  const kicks=match.history.filter(k=>k.shooterId===player.id);
  return <div className="football-dots" aria-label={"Cobranças de "+player.name}>
    {Array.from({length:Math.max(5,kicks.length)},(_,index)=>{
      const kick=kicks[index];
      return <span key={index} className={!kick?"pending":kick.goal?"goal":"save"} title={kick?kick.goal?"Gol":"Defesa":"Pendente"}>
        {kick?kick.goal?"✓":"×":"•"}
      </span>;
    })}
  </div>;
}

function Scoreboard({match}:{match:PenaltyMatchState}){
  const [a,b]=match.players;
  return <section className="football-scoreboard">
    <article>
      <strong>{a.name}</strong>
      <b>{match.goals[a.id]??0}</b>
      <PlayerDots match={match} player={a}/>
    </article>
    <div className="football-score-divider">
      <span>{match.suddenDeath?"Morte súbita":"Pênaltis"}</span>
      <small>Cobrança {match.kickNumber}</small>
    </div>
    <article>
      <strong>{b.name}</strong>
      <b>{match.goals[b.id]??0}</b>
      <PlayerDots match={match} player={b}/>
    </article>
  </section>;
}

function FinalPanel({
  match,humanId,onAgain,onLobby
}:{match:PenaltyMatchState;humanId:string;onAgain:()=>void;onLobby:()=>void}){
  const [a,b]=match.players;
  const aStats=statsFor(match,a.id);
  const bStats=statsFor(match,b.id);
  const winner=match.players.find(p=>p.id===match.winnerId);
  const humanWon=match.winnerId===humanId;
  return <section className="panel football-final">
    <img src="/assets/math-football/football-trophy.svg" alt="" className="football-trophy"/>
    <p className="eyebrow">{match.finishReason==="abandonment"?"Partida encerrada por abandono":"Disputa encerrada"}</p>
    <h1>{winner?winner.name+" venceu!":"Fim de jogo"}</h1>
    <p className="football-final-score">{match.goals[a.id]} × {match.goals[b.id]}</p>
    <p>{humanWon?"Vitória confirmada.":"Resultado final confirmado."}</p>
    <div className="football-stats">
      {[{p:a,s:aStats},{p:b,s:bStats}].map(({p,s})=><article key={p.id} className={p.id===humanId?"you":""}>
        <strong>{p.name}</strong>
        <span>{s.correctAnswers} acertos</span>
        <span>{s.errors} erros</span>
        <span>{s.accuracy}% de aproveitamento</span>
      </article>)}
    </div>
    <div className="football-final-actions">
      <button onClick={onAgain}>Revanche</button>
      <button className="button-ghost" onClick={onLobby}>Voltar ao lobby</button>
    </div>
  </section>;
}

function makeSoloMatch(session:ClientSession,skill:NpcSkill,timeMs:number){
  const base=createPenaltyMatch([
    {id:session.sessionId,name:session.nickname,kind:"human"},
    {id:"football-npc",name:skill==="easy"?"Goleiro Júnior":skill==="medium"?"Goleiro Prisma":"Goleiro Mestre",kind:"npc",npcSkill:skill}
  ]);
  return startKick(base,Date.now(),timeMs>0?timeMs:null);
}

function SoloFootball({
  session,skill,timeMs,onExit
}:{session:ClientSession;skill:NpcSkill;timeMs:number;onExit:()=>void}){
  const [match,setMatch]=useState<PenaltyMatchState>(()=>makeSoloMatch(session,skill,timeMs));
  const questionMatchId=useRef(crypto.randomUUID());
  const leaderboardRun=useRef(crypto.randomUUID());
  const [answer,setAnswer]=useState("");
  const [target,setTarget]=useState<PenaltyTarget>(4);
  const [finalReady,setFinalReady]=useState(false);
  const heardKick=useRef(0);
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [correctAnswer,setCorrectAnswer]=useState<string|null>(null);
  const npcPending=useRef(false);
  const timedOutKick=useRef(0);
  const now=useNow(match.phase==="kick-open"&&match.currentShooterId===session.sessionId&&match.kickDeadlineAt!==null);
  const current=match.players.find(p=>p.id===match.currentShooterId)!;
  useEffect(()=>{
    const kick=match.lastKick;
    if(!kick||heardKick.current===kick.number) return;
    heardKick.current=kick.number;
    playSound(kick.goal?"goal":"save");
    playFootballCrowd(kick.goal);
  },[match.lastKick?.number]);
  useEffect(()=>{
    if(match.phase!=="finished"){setFinalReady(false);return;}
    if(match.finishReason==="score") void recordSoloResult(session,"math-football",
      match.goals[session.sessionId]??0,leaderboardRun.current,
      -(match.errors[session.sessionId]??0)).catch(()=>{});
    const timer=window.setTimeout(()=>setFinalReady(true),2400);
    return ()=>window.clearTimeout(timer);
  },[match.phase]);
  const humanTurn=current.id===session.sessionId;
  const question=useMemo(()=>{
    if(match.phase!=="kick-open"||!humanTurn) return null;
    return generateQuestion(session.gradeLevel,{
      difficulty:match.kickNumber<4?1:match.kickNumber<8?2:3,
      sequenceKey:"solo:"+session.sessionId,
      seed:"football-solo-"+session.sessionId+"-"+questionMatchId.current+"-"+match.kickNumber+"-"+match.history.length
    });
  },[humanTurn,match.history.length,match.kickNumber,match.phase,session.gradeLevel,session.sessionId]);

  useEffect(()=>{
    if(match.phase!=="kick-open"||humanTurn||current.kind!=="npc"||npcPending.current) return;
    npcPending.current=true;
    const decision=npcDecision(current.npcSkill??skill);
    const timer=window.setTimeout(()=>{
      setMatch(state=>submitKick(state,current.id,decision.correct,Date.now(),"npc",Math.floor(Math.random()*9) as PenaltyTarget));
      npcPending.current=false;
    },decision.thinkingMs);
    return ()=>window.clearTimeout(timer);
  },[current,humanTurn,match.phase,skill]);

  useEffect(()=>{
    if(!humanTurn||match.phase!=="kick-open"||match.kickDeadlineAt===null||now<match.kickDeadlineAt) return;
    if(timedOutKick.current===match.kickNumber) return;
    timedOutKick.current=match.kickNumber;
    if(question) setCorrectAnswer(question.correctAnswer);
    setFeedback("incorrect");
    setMatch(state=>timeoutKick(state,Date.now()));
  },[humanTurn,match.kickDeadlineAt,match.kickNumber,match.phase,now,question]);

  useEffect(()=>{
    if(match.phase!=="kick-resolution") return;
    const timer=window.setTimeout(()=>{
      setMatch(state=>openNextKick(state,Date.now(),timeMs>0?timeMs:null));
      setAnswer("");
      setFeedback(null);
      setCorrectAnswer(null);
    },2600);
    return ()=>window.clearTimeout(timer);
  },[match.phase,timeMs]);

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!question||match.phase!=="kick-open"||!humanTurn) return;
    const correct=validateAnswer(question,answer);
    setFeedback(correct?"correct":"incorrect");
    setCorrectAnswer(correct?null:question.correctAnswer);
    setMatch(state=>submitKick(state,session.sessionId,correct,Date.now(),"answer",target));
  };

  const restart=()=>{
    leaderboardRun.current=crypto.randomUUID();
    questionMatchId.current=crypto.randomUUID();
    setMatch(makeSoloMatch(session,skill,timeMs));
    setAnswer("");
    setTarget(4);
    setFeedback(null);
    setCorrectAnswer(null);
    npcPending.current=false;
    timedOutKick.current=0;
  };

  if(match.phase==="finished"&&finalReady){
    return <main id="main-content" className="football-shell"><FinalPanel match={match} humanId={session.sessionId} onAgain={restart} onLobby={onExit}/></main>;
  }

  return <main id="main-content" className="football-page">
    <header className="football-header">
      <div><p className="eyebrow">Modo solo · {skill==="easy"?"Fácil":skill==="medium"?"Médio":"Difícil"}</p><h1>Futebol Matemático</h1></div>
      <button className="button-ghost" onClick={()=>window.confirm("Sair da disputa atual?")&&onExit()}>Sair</button>
    </header>
    <Scoreboard match={match}/>
    <FootballStadium match={match} selectedTarget={target} onSelectTarget={setTarget} canAim={humanTurn&&match.phase==="kick-open"}>
    <section className="football-question">
      <p className="eyebrow">{humanTurn?"Sua cobrança":current.name+" está cobrando"}</p>
      {match.phase!=="kick-open"&&match.lastKick?<><h2>{match.lastKick.goal?"Gol!":"Defesa do goleiro!"}</h2><ResultFeedback status={match.lastKick.correct?"correct":"incorrect"}/></>:humanTurn&&question?<><h2>{question.expression}</h2>
        <form onSubmit={submit}>
          <input inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Digite sua resposta"/>
          <button>Chutar</button>
        </form>
        {match.kickDeadlineAt!==null&&<div className={"football-timer "+(secondsLeft(match.kickDeadlineAt,now)<=5?"danger":"")}>{secondsLeft(match.kickDeadlineAt,now)}s</div>}
      </>:<div className="football-npc-thinking"><span/>Resolvendo a conta...</div>}
      {feedback&&<ResultFeedback status={feedback}/>}
      {feedback==="incorrect"&&correctAnswer&&<p className="football-correction">Resposta correta: <strong>{correctAnswer}</strong></p>}
    </section>
    </FootballStadium>
  </main>;
}

function OnlineFootball({session,onExit,onSessionChange}:{session:ClientSession;onExit:()=>void;onSessionChange:(active:ClientSession)=>void}){
  const [room,setRoom]=useState<FootballRoom|null>(null);
  const [mode,setMode]=useState<"menu"|"create"|"join">("menu");
  const [password,setPassword]=useState(()=>String(Math.floor(Math.random()*900)+100));
  const [code,setCode]=useState("");
  const [grade,setGrade]=useState<5|6|7|8|9|"mixed">(session.gradeLevel);
  const [answer,setAnswer]=useState("");
  const [target,setTarget]=useState<PenaltyTarget>(4);
  const [finalReady,setFinalReady]=useState(false);
  const [rooms,setRooms]=useState<Array<{code:string;hostName:string;players:number;capacity:number}>>([]);
  const [error,setError]=useState("");
  const [connected,setConnected]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const pendingAction=useRef(false);
  const syncSerial=useRef(0);
  const polling=useRef(false);
  const alive=useRef(false);
  const now=useNow(Boolean(room?.match?.phase==="kick-open"),room?.serverNow);
  const activeSession=useRef(session);
  const roomRef=useRef<FootballRoom|null>(null);
  const listSerial=useRef(0);
  const [listStatus,setListStatus]=useState<"loading"|"ready"|"error">("loading");
  const updateRoom=(next:FootballRoom|null)=>{
    const previous=roomRef.current;
    if(previous?.question?.id!==next?.question?.id||previous?.code!==next?.code)setAnswer("");
    roomRef.current=next;setRoom(next);
  };
  const adoptSession=(active:ClientSession)=>{
    const previous=activeSession.current;
    activeSession.current=active;
    if(previous.sessionId!==active.sessionId){
      sessionStorage.removeItem(roomKey(previous));
      if(roomRef.current){
        updateRoom(null);setMode("menu");setError("A sessão foi renovada. A sala anterior não está mais disponível; crie ou entre em outra.");
      }
    }
  };
  useEffect(()=>{adoptSession(session);},[session.sessionId,session.reconnectToken]);
  const refreshIdentity=async()=>{
    const active=await ensureActiveSession(activeSession.current);
    adoptSession(active);onSessionChange(active);
    return active;
  };
  const fetchRooms=()=>{
    const serial=++listSerial.current;
    void fetch(apiBase+"/api/football/rooms",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw new Error("Lista indisponível");
        const data=await response.json() as {ok:boolean;rooms?:typeof rooms};
        if(!data.ok||!Array.isArray(data.rooms))throw new Error("Lista inválida");
        if(serial===listSerial.current){setRooms(data.rooms);setListStatus("ready");if(!roomRef.current)setConnected(true);}
      }).catch(()=>{if(serial===listSerial.current){setListStatus("error");if(!roomRef.current)setConnected(false);}});
  };
  const heardKick=useRef(0);

  useEffect(()=>{
    const kick=room?.match?.lastKick;
    if(!kick||kick.number===heardKick.current) return;
    heardKick.current=kick.number;
    playSound(kick.goal?"goal":"save");
    playFootballCrowd(kick.goal);
  },[room?.match?.lastKick?.number]);

  useEffect(()=>{if(room?.status==="finished") playSound("victory");},[room?.status]);
  useEffect(()=>{
    if(room?.status!=="finished"){setFinalReady(false);return;}
    const timer=window.setTimeout(()=>setFinalReady(true),2400);
    return ()=>window.clearTimeout(timer);
  },[room?.status]);

  const apply=(response:AckResponse)=>{
    if(!response.ok){
      setError(response.error??"Operação não concluída.");
      return false;
    }
    if(response.room){
      updateRoom(response.room);
      sessionStorage.setItem(roomKey(activeSession.current),response.room.code);
    }
    setError("");
    return true;
  };

  type FootballAction="create"|"join"|"sync"|"start"|"answer"|"rematch"|"leave";
  const requestAction=async(action:FootballAction,payload:object,active:ClientSession)=>{
    const response=await fetch(apiBase+"/api/football/action",{
      method:"POST",headers:{"content-type":"application/json"},cache:"no-store",
      body:JSON.stringify({action,...payload,...auth(active)}),
      signal:AbortSignal.timeout(12_000)
    });
    const data=await response.json() as AckResponse;
    return {status:response.status,data};
  };

  useEffect(()=>{
    alive.current=true;
    let disposed=false;
    const poll=async()=>{
      if(disposed||pendingAction.current||polling.current)return;
      const active=activeSession.current;
      const saved=roomRef.current?.code??sessionStorage.getItem(roomKey(active));
      if(!saved)return;
      polling.current=true;
      const serial=syncSerial.current;
      try{
        let result=await requestAction("sync",{code:saved},active);
        if(disposed||serial!==syncSerial.current)return;
        if(result.status===401){
          const renewed=await refreshIdentity();
          if(disposed||serial!==syncSerial.current)return;
          if(renewed.sessionId!==active.sessionId){
            updateRoom(null);setMode("menu");
            setError("A sessão foi renovada. Crie ou entre em uma nova sala.");return;
          }
          result=await requestAction("sync",{code:saved},renewed);
        }
        if(disposed||serial!==syncSerial.current)return;
        if(result.data.ok&&result.data.room){
          updateRoom(result.data.room);setConnected(true);
        }else if(result.status===404||result.status===403){
          sessionStorage.removeItem(roomKey(active));updateRoom(null);setMode("menu");
          setError(result.data.error??"A sala anterior não está mais disponível.");fetchRooms();
        }else{
          setConnected(false);setError(result.data.error??"Não foi possível sincronizar a partida.");
        }
      }catch{
        if(!disposed&&serial===syncSerial.current)setConnected(false);
      }finally{polling.current=false;}
    };
    fetchRooms();
    const roomPolling=window.setInterval(fetchRooms,5_000);
    const statePolling=window.setInterval(()=>void poll(),1_000);
    const visible=()=>{if(document.visibilityState==="visible"){fetchRooms();void poll();}};
    document.addEventListener("visibilitychange",visible);
    window.addEventListener("online",visible);
    void poll();
    return ()=>{
      disposed=true;alive.current=false;++listSerial.current;++syncSerial.current;
      window.clearInterval(roomPolling);window.clearInterval(statePolling);
      document.removeEventListener("visibilitychange",visible);
      window.removeEventListener("online",visible);
    };
  },[]);

  const sendRoomAction=async(action:Exclude<FootballAction,"sync">,payload:object,onSuccess?:(room:FootballRoom)=>void)=>{
    if(pendingAction.current)return;
    pendingAction.current=true;++syncSerial.current;setSubmitting(true);setError("");
    try{
      const active=await refreshIdentity();
      if(!alive.current)return;
      let result=await requestAction(action,payload,active);
      if(result.status===401){
        const renewed=await refreshIdentity();
        if(action!=="create"&&action!=="join"&&renewed.sessionId!==active.sessionId){
          setError("A sessão foi renovada. Entre em uma nova sala.");return;
        }
        result=await requestAction(action,payload,renewed);
      }
      if(!alive.current)return;
      if(apply(result.data)){
        setConnected(true);
        if(result.data.room)onSuccess?.(result.data.room);
      }
      fetchRooms();
    }catch(error){
      if(alive.current){
        setConnected(false);
        setError(error instanceof Error&&error.name==="TimeoutError"?"A solicitação HTTP demorou demais. Tente novamente.":"Não foi possível concluir a solicitação ao servidor. Tente novamente.");
      }
    }finally{pendingAction.current=false;if(alive.current)setSubmitting(false);}
  };
  const create=()=>void sendRoomAction("create",{password,gradeLevel:grade},room=>{
    sessionStorage.setItem("football-pin:"+room.code,password);
  });
  const join=()=>void sendRoomAction("join",{code:code.trim().toUpperCase(),password});
  const start=()=>room&&void sendRoomAction("start",{code:room.code});
  const rematch=()=>room&&void sendRoomAction("rematch",{code:room.code});
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!room?.question||!answer.trim())return;
    void sendRoomAction("answer",{code:room.code,questionId:room.question.id,answer,target,clientSubmissionId:crypto.randomUUID()});
  };
  const leave=async()=>{
    if(pendingAction.current)return;
    pendingAction.current=true;++syncSerial.current;setSubmitting(true);
    try{
      if(room){
        const result=await requestAction("leave",{code:room.code},activeSession.current);
        if(!result.data.ok&&![401,403,404].includes(result.status)){setError(result.data.error??"Não foi possível sair da sala.");return;}
      }
      sessionStorage.removeItem(roomKey(activeSession.current));
      if(room)sessionStorage.removeItem("football-pin:"+room.code);
      updateRoom(null);onExit();
    }catch{setError("Não foi possível sair da sala. Tente novamente.");}
    finally{pendingAction.current=false;if(alive.current)setSubmitting(false);}
  };

  if(!room){
    return <main id="main-content" className="football-shell"><section className="panel football-online-menu">
      <img src="/assets/math-football/football-emblem.svg" alt="" className="football-logo"/>
      <p className="eyebrow">Duelo online</p><h1>Futebol Matemático</h1>
      {mode==="menu"?<div className="football-online-actions">
        <button onClick={()=>{setPassword(String(Math.floor(Math.random()*900)+100));setMode("create");}}>Criar sala</button>
        <button className="button-secondary" onClick={()=>{setPassword("");setMode("join");}}>Entrar em sala</button>
        <button className="button-ghost" onClick={onExit}>Voltar</button>
      </div>:<div className="stack">
        {mode==="create"&&<label>Nível da sala
          <select value={grade} onChange={e=>setGrade(e.target.value==="mixed"?"mixed":Number(e.target.value) as 5|6|7|8|9)}>
            <option value={5}>5º ano</option><option value={6}>6º ano</option><option value={7}>7º ano</option><option value={8}>8º ano</option><option value={9}>9º ano</option><option value="mixed">Misto — 5º ao 9º</option>
          </select>
        </label>}
        {mode==="join"&&<label>Código da sala (6 caracteres)<input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6))} maxLength={6} placeholder="Ex.: ABC234" autoComplete="off"/></label>}
        <label>Senha numérica de 3 dígitos (diferente do código da sala)
          <input className="football-room-pin" inputMode="numeric" pattern="[0-9]{3}" type="text"
            value={password} onChange={e=>setPassword(e.target.value.replace(/\D/g,"").slice(0,3))} maxLength={3} aria-label="Senha numérica de três dígitos"/>
        </label>
        {mode==="create"&&<p className="football-pin-hint">Esta é a senha, não o código da sala. Ao clicar em Criar sala, será gerado um código de 6 caracteres. Compartilhe os dois com seu adversário.</p>}
        {mode==="join"&&<p className="football-pin-hint">Digite o código informado pelo criador ou selecione uma sala disponível abaixo. Depois, informe a senha de 3 dígitos recebida.</p>}
        {!connected&&<p className="football-pin-hint" role="status">Conectando ao servidor de partidas...</p>}
        <button disabled={submitting||!/^\d{3}$/.test(password)||(mode==="join"&&code.length!==6)} onClick={mode==="create"?create:join}>{submitting?"Aguardando confirmação...":mode==="create"?"Criar sala":"Entrar"}</button>
        <button className="button-ghost" onClick={()=>setMode("menu")}>Cancelar</button>
      </div>}
      {(mode==="menu"||mode==="join")&&<div className="football-rooms-list" aria-label="Salas abertas para jogar">
        <strong>Salas disponíveis — escolha uma ou digite o código</strong>
        {listStatus==="loading"?<p role="status">Consultando salas disponíveis...</p>:listStatus==="error"?<p role="status">Não foi possível atualizar as salas. A consulta será refeita automaticamente.</p>:rooms.length===0?<p>Nenhuma sala disponível no momento. Você pode criar uma.</p>:rooms.map(item=><div className="football-room-list-item" key={item.code}>
          <div><strong>{item.hostName}</strong><small style={{display:"block"}}>Sala {item.code} · {item.players}/{item.capacity} jogadores</small></div>
          <button className="button-secondary" onClick={()=>{setCode(item.code);setPassword("");setMode("join");}}>Selecionar</button>
        </div>)}
        <button className="button-ghost" onClick={fetchRooms}>Atualizar salas</button>
      </div>}
      {error&&<p className="error">{error}</p>}
    </section></main>;
  }

  if(room.status==="waiting"){
    const isHost=room.hostSessionId===session.sessionId;
    return <main id="main-content" className="football-shell"><section className="panel football-room-lobby">
      <p className="eyebrow">Sala privada · 2 jogadores</p>
      <p><strong>Código da sala (6 caracteres)</strong></p>
      <h1 className="football-invite-code">{room.code}</h1>
      {isHost&&sessionStorage.getItem("football-pin:"+room.code)&&<p>Senha de acesso (3 dígitos): <strong className="football-room-pin">{sessionStorage.getItem("football-pin:"+room.code)}</strong></p>}
      <p>Compartilhe o código da sala e a senha com o segundo jogador. Ele deve escolher “Entrar em sala”.</p>
      <p>Nível: <strong>{room.gradeLevel==="mixed"?"Misto":room.gradeLevel+"º ano"}</strong></p>
      <p><strong>Vagas:</strong> {room.capacity.occupied}/{room.capacity.max} · {room.capacity.available} disponível(is)</p>
      <div className="football-room-actions">
        <button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(room.code)}>Copiar código</button>
        {isHost&&sessionStorage.getItem("football-pin:"+room.code)&&<>
          <button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(sessionStorage.getItem("football-pin:"+room.code)??"")}>Copiar senha</button>
          <button className="button-secondary" onClick={()=>{
            const pin=sessionStorage.getItem("football-pin:"+room.code);
            if(!pin) return;
            if(!navigator.clipboard){setError("Copie o código e a senha exibidos acima.");return;}
            void navigator.clipboard.writeText(`Futebol Matemático — convite para duelo online\nCódigo da sala: ${room.code}\nSenha: ${pin}\nAcesse: ${window.location.origin}/game/math-football`).catch(()=>setError("Não foi possível copiar. Copie o código e a senha manualmente."));
          }}>Copiar convite completo</button>
        </>}
      </div>
      <div className="football-members">
        {room.members.map(member=><div key={member.sessionId}>
          <span className={member.connected?"online-dot":"online-dot offline"}/>
          <strong>{member.nickname}</strong>
          <small>{member.presence==="connected"?"Conectado":member.presence==="reconnecting"?"Reconectando":member.presence==="disconnected"?"Desconectado":"Abandonou"}</small>
          {member.sessionId===room.hostSessionId&&<small>Host</small>}
        </div>)}
      </div>
      {isHost?<button disabled={submitting||room.lifecycleState!=="ready"} onClick={start}>{room.lifecycleState==="ready"?"Iniciar disputa":"Aguardando adversário"}</button>:<p>Aguardando o host iniciar...</p>}
      <button className="button-ghost" onClick={leave}>Sair da sala</button>
      {error&&<p className="error">{error}</p>}
    </section></main>;
  }

  if(!room.match) return <main id="main-content" className="football-shell"><p>Sincronizando partida...</p></main>;

  if((room.status==="finished"||room.match.phase==="finished")&&finalReady){
    return <main id="main-content" className="football-shell">
      <FinalPanel match={room.match} humanId={session.sessionId} onAgain={rematch} onLobby={leave}/>
      {error&&<p className="error">{error}</p>}
    </main>;
  }

  const shooter=room.match.players.find(p=>p.id===room.match!.currentShooterId)!;
  const myTurn=shooter.id===session.sessionId;
  const resolving=room.match.phase==="kick-resolution"||room.match.phase==="finished";

  return <main id="main-content" className="football-page">
    <header className="football-header">
      <div><p className="eyebrow">Sala {room.code} · {connected?"Conectado":"Reconectando"}</p><h1>Futebol Matemático</h1></div>
      <button className="button-ghost" onClick={()=>window.confirm("Abandonar a partida?")&&leave()}>Sair</button>
    </header>
    <Scoreboard match={room.match}/>
    <FootballStadium match={room.match} selectedTarget={target} onSelectTarget={setTarget} canAim={myTurn&&!resolving}>
    <section className="football-question">
      {resolving&&room.match.lastKick?<><p className="eyebrow">{room.match.lastKick.shooterName}</p>
        <h2>{room.match.lastKick.goal?"Gol confirmado pelo servidor":"Defesa confirmada pelo servidor"}</h2>
        <ResultFeedback status={room.match.lastKick.correct?"correct":"incorrect"}/>
        {!room.match.lastKick.correct&&room.lastCorrectAnswer&&<p className="football-correction">Resposta correta: <strong>{room.lastCorrectAnswer}</strong></p>}
      </>:<>
        <p className="eyebrow">{myTurn?"Sua vez de cobrar":"Cobrança de "+shooter.name}</p>
        <h2>{room.question?.expression??"Preparando cobrança..."}</h2>
        {myTurn&&room.question?<form onSubmit={submit}>
          <input inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Digite sua resposta"/>
          <button disabled={submitting||!answer.trim()}>Chutar</button>
        </form>:<p className="football-wait">Aguardando a resposta do adversário.</p>}
        {room.question?.deadlineAt&&<div className={"football-timer "+(secondsLeft(room.question.deadlineAt,now)<=5?"danger":"")}>{secondsLeft(room.question.deadlineAt,now)}s</div>}
      </>}
      {error&&<p className="error">{error}</p>}
    </section>
    </FootballStadium>
  </main>;
}

export function MathFootball({session,onSessionChange}:{session:ClientSession;onSessionChange:(active:ClientSession)=>void}){
  const [mode,setMode]=useState<"setup"|"solo"|"online">("setup");
  const [skill,setSkill]=useState<NpcSkill>("medium");
  const [timeMs,setTimeMs]=useState(DEFAULT_SOLO_KICK_MS);

  if(mode==="solo") return <SoloFootball session={session} skill={skill} timeMs={timeMs} onExit={()=>setMode("setup")}/>;
  if(mode==="online") return <OnlineFootball session={session} onSessionChange={onSessionChange} onExit={()=>setMode("setup")}/>;

  return <main id="main-content" className="football-shell"><section className="panel football-setup">
    <img src="/assets/math-football/football-emblem.svg" alt="" className="football-logo"/>
    <p className="eyebrow">Matemática decide a cobrança</p>
    <h1>Futebol Matemático</h1>
    <p>Escolha um dos nove setores do gol e resolva a conta. Acertou: gol com o goleiro indo para outra direção. Errou: defesa do goleiro. A disputa segue as regras de uma série de pênaltis.</p>
    <div className="football-options">
      <label>Nível do NPC
        <select value={skill} onChange={e=>setSkill(e.target.value as NpcSkill)}>
          <option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil</option>
        </select>
      </label>
      <label>Tempo pedagógico no modo solo
        <select value={timeMs} onChange={e=>setTimeMs(Number(e.target.value))}>
          <option value={30000}>30 segundos — padrão de aula</option>
          <option value={60000}>60 segundos</option>
          <option value={90000}>90 segundos</option>
          <option value={0}>Sem cronômetro</option>
        </select>
      </label>
    </div>
    <div className="football-mode-grid">
      <button onClick={()=>setMode("solo")}><strong>Contra NPC</strong><span>Treino individual</span></button>
      <button onClick={()=>setMode("online")}><strong>Jogador × Jogador</strong><span>Salas disponíveis e senha de 3 dígitos</span></button>
    </div>
    <HelpRules>
      <ul>
        <li>Cada lado começa com 5 cobranças.</li>
        <li>Acerto matemático resulta em gol; erro resulta em defesa.</li>
        <li>A série termina antes se um jogador não puder mais alcançar o outro.</li>
        <li>Empate após cinco cobranças por lado leva à morte súbita.</li>
        <li>No online, cada cobrança tem limite anti-abandono de 30 segundos.</li>
      </ul>
    </HelpRules>
    <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
  </section></main>;
}
