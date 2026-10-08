import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BOARD, GROUP_LABELS, activePlayer, buyPendingProperty, createGame, currentRent, endTurn,
  getSpace, netWorth, npcAnswerCorrect, npcImproveBest, npcShouldBuy, resolveMathMove,
  rollDice, sellProperty, upgradeProperty, type GameState, type MatchMode
} from "@jogos/property-game";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import { HelpRules, MathQuestionModal, ResultFeedback } from "@jogos/ui";
import type { ClientSession } from "../session";
import { playSound } from "../experience";
import { PropertyOnline } from "./PropertyOnline";

const playerTone=["human","npc-a","npc-b","npc-c"] as const;

const randomDie=():number=>{
  const buffer=new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0]!%6)+1;
};

const boardCoordinate=(index:number):{row:number;col:number}=>{
  if(index<=9) return {row:10,col:index+1};
  if(index<=18) return {row:10-(index-9),col:10};
  if(index<=27) return {row:1,col:10-(index-18)};
  return {row:index-26,col:1};
};

function GameSetup({session,onStart,onOnline}:{session:ClientSession;onStart:(game:GameState)=>void;onOnline:()=>void}) {
  const [totalPlayers,setTotalPlayers]=useState<2|3|4>(2);
  const [mode,setMode]=useState<MatchMode>("short");
  const [rounds,setRounds]=useState(8);

  return <main id="main-content" className="property-shell">
    <section className="property-setup panel">
      <img src="/assets/property-game/cidade-prisma.svg" alt="" className="property-logo"/>
      <p className="eyebrow">Jogo de propriedades e estratégia</p>
      <h1>Banco Imobiliário Matemático</h1>
      <p>
        Jogue com identidade própria na Cidade Prisma: resolva a conta antes de se mover,
        compre bairros, receba aluguéis e administre seus Créditos Prisma.
      </p>

      <div className="setup-grid">
        <label>Participantes
          <select value={totalPlayers} onChange={e=>setTotalPlayers(Number(e.target.value) as 2|3|4)}>
            <option value={2}>2 — você + 1 NPC</option>
            <option value={3}>3 — você + 2 NPCs</option>
            <option value={4}>4 — você + 3 NPCs</option>
          </select>
        </label>

        <label>Modo
          <select value={mode} onChange={e=>setMode(e.target.value as MatchMode)}>
            <option value="short">Partida escolar curta</option>
            <option value="full">Partida completa</option>
          </select>
        </label>

        {mode==="short"&&<label>Rodadas
          <select value={rounds} onChange={e=>setRounds(Number(e.target.value))}>
            <option value={8}>8 rodadas</option>
            <option value={12}>12 rodadas</option>
            <option value={16}>16 rodadas</option>
          </select>
        </label>}
      </div>

      <button onClick={()=>onStart(createGame({
        humanName:session.nickname,totalPlayers,mode,shortRounds:rounds
      }))}>Iniciar partida contra NPC</button>
       <button className="button-secondary property-online-entry" onClick={onOnline}>Criar ou entrar em sala online</button>

      <HelpRules>
        <ul>
          <li>Acertou a conta: avança exatamente o valor do dado.</li>
          <li>Errou: recua o mesmo número de casas.</li>
          <li>Se não houver casas para recuar, volta ao início e paga 200 CP.</li>
          <li>Partida curta: vence o maior patrimônio ao fim das rodadas.</li>
          <li>Partida completa: vence o último jogador solvente.</li>
        </ul>
      </HelpRules>
    </section>
  </main>;
}

export function Pawn({tone,name}:{tone:string;name:string}) {
  return <span className={["prisma-pawn",tone].join(" ")} title={name} aria-label={"Peão de "+name}>
    <span className="pawn-head"/><span className="pawn-body"/><span className="pawn-feet"/>
  </span>;
}
export function Scoreboard({game,myId="human-1"}:{game:GameState;myId?:string}) {
  return <aside className="property-scoreboard">
    <h2>Jogadores</h2>
    {game.players.map((player,index)=><div
      key={player.id}
      className={["score-row",game.activePlayerIndex===index?"active":"",player.bankrupt?"bankrupt":""].filter(Boolean).join(" ")}
    >
      <Pawn tone={playerTone[index]!} name={player.name}/>
      <div>
        <strong>{player.name}</strong>
        <small>{player.kind==="npc"?"NPC":player.id===myId?"Você":"Jogador"} · casa {player.position}</small>
      </div>
      <span>{player.balance} CP</span>
    </div>)}
  </aside>;
}

export function Board({game,lastDie=null,rolling=false}:{game:GameState;lastDie?:number|null;rolling?:boolean}) {
  const [focus,setFocus]=useState<number|null>(null);
  const timeout=useRef<number|null>(null);
  const positions=game.players.map(p=>p.position).join(",");
  const previous=useRef(positions);
  const zoom=(index:number)=>{
    if(timeout.current!==null) window.clearTimeout(timeout.current);
    setFocus(index);
    timeout.current=window.setTimeout(()=>setFocus(null),10000);
  };
  useEffect(()=>{
    const last=previous.current.split(",").map(Number);
    const moved=game.players.findIndex((p,i)=>p.position!==last[i]&&!p.bankrupt);
    previous.current=positions;
    if(moved>=0) zoom(game.players[moved]!.position);
  },[positions]);
  useEffect(()=>()=>{if(timeout.current!==null)window.clearTimeout(timeout.current);},[]);
  const landed=focus!==null?getSpace(focus):null;
  return <div className="property-board-wrap"><div className="property-board" aria-label="Tabuleiro Cidade Prisma">
    {BOARD.map(space=>{
      const {row,col}=boardCoordinate(space.index);
      const property=space.type==="property"?game.properties[space.index]:undefined;
      const ownerIndex=property?.ownerId?game.players.findIndex(p=>p.id===property.ownerId):-1;
      return <div key={space.index}
        className={["board-space","type-"+space.type,space.type==="property"?"group-"+space.group:""].filter(Boolean).join(" ")}
        style={{gridRow:row,gridColumn:col}}
        title={"Toque para ampliar: "+space.name} role="button" tabIndex={0}
        onClick={()=>zoom(space.index)}
        onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();zoom(space.index);}}}
      >
        <span className="space-index">{space.index}</span>
        <strong>{space.name}</strong>
        {space.type==="property"&&<small>{space.price} CP · aluguel {currentRent(game,space.index)} CP</small>}
        {property?.level?<span className="level-chip">N{property.level}</span>:null}
        {ownerIndex>=0?<span className={["owner-mark",playerTone[ownerIndex]].join(" ")} aria-label={"Propriedade de "+game.players[ownerIndex]!.name}/>:null}
        <div className="token-stack">
          {game.players.map((player,index)=>player.position===space.index&&!player.bankrupt?
            <div className="pawn-position" key={player.id}>
              <Pawn tone={playerTone[index]!} name={player.name}/><span className="pawn-name">{player.name}</span>
            </div>:null)}
        </div>
      </div>;
    })}
    <section className="board-center">
      {landed?<article className="landing-zoom" role="status" aria-live="polite">
        <span className="eyebrow">Casa {landed.index} · {landed.type==="property"?"Propriedade":"Cidade Prisma"}</span>
        <div className={"landing-building type-"+landed.type} aria-hidden="true">
          <span className="building-roof"/><span className="building-front"><i/><i/><i/></span>
        </div>
        <h2>{landed.name}</h2>
        {landed.type==="property"?<>
          <p className="landing-group">{GROUP_LABELS[landed.group]}</p>
          <p>Compra: <strong>{landed.price} CP</strong></p>
          <p>Aluguel: <strong>{currentRent(game,landed.index)} CP</strong></p>
        </>:landed.type==="tax"||landed.type==="penalty"||landed.type==="service"?
          <p>Despesa: <strong>{landed.amount} CP</strong></p>:
          landed.type==="bonus"||landed.type==="transport"?
          <p>Bônus: <strong>{landed.amount} CP</strong></p>:
          <p>Veja as últimas ações para conhecer o efeito desta casa.</p>}
        <button className="button-ghost landing-close" onClick={()=>{setFocus(null);if(timeout.current!==null)window.clearTimeout(timeout.current);}}>Fechar ampliação</button>
        <small>Retorno automático em 10 segundos</small>
      </article>:<>
        <img src="/assets/property-game/cidade-prisma.svg" alt="" className="board-emblem"/>
        <div className={["board-dice",rolling?"rolling":""].join(" ")} role="status" aria-live="polite">
          <img src="/assets/property-game/dado-prisma.svg" alt="" />
          <span>{rolling?"…":lastDie??"?"}</span>
        </div>
        <span className="eyebrow">Cidade Prisma</span>
        <h2>Créditos, estratégia e matemática</h2>
        <p>Resolva a operação para definir seu movimento.</p>
      </>}
    </section>
  </div></div>;
}

export function HumanPortfolio({
  game,myId="human-1",onUpgrade,onSell,error
}:{game:GameState;myId?:string;onUpgrade:(index:number)=>void;onSell:(index:number)=>void;error:string}) {
  const human=game.players.find(p=>p.id===myId)!;
  const owned=Object.values(game.properties).filter(p=>p.ownerId===human.id);
  return <section className="property-portfolio">
    <div className="section-title">
      <h2>Seu patrimônio</h2>
      <span>{netWorth(game,human.id)} CP</span>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    {!owned.length?<p className="muted">Nenhuma propriedade adquirida ainda.</p>:
      <div className="portfolio-list">
        {owned.map(property=>{
          const space=getSpace(property.spaceIndex);
          if(space.type!=="property") return null;
          const canManage=activePlayer(game).id===human.id&&game.phase==="awaiting-roll";
          return <article key={property.spaceIndex} className="portfolio-item">
            <div>
              <strong>{space.name}</strong>
              <small>{GROUP_LABELS[space.group]} · nível {property.level} · aluguel {currentRent(game,space.index)} CP</small>
            </div>
            <div className="portfolio-actions">
              <button className="button-secondary" disabled={!canManage||property.level>=3} onClick={()=>onUpgrade(space.index)}>Melhorar</button>
              <button className="button-ghost" disabled={!canManage} onClick={()=>onSell(space.index)}>Vender</button>
            </div>
          </article>;
        })}
      </div>
    }
  </section>;
}

function SoloPropertyGame({session,onOnline}:{session:ClientSession;onOnline:()=>void}) {
  const [game,setGame]=useState<GameState|null>(null);
  const [question,setQuestion]=useState<MathQuestion|null>(null);
  const [answer,setAnswer]=useState("");
  const [feedback,setFeedback]=useState<"correct"|"incorrect"|null>(null);
  const [correctAnswer,setCorrectAnswer]=useState<string|null>(null);
  const [rolling,setRolling]=useState(false);
  const [lastDie,setLastDie]=useState<number|null>(null);
  const [actionError,setActionError]=useState("");
  const answerLock=useRef(false);
  const rollTimer=useRef<number|null>(null);

  const player=game?activePlayer(game):null;
  const winner=useMemo(()=>game?.winnerId?game.players.find(p=>p.id===game.winnerId)??null:null,[game]);

  useEffect(()=>{
    if(game?.phase==="finished") playSound("victory");
  },[game?.phase]);

  useEffect(()=>()=> {
    if(rollTimer.current!==null) window.clearTimeout(rollTimer.current);
  },[]);

  useEffect(()=>{
    if(!game||!player||player.kind!=="npc"||game.phase==="finished") return;
    const timer=window.setTimeout(()=>{
      setGame(current=>{
        if(!current) return current;
        const npc=activePlayer(current);
        if(npc.kind!=="npc") return current;

        if(current.phase==="awaiting-roll"){
          const improved=npcImproveBest(current);
          if(improved!==current) return improved;
          const die=randomDie();
          setLastDie(die);
          return rollDice(current,die);
        }
        if(current.phase==="awaiting-answer"){
          return resolveMathMove(current,npcAnswerCorrect(npc),Math.random);
        }
        if(current.phase==="awaiting-purchase"){
          return buyPendingProperty(current,npcShouldBuy(current));
        }
        if(current.phase==="turn-end"){
          return endTurn(current);
        }
        return current;
      });
    },650);
    return ()=>window.clearTimeout(timer);
  },[game,player]);

  if(!game) return <GameSetup session={session} onStart={setGame} onOnline={onOnline}/>;

  const human=game.players.find(p=>p.kind==="human")!;

  const rollHuman=()=>{
    if(player?.kind!=="human"||game.phase!=="awaiting-roll"||rolling) return;
    setRolling(true);
    playSound("dice");
    setFeedback(null);
    setCorrectAnswer(null);
    setActionError("");
    if(rollTimer.current!==null) window.clearTimeout(rollTimer.current);
    rollTimer.current=window.setTimeout(()=>{
      const die=randomDie();
      setLastDie(die);
      setGame(current=>current?rollDice(current,die):current);
      answerLock.current=false;
      setQuestion(generateQuestion(session.gradeLevel,{
        difficulty:game.round<4?1:game.round<9?2:3,
        seed:"property-"+game.round+"-"+game.activePlayerIndex+"-"+Date.now()+"-"+die
      }));
      setRolling(false);
      rollTimer.current=null;
    },450);
  };

  const submitAnswer=(event:FormEvent)=>{
    event.preventDefault();
    if(answerLock.current||!question||game.phase!=="awaiting-answer") return;
    answerLock.current=true;
    const correct=validateAnswer(question,answer);
    playSound(correct?"correct":"incorrect");
    setFeedback(correct?"correct":"incorrect");
    setCorrectAnswer(correct?null:question.correctAnswer);
    setGame(current=>current?resolveMathMove(current,correct,Math.random):current);
    setQuestion(null);
    setAnswer("");
  };

  const decidePurchase=(buy:boolean)=>{
    if(buy) playSound("purchase");
    setGame(current=>current?buyPendingProperty(current,buy):current);
  };

  const finishTurn=()=>{
    setFeedback(null);
    setCorrectAnswer(null);
    setGame(current=>current?endTurn(current):current);
  };

  const manage=(kind:"upgrade"|"sell",index:number)=>{
    setActionError("");
    try{
      const next=kind==="upgrade"
        ? upgradeProperty(game,human.id,index)
        : sellProperty(game,human.id,index);
      setGame(next);
    }catch(error){
      setActionError(error instanceof Error?error.message:"Ação indisponível.");
    }
  };

  if(game.phase==="finished"){
    return <main id="main-content" className="property-shell">
      <section className="panel property-finish">
        <img src="/assets/property-game/trofeu-prisma.svg" alt="" className="property-trophy"/>
        <p className="eyebrow">Partida encerrada</p>
        <h1>{winner?winner.name+" venceu!":"Partida encerrada"}</h1>
        <div className="final-ranking">
          {[...game.players].sort((a,b)=>netWorth(game,b.id)-netWorth(game,a.id)).map((p,index)=>
            <div key={p.id}><strong>{index+1}º {p.name}</strong><span>{netWorth(game,p.id)} CP de patrimônio</span></div>
          )}
        </div>
        <button onClick={()=>{setGame(null);setQuestion(null);setFeedback(null);setCorrectAnswer(null);}}>Nova partida</button>
        <a className="button button-ghost" href="/lobby">Voltar ao lobby</a>
      </section>
    </main>;
  }

  const pendingSpace=game.pendingPropertyIndex!==null?getSpace(game.pendingPropertyIndex):null;

  return <main id="main-content" className="property-page">
    <header className="property-header">
      <div>
        <p className="eyebrow">Banco Imobiliário Matemático</p>
        <h1>Cidade Prisma</h1>
        <span>Rodada {game.round}{game.maxRounds?" de "+game.maxRounds:""} · vez de <strong>{player?.name}</strong></span>
      </div>

    </header>

    <div className="property-layout">
      <Scoreboard game={game}/>
      <Board game={game} lastDie={lastDie} rolling={rolling}/>

      <aside className="property-actions">
        <h2>Ação atual</h2>
        {player?.kind==="human"&&game.phase==="awaiting-roll"&&<>
          <p>Lance o dado. A conta aparecerá antes do movimento.</p>
          <button onClick={rollHuman} disabled={rolling}>{rolling?"Lançando...":"Lançar dado"}</button>
        </>}

        {player?.kind==="npc"&&<p className="npc-thinking">{player.name} está jogando...</p>}

        {player?.kind==="human"&&game.phase==="awaiting-purchase"&&pendingSpace?.type==="property"&&
          <div className="purchase-card">
            <span className="eyebrow">{GROUP_LABELS[pendingSpace.group]}</span>
            <h3>{pendingSpace.name}</h3>
            <p>Preço: <strong>{pendingSpace.price} CP</strong></p>
            <p>Aluguel inicial: {pendingSpace.rent} CP</p>
            <button onClick={()=>decidePurchase(true)} disabled={human.balance<pendingSpace.price}>Comprar</button>
            <button className="button-ghost" onClick={()=>decidePurchase(false)}>Recusar</button>
          </div>
        }

        {player?.kind==="human"&&game.phase==="turn-end"&&<>
          {feedback&&<ResultFeedback status={feedback}/>}
          {feedback==="incorrect"&&correctAnswer&&<p className="math-correction">Resposta correta: <strong>{correctAnswer}</strong></p>}
          <button onClick={finishTurn}>Encerrar turno</button>
        </>}

        <div className="turn-hint">
          <img src="/assets/property-game/credito-prisma.svg" alt="" />
          <span>Seu saldo</span>
          <strong>{human.balance} CP</strong>
        </div>

        <a
          className="button button-ghost"
          href="/lobby"
          onClick={event=>{
            if(!window.confirm("Sair da partida atual e voltar ao lobby?")) event.preventDefault();
          }}
        >Sair para o lobby</a>
      </aside>
    </div>

    <div className="property-lower">
      <HumanPortfolio game={game} onUpgrade={index=>manage("upgrade",index)} onSell={index=>manage("sell",index)} error={actionError}/>
      <section className="property-log">
        <h2>Últimas ações</h2>
        <ol>{game.log.map(item=><li key={item.id}>{item.message}</li>)}</ol>
      </section>
    </div>

    <HelpRules>
      <p>
        Para melhorar uma propriedade, você precisa possuir todas as propriedades do mesmo grupo.
        Melhorias aumentam o aluguel. Vendas ao banco retornam 70% do valor investido.
      </p>
    </HelpRules>

    <MathQuestionModal open={!!question} expression={question?.expression??""}>
      <form className="math-answer-form" onSubmit={submitAnswer}>
        <label htmlFor="property-answer">Sua resposta</label>
        <input
          id="property-answer"
          autoFocus
          inputMode="decimal"
          value={answer}
          onChange={e=>setAnswer(e.target.value)}
          placeholder="Digite a resposta"
        />
        <button>Confirmar resposta</button>
      </form>
    </MathQuestionModal>
  </main>;
}

export function PropertyGame({session}:{session:ClientSession}) {
  const [online,setOnline]=useState(false);
  return online
    ?<PropertyOnline session={session} onExit={()=>setOnline(false)}/>
    :<SoloPropertyGame session={session} onOnline={()=>setOnline(true)}/>;
}
