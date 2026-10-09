import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import {
  DEFAULT_SOLO_KICK_MS, createPenaltyMatch, npcDecision, openNextKick, startKick,
  statsFor, submitKick, timeoutKick, type NpcSkill, type PenaltyMatchState,
  type PenaltyPlayer, type PenaltyTarget
} from "@jogos/math-football";
import { generateQuestion, validateAnswer } from "@jogos/math-engine";
import { recordSoloResult } from "../session";
import { HelpRules, ResultFeedback } from "@jogos/ui";
import { apiBase, type ClientSession } from "../session";
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

const ROOM_KEY="math-football-room-code";
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
      seed:"football-solo-"+session.sessionId+"-"+match.kickNumber+"-"+match.history.length
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

function OnlineFootball({session,onExit}:{session:ClientSession;onExit:()=>void}){
  const socket=useMemo<Socket>(()=>io(apiBase,{transports:["websocket"],autoConnect:true}),[]);
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
  const now=useNow(Boolean(room?.match?.phase==="kick-open"),room?.serverNow);
  const authData=()=>auth(session);
  const fetchRooms=()=>socket.emit("football:list-rooms",auth(session),(response:{ok:boolean;rooms?:typeof rooms})=>{if(response.ok)setRooms(response.rooms??[]);});
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
      setRoom(response.room);
      sessionStorage.setItem(ROOM_KEY,response.room.code);
    }
    setError("");
    return true;
  };

  useEffect(()=>{
    const stateHandler=(next:FootballRoom)=>{
      setRoom(next);
      if(next.match?.phase==="kick-open") setAnswer("");
    };
    const reconnect=()=>{
      fetchRooms();
      const saved=sessionStorage.getItem(ROOM_KEY);
      if(!saved) return;
      socket.emit("football:reconnect-room",{...auth(session),code:saved},(response:AckResponse)=>{
        if(response.ok&&response.room) setRoom(response.room);
        else sessionStorage.removeItem(ROOM_KEY);
      });
    };
    socket.on("football:room-state",stateHandler);
    socket.on("football:rooms-changed",fetchRooms);
    socket.on("connect",reconnect);
    if(socket.connected) reconnect();
    return ()=>{
      socket.off("football:room-state",stateHandler);
      socket.off("football:rooms-changed",fetchRooms);
      socket.off("connect",reconnect);
      socket.disconnect();
    };
  },[socket,session.sessionId,session.reconnectToken]);

  const create=()=>socket.emit("football:create-room",{...authData(),password,gradeLevel:grade},(response:AckResponse)=>{
    if(apply(response)&&response.room) sessionStorage.setItem("football-pin:"+response.room.code,password);
  });
  const join=()=>socket.emit("football:join-room",{...authData(),code:code.trim().toUpperCase(),password},(response:AckResponse)=>apply(response));
  const start=()=>room&&socket.emit("football:start",{...authData(),code:room.code},(response:AckResponse)=>apply(response));
  const rematch=()=>room&&socket.emit("football:rematch",{...authData(),code:room.code},(response:AckResponse)=>apply(response));
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!room?.question) return;
    socket.emit("football:answer",{
      ...authData(),code:room.code,questionId:room.question.id,answer,target,
      clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      if(apply(response)) setAnswer("");
    });
  };
  const leave=()=>{
    if(room){
      socket.emit("football:leave",{...authData(),code:room.code},()=>{});
    }
    sessionStorage.removeItem(ROOM_KEY);
    if(room)sessionStorage.removeItem("football-pin:"+room.code);
    socket.disconnect();
    onExit();
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
        {mode==="join"&&<label>Código da sala<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Selecione uma sala na lista"/></label>}
        <label>Senha numérica de 3 dígitos
          <input className="football-room-pin" inputMode="numeric" pattern="[0-9]{3}" type="text"
            value={password} onChange={e=>setPassword(e.target.value.replace(/\D/g,"").slice(0,3))} maxLength={3} aria-label="Senha numérica de três dígitos"/>
        </label>
        {mode==="create"&&<p className="football-pin-hint">Compartilhe a senha com seu adversário. Ela não aparece na lista de salas.</p>}
        <button disabled={!/^\d{3}$/.test(password)||(mode==="join"&&code.length!==6)} onClick={mode==="create"?create:join}>{mode==="create"?"Criar sala":"Entrar"}</button>
        <button className="button-ghost" onClick={()=>setMode("menu")}>Cancelar</button>
      </div>}
      {(mode==="menu"||mode==="join")&&<div className="football-rooms-list" aria-label="Salas abertas para jogar">
        <strong>Salas disponíveis</strong>
        {rooms.length===0?<p>Nenhuma sala disponível no momento. Você pode criar uma.</p>:rooms.map(item=><div className="football-room-list-item" key={item.code}>
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
      <h1>{room.code}</h1>
      {isHost&&sessionStorage.getItem("football-pin:"+room.code)&&<p>Senha para convidar: <strong className="football-room-pin">{sessionStorage.getItem("football-pin:"+room.code)}</strong></p>}
      <p>Nível: <strong>{room.gradeLevel==="mixed"?"Misto":room.gradeLevel+"º ano"}</strong></p>
      <p><strong>Vagas:</strong> {room.capacity.occupied}/{room.capacity.max} · {room.capacity.available} disponível(is)</p>
      <div className="football-room-actions"><button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(room.code)}>Copiar código</button>{isHost&&sessionStorage.getItem("football-pin:"+room.code)&&<button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(sessionStorage.getItem("football-pin:"+room.code)??"")}>Copiar senha</button>}</div>
      <div className="football-members">
        {room.members.map(member=><div key={member.sessionId}>
          <span className={member.connected?"online-dot":"online-dot offline"}/>
          <strong>{member.nickname}</strong>
          <small>{member.presence==="connected"?"Conectado":member.presence==="reconnecting"?"Reconectando":member.presence==="disconnected"?"Desconectado":"Abandonou"}</small>
          {member.sessionId===room.hostSessionId&&<small>Host</small>}
        </div>)}
      </div>
      {isHost?<button disabled={room.lifecycleState!=="ready"} onClick={start}>{room.lifecycleState==="ready"?"Iniciar disputa":"Aguardando adversário"}</button>:<p>Aguardando o host iniciar...</p>}
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
      <div><p className="eyebrow">Sala {room.code} · {socket.connected?"Conectado":"Reconectando"}</p><h1>Futebol Matemático</h1></div>
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
          <button>Chutar</button>
        </form>:<p className="football-wait">Aguardando a resposta do adversário.</p>}
        {room.question?.deadlineAt&&<div className={"football-timer "+(secondsLeft(room.question.deadlineAt,now)<=5?"danger":"")}>{secondsLeft(room.question.deadlineAt,now)}s</div>}
      </>}
      {error&&<p className="error">{error}</p>}
    </section>
    </FootballStadium>
  </main>;
}

export function MathFootball({session}:{session:ClientSession}){
  const [mode,setMode]=useState<"setup"|"solo"|"online">("setup");
  const [skill,setSkill]=useState<NpcSkill>("medium");
  const [timeMs,setTimeMs]=useState(DEFAULT_SOLO_KICK_MS);

  if(mode==="solo") return <SoloFootball session={session} skill={skill} timeMs={timeMs} onExit={()=>setMode("setup")}/>;
  if(mode==="online") return <OnlineFootball session={session} onExit={()=>setMode("setup")}/>;

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
