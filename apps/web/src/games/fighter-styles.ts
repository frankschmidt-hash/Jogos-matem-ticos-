/**
 * Registro único das modalidades da Luta Matemática.
 * Os nomes persistidos são os mesmos da versão v1 dos perfis.
 * Não altera matemática, recompensas nem o protocolo de sessão.
 */
export const FIGHTER_STYLES = [
  "Boxe", "Muay Thai", "Capoeira", "Karatê", "Jiu-jítsu", "Luta de rua"
] as const;

export type FighterStyle = (typeof FIGHTER_STYLES)[number];
export type FighterOutfit = "boxing" | "muay-thai" | "capoeira" | "karate" | "jiujitsu" | "street";
export type FighterFootwear = "boots" | "barefoot" | "trainers";
export type FighterHandwear = "boxing-gloves" | "thai-gloves" | "wraps" | "bare";

export type FighterStyleConfig = {
  slug: string;
  name: FighterStyle;
  outfit: FighterOutfit;
  footwear: FighterFootwear;
  handwear: FighterHandwear;
  guard: "high" | "traditional" | "ginga" | "grappling" | "loose";
  description: string;
};

export const fighterStyles: Record<FighterStyle, FighterStyleConfig> = {
  "Boxe": {
    slug: "boxing", name: "Boxe", outfit: "boxing", footwear: "boots",
    handwear: "boxing-gloves", guard: "high",
    description: "Luvas de pugilista, calção, botas de ringue e guarda clássica."
  },
  "Muay Thai": {
    slug: "muay-thai", name: "Muay Thai", outfit: "muay-thai", footwear: "barefoot",
    handwear: "thai-gloves", guard: "high",
    description: "Shorts tailandeses, bandagens, guarda alta e base para chutes."
  },
  "Capoeira": {
    slug: "capoeira", name: "Capoeira", outfit: "capoeira", footwear: "barefoot",
    handwear: "bare", guard: "ginga",
    description: "Calça longa, cordão na cintura, pés descalços e movimento de ginga."
  },
  "Karatê": {
    slug: "karate", name: "Karatê", outfit: "karate", footwear: "barefoot",
    handwear: "bare", guard: "traditional",
    description: "Karategi de mangas largas, faixa e postura de karatê."
  },
  "Jiu-jítsu": {
    slug: "jiujitsu", name: "Jiu-jítsu", outfit: "jiujitsu", footwear: "barefoot",
    handwear: "bare", guard: "grappling",
    description: "Kimono reforçado, faixa e base de luta em pé."
  },
  "Luta de rua": {
    slug: "street", name: "Luta de rua", outfit: "street", footwear: "trainers",
    handwear: "wraps", guard: "loose",
    description: "Visual urbano original, bandagens, tênis e guarda solta."
  }
};

export function resolveFighterStyle(value: unknown): FighterStyle {
  return FIGHTER_STYLES.find(style => style === value) ?? "Boxe";
}
