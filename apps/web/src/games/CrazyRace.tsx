import { useEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties } from "react";
import { io, type Socket } from "socket.io-client";
import {
  bombTarget, CAR_MODELS, TIMED_BOMBS, createRace, answerTimedRace, finishTimedRace,
  racerDeadline, resolveNpcBombIfNeeded, resolveTimedTrackBomb, startTimedRace,
  tickTimedNpcs, triggerTimedTrackBombs, useBomb,
  type BombDirection, type CarModel, type CarSelection, type Racer, type RaceState
} from "@jogos/crazy-race";
import { generateRaceQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import { HelpRules, ResultFeedback } from "@jogos/ui";
import { apiBase, type ClientSession } from "../session";
import { playSound } from "../experience";
import "./crazy-race.css";

type RoomRace = Omit<RaceState,"submissions"|"bombChallenges"> & {
  answeredIds:string[];
  bombTargets:string[];
};

type OnlineRoom = {
  code:string;
  hostSessionId:string;
  gradeLevel:5|6|7|"mixed";
  members:Array<{sessionId:string;nickname:string;gradeLevel:5|6|7|"mixed";carModel:CarModel;carColor:string;connected:boolean;presence:"connected"|"reconnecting"|"disconnected"|"abandoned"}>;
  status:"waiting"|"playing"|"finished";
  lifecycleState:"waiting"|"ready"|"countdown"|"playing"|"round-resolution"|"finished"|"closed";
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  race:RoomRace|null;
  question:null|{id:string;expression:string;gradeLevel:number;difficulty:number;deadlineAt:number|null};
  lastCorrectAnswer:string|null;
  updatedAt:number;
};

type BombQuestion = {id:string;expression:string;deadlineAt:number};
type TrackQuestion={id:string;expression:string;checkpoint:number};
type RoomListing={code:string;hostNickname:string;occupied:number;max:number;createdAt:number};
type AckResponse = {
  ok:boolean;room?:OnlineRoom;rooms?:RoomListing[];pin?:string;error?:string;targetId?:string;
  bombQuestion?:BombQuestion|null;bombCorrection?:string|null;
  trackQuestion?:TrackQuestion|null;trackCorrect?:boolean|null;trackCorrection?:string|null
};

const ROOM_KEY="crazy-race-room-code";
const ROOM_PIN_KEY="crazy-race-room-private-pin";
const CAR_LABELS:Record<CarModel,string>={
  esportivo:"Esportivo",sedan:"Sedã",hatch:"Hatch",suv:"SUV",picape:"Picape",
  buggy:"Buggy",formula:"Fórmula",classico:"Clássico",jipe:"Jipe",van:"Van"
};
const PALETTE=[
  {name:"Azul",hex:"#3378dc"},{name:"Vermelho",hex:"#e54842"},
  {name:"Verde",hex:"#21a47a"},{name:"Amarelo",hex:"#edb22a"},
  {name:"Roxo",hex:"#8b56d7"},{name:"Preto",hex:"#303847"},
  {name:"Branco",hex:"#e5e9ef"},{name:"Laranja",hex:"#ec752f"}
];

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

function formatClock(seconds:number):string{
  return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
}

function secondsLeft(deadline:number|null|undefined,now:number):number {
  if(!deadline) return 0;
  return Math.max(0,Math.ceil((deadline-now)/1000));
}

function orderedRacers(racers:Racer[]):Racer[] {
  return [...racers].sort((a,b)=>
    b.correctAnswers-a.correctAnswers ||
    a.errors-b.errors ||
    b.progress-a.progress ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs ||
    a.name.localeCompare(b.name,"pt-BR")
  );
}

function Vehicle({model,color,name,isPlayer=false}:{model:CarModel;color:string;name:string;isPlayer?:boolean}){
  return <div className={["race-car","car-model-"+model,isPlayer?"player-car":""].filter(Boolean).join(" ")}
    style={{"--car-paint":color} as CSSProperties} aria-label={CAR_LABELS[model]+" de "+name} title={name}>
    <span className="car-body"><span className="car-door"/><span className="car-headlight"/></span>
    <span className="car-roof"><span className="car-window rear-window"/><span className="car-window front-window"/></span>
    <span className="car-wheel rear-wheel"/><span className="car-wheel front-wheel"/>
  </div>;
}

function CarPicker({choice,onChange}:{choice:CarSelection;onChange:(value:CarSelection)=>void}){
  return <section className="car-picker" aria-label="Escolha seu carro">
    <div className="car-picker-title"><h2>Minha garagem</h2><p>Escolha o modelo e a cor do carro que você usará.</p></div>
    <div className="car-preview"><Vehicle model={choice.carModel} color={choice.carColor} name="Seu carro" isPlayer/></div>
    <div className="car-models">{CAR_MODELS.map(model=><button key={model}
      className={choice.carModel===model?"selected":""}
      aria-pressed={choice.carModel===model}
      onClick={()=>onChange({...choice,carModel:model})}>{CAR_LABELS[model]}</button>)}</div>
    <div className="car-colors" role="group" aria-label="Cor do carro">{PALETTE.map(color=><button
      key={color.hex} title={color.name} aria-label={"Cor "+color.name}
      aria-pressed={choice.carColor===color.hex}
      className={choice.carColor===color.hex?"selected":""}
      style={{backgroundColor:color.hex}} onClick={()=>onChange({...choice,carColor:color.hex})}/>)}</div>
  </section>;
}

function Track({racers,finishLine,humanId}:{racers:Racer[];finishLine:number;humanId:string}) {
  const ordered=orderedRacers(racers);
  const displayDistance=Math.max(5000,...racers.map(r=>r.progress+1000));
  return <section className="crazy-track" aria-label="Pista da Corrida Maluca com três bombas ao longo de cinco minutos">
    <div className="roadside roadside-top" aria-hidden="true">{Array.from({length:11},(_,i)=><img
      key={i} src={i%3===0?"/assets/crazy-race/roadside-cone.svg":"/assets/crazy-race/roadside-tree.svg"} alt=""/>)}</div>
    <div className="track-finish" aria-hidden="true"/>
    {TIMED_BOMBS.map((point,index)=><div
      key={point} className="track-checkpoint" style={{left:(point/300_000*100)+"%"}}
      title={"Bomba "+(index+1)+" - aos "+formatClock(point/1000)} aria-hidden="true">
      <img src="/assets/crazy-race/math-bomb.svg" alt=""/><span>{index+1}</span>
    </div>)}
    {ordered.map((racer,index)=>{
      const pct=Math.max(0,Math.min(98,racer.progress/displayDistance*100));
      return <div className="race-lane" key={racer.id}>
        <span className="lane-rank">{index+1}º</span>
        <div className="car-position" style={{left:"calc("+pct+"% - "+(pct*0.9)+"px)"}}>
          <Vehicle model={racer.carModel??"esportivo"} color={racer.carColor??"#3378dc"}
            name={racer.name} isPlayer={racer.id===humanId}/>
        </div>
        <span className="lane-name">{racer.name}{racer.pendingTrackBomb!==null?" · Bomba!":""}</span>
      </div>;
    })}
    <div className="roadside roadside-bottom" aria-hidden="true">{Array.from({length:11},(_,i)=><img
      key={i} src={i%4===0?"/assets/crazy-race/roadside-cone.svg":"/assets/crazy-race/roadside-tree.svg"} alt=""/>)}</div>
  </section>;
}

function RaceHud({
  racers,humanId,deadline,now
}:{racers:Racer[];humanId:string;deadline:number|null;now:number}) {
  const human=racers.find(r=>r.id===humanId);
  const rank=human?orderedRacers(racers).findIndex(r=>r.id===humanId)+1:0;
  return <div className="crazy-hud">
    <div><span>Posição</span><strong>{rank || "—"}º / 6</strong></div>
    <div><span>Acertos</span><strong>{human?.correctAnswers??0}</strong></div>
    <div><span>Erros</span><strong>{human?.errors??0}</strong></div>
    <div className={secondsLeft(deadline,now)<=30?"timer-danger":""}><span>Tempo restante</span><strong>{formatClock(secondsLeft(deadline,now))}</strong></div>
    <div><span>Bombas surpresa</span><strong>{human?.clearedTrackBombs.length??0} / 3</strong></div>
    <div><span>Ataques</span><strong>{human?.bombCharges ?? 0}</strong></div>
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
    <p className="eyebrow">Tempo encerrado · 05:00</p>
    <h1>{winner?winner.name+" venceu!":"Empate na Corrida Maluca!"}</h1>
    <div className="race-ranking">
      {orderedRacers(racers).map((r,index)=><div key={r.id} className={r.id===humanId?"you":""}>
        <strong>{index+1}º {r.name}</strong>
        <span>{r.correctAnswers} acertos · {r.errors} erros · {Math.round(r.progress)} m · {r.timePenaltyMs/1000}s de penalidade</span>
      </div>)}
    </div>
    <button onClick={onAgain}>Nova corrida</button>
    <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
  </section>;
}

function SoloRace({session,onExit,car}:{session:ClientSession;onExit:()=>void;car:CarSelection}) {
  const begin=()=>startTimedRace(createRace([{id:session.sessionId,name:session.nickname,...car}]),Date.now());
  const [race,setRace]=useState<RaceState>(begin);
  const [question,setQuestion]=useState<MathQuestion>(()=>generateRaceQuestion(session.gradeLevel,{difficulty:1,seed:"solo-start-"+session.sessionId+"-"+Date.now()}));
  const [answer,setAnswer]=useState("");
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [correctAnswer,setCorrectAnswer]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [trackQuestion,setTrackQuestion]=useState<MathQuestion|null>(null);
  const [trackMessage,setTrackMessage]=useState("");
  const lastNpcPulse=useRef(Date.now());
  const questionStarted=useRef(Date.now());
  const questionSerial=useRef(0);
  const now=useNow(race.phase==="round-open");
  const own=race.racers.find(r=>r.id===session.sessionId);
  const deadline=race.matchDeadlineAt==null?null:racerDeadline(race,session.sessionId);
  const active=race.phase==="round-open"&&deadline!=null&&now<deadline;
  const pendingTrackBomb=own?.pendingTrackBomb??null;

  const makeNextQuestion=(level:number)=>generateRaceQuestion(session.gradeLevel,{
    difficulty:level>25?3:level>12?2:1,
    seed:"crazy-solo-"+session.sessionId+"-"+Date.now()+"-"+(++questionSerial.current)
  });

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      const moment=Date.now();
      setRace(current=>{
        if(current.phase!=="round-open"||current.matchDeadlineAt==null) return current;
        if(moment>=current.matchDeadlineAt) return finishTimedRace(current,moment);
        let next=triggerTimedTrackBombs(current,moment);
        if(moment-lastNpcPulse.current>=6000){
          next=tickTimedNpcs(next,moment);
          lastNpcPulse.current=moment;
        }
        return next;
      });
    },500);
    return ()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{
    if(pendingTrackBomb===null){setTrackQuestion(null);return;}
    setTrackQuestion(current=>current??generateRaceQuestion(session.gradeLevel,{
      difficulty:own?.clearedTrackBombs.length===0?1:own?.clearedTrackBombs.length===1?2:3,
      seed:"crazy-solo-track-"+session.sessionId+"-"+pendingTrackBomb
    }));
  },[pendingTrackBomb,session.gradeLevel,session.sessionId,own?.clearedTrackBombs.length]);

  const restart=()=>{
    const next=begin();
    setRace(next);
    setQuestion(makeNextQuestion(1));
    setAnswer("");
    setFeedback(null);
    setCorrectAnswer(null);
    setMessage("");
    setTrackQuestion(null);
    setTrackMessage("");
    lastNpcPulse.current=Date.now();
    questionStarted.current=Date.now();
  };

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!active||pendingTrackBomb!==null||!answer.trim()) return;
    const currentQuestion=question;
    const submittedAt=Date.now();
    try{
      const correct=validateAnswer(currentQuestion,answer);
      const next=answerTimedRace(race,session.sessionId,correct,submittedAt-questionStarted.current,submittedAt);
      setRace(next);
      setFeedback(correct?"correct":"incorrect");
      setCorrectAnswer(correct?null:currentQuestion.correctAnswer);
      setQuestion(makeNextQuestion(next.round));
      setAnswer("");
      questionStarted.current=submittedAt;
      playSound(correct?"engine":"incorrect");
      setMessage("");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível registrar.");
    }
  };

  const submitTrack=(event:FormEvent)=>{
    event.preventDefault();
    if(!active||pendingTrackBomb===null||!trackQuestion) return;
    const input=new FormData(event.currentTarget as HTMLFormElement).get("trackAnswer")?.toString()??"";
    const correct=validateAnswer(trackQuestion,input);
    const next=resolveTimedTrackBomb(race,session.sessionId,correct);
    setRace(next);
    setTrackMessage(correct?"Bomba desarmada! Continue acertando contas.":
      "BOOM! Resposta correta: "+trackQuestion.correctAnswer+". Seu tempo foi reduzido em 10 segundos.");
    setTrackQuestion(null);
    playSound(correct?"engine":"incorrect");
  };

  const bomb=(direction:BombDirection)=>{
    if(!active||pendingTrackBomb!==null) return;
    try{
      const target=bombTarget(race,session.sessionId,direction);
      let next=useBomb(race,session.sessionId,direction,Date.now());
      if(target?.kind==="npc") next=resolveNpcBombIfNeeded(next,target.id);
      setRace(next);
      playSound("engine");
      setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"Bomba indisponível.");}
  };

  if(race.phase==="finished"){
    return <main id="main-content" className="crazy-shell">
      <RaceFinish racers={race.racers} winnerId={race.winnerId} humanId={session.sessionId} onAgain={restart}/>
    </main>;
  }

  return <main id="main-content" className="crazy-page">
    <header className="crazy-header">
      <div><p className="eyebrow">Modo solo · 05:00 · 1 humano + 5 NPCs</p><h1>Corrida Maluca</h1></div>
      <button className="button-ghost" onClick={()=>window.confirm("Sair da corrida atual?")&&onExit()}>Sair</button>
    </header>
    <RaceHud racers={race.racers} humanId={session.sessionId} deadline={deadline} now={now}/>
    <Track racers={race.racers} finishLine={race.finishLine} humanId={session.sessionId}/>
    <div className="crazy-lower">
      <section className="race-question-card">
        <span className="eyebrow">Contas contínuas · 05:00 no total · cada acerto avança o carro</span>
        <h2>{question.expression}</h2>
        {active&&pendingTrackBomb===null&&<form onSubmit={submit}>
          <input aria-label="Resposta da conta" inputMode="decimal" value={answer}
            onChange={e=>setAnswer(e.target.value)} placeholder="Digite sua resposta" autoFocus/>
          <button disabled={!answer.trim()}>Responder</button>
        </form>}
        {!active&&<p className="race-waiting">Seu tempo acabou. Aguardando o cronômetro geral para mostrar o vencedor.</p>}
        {feedback&&<ResultFeedback status={feedback}/>}
        {feedback==="incorrect"&&correctAnswer&&<p className="math-correction">Resposta correta: <strong>{correctAnswer}</strong></p>}
        {pendingTrackBomb!==null&&active&&<p className="bomb-warning">Bomba surpresa! Resolva para continuar.</p>}
        {trackMessage&&<p className="race-waiting" role="status">{trackMessage}</p>}
        {message&&<p className="error" role="alert">{message}</p>}
      </section>
      <BombControls race={race} humanId={session.sessionId} onBomb={bomb} disabled={!active||pendingTrackBomb!==null}/>
    </div>
    {active&&pendingTrackBomb!==null&&trackQuestion&&<div className="bomb-overlay" role="dialog" aria-modal="true" aria-label="Desafio da bomba surpresa">
      <section className="bomb-dialog track-bomb-dialog">
        <img src="/assets/crazy-race/math-bomb.svg" alt="Bomba surpresa"/>
        <p className="eyebrow">Bomba {TIMED_BOMBS.indexOf(pendingTrackBomb as typeof TIMED_BOMBS[number])+1} de 3 · 05:00 de corrida</p>
        <h2>{trackQuestion.expression}</h2>
        <p>Acertou: segue normalmente. Errou: perde 10 segundos do seu relógio!</p>
        <form onSubmit={submitTrack}>
          <input autoFocus name="trackAnswer" aria-label="Resposta da bomba" inputMode="decimal" required placeholder="Sua resposta"/>
          <button>Desarmar bomba</button>
        </form>
      </section>
    </div>}
    <details className="crazy-log"><summary>Últimos acontecimentos</summary><ol>{race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></details>
  </main>;
}

function OnlineRace({session,onExit,car}:{session:ClientSession;onExit:()=>void;car:CarSelection}) {
  const socket=useMemo<Socket>(()=>io(apiBase,{transports:["websocket"],autoConnect:true}),[]);
  const [room,setRoom]=useState<OnlineRoom|null>(null);
  const [availableRooms,setAvailableRooms]=useState<RoomListing[]>([]);
  const [mode,setMode]=useState<"menu"|"create"|"join">("menu");
  const [pin,setPin]=useState("");
  const [privatePin,setPrivatePin]=useState<string|null>(()=>sessionStorage.getItem(ROOM_PIN_KEY));
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [answer,setAnswer]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [bombQuestion,setBombQuestion]=useState<BombQuestion|null>(null);
  const [bombAnswer,setBombAnswer]=useState("");
  const [bombCorrection,setBombCorrection]=useState<string|null>(null);
  const [trackQuestion,setTrackQuestion]=useState<TrackQuestion|null>(null);
  const [trackAnswer,setTrackAnswer]=useState("");
  const [trackMessage,setTrackMessage]=useState("");
  const now=useNow(Boolean(room?.status==="playing"||bombQuestion),room?.serverNow);

  useEffect(()=>{if(room?.status==="finished") playSound("victory");},[room?.status]);

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
    if(response.trackQuestion) setTrackQuestion(response.trackQuestion);
    setError("");
    return true;
  };

  useEffect(()=>{
    const stateHandler=(next:OnlineRoom)=>{
      setRoom(next);
      if(next.race?.racers.find(r=>r.id===session.sessionId)?.pendingTrackBomb===null) setTrackQuestion(null);
      if(next.race&&!next.race.bombTargets.includes(session.sessionId)) setBombQuestion(null);
    };
    const bombHandler=(q:BombQuestion)=>{setBombCorrection(null);setBombQuestion(q);};
    const trackHandler=(q:TrackQuestion)=>{setTrackMessage("");setTrackQuestion(q);};
    const refreshRooms=()=>{
      socket.emit("crazy:list-rooms",{},(response:AckResponse)=>{
        if(response.ok&&response.rooms) setAvailableRooms(response.rooms);
      });
    };
    const connectHandler=()=>{
      refreshRooms();
      const saved=sessionStorage.getItem(ROOM_KEY);
      if(!saved) return;
      socket.emit("crazy:reconnect-room",{...auth(session),code:saved},(response:AckResponse)=>{
        if(response.ok&&response.room) applyAck(response);
        else {
          sessionStorage.removeItem(ROOM_KEY);
          sessionStorage.removeItem(ROOM_PIN_KEY);
          setPrivatePin(null);
        }
      });
    };
    socket.on("crazy:room-state",stateHandler);
    socket.on("crazy:bomb-question",bombHandler);
    socket.on("crazy:track-question",trackHandler);
    socket.on("crazy:rooms-changed",refreshRooms);
    socket.on("connect",connectHandler);
    if(socket.connected) connectHandler();
    const timer=window.setInterval(()=>{if(socket.connected) refreshRooms();},8000);
    return ()=>{
      window.clearInterval(timer);
      socket.off("crazy:room-state",stateHandler);
      socket.off("crazy:bomb-question",bombHandler);
      socket.off("crazy:track-question",trackHandler);
      socket.off("crazy:rooms-changed",refreshRooms);
      socket.off("connect",connectHandler);
      socket.disconnect();
    };
  },[socket,session.sessionId,session.reconnectToken]);

  const create=()=>{
    socket.emit("crazy:create-room",{...auth(session),...car},(response:AckResponse)=>{
      if(applyAck(response)&&response.pin){
        setPrivatePin(response.pin);
        sessionStorage.setItem(ROOM_PIN_KEY,response.pin);
      }
    });
  };
  const join=()=>{
    if(!/^\d{3}$/.test(pin)){setError("Digite o PIN de três dígitos da sala.");return;}
    socket.emit("crazy:join-room",{...auth(session),code:code.trim().toUpperCase(),pin,...car},(response:AckResponse)=>{
      if(applyAck(response)){
        sessionStorage.removeItem(ROOM_PIN_KEY);
        setPrivatePin(null);
      }
    });
  };
  const start=()=>{
    if(!room) return;
    socket.emit("crazy:start",{...auth(session),code:room.code},(response:AckResponse)=>applyAck(response));
  };
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!room?.question||!room.race||!answer.trim()||submitting) return;
    const me=room.race.racers.find(r=>r.id===session.sessionId);
    if(!me||secondsLeft(room.question.deadlineAt,now)===0) return;
    const previous=me.correctAnswers;
    setSubmitting(true);
    socket.emit("crazy:answer",{
      ...auth(session),code:room.code,questionId:room.question.id,answer,
      clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      setSubmitting(false);
      if(applyAck(response)){
        const after=response.room?.race?.racers.find(r=>r.id===session.sessionId);
        const correct=(after?.correctAnswers??previous)>previous;
        setFeedback(correct?"correct":"incorrect");
        playSound(correct?"engine":"incorrect");
        setAnswer("");
      }
    });
  };
  const bomb=(direction:BombDirection)=>{
    if(!room) return;
    socket.emit("crazy:bomb",{...auth(session),code:room.code,direction,clientSubmissionId:crypto.randomUUID()},
      (response:AckResponse)=>applyAck(response));
  };
  const answerBomb=(event:FormEvent)=>{
    event.preventDefault();
    if(!room||!bombQuestion) return;
    socket.emit("crazy:bomb-answer",{
      ...auth(session),code:room.code,questionId:bombQuestion.id,answer:bombAnswer,
      clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      if(applyAck(response)){
        setBombCorrection(response.bombCorrection??null);
        setBombQuestion(null);
        setBombAnswer("");
      }
    });
  };
  const answerTrack=(event:FormEvent)=>{
    event.preventDefault();
    if(!room||!trackQuestion) return;
    socket.emit("crazy:track-answer",{
      ...auth(session),code:room.code,questionId:trackQuestion.id,answer:trackAnswer,
      clientSubmissionId:crypto.randomUUID()
    },(response:AckResponse)=>{
      if(applyAck(response)){
        if(response.trackCorrect!==null){
          const success=Boolean(response.trackCorrect);
          setTrackMessage(success?"Bomba desarmada! Continue acertando contas.":"BOOM! Você perdeu 10 segundos. Resposta correta: "+(response.trackCorrection??"—"));
          playSound(success?"engine":"incorrect");
        }
        setTrackQuestion(null);
        setTrackAnswer("");
      }
    });
  };
  const leave=()=>{
    if(room) socket.emit("crazy:leave",{...auth(session),code:room.code},()=>{});
    sessionStorage.removeItem(ROOM_KEY);
    sessionStorage.removeItem(ROOM_PIN_KEY);
    socket.disconnect();
    onExit();
  };

  if(!room){
    return <main id="main-content" className="crazy-shell">
      <section className="panel crazy-online-menu">
        <img src="/assets/crazy-race/race-emblem.svg" alt="" className="crazy-logo"/>
        <p className="eyebrow">Multiplayer online · até 6 pilotos</p>
        <h1>Salas da Corrida Maluca</h1>
        {mode==="menu"&&<>
          <div className="online-actions">
            <button onClick={()=>setMode("create")}>Criar minha sala</button>
            <button className="button-ghost" onClick={onExit}>Voltar à garagem</button>
          </div>
          <h2>Salas disponíveis</h2>
          <p>Escolha uma sala e digite o PIN de 3 dígitos que o criador compartilhou.</p>
          <div className="crazy-room-list" aria-live="polite">
            {availableRooms.length===0&&<p>Nenhuma sala aberta. Crie uma para convidar outros jogadores.</p>}
            {availableRooms.map(available=><div className="crazy-room-item" key={available.code}>
              <div><strong>{available.hostNickname}</strong><small>Sala {available.code} · {available.occupied}/{available.max} pilotos</small></div>
              <button className="button-secondary" onClick={()=>{setCode(available.code);setPin("");setError("");setMode("join");}}>Entrar</button>
            </div>)}
          </div>
          <button className="button-ghost" onClick={()=>{setCode("");setMode("join");}}>Entrar com código</button>
        </>}
        {mode==="create"&&<div className="stack">
          <p>O sistema criará uma sala e gerará um PIN secreto de três dígitos para você compartilhar.</p>
          <button onClick={create}>Criar sala com PIN</button>
          <button className="button-ghost" onClick={()=>setMode("menu")}>Cancelar</button>
        </div>}
        {mode==="join"&&<form className="stack" onSubmit={event=>{event.preventDefault();join();}}>
          <label>Código da sala<input value={code} required onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6}/></label>
          <label>PIN de 3 dígitos<input type="password" inputMode="numeric" autoComplete="off"
            required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,3))}
            minLength={3} maxLength={3} pattern="[0-9]{3}" placeholder="000"/></label>
          <button type="submit">Entrar na corrida</button>
          <button type="button" className="button-ghost" onClick={()=>setMode("menu")}>Cancelar</button>
        </form>}
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
    </main>;
  }

  if(room.status==="waiting"){
    const isHost=room.hostSessionId===session.sessionId;
    return <main id="main-content" className="crazy-shell">
      <section className="panel crazy-room-lobby">
        <p className="eyebrow">Sala de espera · somente o criador inicia</p>
        <h1>Sala {room.code}</h1>
        <p>Compartilhe o código da sala e o PIN com os convidados. Novos jogadores substituem NPCs, até completar seis carros.</p>
        {isHost&&<div className="room-private-pin">
          <span>PIN privado de 3 dígitos</span><strong>{privatePin??"Veja o PIN salvo ao criar a sala"}</strong>
          {privatePin&&<button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(privatePin)}>Copiar PIN</button>}
        </div>}
        <p><strong>Vagas:</strong> {room.capacity.occupied}/{room.capacity.max} · {room.capacity.available} disponível(is)</p>
        <button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(room.code)}>Copiar código da sala</button>
        <div className="room-members">
          {room.members.map(member=><div key={member.sessionId}>
            <span className={member.connected?"online-dot":"online-dot offline"}/>
            <strong>{member.nickname} {member.sessionId===room.hostSessionId?"(Criador)":""}</strong>
            <small>{member.connected?"Conectado":"Desconectado"} · {CAR_LABELS[(member.carModel??"esportivo") as CarModel]}</small>
          </div>)}
        </div>
        {isHost?<button disabled={room.lifecycleState!=="ready"} onClick={start}>Iniciar partida ({room.capacity.occupied} jogador(es))</button>
          :<p>Aguardando o criador iniciar a partida...</p>}
        <button className="button-ghost" onClick={leave}>Sair da sala</button>
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
    </main>;
  }

  if(!room.race) return <main id="main-content" className="crazy-shell"><p>Sincronizando corrida...</p></main>;

  if(room.status==="finished"||room.race.phase==="finished"){
    return <main id="main-content" className="crazy-shell">
      <RaceFinish racers={room.race.racers} winnerId={room.race.winnerId} humanId={session.sessionId} onAgain={leave}/>
    </main>;
  }

  const human=room.race.racers.find(r=>r.id===session.sessionId);
  const receivedBomb=room.race.bombTargets.includes(session.sessionId);
  const pendingTrack=human?.pendingTrackBomb??null;
  const deadline=room.race.matchDeadlineAt==null?null:room.race.matchDeadlineAt-(human?.timePenaltyMs??0);
  const active=room.status==="playing"&&deadline!=null&&now<deadline;
  return <main id="main-content" className="crazy-page">
    <header className="crazy-header">
      <div><p className="eyebrow">Sala {room.code} · multiplayer</p><h1>Corrida Maluca</h1></div>
      <div className="connection-pill">{socket.connected?"Conectado":"Reconectando"}</div>
    </header>
    <RaceHud racers={room.race.racers} humanId={session.sessionId} deadline={deadline} now={now}/>
    <Track racers={room.race.racers} finishLine={room.race.finishLine} humanId={session.sessionId}/>

    <div className="crazy-lower">
      <section className="race-question-card">
        <span className="eyebrow">05:00 de corrida · {formatClock(secondsLeft(deadline,now))} restantes · contas contínuas</span>
        <h2>{room.question?.expression ?? "Processando rodada..."}</h2>
        {room.question&&active&&pendingTrack===null&&<form onSubmit={submit}>
          <input aria-label="Resposta da conta" inputMode="decimal" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={submitting} placeholder="Digite sua resposta" autoFocus/>
          <button disabled={submitting||!answer.trim()}>{submitting?"Registrando...":"Responder"}</button>
        </form>}
        {!active&&<p className="race-waiting">Seu tempo terminou. Aguardando o encerramento dos cinco minutos para revelar o vencedor.</p>}
        {feedback&&<ResultFeedback status={feedback}/>}


        {pendingTrack!==null&&active&&<p className="bomb-warning">Bomba surpresa! Responda para voltar a acelerar.</p>}
        {trackMessage&&<p className="race-waiting" role="status">{trackMessage}</p>}
        {bombCorrection&&<p className="math-correction">Bomba matemática — resposta correta: <strong>{bombCorrection}</strong></p>}
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
      <BombControls race={room.race} humanId={session.sessionId} onBomb={bomb} disabled={!active||!room.question||receivedBomb||pendingTrack!==null}/>
    </div>

    {active&&pendingTrack!==null&&trackQuestion&&<div className="bomb-overlay" role="dialog" aria-modal="true" aria-label="Bomba de percurso">
      <section className="bomb-dialog track-bomb-dialog">
        <img src="/assets/crazy-race/math-bomb.svg" alt="Bomba de percurso"/>
        <p className="eyebrow">Bomba surpresa {TIMED_BOMBS.indexOf(trackQuestion.checkpoint as typeof TIMED_BOMBS[number])+1} de 3</p>
        <h2>{trackQuestion.expression}</h2>
        <p>Acertou: continua a corrida. Errou: perde 10 segundos do seu relógio.</p>
        <form onSubmit={answerTrack}>
          <input autoFocus aria-label="Resposta da bomba de percurso" inputMode="decimal" value={trackAnswer}
            onChange={e=>setTrackAnswer(e.target.value)} required placeholder="Sua resposta"/>
          <button>Desarmar bomba</button>
        </form>
      </section>
    </div>}

    {active&&bombQuestion&&pendingTrack===null&&<div className="bomb-overlay" role="dialog" aria-modal="true">
      <section className="bomb-dialog">
        <img src="/assets/crazy-race/math-bomb.svg" alt="" />
        <p className="eyebrow">Bomba matemática recebida de um adversário</p>
        <h2>{bombQuestion.expression}</h2>
        <p>{secondsLeft(bombQuestion.deadlineAt,now)} segundos para neutralizar.</p>
        <form onSubmit={answerBomb}>
          <input autoFocus inputMode="decimal" value={bombAnswer} onChange={e=>setBombAnswer(e.target.value)} placeholder="Resposta"/>
          <button>Neutralizar bomba</button>
        </form>
      </section>
    </div>}

    <details className="crazy-log"><summary>Últimos acontecimentos</summary><ol>{room.race.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></details>
    <button className="button-ghost" onClick={()=>window.confirm("Sair da sala e abandonar a corrida?")&&leave()}>Sair da corrida</button>
  </main>;
}

export function CrazyRace({session}:{session:ClientSession}) {
  const [mode,setMode]=useState<"setup"|"solo"|"online">("setup");
  const [car,setCar]=useState<CarSelection>({carModel:"esportivo",carColor:"#3378dc"});

  if(mode==="solo") return <SoloRace session={session} car={car} onExit={()=>setMode("setup")}/>;
  if(mode==="online") return <OnlineRace session={session} car={car} onExit={()=>setMode("setup")}/>;

  return <main id="main-content" className="crazy-shell">
    <section className="panel crazy-setup">
      <img src="/assets/crazy-race/race-emblem.svg" alt="" className="crazy-logo"/>
      <p className="eyebrow">Arcade matemático</p>
      <h1>Corrida Maluca</h1>
      <p>Você tem 05:00 para acertar o maior número de contas. Uma nova conta aparece imediatamente após cada resposta. Desarme as 3 bombas surpresa!</p>
      <CarPicker choice={car} onChange={setCar}/>
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
          <li>Todos começam com cinco minutos (05:00) no relógio.</li>
          <li>Acertou ou errou: outra conta aparece imediatamente. Cada acerto gera avanço.</li>
          <li>Três bombas-surpresa aparecem aos 01:15, 02:30 e 03:45.</li>
          <li>Acertar a bomba permite continuar; errar desconta 10 segundos do seu tempo sem apagar os acertos.</li>
          <li>Bombas de ataque também podem ser lançadas contra o carro à frente ou atrás.</li>
          <li>No multiplayer, o criador recebe um PIN de 3 dígitos e controla o início da partida.</li>
          <li>Vence quem acertar mais contas dentro do tempo disponível. Empates seguem critérios de erros e velocidade.</li>
        </ul>
      </HelpRules>
      <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
    </section>
  </main>;
}
