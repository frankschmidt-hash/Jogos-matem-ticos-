import { useEffect, useState, type FormEvent } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { GAME_CATALOG, type GameId } from "@jogos/game-core";
import { GRADE_DESCRIPTIONS } from "@jogos/math-engine";
import { ConnectionStatus, GameCard, HelpRules } from "@jogos/ui";
import {
  claimSession, loadSession, clearSession, ensureActiveSession, isNicknameUnavailable,
  fetchLeaderboards, type Leaderboards, type ClientSession
} from "./session";
import { ExperienceControls } from "./experience";
import { PropertyGame } from "./games/PropertyGame";
import { CrazyRace } from "./games/CrazyRace";
import { NumberRace } from "./games/NumberRace";
import { MathFootball } from "./games/MathFootball";
import { MathFight } from "./games/MathFight";

const GAME_ART:Record<GameId,{src:string;theme:string;label:string}>={
  "property-math":{src:"/assets/game-cards/property-math.webp",theme:"prisma",label:"Cidade Prisma"},
  "crazy-race":{src:"/assets/game-cards/crazy-race.webp",theme:"race",label:"Corrida"},
  "number-race":{src:"/assets/game-cards/number-race.webp",theme:"number",label:"Números"},
  "math-football":{src:"/assets/game-cards/math-football.webp",theme:"football",label:"Futebol"},
  "math-fight":{src:"/assets/game-cards/math-fight.webp",theme:"fight",label:"Luta"}
};

const RANKING_INFO=[
  {id:"property-math",title:"Banco Imobiliário",unit:"CP",hint:"Maior patrimônio"},
  {id:"crazy-race",title:"Corrida Maluca",unit:"acertos",hint:"Mais contas corretas"},
  {id:"number-race",title:"Corrida Numérica",unit:"acertos",hint:"Mais contas corretas"},
  {id:"math-football",title:"Futebol Matemático",unit:"gols",hint:"Maior número de gols"}
] as const;

function HomeRankings(){
  const [boards,setBoards]=useState<Leaderboards|null>(null);
  const [problem,setProblem]=useState(false);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{void fetchLeaderboards().then(data=>{
      if(active){setBoards(data);setProblem(false);}
    }).catch(()=>{if(active)setProblem(true);});};
    refresh();
    const timer=window.setInterval(refresh,30_000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[]);
  return <section className="home-rankings" aria-labelledby="rankings-title">
    <div className="rankings-heading">
      <div><p className="eyebrow">Hall dos campeões</p><h2 id="rankings-title">Top 10 de cada jogo</h2>
        <p className="muted">Melhor resultado por nickname. Os adversários do computador não participam.</p>
      </div>
      <span className="rankings-refresh">Atualização automática</span>
    </div>
    {problem&&<p className="rankings-warning" role="status">Não foi possível atualizar o ranking neste momento.</p>}
    <div className="rankings-grid">
      {RANKING_INFO.map(item=><article key={item.id} className="ranking-card">
        <header><h3>{item.title}</h3><p>{item.hint}</p></header>
        {boards===null?<p className="rankings-empty">Carregando classificação...</p>:
          boards[item.id].length===0?<p className="rankings-empty">Sem resultados ainda. Seja o primeiro!</p>:
          <ol className="ranking-list">{boards[item.id].slice(0,10).map((entry,index)=>
            <li key={entry.nickname}><span className="ranking-place">{index+1}º</span>
              <strong title={entry.nickname}>{entry.nickname}</strong>
              <span className="ranking-points">{entry.score.toLocaleString("pt-BR")} <small>{item.unit}</small></span>
            </li>)}</ol>}
      </article>)}
    </div>
  </section>;
}

function Home({onSession,sessionNotice=""}:{onSession:(s:ClientSession)=>void;sessionNotice?:string}) {
  const nav=useNavigate();
  const [nickname,setNickname]=useState("");
  const [grade,setGrade]=useState<5|6|7|8|9|"mixed">(5);
  const [error,setError]=useState(sessionNotice);
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
    <div className="portal-hero-band">
      <section className="portal-intro" aria-labelledby="portal-title">
      <div className="portal-copy">
        <span className="portal-badge">5º ao 9º ano · sem cadastro</span>
        <p className="eyebrow">Aprender jogando</p>
        <h1 id="portal-title">Matemática em <span className="portal-title-accent">movimento</span></h1>
        <p className="portal-lead">
          Cinco jogos, desafios rápidos e contas do seu nível.
          Jogue, avance e conquiste seu lugar no ranking!
        </p>
        <ul className="portal-points" aria-label="Recursos do portal">
          <li><span aria-hidden="true">✓</span> partidas solo e multiplayer</li>
          <li><span aria-hidden="true">✓</span> feedback imediato</li>
          <li><span aria-hidden="true">✓</span> funciona em celular, tablet e computador</li>
        </ul>
      </div>
      <div className="portal-visual" aria-hidden="true">
        <img className="portal-hero-art" src="/assets/portal/matematica-em-movimento-hero.webp"
          alt="" width={960} height={720} loading="eager" decoding="async"
          onError={event=>{
            if(!event.currentTarget.src.endsWith("/assets/portal/math-portal.svg")){
              event.currentTarget.src="/assets/portal/math-portal.svg";
            }
          }}/>
      </div>
    </section>

    <section className="panel login-panel" aria-labelledby="login-title">
      <p className="eyebrow">Seu passe de entrada</p>
      <h2 id="login-title">Preparar jogador</h2>
      <p className="muted">Use um apelido apropriado para a escola. Não use seu nome completo.</p>
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
          <small id="nickname-help">2 a 20 caracteres. Palavras ofensivas ou obscenas não são permitidas.</small>
        </label>
        <label htmlFor="grade">Nível das contas
          <select id="grade" aria-describedby="grade-help" value={grade} onChange={e=>setGrade(e.target.value==="mixed"?"mixed":Number(e.target.value) as 5|6|7|8|9)}>
            <option value={5}>5º ano</option>
            <option value={6}>6º ano</option>
            <option value={7}>7º ano</option>
            <option value={8}>8º ano</option>
            <option value={9}>9º ano</option>
            <option value="mixed">Misto — 5º ao 9º</option>
          </select>
          <small id="grade-help">{GRADE_DESCRIPTIONS[grade]}</small>
        </label>
        {error&&<p className="error" role="alert"><span aria-hidden="true">!</span> {error}</p>}
        <button className="primary-cta" disabled={loading||nickname.trim().length<2}>
          {loading?<><span className="button-spinner" aria-hidden="true"/> Entrando...</>:"Entrar no portal"}
        </button>
      </form>
    </section>
    </div>
    <HomeRankings/>
  </main>;
}

function Lobby({session}:{session:ClientSession}) {
  return <main className="page lobby-page" id="main-content">
    <header className="topbar lobby-header">
      <div>
        <span className="eyebrow">Portal de jogos</span>
        <h1>Escolha sua próxima missão</h1>
        <p className="muted">Nível atual: <strong>{session.gradeLevel==="mixed"?"Misto":session.gradeLevel+"º ano"}</strong></p>
        <p className="muted">{GRADE_DESCRIPTIONS[session.gradeLevel]}</p>
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
  const [sessionNotice,setSessionNotice]=useState("");

  useEffect(()=>{
    const saved=loadSession();
    if(!saved){
      setChecking(false);
      return;
    }
    let cancelled=false;
    ensureActiveSession(saved)
      .then(active=>{if(!cancelled)setSession(active);})
      .catch(error=>{
        if(cancelled)return;
        if(isNicknameUnavailable(error)){
          clearSession();setSession(null);setSessionNotice("Sua sessão anterior terminou e o nickname está em uso. Escolha outro para continuar.");
        }else setSession({...saved,connectionState:"reconnecting"});
      })
      .finally(()=>{if(!cancelled)setChecking(false);});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!session) return;

    let cancelled=false;
    const refresh=()=>void ensureActiveSession(session)
      .then(active=>{if(!cancelled)setSession(current=>current?.sessionId===session.sessionId?active:current);})
      .catch(error=>{
        if(cancelled)return;
        if(isNicknameUnavailable(error)){
          clearSession();setSession(null);setSessionNotice("Sua sessão anterior terminou e o nickname está em uso. Escolha outro para continuar.");
        }else setSession(current=>current?.sessionId===session.sessionId?{...current,connectionState:"reconnecting"}:current);
      });
    const timer=window.setInterval(refresh,15_000);
    const offline=()=>setSession(current=>current?{...current,connectionState:"disconnected"}:null);
    const visible=()=>{if(document.visibilityState==="visible")refresh();};
    window.addEventListener("offline",offline);
    window.addEventListener("online",refresh);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",visible);
    // No pagehide disconnect: normal navigation/reload must not invalidate another open connection.
    return ()=>{
      cancelled=true;
      window.clearInterval(timer);
      window.removeEventListener("offline",offline);
      window.removeEventListener("online",refresh);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",visible);
    };
  },[session?.sessionId]);

  if(checking) return <><ExperienceControls/><ReconnectScreen/></>;

  return <>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <ExperienceControls/>
    <Routes>
      <Route path="/" element={<Home onSession={active=>{setSessionNotice("");setSession(active);}} sessionNotice={sessionNotice}/>}/>
      <Route path="/lobby" element={session?<Lobby session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/property-math" element={session?<PropertyGame session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/crazy-race" element={session?<CrazyRace session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/number-race" element={session?<NumberRace session={session}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/math-football" element={session?<MathFootball session={session} onSessionChange={setSession}/>:<Navigate to="/" replace/>}/>
      <Route path="/game/math-fight" element={session?<MathFight session={session}/>:<Navigate to="/" replace/>}/>
      {GAME_CATALOG.filter(g=>g.id!=="property-math"&&g.id!=="crazy-race"&&g.id!=="number-race"&&g.id!=="math-football"&&g.id!=="math-fight").map(g=>
        <Route key={g.id} path={"/game/"+g.id} element={session?<GamePlaceholder id={g.id}/>:<Navigate to="/" replace/>}/>
      )}
      <Route path="*" element={<Navigate to={session?"/lobby":"/"} replace/>}/>
    </Routes>
  </>;
}
