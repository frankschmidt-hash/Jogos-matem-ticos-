type FightHudProps={
  playerName:string;
  playerHp:number;
  cpuHp:number;
  remaining:number;
  duration:number;
  turn:"attack"|"defend";
  active:boolean;
  resolving:boolean;
  impact?:{defender:"player"|"cpu";blocked:boolean}|null;
};
function HealthBar({value,flipped=false,label}:{value:number;flipped?:boolean;label:string}){
  const safe=Math.min(100,Math.max(0,value));
  return <div className={`fight-hud-healthbar ${safe<=30?"fight-hud-healthbar--critical":""} ${flipped?"fight-hud-healthbar--flipped":""}`}>
    <div className="fight-hud-healthbar-track" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}>
      <div className="fight-hud-healthbar-fill" style={{width:`${safe}%`}}/>
    </div>
  </div>;
}
export function FightHud({playerName,playerHp,cpuHp,remaining,duration,turn,active,resolving,impact}:FightHudProps){
  const showClock=active&&!resolving;
  const closeToTimeout=showClock&&remaining<=Math.ceil(duration*.2);
  return <div className="fight-hud" aria-label="Painel de combate">
    <div className={`fight-hud-fighter fight-hud-fighter--player ${impact?.defender==="player"?(impact.blocked?"fight-hud-fighter--blocked":"fight-hud-fighter--damaged"):""}`}>
      <div className="fight-hud-name"><span className="fight-hud-side">JOGADOR 1</span><strong>{playerName||"Lutador"}</strong></div>
      <HealthBar value={playerHp} label={`Vida de ${playerName||"seu lutador"}`}/>
      <span className="fight-hud-hp">{playerHp} <small>/ 100 HP</small></span>
    </div>
    <div className="fight-hud-center">
      <span className="fight-hud-versus" aria-hidden="true">VS</span>
      <div className={`fight-hud-clock ${closeToTimeout?"fight-hud-clock--urgent":""}`}
        aria-label={active?`Tempo restante: ${remaining} segundos`:"Combate encerrado"}>
        {active?(resolving?"—":remaining):"FIM"}
      </div>
      <span className="fight-hud-state">{!active?"RESULTADO":resolving?"COMBATE":turn==="attack"?"ATACAR":"DEFENDER"}</span>
    </div>
    <div className={`fight-hud-fighter fight-hud-fighter--cpu ${impact?.defender==="cpu"?(impact.blocked?"fight-hud-fighter--blocked":"fight-hud-fighter--damaged"):""}`}>
      <div className="fight-hud-name"><span className="fight-hud-side">COMPUTADOR</span><strong>Desafiante CPU</strong></div>
      <HealthBar value={cpuHp} flipped label="Vida do adversário"/>
      <span className="fight-hud-hp">{cpuHp} <small>/ 100 HP</small></span>
    </div>
  </div>;
}
