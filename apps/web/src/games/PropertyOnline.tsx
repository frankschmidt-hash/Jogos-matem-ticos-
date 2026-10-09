import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { activePlayer, getSpace, GROUP_LABELS, netWorth, type GameState, type MatchMode } from "@jogos/property-game";
import { MathQuestionModal, ResultFeedback } from "@jogos/ui";
import { apiBase, type ClientSession } from "../session";
import { playSound } from "../experience";
import { Board, HumanPortfolio, Scoreboard } from "./PropertyGame";

type RoomSummary={code:string;hostName:string;players:number;capacity:number;mode:MatchMode};
type RoomMember={sessionId:string;nickname:string;connected:boolean;presence:string};
type PropertyRoom={
  code:string;
  hostSessionId:string;
  members:RoomMember[];
  status:"waiting"|"playing"|"finished";
  mode:MatchMode;
  shortRounds:number;
  gradeLevel:5|6|7|8|9|"mixed";
  game:GameState|null;
  question:{id:string;expression:string}|null;
  lastResolution:{playerId:string;correct:boolean;correctAnswer:string|null;position:number;at:number}|null;
  lastDie:number|null;
};
type Reply={ok:boolean;room?:PropertyRoom|null;rooms?:RoomSummary[];error?:string};
const ROOM_KEY="property-prisma-online-room";
const auth=(session:ClientSession)=>({sessionId:session.sessionId,reconnectToken:session.reconnectToken});

export function PropertyOnline({session,onExit}:{session:ClientSession;onExit:()=>void}) {
  const socket=useMemo<Socket>(()=>io(apiBase,{transports:["polling","websocket"],autoConnect:true}),[]);
  const [room,setRoom]=useState<PropertyRoom|null>(null);
  const [rooms,setRooms]=useState<RoomSummary[]>([]);
  const [view,setView]=useState<"list"|"create"|"join">("list");
  const [selected,setSelected]=useState("");
  const [pin,setPin]=useState("");
  const [mode,setMode]=useState<MatchMode>("short");
  const [rounds,setRounds]=useState(8);
  const [answer,setAnswer]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [rolling,setRolling]=useState(false);
  const [actionError,setActionError]=useState("");
  const questionRef=useRef<string|null>(null);
  const rollTimer=useRef<number|null>(null);
  useEffect(()=>()=>{if(rollTimer.current!==null)window.clearTimeout(rollTimer.current);},[]);

  const apply=(response:Reply)=>{
    setBusy(false);
    if(!response.ok){setError(response.error??"Operação não concluída.");return;}
    if(response.rooms) setRooms(response.rooms);
    if(response.room){
      setRoom(response.room);
      sessionStorage.setItem(ROOM_KEY,response.room.code);
    }
    setError("");
  };
  useEffect(()=>{
    const onRoom=(next:PropertyRoom)=>{
      setRoom(next);
      if(next.question?.id!==questionRef.current) setAnswer("");
      questionRef.current=next.question?.id??null;
    };
    const onRooms=(next:RoomSummary[])=>setRooms(next);
    const connected=()=>{
      socket.emit("property:list-rooms",auth(session),(reply:Reply)=>{if(reply.ok&&reply.rooms)setRooms(reply.rooms);});
      const previous=sessionStorage.getItem(ROOM_KEY);
      if(previous) socket.emit("property:reconnect-room",{...auth(session),code:previous},(reply:Reply)=>{
        if(reply.ok&&reply.room) setRoom(reply.room);
        else sessionStorage.removeItem(ROOM_KEY);
      });
    };
    socket.on("property:room-state",onRoom);
    socket.on("property:rooms",onRooms);
    socket.on("connect",connected);
    if(socket.connected) connected();
    return ()=>{
      socket.off("property:room-state",onRoom);
      socket.off("property:rooms",onRooms);
      socket.off("connect",connected);
      socket.disconnect();
    };
  },[socket,session.sessionId,session.reconnectToken]);

  const send=(event:string,payload:object)=>{
    setBusy(true);setError("");
    socket.emit(event,{...auth(session),...payload},(reply:Reply)=>apply(reply));
  };
  const refresh=()=>socket.emit("property:list-rooms",auth(session),(reply:Reply)=>apply(reply));
  const create=()=>{
    if(!/^\d{3}$/.test(pin)){setError("A senha precisa ter exatamente 3 números.");return;}
    send("property:create-room",{pin,mode,shortRounds:rounds});
  };
  const join=()=>{
    if(!/^\d{3}$/.test(pin)){setError("Digite a senha de 3 números.");return;}
    send("property:join-room",{code:selected,pin});
  };
  const act=(action:"roll"|"answer"|"buy"|"end"|"upgrade"|"sell",extra:object={})=>{
    if(!room||busy) return;
    if(action==="roll"){setRolling(true);playSound("dice");}
    setActionError("");
    socket.emit("property:action",{...auth(session),code:room.code,action,...extra},(reply:Reply)=>{
      if(action==="roll"&&reply.ok){
        if(rollTimer.current!==null)window.clearTimeout(rollTimer.current);
        rollTimer.current=window.setTimeout(()=>{setRolling(false);rollTimer.current=null;},650);
      }else setRolling(false);
      if(!reply.ok){setBusy(false);setActionError(reply.error??"Não foi possível realizar a ação.");return;}
      apply(reply);
      if(action==="answer")setAnswer("");
      if(action==="buy")playSound("purchase");
    });
    setBusy(true);
  };
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!room?.question||!answer.trim())return;
    act("answer",{questionId:room.question.id,answer,submissionId:crypto.randomUUID()});
  };
  const leave=()=>{
    if(room) socket.emit("property:leave",{...auth(session),code:room.code},()=>{});
    sessionStorage.removeItem(ROOM_KEY);
    setRoom(null);setPin("");setSelected("");setView("list");
  };
  const exit=()=>{
    leave();
    onExit();
  };

  if(!room) return <main id="main-content" className="property-shell">
    <section className="panel property-setup property-room-menu">
      <img className="property-logo" src="/assets/property-game/cidade-prisma.svg" alt=""/>
      <p className="eyebrow">Cidade Prisma · Multiplayer</p>
      <h1>Banco Imobiliário Matemático</h1>
      <p>Crie uma sala com senha de 3 números ou entre em uma partida disponível. O criador inicia quando os jogadores estiverem reunidos.</p>
      <div className="property-room-buttons">
        <button onClick={()=>{setView("create");setPin("");}}>Criar sala</button>
        <button className="button-secondary" onClick={()=>setView("list")}>Salas disponíveis</button>
        <button className="button-ghost" onClick={exit}>Jogar contra NPC</button>
      </div>
      {view==="create"&&<div className="property-room-form">
        <h2>Criar uma sala</h2>
        <label>Senha de 3 dígitos
          <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,3))} inputMode="numeric" pattern="[0-9]{3}" maxLength={3} autoComplete="off" placeholder="Ex.: 482"/>
        </label>
        <label>Tipo de partida
          <select value={mode} onChange={e=>setMode(e.target.value as MatchMode)}>
            <option value="short">Partida escolar curta</option><option value="full">Partida completa</option>
          </select>
        </label>
        {mode==="short"&&<label>Rodadas
          <select value={rounds} onChange={e=>setRounds(Number(e.target.value))}>
            <option value={8}>8</option><option value={12}>12</option><option value={16}>16</option>
          </select>
        </label>}
        <button disabled={busy||pin.length!==3} onClick={create}>Criar sala protegida</button>
      </div>}
      {(view==="list"||view==="join")&&<section className="property-public-rooms">
        <div className="section-title"><h2>Salas aguardando jogadores</h2><button className="button-ghost" onClick={refresh}>Atualizar</button></div>
        {rooms.length===0?<p>Nenhuma sala disponível. Você pode criar a primeira.</p>:rooms.map(item=><div className="property-room-row" key={item.code}>
          <div><strong>Sala de {item.hostName}</strong><small>{item.players}/{item.capacity} jogadores · {item.mode==="short"?"Curta":"Completa"}</small></div>
          <button disabled={item.players>=item.capacity} onClick={()=>{setSelected(item.code);setPin("");setView("join");}}>Entrar</button>
        </div>)}
        {view==="join"&&<div className="property-room-form">
          <h3>Entrar na sala de {rooms.find(r=>r.code===selected)?.hostName??"jogador"}</h3>
          <label>Senha de 3 números
            <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,3))} inputMode="numeric" maxLength={3} pattern="[0-9]{3}" autoComplete="off" autoFocus/>
          </label>
          <button disabled={busy||pin.length!==3} onClick={join}>Confirmar entrada</button>
        </div>}
      </section>}
      {error&&<p className="error" role="alert">{error}</p>}
    </section>
  </main>;

  const host=room.hostSessionId===session.sessionId;
  if(room.status==="waiting")return <main id="main-content" className="property-shell">
    <section className="panel property-setup property-waiting">
      <img className="property-logo" src="/assets/property-game/cidade-prisma.svg" alt=""/>
      <p className="eyebrow">Sala de Banco Imobiliário · Espera</p>
      <h1>Sala de {room.members.find(m=>m.sessionId===room.hostSessionId)?.nickname??"jogador"}</h1>
      <p>Compartilhe a senha de 3 dígitos escolhida com seus colegas. Ela não aparece na lista pública de salas.</p>
      {host&&pin&&<div className="property-host-pin">
        <span>Senha da sua sala</span><strong>{pin}</strong>
        <button className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(pin)}>Copiar senha</button>
        <small>Guarde a senha: ela não pode ser recuperada após fechar esta página.</small>
      </div>}
      <p><strong>{room.members.length}/4 jogadores</strong> · {room.mode==="short"?"Partida curta":"Partida completa"}</p>
      <div className="property-room-members">
        {room.members.map(member=><div key={member.sessionId}>
          <strong>{member.nickname}</strong>
          <span>{member.sessionId===room.hostSessionId?"Criador":member.connected?"Pronto":"Reconectando"}</span>
        </div>)}
      </div>
      {host?<button disabled={room.members.length<2||room.members.some(m=>!m.connected)||busy}
        onClick={()=>send("property:start",{code:room.code})}>Iniciar partida</button>:
        <p>Aguardando o criador da sala iniciar a partida...</p>}
      <button className="button-ghost" onClick={leave}>Sair da sala</button>
      {error&&<p className="error" role="alert">{error}</p>}
    </section>
  </main>;

  if(!room.game) return <main className="property-shell"><p>Sincronizando a partida...</p></main>;
  const game=room.game;
  const current=activePlayer(game);
  const me=game.players.find(p=>p.id===session.sessionId);
  const myTurn=current.id===session.sessionId;
  const winner=game.players.find(p=>p.id===game.winnerId);
  const pending=game.pendingPropertyIndex!==null?getSpace(game.pendingPropertyIndex):null;
  const resolution=room.lastResolution;

  if(room.status==="finished"||game.phase==="finished")return <main className="property-shell">
    <section className="panel property-finish">
      <img className="property-trophy" src="/assets/property-game/trofeu-prisma.svg" alt=""/>
      <h1>{winner?winner.name+" venceu!":"Partida encerrada"}</h1>
      <div className="final-ranking">{[...game.players].sort((a,b)=>netWorth(game,b.id)-netWorth(game,a.id))
        .map((p,i)=><div key={p.id}><strong>{i+1}º {p.name}</strong><span>{netWorth(game,p.id)} CP</span></div>)}</div>
      <button onClick={leave}>Voltar às salas</button>
      <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
    </section>
  </main>;

  return <main id="main-content" className="property-page">
    <header className="property-header">
      <div><p className="eyebrow">Sala online · {socket.connected?"Conectado":"Reconectando"}</p>
        <h1>Cidade Prisma</h1>
        <span>Rodada {game.round}{game.maxRounds?" de "+game.maxRounds:""} · vez de <strong>{current.name}</strong></span>
      </div>
      <button className="button-ghost" onClick={()=>{if(window.confirm("Abandonar a partida online?"))leave();}}>Sair da sala</button>
    </header>
    <div className="property-layout">
      <Scoreboard game={game} myId={session.sessionId}/>
      <Board game={game} lastDie={room.lastDie} rolling={rolling}/>
      <aside className="property-actions">
        <h2>Ação atual</h2>
        {!myTurn?<p>É a vez de {current.name}. Aguarde sua jogada.</p>:game.phase==="awaiting-roll"?<>
          <p>Lance o dado e responda à conta para avançar.</p>
          <button disabled={busy} onClick={()=>act("roll")}>{rolling?"Lançando...":"Lançar dado"}</button>
        </>:game.phase==="awaiting-answer"?<p>Resolva a conta apresentada para movimentar seu peão.</p>:
        game.phase==="awaiting-purchase"&&pending?.type==="property"?<div className="purchase-card">
          <span className="eyebrow">{GROUP_LABELS[pending.group]}</span>
          <h3>{pending.name}</h3><p>Preço: {pending.price} CP</p>
          <button disabled={busy||!me||me.balance<pending.price} onClick={()=>act("buy",{buy:true})}>Comprar</button>
          <button className="button-ghost" disabled={busy} onClick={()=>act("buy",{buy:false})}>Recusar</button>
        </div>:game.phase==="turn-end"?<button disabled={busy} onClick={()=>act("end")}>Encerrar turno</button>:null}
        {resolution?.playerId===session.sessionId&&game.phase==="turn-end"&&<>
          <ResultFeedback status={resolution.correct?"correct":"incorrect"}/>
          {resolution.correctAnswer&&<p>Resposta correta: <strong>{resolution.correctAnswer}</strong></p>}
        </>}
        <div className="turn-hint"><img src="/assets/property-game/credito-prisma.svg" alt=""/><span>Seu saldo</span>
          <strong>{me?.balance??0} CP</strong></div>
        {actionError&&<p className="error" role="alert">{actionError}</p>}
      </aside>
    </div>
    <div className="property-lower">
      {me&&<HumanPortfolio game={game} myId={me.id} onUpgrade={index=>act("upgrade",{spaceIndex:index})}
        onSell={index=>act("sell",{spaceIndex:index})} error={actionError}/>}
      <section className="property-log"><h2>Últimas ações</h2><ol>{game.log.map(item=><li key={item.id}>{item.message}</li>)}</ol></section>
    </div>
    <MathQuestionModal open={Boolean(myTurn&&!rolling&&game.phase==="awaiting-answer"&&room.question)}
      expression={room.question?.expression??""}>
      <form className="math-answer-form" onSubmit={submit}>
        <label htmlFor="property-online-answer">Sua resposta</label>
        <input id="property-online-answer" autoFocus inputMode="decimal" value={answer}
          onChange={e=>setAnswer(e.target.value)} placeholder="Digite a resposta"/>
        <button disabled={busy||!answer.trim()}>Confirmar resposta</button>
      </form>
    </MathQuestionModal>
  </main>;
}
