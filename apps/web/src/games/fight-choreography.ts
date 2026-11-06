/**
 * Coreografia puramente visual do Luta Matemática.
 * A matemática, HP, recompensas e validação continuam sob responsabilidade do jogo.
 * O plano não decide se uma resposta está correta nem se houve dano.
 */
export type CombatPose =
  | "idle" | "step" | "retreat" | "jab" | "cross" | "kick"
  | "block" | "hit" | "victory" | "defeat";

export type CombatTurn = "attack" | "defend";
export type CombatTarget = "Cabeça" | "Tronco" | "Pernas";
export type AttackPose = Extract<CombatPose, "jab" | "cross" | "kick">;

export const EXCHANGE_DURATION_MS = 1080;
export const RECOVERY_DURATION_MS = 360;

export type ExchangePlan = {
  player: CombatPose;
  cpu: CombatPose;
  caption: string;
  hasStrike: boolean;
  hasHit: boolean;
};

export function choosePlayerStrike(target: CombatTarget, damage: number): AttackPose {
  if (target === "Pernas") return "kick";
  if (target === "Cabeça" || damage >= 22) return "cross";
  return "jab";
}

export function chooseCpuStrike(counter: number): AttackPose {
  return (["jab", "cross", "kick"] as const)[Math.abs(Math.trunc(counter)) % 3]!;
}

/**
 * Tempo esgotado no próprio ataque não produz um golpe fictício;
 * nos turnos de defesa, a CPU continua atacando normalmente.
 */
export function planExchange(input: {
  turn: CombatTurn;
  correct: boolean;
  timedOut: boolean;
  target: CombatTarget;
  damage: number;
  cpuAttackCount: number;
}): ExchangePlan {
  const { turn, correct, timedOut, target, damage, cpuAttackCount } = input;
  if (turn === "attack") {
    if (timedOut) return {
      player: "idle", cpu: "idle", caption: "Tempo esgotado — ataque cancelado",
      hasStrike: false, hasHit: false
    };
    const strike = choosePlayerStrike(target, damage);
    const name = strike === "jab" ? "Jab" : strike === "cross" ? "Direto" : "Chute";
    return {
      player: strike,
      cpu: correct ? "hit" : "block",
      caption: correct ? `${name} conectado!` : `${name} bloqueado!`,
      hasStrike: true,
      hasHit: correct
    };
  }
  const strike = chooseCpuStrike(cpuAttackCount);
  return {
    player: correct ? "block" : "hit",
    cpu: strike,
    caption: correct ? "Defesa perfeita!" : "Ataque do adversário!",
    hasStrike: true,
    hasHit: !correct
  };
}
