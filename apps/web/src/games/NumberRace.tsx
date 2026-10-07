import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import {
  createNumberRace, ranking, resolveRound, startRound, statsFor, submitAnswer,
  submitNpcAnswers, type NumberRaceState, type Racer
} from "@jogos/number-race";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import { HelpRules, ResultFeedback } from "@jogos/ui";
import { apiBase, type ClientSession } from "../session";
import "./number-race.css";

type RoomRace=Omit<NumberRaceState,"submissions"> & {answeredIds:string[]};
type NumberRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:5|6|7|"mixed";
  members:Array<{sessionId:string;nickname:string;connected:boolean}>;
  status:"waiting"|"playing"|"finished";
  race:RoomRace|null;
  question:null|{id:string;expression:string;gradeLevel:number;difficulty:number;deadlineAt:number|null};
  updatedAt:number;
};
type AckResponse={ok:boolean;room?:NumberRoom;error?:string};

const ROOM_KEY="number-race-room-code";
const auth=(session:ClientSession)=>({sessionId:session.sessionId,reconnectToken:session.reconnectToken});

function useNow(active:boolean){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{
    if(!active) return;
    const timer=window.setInterval(()=>setNow(Date.now()),200);
    return ()=>window.clearInterval(timer);
  },[active]);
  return now;
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

function NumericTrack({racers,finishLine,humanId}:{racers:Racer[];finishLine:number;humanId:string}){
  const ordered=[...racers].sort((a,b)=>
    b.progress-a.progress ||
    b.correctAnswers-a.correctAnswers ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs
  );
  return <section className="number-track" aria-label="Pista da Corrida Numérica">
    {[25,50,75].map((pct,index)=><div key={pct} className={"number-portal portal-"+(index+1)} style={{left:pct+"%"}}>
      <span>{index===0?"+":index===1?"×":"="}</span>
    </div>)}
    <div className="number-finish-line"><span>100%</span></div>
    {ordered.map((racer,index)=>{
      const pct=Math.min(100,racer.progress/finishLine*100);
      return <div className="number-lane" key={racer.id}>
        <span className="number-rank">{index+1}º</span>
        <div
          className={["number-car",racer.id===humanId?"number-player":"",racer.kind==="npc"?"number-npc":""].filter(Boolean).join(" ")}
          style={{left:"calc("+pct+"% - 31px)"}}
        >
          <span className="number-car-screen">{racer.streak}</span>
          <strong>{racer.name.slice(0,2).toUpperCase()}</strong>
        </div>
        <span className="number-lane-name">{racer.name}</span>
      </div>;
    })}
  </section>;
}

function NumberHud({
  race,humanId,deadline,now
}:{race:NumberRaceState|RoomRace;humanId:string;deadline:number|null;now:number}){
  const ordered=[...race.racers].sort((a,b)=>b.progress-a.progress||b.correctAnswers-a.correctAnswers||a.totalCorrectResponseMs-b.totalCorrectResponseMs);
  const human=race.racers.find(r=>r.id===humanId);
  const position=ordered.findIndex(r=>r.id===humanId)+1;
  const progress=human?Math.min(100,Math.round(human.progress/race.finishLine*100)):0;
  return <div className="number-hud">
    <div><span>Posição</span><strong>{position>0?position+"º / 6":"—"}</strong></div>
    <div><span>Progresso</span><strong>{progress}%</strong></div>
    <div><span>Combo</span><strong>{human?.streak??0}×</strong></div>
    <div><span>Melhor sequência</span><strong>{human?.bestStreak??0}</strong></div>
    <div className={secondsLeft(deadline,now)<=5?"number-time-danger":""}><span>Tempo</span><strong>{secondsLeft(deadline,now)}s</strong></div>
  </div>;
}

function FinalStats({
  racers,winnerId,humanId,onAgain
}:{racers:Racer[];winnerId:string|null;humanId:string;onAgain:()=>void}){
  const ordered=[...racers].sort((a,b)=>b.progress-a.progress||b.correctAnswers-a.correctAnswers||a.totalCorrectResponseMs-b.totalCorrectResponseMs);
  const winner=ordered.find(r=>r.id===winnerId);
  return <section className="panel number-finish">
    <img src="/assets/number-race/number-trophy.svg" alt="" className="number-finish-art"/>
    <p className="eyebrow">Corrida concluída</p>
    <h1>{winner?.name??"Competidor"} venceu!</h1>
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

function SoloNumberRace({session,onExit}:{session:ClientSession;onExit:()=>void}){
  const makeRace=()=>{
    let next=createNumberRace([{id:session.sessionId,name:session.nickname}]);
    next=startRound(next,Date.now());
    return submitNpcAnswers(next);
  };
  const [race,setRace]=useState<NumberRaceState>(makeRace);
  const [question,setQuestion]=useState<MathQuestion|null>(()=>generateQuestion(session.gradeLevel,{difficulty:1,seed:"number-solo-1-"+session.sessionId}));
  const [answer,setAnswer]=useState("");
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [error,setError]=useState("");
  const resolved=useRef(0);
  const now=useNow(race.phase==="round-open");

  useEffect(()=>{
    if(race.phase!=="round-open"||!race.roundDeadlineAt||now<race.roundDeadlineAt||resolved.current===race.round) return;
    resolved.current=race.round;
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
          seed:"number-solo-"+next.round+"-"+session.sessionId
        }));
        setAnswer("");
        setFeedback(null);
        setSubmitted(false);
        setError("");
        return next;
      });
    },1000);
    return ()=>window.clearTimeout(timer);
  },[race.phase,session.gradeLevel,session.sessionId]);

  const restart=()=>{
    const next=makeRace();
    setRace(next);
    setQuestion(generateQuestion(session.gradeLevel,{difficulty:1,seed:"number-solo-restart-"+Date.now()}));
    setAnswer("");
    setFeedback(null);
    setSubmitted(false);
    setError("");
    resolved.current=0;
  };

  if(race.phase==="finished"){
    return <main className="number-shell"><FinalStats racers={race.racers} winnerId={race.winnerId} humanId={session.sessionId} onAgain={restart}/></main>;
  }

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(submitted||!question||race.phase!=="round-open") return;
    try{
      const correct=validateAnswer(question,answer);
      const responseMs=Math.max(0,Date.now()-(race.roundStartedAt??Date.now()));
      setRace(current=>submitAnswer(current,session.sessionId,correct,responseMs,Date.now()));
      setFeedback(correct?"correct":"incorrect");
      setSubmitted(true);
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível enviar.");
    }
  };

  const human=race.racers.find(r=>r.id===session.sessionId)!;
  return <main className="number-page">
    <header className="number-header">
      <div><p className="eyebrow">Modo solo · precisão antes da velocidade</p><h1>Corrida Numérica</h1></div>
      <button className="button-ghost" onClick={()=>window.confirm("Sair da corrida atual?")&&onExit()}>Sair</button>
    </header>

    <NumberHud race={race} humanId={session.sessionId} deadline={race.roundDeadlineAt} now={now}/>
    <NumericTrack racers={race.racers} finishLine={race.finishLine} humanId={session.sessionId}/>

    <div className="number-lower">
      <section className="number-question">
        <span className="eyebrow">Rodada {race.round} · 20 segundos</span>
        <h2>{question?.expression??"Calculando posições..."}</h2>
        {question&&race.phase==="round-open"&&<form onSubmit={submit}>
          <input inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={submitted} placeholder="Digite sua resposta"/>
          <button disabled={submitted}>{submitted?"Resposta enviada":"Responder"}</button>
        </form>}
        {feedback&&<ResultFeedback status={feedback}/>}
        {submitted&&<p className="number-wait">Movimento aplicado ao final dos 20 segundos.</p>}
        {error&&<p className="error" role="alert">{error}</p>}
      </section>

      <section className="number-boost">
        <img src="/assets/number-race/boost.svg" alt="" />
        <div>
          <p className="eyebrow">Impulso numérico</p>
          <h2>{human.streak} acerto(s) seguido(s)</h2>
          <p>3 acertos: bônus pequeno. 5 ou mais: bônus moderado. Rapidez acrescenta apenas um bônus leve.</p>
        </div>
      </section>
    </div>

    <section className="number-log"><h2>Progresso da corrida</h2><ol>{race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></section>
  </main>;
}

function OnlineNumberRace({session,onExit}:{session:ClientSession;onExit:()=>void}){
  const socket=useMemo<Socket>(()=>io(apiBase,{transports:["websocket"],autoConnect:true}),[]);
  const [room,setRoom]=useState<NumberRoom|null>(null);
  const [mode,setMode]=useState<"menu"|"create"|"join">("menu");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [grade,setGrade]=useState<5|6|7|"mixed">(session.gradeLevel);
  const [answer,setAnswer]=useState("");
  const [error,setError]=useState("");
  const now=useNow(Boolean(room?.race?.phase==="round-open"));

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
      socket.emit("number:reconnect-room",{...auth(session),code:saved},(response:AckResponse)=>{
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

  const create=()=>socket.emit("number:create-room",{...auth(session),password,gradeLevel:grade},(response:AckResponse)=>apply(response));
  const join=()=>socket.emit("number:join-room",{...auth(session),code:code.trim().toUpperCase(),password},(response:AckResponse)=>apply(response));
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
    sessionStorage.removeItem(ROOM_KEY);
    socket.disconnect();
    onExit();
  };

  if(!room){
    return <main className="number-shell">
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
    return <main className="number-shell">
      <section className="panel number-room-lobby">
        <p className="eyebrow">Sala privada · nível bloqueado após largada</p>
        <h1>{room.code}</h1>
        <p>Nível da sala: <strong>{room.gradeLevel==="mixed"?"Misto":room.gradeLevel+"º ano"}</strong></p>
        <div className="number-members">
          {room.members.map(member=><div key={member.sessionId}>
            <span className={member.connected?"online-dot":"online-dot offline"}/>
            <strong>{member.nickname}</strong>
            {member.sessionId===room.hostSessionId&&<small>Host</small>}
          </div>)}
        </div>
        {isHost?<button onClick={start}>Iniciar com {room.members.length} humano(s)</button>:<p>Aguardando o host iniciar...</p>}
        <button className="button-ghost" onClick={leave}>Sair da sala</button>
        {error&&<p className="error">{error}</p>}
      </section>
    </main>;
  }

  if(!room.race) return <main className="number-shell"><p>Sincronizando...</p></main>;

  if(room.status==="finished"||room.race.phase==="finished"){
    return <main className="number-shell">
      <FinalStats racers={room.race.racers} winnerId={room.race.winnerId} humanId={session.sessionId} onAgain={leave}/>
    </main>;
  }

  const answered=room.race.answeredIds.includes(session.sessionId);
  const human=room.race.racers.find(r=>r.id===session.sessionId);

  return <main className="number-page">
    <header className="number-header">
      <div>
        <p className="eyebrow">Sala {room.code} · {room.gradeLevel==="mixed"?"Misto":room.gradeLevel+"º ano"}</p>
        <h1>Corrida Numérica</h1>
      </div>
      <div className="number-connection">{socket.connected?"Conectado":"Reconectando"}</div>
    </header>

    <NumberHud race={room.race} humanId={session.sessionId} deadline={room.question?.deadlineAt??null} now={now}/>
    <NumericTrack racers={room.race.racers} finishLine={room.race.finishLine} humanId={session.sessionId}/>

    <div className="number-lower">
      <section className="number-question">
        <span className="eyebrow">Servidor · {secondsLeft(room.question?.deadlineAt,now)}s</span>
        <h2>{room.question?.expression??"Processando rodada..."}</h2>
        {room.question&&<form onSubmit={submit}>
          <input inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={answered} placeholder="Digite sua resposta"/>
          <button disabled={answered}>{answered?"Resposta registrada":"Responder"}</button>
        </form>}
        {answered&&<p className="number-wait">Resposta registrada; aguardando o deadline oficial.</p>}
        {error&&<p className="error">{error}</p>}
      </section>

      <section className="number-boost">
        <img src="/assets/number-race/boost.svg" alt="" />
        <div><p className="eyebrow">Seu impulso</p><h2>{human?.streak??0}× combo</h2><p>Sem itens de ataque. Seu resultado depende da matemática.</p></div>
      </section>
    </div>

    <section className="number-log"><h2>Progresso da corrida</h2><ol>{room.race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></section>
    <button className="button-ghost" onClick={()=>window.confirm("Sair da sala e abandonar a corrida?")&&leave()}>Sair da corrida</button>
  </main>;
}

export function NumberRace({session}:{session:ClientSession}){
  const [mode,setMode]=useState<"setup"|"solo"|"online">("setup");

  if(mode==="solo") return <SoloNumberRace session={session} onExit={()=>setMode("setup")}/>;
  if(mode==="online") return <OnlineNumberRace session={session} onExit={()=>setMode("setup")}/>;

  return <main className="number-shell">
    <section className="panel number-setup">
      <img src="/assets/number-race/number-emblem.svg" alt="" className="number-logo"/>
      <p className="eyebrow">Precisão · sequência · impulso</p>
      <h1>Corrida Numérica</h1>
      <p>Seis competidores avançam resolvendo contas. Não há bombas ou ataques: a precisão decide a corrida e rapidez/combos dão apenas bônus pequenos.</p>
      <div className="number-mode-grid">
        <button onClick={()=>setMode("solo")}><strong>Jogar agora</strong><span>Você contra 5 NPCs</span></button>
        <button onClick={()=>setMode("online")}><strong>Multiplayer</strong><span>Criar ou entrar em sala</span></button>
      </div>
      <HelpRules>
        <ul>
          <li>Cada rodada dura 20 segundos.</li>
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
