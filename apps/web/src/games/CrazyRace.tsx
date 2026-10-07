import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import {
  bombTarget, createRace, positionOf, progressPercent, resolveNpcBombIfNeeded,
  resolveRound, startRound, submitNpcAnswers, submitRoundAnswer, useBomb,
  type BombDirection, type Racer, type RaceState
} from "@jogos/crazy-race";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import { HelpRules, ResultFeedback } from "@jogos/ui";
import { apiBase, type ClientSession } from "../session";
import "./crazy-race.css";

type RoomRace = Omit<RaceState,"submissions"|"bombChallenges"> & {
  answeredIds:string[];
  bombTargets:string[];
};

type OnlineRoom = {
  code:string;
  hostSessionId:string;
  gradeLevel:5|6|7|"mixed";
  members:Array<{sessionId:string;nickname:string;gradeLevel:5|6|7|"mixed";connected:boolean;presence:"connected"|"reconnecting"|"disconnected"|"abandoned"}>;
  status:"waiting"|"playing"|"finished";
  lifecycleState:"waiting"|"ready"|"countdown"|"playing"|"round-resolution"|"finished"|"closed";
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  race:RoomRace|null;
  question:null|{id:string;expression:string;gradeLevel:number;difficulty:number;deadlineAt:number|null};
  updatedAt:number;
};

type BombQuestion = {id:string;expression:string;deadlineAt:number};
type AckResponse = {ok:boolean;room?:OnlineRoom;error?:string;targetId?:string;bombQuestion?:BombQuestion|null};

const ROOM_KEY="crazy-race-room-code";

const auth=(session:ClientSession)=>({
  sessionId:session.sessionId,
  reconnectToken:session.reconnectToken
});

function useNow(active:boolean,serverNow?:number) {
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

function secondsLeft(deadline:number|null|undefined,now:number):number {
  if(!deadline) return 0;
  return Math.max(0,Math.ceil((deadline-now)/1000));
}

function orderedRacers(racers:Racer[]):Racer[] {
  return [...racers].sort((a,b)=>
    b.progress-a.progress ||
    b.correctAnswers-a.correctAnswers ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs ||
    a.name.localeCompare(b.name,"pt-BR")
  );
}

function Track({racers,finishLine,humanId}:{racers:Racer[];finishLine:number;humanId:string}) {
  const ordered=orderedRacers(racers);
  return <section className="crazy-track" aria-label="Pista da Corrida Maluca">
    <div className="track-finish" aria-hidden="true"/>
    {[220,440,660].map((point,index)=><div
      key={point}
      className="track-checkpoint"
      style={{left:(point/finishLine*100)+"%"}}
      aria-hidden="true"
    ><span>{index+1}</span></div>)}
    {ordered.map((racer,index)=>{
      const pct=Math.min(100,(racer.progress/finishLine)*100);
      return <div className="race-lane" key={racer.id}>
        <span className="lane-rank">{index+1}º</span>
        <div
          className={["race-car",racer.id===humanId?"player-car":"",racer.kind==="npc"?"npc-car":""].filter(Boolean).join(" ")}
          style={{left:"calc("+pct+"% - 34px)"}}
          title={racer.name}
        >
          <span className="car-window"/>
          <strong>{racer.name.slice(0,2).toUpperCase()}</strong>
        </div>
        <span className="lane-name">{racer.name}</span>
      </div>;
    })}
  </section>;
}

function RaceHud({
  racers,round,finishLine,humanId,deadline,now
}:{racers:Racer[];round:number;finishLine:number;humanId:string;deadline:number|null;now:number}) {
  const human=racers.find(r=>r.id===humanId);
  const rank=human?orderedRacers(racers).findIndex(r=>r.id===humanId)+1:0;
  return <div className="crazy-hud">
    <div><span>Posição</span><strong>{rank || "—"}º / 6</strong></div>
    <div><span>Rodada</span><strong>{round}</strong></div>
    <div><span>Progresso</span><strong>{human?Math.min(100,Math.round(human.progress/finishLine*100)):0}%</strong></div>
    <div className={secondsLeft(deadline,now)<=5?"timer-danger":""}><span>Tempo</span><strong>{secondsLeft(deadline,now)}s</strong></div>
    <div><span>Bombas</span><strong>{human?.bombCharges ?? 0}</strong></div>
  </div>;
}

function BombControls({
  race,humanId,onBomb,disabled
}:{race:RaceState|RoomRace;humanId:string;onBomb:(direction:BombDirection)=>void;disabled:boolean}) {
  const ordered=orderedRacers(race.racers);
  const index=ordered.findIndex(r=>r.id===humanId);
  const ahead=index>0?ordered[index-1]:null;
  const behind=index>=0&&index<ordered.length-1?ordered[index+1]:null;
  const human=race.racers.find(r=>r.id===humanId);
  const cooldown=human ? race.round<human.bombCooldownUntilRound : true;
  const noCharge=!human||human.bombCharges<=0;

  return <section className="bomb-controls">
    <div className="bomb-title">
      <img src="/assets/crazy-race/math-bomb.svg" alt="" />
      <div><strong>Bomba matemática</strong><small>Somente no rival imediatamente à frente ou atrás.</small></div>
    </div>
    <button disabled={disabled||noCharge||cooldown||!ahead} onClick={()=>onBomb("ahead")}>
      Frente {ahead?"— "+ahead.name:""}
    </button>
    <button disabled={disabled||noCharge||cooldown||!behind} onClick={()=>onBomb("behind")}>
      Atrás {behind?"— "+behind.name:""}
    </button>
    {cooldown&&human&&<small>Cooldown até a rodada {human.bombCooldownUntilRound}.</small>}
  </section>;
}

function RaceFinish({
  racers,winnerId,humanId,onAgain
}:{racers:Racer[];winnerId:string|null;humanId:string;onAgain:()=>void}) {
  const winner=racers.find(r=>r.id===winnerId);
  return <section className="crazy-finish panel">
    <img src="/assets/crazy-race/finish-flag.svg" alt="" className="finish-art"/>
    <p className="eyebrow">Linha de chegada</p>
    <h1>{winner?.name ?? "Corrida encerrada"} venceu!</h1>
    <div className="race-ranking">
      {orderedRacers(racers).map((r,index)=><div key={r.id} className={r.id===humanId?"you":""}>
        <strong>{index+1}º {r.name}</strong>
        <span>{r.correctAnswers} acertos · {Math.round(r.progress)} m</span>
      </div>)}
    </div>
    <button onClick={onAgain}>Nova corrida</button>
    <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
  </section>;
}

function SoloRace({session,onExit}:{session:ClientSession;onExit:()=>void}) {
  const begin=()=>{
    let race=createRace([{id:session.sessionId,name:session.nickname}]);
    race=startRound(race,Date.now());
    race=submitNpcAnswers(race);
    return race;
  };
  const [race,setRace]=useState<RaceState>(begin);
  const [question,setQuestion]=useState<MathQuestion|null>(()=>generateQuestion(session.gradeLevel,{difficulty:1,seed:"crazy-solo-1-"+session.sessionId}));
  const [answer,setAnswer]=useState("");
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [message,setMessage]=useState("");
  const resolvedRound=useRef(0);
  const now=useNow(race.phase==="round-open");

  useEffect(()=>{
    if(race.phase!=="round-open"||!race.roundDeadlineAt||now<race.roundDeadlineAt||resolvedRound.current===race.round) return;
    resolvedRound.current=race.round;
    setRace(current=>resolveRound(current,Date.now()));
    setQuestion(null);
  },[now,race.phase,race.round,race.roundDeadlineAt]);

  useEffect(()=>{
    if(race.phase!=="round-resolution") return;
    const timer=window.setTimeout(()=>{
      setRace(current=>{
        let next=startRound(current,Date.now());
        next=submitNpcAnswers(next);
        setQuestion(generateQuestion(session.gradeLevel,{
          difficulty:next.round<4?1:next.round<8?2:3,
          seed:"crazy-solo-"+next.round+"-"+session.sessionId
        }));
        setSubmitted(false);
        setFeedback(null);
        setAnswer("");
        setMessage("");
        return next;
      });
    },1200);
    return ()=>window.clearTimeout(timer);
  },[race.phase,session.gradeLevel,session.sessionId]);

  const restart=()=>{
    const next=begin();
    setRace(next);
    setQuestion(generateQuestion(session.gradeLevel,{difficulty:1,seed:"crazy-solo-1-"+session.sessionId+"-"+Date.now()}));
    setAnswer("");
    setFeedback(null);
    setSubmitted(false);
    setMessage("");
    resolvedRound.current=0;
  };

  if(race.phase==="finished"){
    return <main className="crazy-shell"><RaceFinish racers={race.racers} winnerId={race.winnerId} humanId={session.sessionId} onAgain={restart}/></main>;
  }

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(submitted||race.phase!=="round-open"||!question) return;
    const correct=validateAnswer(question,answer);
    const responseMs=Math.max(0,Date.now()-(race.roundStartedAt??Date.now()));
    try{
      setRace(current=>submitRoundAnswer(current,session.sessionId,correct,responseMs,Date.now()));
      setFeedback(correct?"correct":"incorrect");
      setSubmitted(true);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível enviar.");
    }
  };

  const bomb=(direction:BombDirection)=>{
    setMessage("");
    try{
      const target=bombTarget(race,session.sessionId,direction);
      let next=useBomb(race,session.sessionId,direction,Date.now());
      if(target?.kind==="npc") next=resolveNpcBombIfNeeded(next,target.id);
      setRace(next);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Bomba indisponível.");
    }
  };

  return <main className="crazy-page">
    <header className="crazy-header">
      <div><p className="eyebrow">Modo solo · 1 humano + 5 NPCs</p><h1>Corrida Maluca</h1></div>
      <button className="button-ghost" onClick={()=>window.confirm("Sair da corrida atual?")&&onExit()}>Sair</button>
    </header>

    <RaceHud racers={race.racers} round={race.round} finishLine={race.finishLine} humanId={session.sessionId} deadline={race.roundDeadlineAt} now={now}/>
    <Track racers={race.racers} finishLine={race.finishLine} humanId={session.sessionId}/>

    <div className="crazy-lower">
      <section className="race-question-card">
        <span className="eyebrow">20 segundos</span>
        <h2>{question?.expression ?? "Processando rodada..."}</h2>
        {race.phase==="round-open"&&question&&<form onSubmit={submit}>
          <input
            aria-label="Resposta da rodada"
            inputMode="decimal"
            value={answer}
            onChange={e=>setAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Digite sua resposta"
          />
          <button disabled={submitted}>{submitted?"Resposta enviada":"Responder"}</button>
        </form>}
        {feedback&&<ResultFeedback status={feedback}/>}
        {submitted&&<p className="race-waiting">Resposta registrada. O movimento acontece ao terminar os 20 segundos.</p>}
        {message&&<p className="error" role="alert">{message}</p>}
      </section>

      <BombControls race={race} humanId={session.sessionId} onBomb={bomb} disabled={race.phase!=="round-open"}/>
    </div>

    <section className="crazy-log"><h2>Últimos acontecimentos</h2><ol>{race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></section>
  </main>;
}

function OnlineRace({session,onExit}:{session:ClientSession;onExit:()=>void}) {
  const socket=useMemo<Socket>(()=>io(apiBase,{transports:["websocket"],autoConnect:true}),[]);
  const [room,setRoom]=useState<OnlineRoom|null>(null);
  const [mode,setMode]=useState<"menu"|"create"|"join">("menu");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [answer,setAnswer]=useState("");
  const [bombQuestion,setBombQuestion]=useState<BombQuestion|null>(null);
  const [bombAnswer,setBombAnswer]=useState("");
  const now=useNow(Boolean(room?.race?.phase==="round-open"),room?.serverNow);
  const roomRef=useRef<OnlineRoom|null>(null);

  useEffect(()=>{roomRef.current=room},[room]);

  const applyAck=(response:AckResponse)=>{
    if(!response.ok){
      setError(response.error??"Operação não concluída.");
      return false;
    }
    if(response.room){
      setRoom(response.room);
      sessionStorage.setItem(ROOM_KEY,response.room.code);
    }
    if(response.bombQuestion) setBombQuestion(response.bombQuestion);
    setError("");
    return true;
  };

  useEffect(()=>{
    const stateHandler=(next:OnlineRoom)=>setRoom(next);
    const bombHandler=(q:BombQuestion)=>setBombQuestion(q);
    const connectHandler=()=>{
      const saved=sessionStorage.getItem(ROOM_KEY);
      if(!saved) return;
      socket.emit("crazy:reconnect-room",{...auth(session),code:saved},(response:AckResponse)=>{
        if(response.ok&&response.room){
          setRoom(response.room);
          if(response.bombQuestion) setBombQuestion(response.bombQuestion);
        }else{
          sessionStorage.removeItem(ROOM_KEY);
        }
      });
    };
    socket.on("crazy:room-state",stateHandler);
    socket.on("crazy:bomb-question",bombHandler);
    socket.on("connect",connectHandler);
    if(socket.connected) connectHandler();
    return ()=>{
      socket.off("crazy:room-state",stateHandler);
      socket.off("crazy:bomb-question",bombHandler);
      socket.off("connect",connectHandler);
      socket.disconnect();
    };
  },[socket,session.sessionId,session.reconnectToken]);

  const create=()=>{
    socket.emit("crazy:create-room",{...auth(session),password},(response:AckResponse)=>applyAck(response));
  };
  const join=()=>{
    socket.emit("crazy:join-room",{...auth(session),code:code.trim().toUpperCase(),password},(response:AckResponse)=>applyAck(response));
  };
  const start=()=>{
    if(!room) return;
    socket.emit("crazy:start",{...auth(session),code:room.code},(response:AckResponse)=>applyAck(response));
  };
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!room?.question) return;
    socket.emit("crazy:answer",{
      ...auth(session),code:room.code,questionId:room.question.id,answer,
      clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      if(applyAck(response)) setAnswer("");
    });
  };
  const bomb=(direction:BombDirection)=>{
    if(!room) return;
    socket.emit("crazy:bomb",{...auth(session),code:room.code,direction,clientSubmissionId:crypto.randomUUID()},(response:AckResponse)=>applyAck(response));
  };
  const answerBomb=(event:FormEvent)=>{
    event.preventDefault();
    if(!room||!bombQuestion) return;
    socket.emit("crazy:bomb-answer",{
      ...auth(session),code:room.code,questionId:bombQuestion.id,answer:bombAnswer,clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      if(applyAck(response)){
        setBombQuestion(null);
        setBombAnswer("");
      }
    });
  };
  const leave=()=>{
    if(room) socket.emit("crazy:leave",{...auth(session),code:room.code},()=>{});
    sessionStorage.removeItem(ROOM_KEY);
    socket.disconnect();
    onExit();
  };

  if(!room){
    return <main className="crazy-shell">
      <section className="panel crazy-online-menu">
        <img src="/assets/crazy-race/race-emblem.svg" alt="" className="crazy-logo"/>
        <p className="eyebrow">Multiplayer online</p>
        <h1>Corrida Maluca</h1>
        {mode==="menu"&&<div className="online-actions">
          <button onClick={()=>setMode("create")}>Criar sala</button>
          <button className="button-secondary" onClick={()=>setMode("join")}>Entrar em sala</button>
          <button className="button-ghost" onClick={onExit}>Voltar</button>
        </div>}
        {mode!=="menu"&&<div className="stack">
          {mode==="join"&&<label>Código da sala<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6}/></label>}
          <label>Senha da sala<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={4} maxLength={32}/></label>
          <button onClick={mode==="create"?create:join}>{mode==="create"?"Criar sala":"Entrar"}</button>
          <button className="button-ghost" onClick={()=>setMode("menu")}>Cancelar</button>
        </div>}
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
    </main>;
  }

  if(room.status==="waiting"){
    const isHost=room.hostSessionId===session.sessionId;
    return <main className="crazy-shell">
      <section className="panel crazy-room-lobby">
        <p className="eyebrow">Sala privada</p>
        <h1>Código {room.code}</h1>
        <p>Compartilhe o código e a senha com os outros jogadores. Cada humano substituirá um NPC até o limite de 6 competidores.</p>
        <p><strong>Vagas:</strong> {room.capacity.occupied}/{room.capacity.max} · {room.capacity.available} disponível(is)</p>
        <button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(room.code)}>Copiar código</button>
        <div className="room-members">
          {room.members.map(member=><div key={member.sessionId}>
            <span className={member.connected?"online-dot":"online-dot offline"}/>
            <strong>{member.nickname}</strong>
            <small>{member.presence==="connected"?"Conectado":member.presence==="reconnecting"?"Reconectando":member.presence==="disconnected"?"Desconectado":"Abandonou"}</small>
            {member.sessionId===room.hostSessionId&&<small>Host</small>}
          </div>)}
        </div>
        {isHost&&<button disabled={room.lifecycleState!=="ready"} onClick={start}>Iniciar corrida com {room.capacity.occupied} humano(s)</button>}
        {!isHost&&<p>Aguardando o host iniciar...</p>}
        <button className="button-ghost" onClick={leave}>Sair da sala</button>
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
    </main>;
  }

  if(!room.race) return <main className="crazy-shell"><p>Sincronizando corrida...</p></main>;

  if(room.status==="finished"||room.race.phase==="finished"){
    return <main className="crazy-shell">
      <RaceFinish racers={room.race.racers} winnerId={room.race.winnerId} humanId={session.sessionId} onAgain={leave}/>
    </main>;
  }

  const answered=room.race.answeredIds.includes(session.sessionId);
  const human=room.race.racers.find(r=>r.id===session.sessionId);
  const receivedBomb=room.race.bombTargets.includes(session.sessionId);

  return <main className="crazy-page">
    <header className="crazy-header">
      <div>
        <p className="eyebrow">Sala {room.code} · multiplayer</p>
        <h1>Corrida Maluca</h1>
      </div>
      <div className="connection-pill">{socket.connected?"Conectado":"Reconectando"}</div>
    </header>

    <RaceHud racers={room.race.racers} round={room.race.round} finishLine={room.race.finishLine} humanId={session.sessionId} deadline={room.race.roundDeadlineAt} now={now}/>
    <Track racers={room.race.racers} finishLine={room.race.finishLine} humanId={session.sessionId}/>

    <div className="crazy-lower">
      <section className="race-question-card">
        <span className="eyebrow">Servidor · {secondsLeft(room.question?.deadlineAt,now)}s</span>
        <h2>{room.question?.expression ?? "Processando rodada..."}</h2>
        {room.question&&<form onSubmit={submit}>
          <input inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={answered} placeholder="Digite sua resposta"/>
          <button disabled={answered}>{answered?"Resposta registrada":"Responder"}</button>
        </form>}
        {answered&&<p className="race-waiting">Aguardando o encerramento oficial da rodada.</p>}
        {human?.blockedRound===room.race.round&&<p className="bomb-warning">Você foi bloqueado por uma bomba nesta rodada.</p>}
        {error&&<p className="error" role="alert">{error}</p>}
      </section>

      <BombControls race={room.race} humanId={session.sessionId} onBomb={bomb} disabled={!room.question||receivedBomb}/>
    </div>

    {bombQuestion&&<div className="bomb-overlay" role="dialog" aria-modal="true">
      <section className="bomb-dialog">
        <img src="/assets/crazy-race/math-bomb.svg" alt="" />
        <p className="eyebrow">Bomba matemática recebida</p>
        <h2>{bombQuestion.expression}</h2>
        <p>{secondsLeft(bombQuestion.deadlineAt,now)} segundos para neutralizar.</p>
        <form onSubmit={answerBomb}>
          <input autoFocus inputMode="decimal" value={bombAnswer} onChange={e=>setBombAnswer(e.target.value)} placeholder="Resposta"/>
          <button>Neutralizar bomba</button>
        </form>
      </section>
    </div>}

    <section className="crazy-log"><h2>Últimos acontecimentos</h2><ol>{room.race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></section>
    <button className="button-ghost" onClick={()=>window.confirm("Sair da sala e abandonar a corrida?")&&leave()}>Sair da corrida</button>
  </main>;
}

export function CrazyRace({session}:{session:ClientSession}) {
  const [mode,setMode]=useState<"setup"|"solo"|"online">("setup");

  if(mode==="solo") return <SoloRace session={session} onExit={()=>setMode("setup")}/>;
  if(mode==="online") return <OnlineRace session={session} onExit={()=>setMode("setup")}/>;

  return <main className="crazy-shell">
    <section className="panel crazy-setup">
      <img src="/assets/crazy-race/race-emblem.svg" alt="" className="crazy-logo"/>
      <p className="eyebrow">Arcade matemático</p>
      <h1>Corrida Maluca</h1>
      <p>Seis carros disputam a pista. Você tem 20 segundos por rodada: acertou, acelera; errou ou perdeu o tempo, não avança.</p>
      <div className="crazy-mode-grid">
        <button onClick={()=>setMode("solo")}>
          <strong>Jogar agora</strong>
          <span>Você contra 5 NPCs</span>
        </button>
        <button onClick={()=>setMode("online")}>
          <strong>Multiplayer</strong>
          <span>Criar ou entrar em sala privada</span>
        </button>
      </div>
      <HelpRules>
        <ul>
          <li>Uma rodada dura 20 segundos.</li>
          <li>Acerto gera avanço; erro ou timeout mantém o carro parado.</li>
          <li>Bombas matemáticas podem atingir apenas o rival imediatamente à frente ou atrás.</li>
          <li>Acertar a bomba neutraliza o ataque; errar impede seu avanço na rodada.</li>
          <li>Vence quem cruza a linha de chegada após a resolução oficial da rodada.</li>
        </ul>
      </HelpRules>
      <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
    </section>
  </main>;
}
