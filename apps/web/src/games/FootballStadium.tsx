import { type CSSProperties, type ReactNode } from "react";
import { PENALTY_TARGETS, type PenaltyKick, type PenaltyMatchState, type PenaltyTarget } from "@jogos/math-football";

const targetNames=[
  "canto superior esquerdo","centro superior","canto superior direito",
  "meio esquerdo","centro","meio direito",
  "canto inferior esquerdo","centro inferior","canto inferior direito"
];

function Athlete({keeper=false,celebrating=false,disappointed=false}:{
  keeper?:boolean;celebrating?:boolean;disappointed?:boolean
}){
  return <svg className={"football-athlete "+(keeper?"keeper-athlete":"striker-athlete")+(celebrating?" celebrating":"")+(disappointed?" disappointed":"")}
    viewBox="0 0 165 260" role="img" aria-label={keeper?"Goleiro preparado para defender":"Jogador de futebol preparado para chutar"}>
    <defs>
      <linearGradient id={keeper?"keeper-kit":"player-kit"} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={keeper?"#5f7592":"#fff04e"}/>
        <stop offset=".55" stopColor={keeper?"#182942":"#ffd31c"}/>
        <stop offset="1" stopColor={keeper?"#111827":"#c78b00"}/>
      </linearGradient>
      <linearGradient id="football-skin" x1="0" y1="0" x2=".95" y2="1">
        <stop stopColor="#f8cc9d"/><stop offset=".65" stopColor="#d38e58"/><stop offset="1" stopColor="#94533c"/>
      </linearGradient>
    </defs>
    <ellipse cx="82" cy="250" rx="53" ry="6" fill="#061b18" opacity=".3"/>
    <g stroke="#152538" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      <path d="M55 150 L47 195 L38 239 L60 243 L77 199 L84 167 Z" fill={keeper?"#202f49":"#244eaa"}/>
      <path d="M84 155 L98 194 L107 238 L126 238 L124 190 L109 147 Z" fill={keeper?"#202f49":"#244eaa"}/>
      <path d="M41 214 L36 235 L31 245 L63 248 L62 225 Z" fill="#f9fafb"/>
      <path d="M103 215 L106 241 L130 241 L122 216 Z" fill="#f9fafb"/>
      <path d="M35 236 Q21 238 19 251 Q36 257 65 251 L62 241Z" fill={keeper?"#dbeafe":"#205de7"}/>
      <path d="M107 237 Q130 235 145 249 L143 254 L107 252Z" fill={keeper?"#dbeafe":"#205de7"}/>
      <path d="M56 76 Q80 65 111 78 L120 151 Q82 171 46 148 Z" fill={"url(#"+(keeper?"keeper-kit":"player-kit")+")"}/>
      <path d="M54 77 Q45 84 42 94 L31 146 Q27 159 17 157 L10 145 L24 86 Q38 73 54 77Z" fill={keeper?"#334960":"#f0c315"}/>
      <path d="M109 79 Q123 75 132 88 L155 142 L144 155 Q131 145 120 132 L109 108Z" fill={keeper?"#334960":"#f0c315"}/>
      <path d="M21 138 L8 136 L5 156 Q14 169 28 151Z" fill={keeper?"#edf6ff":"url(#football-skin)"}/>
      <path d="M144 143 L157 139 L163 157 Q150 170 140 155Z" fill={keeper?"#edf6ff":"url(#football-skin)"}/>
      <path d="M45 145 Q81 160 119 148 L115 177 L52 178Z" fill={keeper?"#172437":"#1946a8"}/>
      <path d="M72 67 L70 83 Q83 96 97 82 L95 64Z" fill="url(#football-skin)"/>
      <ellipse cx="83" cy="45" rx="33" ry="39" fill="url(#football-skin)"/>
      <path d="M49 44 Q46 6 78 5 Q113 0 118 34 L113 44 Q107 29 98 28 Q78 36 62 28Z" fill="#281c1d"/>
      <path d="M49 39 Q40 15 60 12 L63 32 M73 12 Q85 -1 100 18" stroke="#1c1316" strokeWidth="9" fill="none"/>
    </g>
    {disappointed&&!keeper&&<g stroke="#152538" strokeLinecap="round" strokeWidth="10" fill="none"><path d="M17 143 Q16 95 56 31" stroke="#d59a62"/><circle cx="56" cy="31" r="7" fill="#d59a62" stroke="none"/></g>}
    {celebrating&&!keeper&&<g stroke="#e8ad70" strokeWidth="12" fill="none" strokeLinecap="round"><path d="M148 146 L139 73 L148 20"/></g>}
    {keeper?<g fill="#f5faff"><circle cx="72" cy="47" r="3"/><circle cx="97" cy="47" r="3"/><path d="M75 62 Q83 66 92 62" stroke="#713d38" strokeWidth="2" fill="none"/><text x="80" y="128" textAnchor="middle" fontSize="29" fontWeight="900" fill="white">1</text></g>
    :<g><path d="M50 90 L46 149" stroke="#159854" strokeWidth="6"/><path d="M116 89 L120 148" stroke="#159854" strokeWidth="6"/><text x="83" y="134" textAnchor="middle" fontWeight="900" fontSize="40" fill="#159854">10</text></g>}
  </svg>;
}

function Spectators(){
  const fans=Array.from({length:72},(_,i)=>i);
  return <div className="football-stands" aria-hidden="true">
    <div className="football-stand-tier tier-top">
      {fans.map(i=><i key={i} className={"football-fan "+(i%7===0?"waving":"")} style={{"--shirt": ["#fbd04f","#fae8ac","#15985e","#58a8e6","#f97359"][i%5],"--fan-delay":String((i%11)*-.13)+"s"} as CSSProperties}/>)}
    </div>
    <div className="football-stadium-banner football-banner-left">FUTEBOL MATEMÁTICO</div>
    <div className="football-stadium-banner football-banner-right">APRENDER É UMA GRANDE JOGADA!</div>
    <div className="football-stand-tier tier-bottom">
      {fans.slice(0,55).map(i=><i key={i} className={"football-fan "+(i%4===0?"waving":"")} style={{"--shirt": ["#fde047","#15803d","#93c5fd","#f9b870"][i%4],"--fan-delay":String((i%7)*-.15)+"s"} as CSSProperties}/>)}
    </div>
    <div className="football-adboard">FUTEBOL <strong>MATEMÁTICO</strong> <span>•</span> MATEMÁTICA EM CAMPO <span>•</span> FUTEBOL <strong>MATEMÁTICO</strong></div>
  </div>;
}

function targetVariables(target:PenaltyTarget,keeperTarget:PenaltyTarget):CSSProperties{
  const col=target%3,row=Math.floor(target/3);
  const keeperCol=keeperTarget%3,keeperRow=Math.floor(keeperTarget/3);
  return {
    "--shot-x":(22+(col+.5)*(53/3))+"%",
    "--shot-y-desktop":(37+(row+.5)*(29/3))+"%",
    "--shot-y-mobile":(28+(row+.5)*(21/3))+"%",
    "--keeper-x":(22+(keeperCol+.5)*(53/3))+"%",
    "--keeper-y-desktop":(37+(keeperRow+.5)*(29/3))+"%",
    "--keeper-y-mobile":(28+(keeperRow+.5)*(21/3))+"%",
    "--keeper-turn":keeperCol===0?"-65deg":keeperCol===2?"65deg":"0deg"
  } as CSSProperties;
}

export function FootballStadium({
  match,selectedTarget,onSelectTarget,canAim,children
}:{
  match:PenaltyMatchState;selectedTarget:PenaltyTarget;onSelectTarget:(target:PenaltyTarget)=>void;
  canAim:boolean;children:ReactNode
}){
  const kick:PenaltyKick|null=match.lastKick;
  const resolution=Boolean(kick && (match.phase==="kick-resolution"||match.phase==="finished"));
  const target=kick?.target??selectedTarget;
  const keeperTarget=kick?.keeperTarget??4;
  const style=targetVariables(target,keeperTarget);
  return <section className={"football-stadium football-stadium-v2"+(resolution?(kick?.goal?" is-goal":" is-save"):"")} style={style}
    key={"football-scene-"+match.history.length} aria-label="Estádio de futebol e cobrança de pênalti">
    <div className="football-sky"><div className="football-floodlight left"/><div className="football-floodlight right"/></div>
    <Spectators/>
    <div className="football-pitch">
      <div className="football-pitch-stripes"/><div className="football-field-arc"/>
      <div className="football-penalty-mark"/>
    </div>
    <div className="football-goal-v2" aria-label="Gol dividido em nove setores">
      <div className="football-goal-depth"/>
      <div className="football-net-v2"/>
      <div className="football-target-grid">
        {PENALTY_TARGETS.map(n=><button type="button" key={n} disabled={!canAim||resolution}
          onClick={()=>onSelectTarget(n)}
          aria-label={"Mirar no "+targetNames[n]}
          aria-pressed={canAim&&n===selectedTarget}
          className={"football-target"+(n===selectedTarget&&canAim?" selected":"")}>
          <span aria-hidden="true">⊕</span>
        </button>)}
      </div>
    </div>
    <div className="football-goalkeeper-v2"><Athlete keeper/></div>
    <div className="football-player-v2"><Athlete celebrating={Boolean(resolution&&kick?.goal)} disappointed={Boolean(resolution&&!kick?.goal)}/></div>
    <div className="football-ball-v2" aria-label="Bola de futebol"><span/></div>
    <div className="football-impact"/>
    {resolution&&<div className={"football-event-overlay "+(kick?.goal?"football-goal-celebration":"football-save-celebration")}>
      <strong>{kick?.goal?"GOOOOL!":"DEFENDEU!"}</strong>
      <span>{kick?.goal?"Torcida aplaudindo!":"A torcida vaia a cobrança."}</span>
    </div>}
    {resolution&&kick?.goal&&<div className="football-confetti" aria-hidden="true">
      {Array.from({length:24},(_,i)=><i key={i} style={{"--p":(i*37%100)+"%","--delay":(i%7)*-.16+"s","--color":["#ffe94d","#26e58c","#58b5ff"][i%3]} as CSSProperties}/>)}
    </div>}
    <div className="football-action-overlay">{children}</div>
    <div className="football-target-caption">
      {canAim&&!resolution?"Toque no gol para escolher onde chutar":"Cobrança de pênalti"}
    </div>
  </section>;
}
