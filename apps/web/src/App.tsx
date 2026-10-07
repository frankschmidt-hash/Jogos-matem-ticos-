import { useEffect, useState, type FormEvent } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { GAME_CATALOG, type GameId } from "@jogos/game-core";
import { ConnectionStatus, GameCard, HelpRules } from "@jogos/ui";
import {
  claimSession, heartbeatSession, loadSession, notifyDisconnect,
  reconnectSession, type ClientSession
} from "./session";
import { ExperienceControls } from "./experience";
import { PropertyGame } from "./games/PropertyGame";
import { CrazyRace } from "./games/CrazyRace";
import { NumberRace } from "./games/NumberRace";
import { MathFootball } from "./games/MathFootball";

const GAME_ART:Record<GameId,{src:string;theme:string;label:string}>={
  "property-math":{src:"/assets/property-game/cidade-prisma.svg",theme:"prisma",label:"Cidade Prisma"},
  "crazy-race":{src:"/assets/crazy-race/race-emblem.svg",theme:"race",label:"Corrida"},
  "number-race":{src:"/assets/number-race/number-emblem.svg",theme:"number",label:"Números"},
  "math-football":{src:"/assets/math-football/football-emblem.svg",theme:"football",label:"Futebol"}
};

function Home({onSession}:{onSession:(s:ClientSession)=>void}) {
  const nav=useNavigate();
  const [nickname,setNickname]=useState("");
  const [grade,setGrade]=useState<5|6|7|"mixed">(5);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    setError("");
    setLoading(true);
    try{
      const s=await claimSession(nickname,grade);
      onSession(s);
      nav("/lobby");
    }catch(err){
      setError(err instanceof Error?err.message:"Erro ao entrar.");
    }finally{
      setLoading(false);
    }
  };

  return <main className="portal-home" id="main-content">
    <section className="portal-intro" aria-labelledby="portal-title">
      <div className="portal-copy">
        <span className="portal-badge">5º ao 7º ano · sem cadastro</span>
        <p className="eyebrow">Aprender jogando</p>
        <h1 id="portal-title">Matemática em movimento</h1>
        <p className="portal-lead">
          Quatro jogos, desafios curtos e contas adaptadas ao seu nível.
          Escolha seu nome e entre no portal.
        </p>
        <ul className="portal-points" aria-label="Recursos do portal">
          <li><span aria-hidden="true">✓</span> partidas solo e multiplayer</li>
          <li><span aria-hidden="true">✓</span> feedback imediato</li>
          <li><span aria-hidden="true">✓</span> funciona em celular, tablet e computador</li>
        </ul>
      </div>
      <div className="portal-visual" aria-hidden="true">
        <img src="/assets/portal/math-portal.svg" alt=""/>
      </div>
    </section>

    <section className="panel login-panel" aria-labelledby="login-title">
      <p className="eyebrow">Seu passe de entrada</p>
      <h2 id="login-title">Preparar jogador</h2>
      <p className="muted">O nickname identifica você nas salas. Não use seu nome completo.</p>
      <form onSubmit={submit} className="stack">
        <label htmlFor="nickname">Nome de jogador
          <input
            id="nickname"
            value={nickname}
            onChange={e=>setNickname(e.target.value)}
            minLength={2}
            maxLength={20}
            autoComplete="off"
            placeholder="Ex.: Mestre7"
            aria-describedby="nickname-help"
          />
          <small id="nickname-help">2 a 20 caracteres.</small>
        </label>
        <label htmlFor="grade">Nível das contas
          <select id="grade" value={grade} onChange={e=>setGrade(e.target.value==="mixed"?"mixed":Number(e.target.value) as 5|6|7)}>
            <option value={5}>5º ano</option>
            <option value={6}>6º ano</option>
            <option value={7}>7º ano</option>
            <option value="mixed">Misto — 5º ao 7º</option>
          </select>
        </label>
        {error&&<p className="error" role="alert"><span aria-hidden="true">!</span> {error}</p>}
        <button className="primary-cta" disabled={loading||nickname.trim().length<2}>
          {loading?<><span className="button-spinner" aria-hidden="true"/> Entrando...</>:"Entrar no portal"}
        </button>
      </form>
    </section>
  </main>;
}

function Lobby({session}:{session:ClientSession}) {
  return <main className="page lobby-page" id="main-content">
    <header className="topbar lobby-header">
      <div>
        <span className="eyebrow">Portal de jogos</span>
        <h1>Escolha sua próxima missão</h1>
        <p className="muted">Nível atual: <strong>{session.gradeLevel==="mixed"?"Misto":session.gradeLevel+"º ano"}</strong></p>
      </div>
      <div className="player-summary">
        <span className="avatar-chip" aria-hidden="true">{session.nickname.slice(0,2).toUpperCase()}</span>
        <div><strong>{session.nickname}</strong><ConnectionStatus state={session.connectionState}/></div>
      </div>
    </header>

    <section className="game-grid" aria-label="Jogos disponíveis">
      {GAME_CATALOG.map(game=>{
        const art=GAME_ART[game.id];
        return <GameCard
          key={game.id}
          name={game.name}
          description={game.description}
          href={"/game/"+game.id}
          artLabel={art.label}
          imageSrc={art.src}
          theme={art.theme}
        />;
      })}
    </section>

    <HelpRules>
      <p>
        As contas são adaptadas ao nível escolhido. Cada jogo apresenta regras próprias,
        e informações essenciais aparecem sempre em texto — o áudio é apenas complementar.
      </p>
    </HelpRules>
  </main>;
}

function GamePlaceholder({id}:{id:GameId}) {
  const game=GAME_CATALOG.find(g=>g.id===id)!;
  return <main className="center" id="main-content">
    <section className="panel">
      <p className="eyebrow">Próximas etapas</p>
      <h1>{game.name}</h1>
      <p>A fundação está pronta. As regras específicas deste jogo serão implementadas no prompt correspondente.</p>
      <a className="button" href="/lobby">Voltar ao lobby</a>
    </section>
  </main>;
}

function ReconnectScreen(){
  return <main className="center reconnect-screen" id="main-content">
    <section className="panel status-panel" role="status" aria-live="polite">
      <span className="reconnect-loader" aria-hidden="true"/>
      <p className="eyebrow">Conexão</p>
      <h1>Recuperando sua sessão</h1>
      <p>Seu nickname e a sala serão restaurados quando a conexão responder.</p>
    </section>
  </main>;
}

export function App(){
  const [session,setSession]=useState<ClientSession|null>(()=>loadSession());
  const [checking,setChecking]=useState(!!session);

  useEffect(()=>{
    const saved=loadSession();
    if(!saved){
      setChecking(false);
      return;
    }
    reconnectSession(saved)
      .then(setSession)
      .catch(()=>setSession(null))
      .finally(()=>setChecking(false));
  },[]);

  useEffect(()=>{
    if(!session) return;

    const heartbeat=()=>heartbeatSession(session)
      .then(setSession)
      .catch(()=>setSession(current=>current?{...current,connectionState:"reconnecting"}:null));

    const timer=window.setInterval(heartbeat,20_000);
    const pageHide=()=>notifyDisconnect(session);
    const offline=()=>setSession(current=>current?{...current,connectionState:"disconnected"}:null);
    const online=()=>{
      setSession(current=>current?{...current,connectionState:"reconnecting"}:null);
      void reconnectSession(session).then(setSession).catch(()=>{});
    };

    window.addEventListener("pagehide",pageHide);
    window.addEventListener("offline",offline);
    window.addEventListener("online",online);

    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("pagehide",pageHide);
      window.removeEventListener("offline",offline);
      window.removeEventListener("online",online);
    };
  },[session?.sessionId]);

  if(checking) return <><ExperienceControls/><ReconnectScreen/></>;

  return <>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <ExperienceControls/>
    <Routes>
      <Route path="/" element={<Home onSession={setSession}/>}/>
      <Route path="/lobby" element={session?<Lobby session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/property-math" element={session?<PropertyGame session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/crazy-race" element={session?<CrazyRace session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/number-race" element={session?<NumberRace session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/math-football" element={session?<MathFootball session={session}/>:<Navigate to="/" replace/>}/>
      {GAME_CATALOG.filter(g=>g.id!=="property-math"&&g.id!=="crazy-race"&&g.id!=="number-race"&&g.id!=="math-football").map(g=>
        <Route key={g.id} path={"/game/"+g.id} element={session?<GamePlaceholder id={g.id}/>:<Navigate to="/" replace/>}/>
      )}
      <Route path="*" element={<Navigate to={session?"/lobby":"/"} replace/>}/>
    </Routes>
  </>;
}
