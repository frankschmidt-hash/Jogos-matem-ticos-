import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import {
  createNumberRace, startTimedRace, answerTimedRace, finishTimedRace, tickTimedNpcs,
  MATCH_DURATION_MS, TIMED_ADVANCE, type NumberRaceState, type Racer
} from "@jogos/number-race";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import { HelpRules } from "@jogos/ui";
import { apiBase, type ClientSession } from "../session";
import { playSound } from "../experience";
import { CarPicker, NumberVehicle, opponentCar, useCarChoice, type CarChoice } from "./NumberRaceCars";
import "./number-race.css";

type RoomRace=Omit<NumberRaceState,"submissions"> & {answeredIds:string[]};
type NumberRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:5|6|7|"mixed";
  members:Array<{sessionId:string;nickname:string;connected:boolean;presence:"connected"|"reconnecting"|"disconnected"|"abandoned"}>;
  status:"waiting"|"playing"|"finished";
  lifecycleState:"waiting"|"ready"|"countdown"|"playing"|"round-resolution"|"finished"|"closed";
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  race:RoomRace|null;
  carChoices:Record<string,CarChoice>;
  question:null|{id:string;expression:string;gradeLevel:number;difficulty:number;deadlineAt:number|null};
  lastCorrectAnswer:string|null;
  updatedAt:number;
};
type AckResponse={ok:boolean;room?:NumberRoom;error?:string;answerCorrect?:boolean;answerRecorded?:boolean};

const ROOM_KEY="number-race-room-code";
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

function formattedTime(deadline:number|null|undefined,now:number){
  const total=secondsLeft(deadline,now);
  return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
}

function secondsLeft(deadline:number|null|undefined,now:number){
  return deadline?Math.max(0,Math.ceil((deadline-now)/1000)):0;
}

function statsFromRacer(racer:Racer,position:number){
  const attempts=racer.correctAnswers+racer.errors;
  return {
    position,
    correctAnswers:racer.correctAnswers,
    errors:racer.errors,
    accuracy:attempts?Math.round(racer.correctAnswers/attempts*100):0,
    bestStreak:racer.bestStreak,
    averageCorrectResponseMs:racer.correctAnswers?Math.round(racer.totalCorrectResponseMs/racer.correctAnswers):null
  };
}

function NumericTrack({racers,finishLine,humanId,carChoice,carChoices}:{racers:Racer[];finishLine:number;humanId:string;carChoice:CarChoice;carChoices?:Record<string,CarChoice>}){
  const ordered=[...racers].sort((a,b)=>
    b.progress-a.progress ||
    b.correctAnswers-a.correctAnswers ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs
  );
  return <section className="number-track" aria-label="Pista da Corrida Numérica">
    <div className="number-roadside number-roadside-left" aria-hidden="true">
      <img src="/assets/crazy-race/roadside-tree.svg" alt=""/>
      <img src="/assets/crazy-race/roadside-cone.svg" alt=""/>
      <img src="/assets/crazy-race/roadside-tree.svg" alt=""/>
      <img src="/assets/crazy-race/roadside-cone.svg" alt=""/>
    </div>
    <div className="number-roadside number-roadside-right" aria-hidden="true">
      <img src="/assets/crazy-race/roadside-cone.svg" alt=""/>
      <img src="/assets/crazy-race/roadside-tree.svg" alt=""/>
      <img src="/assets/crazy-race/roadside-cone.svg" alt=""/>
      <img src="/assets/crazy-race/roadside-tree.svg" alt=""/>
    </div>
    {[25,50,75].map((pct,index)=><div key={pct} className={"number-portal portal-"+(index+1)} style={{left:pct+"%"}}>
      <span>{index===0?"+":index===1?"×":"="}</span>
    </div>)}
    <div className="number-finish-line"><span>CHEGADA</span></div>
    {ordered.map((racer,index)=>{
      // A referência visual escala com o líder: distância comparável por quantidade de acertos.
      const leader=Math.max(0,...racers.map(item=>item.correctAnswers));
      const goal=Math.max(22,leader+8);
      const pct=Math.min(96,racer.correctAnswers/goal*96);
      const car=racer.id===humanId?carChoice:carChoices?.[racer.id]??opponentCar(racer.id);
      return <div className="number-lane" key={racer.id}>
        <span className="number-rank">{index+1}º</span>
        <div className={["number-car",racer.id===humanId?"number-player":"",racer.kind==="npc"?"number-npc":""].filter(Boolean).join(" ")}
          style={{left:"clamp(0px, calc("+pct+"% - 54px), calc(100% - 94px))"}}>
          <NumberVehicle modelId={car.modelId} color={car.color}/>
          {racer.streak>0&&<span className="number-car-screen" title="Sequência de acertos">{racer.streak}×</span>}
        </div>
        <span className="number-lane-name">{racer.name}</span>
      </div>;
    })}
  </section>;
}
function NumberHud({race,humanId,deadline,now}:{
  race:NumberRaceState|RoomRace;humanId:string;deadline:number|null;now:number
}){
  const ordered=[...race.racers].sort((a,b)=>b.correctAnswers-a.correctAnswers||a.errors-b.errors||a.totalCorrectResponseMs-b.totalCorrectResponseMs);
  const human=race.racers.find(r=>r.id===humanId);
  const position=ordered.findIndex(r=>r.id===humanId)+1;
  const remaining=secondsLeft(deadline,now);
  return <div className="number-hud">
    <div><span>Posição</span><strong>{position>0?position+"º / 6":"—"}</strong></div>
    <div><span>Acertos</span><strong>{human?.correctAnswers??0}</strong></div>
    <div><span>Distância</span><strong>{human?.progress??0} m</strong></div>
    <div><span>Erros</span><strong>{human?.errors??0}</strong></div>
    <div className={"number-global-timer "+(remaining<=30?"number-time-danger":"")} aria-live="off">
      <span>Tempo restante</span><strong>{formattedTime(deadline,now)}</strong>
    </div>
  </div>;
}

function FinalStats({
  racers,winnerId,humanId,onAgain
}:{racers:Racer[];winnerId:string|null;humanId:string;onAgain:()=>void}){
  const ordered=[...racers].sort((a,b)=>b.correctAnswers-a.correctAnswers||a.errors-b.errors||a.totalCorrectResponseMs-b.totalCorrectResponseMs);
  const winner=ordered.find(r=>r.id===winnerId);
  return <section className="panel number-finish">
    <img src="/assets/number-race/number-trophy.svg" alt="" className="number-finish-art"/>
    <p className="eyebrow">Corrida concluída</p>
    <h1>{winner?winner.name+" venceu!":"Empate!"}</h1>
    <p>Placar final após 5 minutos · venceu quem acertou mais contas.</p>
    <div className="number-stats-table">
      {ordered.map((racer,index)=>{
        const s=statsFromRacer(racer,index+1);
        return <article key={racer.id} className={racer.id===humanId?"number-stat-row you": "number-stat-row"}>
          <strong>{s.position}º {racer.name}</strong>
          <span>{s.correctAnswers} acertos</span>
          <span>{s.errors} erros</span>
          <span>{s.accuracy}%</span>
          <span>combo {s.bestStreak}</span>
          <span>{s.averageCorrectResponseMs===null?"—":(s.averageCorrectResponseMs/1000).toFixed(1)+"s"} média</span>
        </article>;
      })}
    </div>
    <button onClick={onAgain}>Nova corrida</button>
    <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
  </section>;
}

function SoloNumberRace({session,onExit,carChoice}:{session:ClientSession;onExit:()=>void;carChoice:CarChoice}){
  const makeRace=()=>startTimedRace(createNumberRace([{id:session.sessionId,name:session.nickname}]),Date.now());
  const [race,setRace]=useState<NumberRaceState>(makeRace);
  const [question,setQuestion]=useState<MathQuestion>(()=>generateQuestion(session.gradeLevel,{difficulty:1,seed:"number-solo-1-"+session.sessionId}));
  const [answer,setAnswer]=useState("");
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [correctAnswer,setCorrectAnswer]=useState<string|null>(null);
  const [error,setError]=useState("");
  const questionNumber=useRef(1);
  const questionStarted=useRef(Date.now());
  const inputRef=useRef<HTMLInputElement>(null);
  const now=useNow(race.phase==="round-open");

  useEffect(()=>{
    if(race.phase!=="round-open"||race.matchDeadlineAt==null||now<race.matchDeadlineAt) return;
    setRace(current=>current.phase==="round-open"?finishTimedRace(current,Math.max(now,current.matchDeadlineAt!)):current);
  },[now,race.phase,race.matchDeadlineAt]);

  useEffect(()=>{
    if(race.phase!=="round-open") return;
    const timer=window.setInterval(()=>{
      setRace(current=>current.phase==="round-open" ? tickTimedNpcs(current,Date.now()):current);
    },6000);
    return ()=>window.clearInterval(timer);
  },[race.phase]);

  const restart=()=>{
    const next=makeRace();
    setRace(next);
    questionNumber.current=1;
    questionStarted.current=Date.now();
    setQuestion(generateQuestion(session.gradeLevel,{difficulty:1,seed:"number-solo-restart-"+Date.now()}));
    setAnswer("");
    setFeedback(null);
    setCorrectAnswer(null);
    setError("");
  };

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!answer.trim()||race.phase!=="round-open") return;
    const when=Date.now();
    if(race.matchDeadlineAt!=null && when>race.matchDeadlineAt){
      setRace(current=>current.phase==="round-open"?finishTimedRace(current,when):current);
      return;
    }
    try{
      const correct=validateAnswer(question,answer);
      setRace(current=>answerTimedRace(current,session.sessionId,correct,when-questionStarted.current,when));
      playSound(correct?"engine":"incorrect");
      setFeedback(correct?"correct":"incorrect");
      setCorrectAnswer(correct?null:question.correctAnswer);
      questionNumber.current+=1;
      setQuestion(generateQuestion(session.gradeLevel,{
        difficulty:1,seed:"number-solo-"+session.sessionId+"-"+questionNumber.current+"-"+race.matchStartedAt
      }));
      questionStarted.current=when;
      setAnswer("");
      setError("");
      inputRef.current?.focus();
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível enviar a resposta.");
    }
  };

  if(race.phase==="finished"){
    return <main id="main-content" className="number-shell"><FinalStats racers={race.racers} winnerId={race.winnerId} humanId={session.sessionId} onAgain={restart}/></main>;
  }

  return <main id="main-content" className="number-page">
    <header className="number-header">
      <div><p className="eyebrow">Modo solo · desafio de 5 minutos</p><h1>Corrida Numérica</h1></div>
      <button className="button-ghost" onClick={()=>window.confirm("Sair da corrida atual?")&&onExit()}>Sair</button>
    </header>
    <NumberHud race={race} humanId={session.sessionId} deadline={race.matchDeadlineAt??null} now={now}/>
    <NumericTrack racers={race.racers} finishLine={race.finishLine} humanId={session.sessionId} carChoice={carChoice}/>
    <div className="number-lower">
      <section className="number-question">
        <span className="eyebrow">Resolva o máximo de contas · cada acerto avança {TIMED_ADVANCE} m</span>
        <h2>{question.expression}</h2>
        <form onSubmit={submit}>
          <input ref={inputRef} inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Sua resposta" aria-label="Resposta da conta" autoFocus/>
          <button type="submit" disabled={!answer.trim()}>Responder</button>
        </form>
        {feedback&&<p className={"number-answer-result "+feedback} role="status">{feedback==="correct"?"Acertou! O carro avançou.":"Não avançou. Tente a próxima conta."}</p>}
        {feedback==="incorrect"&&correctAnswer&&<p className="math-correction">Resposta correta: <strong>{correctAnswer}</strong></p>}
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
      <section className="number-boost">
        <img src="/assets/number-race/boost.svg" alt="" />
        <div><p className="eyebrow">Velocidade matemática</p><h2>Sem esperar entre as contas</h2><p>Mais acertos = mais distância. Todos têm 05:00.</p></div>
      </section>
    </div>
    <details className="number-log"><summary>Regras e andamento</summary>
      <ol><li>Partida única de 5 minutos.</li><li>Cada acerto move 100 m.</li><li>Vence quem acertar mais questões.</li></ol>
    </details>
  </main>;
}

function OnlineNumberRace({session,onExit,carChoice}:{session:ClientSession;onExit:()=>void;carChoice:CarChoice}){
  const socket=useMemo<Socket>(()=>io(apiBase,{transports:["websocket"],autoConnect:true}),[]);
  const [room,setRoom]=useState<NumberRoom|null>(null);
  const [mode,setMode]=useState<"menu"|"create"|"join">("menu");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [grade,setGrade]=useState<5|6|7|"mixed">(session.gradeLevel);
  const [answer,setAnswer]=useState("");
  const [error,setError]=useState("");
  const now=useNow(Boolean(room?.race?.phase==="round-open"),room?.serverNow);

  useEffect(()=>{if(room?.status==="finished") playSound("victory");},[room?.status]);

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
    const stateHandler=(next:NumberRoom)=>setRoom(next);
    const reconnect=()=>{
      const saved=sessionStorage.getItem(ROOM_KEY);
      if(!saved) return;
      socket.emit("number:reconnect-room",{...auth(session),code:saved,carChoice},(response:AckResponse)=>{
        if(response.ok&&response.room) setRoom(response.room);
        else sessionStorage.removeItem(ROOM_KEY);
      });
    };
    socket.on("number:room-state",stateHandler);
    socket.on("connect",reconnect);
    if(socket.connected) reconnect();
    return ()=>{
      socket.off("number:room-state",stateHandler);
      socket.off("connect",reconnect);
      socket.disconnect();
    };
  },[socket,session.sessionId,session.reconnectToken]);

  const create=()=>socket.emit("number:create-room",{...auth(session),password,gradeLevel:grade,carChoice},(response:AckResponse)=>apply(response));
  const join=()=>socket.emit("number:join-room",{...auth(session),code:code.trim().toUpperCase(),password,carChoice},(response:AckResponse)=>apply(response));
  const start=()=>{
    if(room) socket.emit("number:start",{...auth(session),code:room.code},(response:AckResponse)=>apply(response));
  };
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!room?.question) return;
    socket.emit("number:answer",{
      ...auth(session),code:room.code,questionId:room.question.id,answer,
      clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      if(apply(response)) setAnswer("");
    });
  };
  const leave=()=>{
    if(room) socket.emit("number:leave",{...auth(session),code:room.code},()=>{});
    sessionStorage.removeItem(ROOM_KEY);
    socket.disconnect();
    onExit();
  };

  if(!room){
    return <main id="main-content" className="number-shell">
      <section className="panel number-online-menu">
        <img src="/assets/number-race/number-emblem.svg" alt="" className="number-logo"/>
        <p className="eyebrow">Multiplayer pedagógico</p>
        <h1>Corrida Numérica</h1>
        {mode==="menu"&&<div className="number-online-actions">
          <button onClick={()=>setMode("create")}>Criar sala</button>
          <button className="button-secondary" onClick={()=>setMode("join")}>Entrar em sala</button>
          <button className="button-ghost" onClick={onExit}>Voltar</button>
        </div>}
        {mode!=="menu"&&<div className="stack">
          {mode==="create"&&<label>Nível da sala
            <select value={grade} onChange={e=>setGrade(e.target.value==="mixed"?"mixed":Number(e.target.value) as 5|6|7)}>
              <option value={5}>5º ano</option><option value={6}>6º ano</option><option value={7}>7º ano</option><option value="mixed">Misto</option>
            </select>
          </label>}
          {mode==="join"&&<label>Código da sala<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6}/></label>}
          <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={4} maxLength={32}/></label>
          <button onClick={mode==="create"?create:join}>{mode==="create"?"Criar sala":"Entrar"}</button>
          <button className="button-ghost" onClick={()=>setMode("menu")}>Cancelar</button>
        </div>}
        {error&&<p className="error">{error}</p>}
      </section>
    </main>;
  }

  if(room.status==="waiting"){
    const isHost=room.hostSessionId===session.sessionId;
    return <main id="main-content" className="number-shell">
      <section className="panel number-room-lobby">
        <p className="eyebrow">Sala privada · nível bloqueado após largada</p>
        <h1>{room.code}</h1>
        <p>Nível da sala: <strong>{room.gradeLevel==="mixed"?"Misto":room.gradeLevel+"º ano"}</strong></p>
        <p><strong>Vagas:</strong> {room.capacity.occupied}/{room.capacity.max} · {room.capacity.available} disponível(is)</p>
        <button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(room.code)}>Copiar código</button>
        <div className="number-members">
          {room.members.map(member=><div key={member.sessionId}>
            <span className={member.connected?"online-dot":"online-dot offline"}/>
            <strong>{member.nickname}</strong>
            <small>{member.presence==="connected"?"Conectado":member.presence==="reconnecting"?"Reconectando":member.presence==="disconnected"?"Desconectado":"Abandonou"}</small>
            {member.sessionId===room.hostSessionId&&<small>Host</small>}
          </div>)}
        </div>
        {isHost?<button disabled={room.lifecycleState!=="ready"} onClick={start}>Iniciar com {room.capacity.occupied} humano(s)</button>:<p>Aguardando o host iniciar...</p>}
        <button className="button-ghost" onClick={leave}>Sair da sala</button>
        {error&&<p className="error">{error}</p>}
      </section>
    </main>;
  }

  if(!room.race) return <main id="main-content" className="number-shell"><p>Sincronizando...</p></main>;

  if(room.status==="finished"||room.race.phase==="finished"){
    return <main id="main-content" className="number-shell">
      <FinalStats racers={room.race.racers} winnerId={room.race.winnerId} humanId={session.sessionId} onAgain={leave}/>
    </main>;
  }

  const answered=room.race.answeredIds.includes(session.sessionId);
  const human=room.race.racers.find(r=>r.id===session.sessionId);

  return <main id="main-content" className="number-page">
    <header className="number-header">
      <div>
        <p className="eyebrow">Sala {room.code} · {room.gradeLevel==="mixed"?"Misto":room.gradeLevel+"º ano"}</p>
        <h1>Corrida Numérica</h1>
      </div>
      <div className="number-header-actions"><div className="number-connection">{socket.connected?"Conectado":"Reconectando"}</div><button className="button-ghost" onClick={()=>window.confirm("Sair da sala e abandonar a corrida?")&&leave()}>Sair</button></div>
    </header>

    <NumberHud race={room.race} humanId={session.sessionId} deadline={room.question?.deadlineAt??null} now={now}/>
    <NumericTrack racers={room.race.racers} finishLine={room.race.finishLine} humanId={session.sessionId} carChoice={carChoice} carChoices={room.carChoices}/>

    <div className="number-lower">
      <section className="number-question">
        <span className="eyebrow">Servidor · {secondsLeft(room.question?.deadlineAt,now)}s</span>
        <h2>{room.question?.expression??"Processando rodada..."}</h2>
        {room.question&&<form onSubmit={submit}>
          <input inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={answered} placeholder="Digite sua resposta"/>
          <button disabled={answered}>{answered?"Resposta registrada":"Responder"}</button>
        </form>}
        {answered&&room.question&&<p className="number-wait">Resposta registrada; aguardando o deadline oficial.</p>}
        {!room.question&&room.lastCorrectAnswer&&<p className="math-correction">Resposta correta da rodada: <strong>{room.lastCorrectAnswer}</strong></p>}
        {error&&<p className="error">{error}</p>}
      </section>

      <section className="number-boost">
        <img src="/assets/number-race/boost.svg" alt="" />
        <div><p className="eyebrow">Seu impulso</p><h2>{human?.streak??0}× combo</h2><p>Sem itens de ataque. Seu resultado depende da matemática.</p></div>
      </section>
    </div>

    <details className="number-log"><summary>Progresso da corrida</summary><ol>{room.race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></details>
  </main>;
}

export function NumberRace({session}:{session:ClientSession}){
  const [mode,setMode]=useState<"setup"|"solo"|"online">("setup");
  const [carChoice,setCarChoice]=useCarChoice();

  if(mode==="solo") return <SoloNumberRace session={session} carChoice={carChoice} onExit={()=>setMode("setup")}/>;
  if(mode==="online") return <OnlineNumberRace session={session} carChoice={carChoice} onExit={()=>setMode("setup")}/>;

  return <main id="main-content" className="number-shell">
    <section className="panel number-setup">
      <img src="/assets/number-race/number-emblem.svg" alt="" className="number-logo"/>
      <p className="eyebrow">Precisão · sequência · impulso</p>
      <h1>Corrida Numérica</h1>
      <p>Seis competidores avançam resolvendo contas. Não há bombas ou ataques: a precisão decide a corrida e rapidez/combos dão apenas bônus pequenos.</p>
      <CarPicker choice={carChoice} onChange={setCarChoice}/>
       <div className="number-mode-grid">
        <button onClick={()=>setMode("solo")}><strong>Jogar agora</strong><span>Você contra 5 NPCs</span></button>
        <button onClick={()=>setMode("online")}><strong>Multiplayer</strong><span>Criar ou entrar em sala</span></button>
      </div>
      <HelpRules>
        <ul>
          <li>Cada rodada dura {ROUND_DURATION_MS/1000} segundos.</li>
          <li>Acerto concede o avanço principal.</li>
          <li>3 e 5 acertos seguidos geram pequenos bônus de impulso.</li>
          <li>Resposta rápida dá bônus leve e limitado; não supera a importância do acerto.</li>
          <li>Erro ou timeout: zero avanço e combo reiniciado.</li>
        </ul>
      </HelpRules>
      <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
    </section>
  </main>;
}
