import { useEffect, useState, type FormEvent } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { GAME_CATALOG, type GameId } from "@jogos/game-core";
import { ConnectionStatus, GameCard, HelpRules } from "@jogos/ui";
import {
  claimSession, heartbeatSession, loadSession, notifyDisconnect,
  reconnectSession, type ClientSession
} from "./session";

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
    try {
      const s=await claimSession(nickname,grade);
      onSession(s);
      nav("/lobby");
    } catch(err) {
      setError(err instanceof Error?err.message:"Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="center">
    <section className="panel hero">
      <p className="eyebrow">Aprender jogando</p>
      <h1>Jogos Matemáticos</h1>
      <p>Entre sem cadastro. Escolha um nome e o nível das contas.</p>
      <form onSubmit={submit} className="stack">
        <label>Nome de jogador
          <input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={20} autoComplete="off"/>
        </label>
        <label>Nível
          <select value={grade} onChange={e=>setGrade(e.target.value==="mixed"?"mixed":Number(e.target.value) as 5|6|7)}>
            <option value={5}>5º ano</option>
            <option value={6}>6º ano</option>
            <option value={7}>7º ano</option>
            <option value="mixed">Misto</option>
          </select>
        </label>
        {error&&<p className="error" role="alert">{error}</p>}
        <button disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
      </form>
    </section>
  </main>;
}

function Lobby({session}:{session:ClientSession}) {
  return <main className="page">
    <header className="topbar">
      <div>
        <span className="eyebrow">Lobby</span>
        <h1>Escolha um jogo</h1>
      </div>
      <div>
        <strong>{session.nickname}</strong><br/>
        <ConnectionStatus state={session.connectionState}/>
      </div>
    </header>

    <section className="game-grid">
      {GAME_CATALOG.map(game=>
        <GameCard
          key={game.id}
          name={game.name}
          description={game.description}
          href={`/game/${game.id}`}
          artLabel={game.name.slice(0,1)}
        />
      )}
    </section>

    <HelpRules>
      <p>As contas são adaptadas ao nível escolhido. Cada jogo explicará suas regras antes da partida.</p>
    </HelpRules>
  </main>;
}

function GamePlaceholder({id}:{id:GameId}) {
  const game=GAME_CATALOG.find(g=>g.id===id)!;
  return <main className="center">
    <section className="panel">
      <p className="eyebrow">Próximas etapas</p>
      <h1>{game.name}</h1>
      <p>A fundação está pronta. As regras específicas deste jogo serão implementadas no prompt correspondente.</p>
      <a className="button" href="/lobby">Voltar ao lobby</a>
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

    const timer=window.setInterval(()=>{
      heartbeatSession(session)
        .then(setSession)
        .catch(()=>setSession(current=>current?{...current,connectionState:"reconnecting"}:null));
    },20_000);

    const pageHide=()=>notifyDisconnect(session);
    window.addEventListener("pagehide",pageHide);

    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("pagehide",pageHide);
    };
  },[session?.sessionId]);

  if(checking) {
    return <main className="center"><p role="status">Reconectando...</p></main>;
  }

  return <Routes>
    <Route path="/" element={<Home onSession={setSession}/>}/>
    <Route path="/lobby" element={session?<Lobby session={session}/>:<Navigate to="/" replace/>}/>
    {GAME_CATALOG.map(g=>
      <Route
        key={g.id}
        path={`/game/${g.id}`}
        element={session?<GamePlaceholder id={g.id}/>:<Navigate to="/" replace/>}
      />
    )}
    <Route path="*" element={<Navigate to={session?"/lobby":"/"} replace/>}/>
  </Routes>;
}
