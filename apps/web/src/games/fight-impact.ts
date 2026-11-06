import type { CombatTarget, ExchangePlan, AttackPose, CombatTurn } from "./fight-choreography";

/**
 * Um único relógio para o golpe e a reação do defensor.
 * A regra de acerto/erro pertence à Matemática; este módulo apenas transforma
 * o resultado já calculado em efeitos visuais determinísticos.
 */
export type ImpactSide = "player" | "cpu";
export type ImpactGrade = "block" | "light" | "medium" | "heavy";

export type ImpactCue = {
  attacker: ImpactSide;
  defender: ImpactSide;
  strike: AttackPose;
  target: CombatTarget;
  grade: ImpactGrade;
  blocked: boolean;
  contactAtMs: number;
  hitStopMs: number;
  knockbackPx: number;
  shakePx: number;
  label: string;
};

const STRIKE_CONTACT_MS: Record<AttackPose,number> = {
  jab: 430,
  cross: 465,
  kick: 490
};

/** A pausa é pequena e somente visual: nenhuma pergunta perde tempo. */
const HIT_STOP_MS: Record<ImpactGrade,number> = {
  block: 42,
  light: 58,
  medium: 84,
  heavy: 108
};

const KNOCKBACK_PX: Record<ImpactGrade,number> = {
  block: 9,
  light: 19,
  medium: 36,
  heavy: 52
};

const SHAKE_PX: Record<ImpactGrade,number> = {
  block: 0,
  light: 0,
  medium: 3,
  heavy: 5
};

export function impactGrade(strike: AttackPose, blocked:boolean):ImpactGrade {
  if(blocked) return "block";
  if(strike==="kick") return "heavy";
  if(strike==="cross") return "medium";
  return "light";
}

export function createImpactCue(
  exchange:ExchangePlan,
  turn:CombatTurn,
  target:CombatTarget
):ImpactCue|null {
  if(!exchange.hasStrike) return null; // tempo esgotado = sem contato fictício

  const attacker:ImpactSide = turn==="attack"?"player":"cpu";
  const defender:ImpactSide = attacker==="player"?"cpu":"player";
  const strike = turn==="attack"?exchange.player:exchange.cpu;
  if(strike!=="jab"&&strike!=="cross"&&strike!=="kick")return null;
  const blocked=!exchange.hasHit;
  const grade=impactGrade(strike,blocked);
  const aimedTarget=turn==="attack"?target:strike==="kick"?"Pernas":strike==="cross"?"Cabeça":"Tronco";
  return {
    attacker,defender,strike,target:aimedTarget,grade,blocked,
    contactAtMs:STRIKE_CONTACT_MS[strike],
    hitStopMs:HIT_STOP_MS[grade],
    knockbackPx:KNOCKBACK_PX[grade],
    shakePx:SHAKE_PX[grade],
    label:blocked?"BLOQUEADO":grade==="heavy"?"GOLPE FORTE!":"ACERTOU!"
  };
}

export const IMPACT_EFFECT_MS=290;

export function exchangeTotalDuration(baseDuration:number,cue:ImpactCue|null,reducedMotion:boolean):number {
  return baseDuration+(cue&&!reducedMotion?cue.hitStopMs:0);
}
