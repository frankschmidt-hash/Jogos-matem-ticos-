import { describe, expect, it } from "vitest";
import { FIGHTER_STYLES, fighterStyles, resolveFighterStyle } from "./fighter-styles";

describe("registro de estilos de lutadores",()=>{
  it("reconhece as seis modalidades sem mudar chaves dos perfis",()=>{
    expect(FIGHTER_STYLES).toEqual(["Boxe","Muay Thai","Capoeira","Karatê","Jiu-jítsu","Luta de rua"]);
    for(const name of FIGHTER_STYLES)expect(resolveFighterStyle(name)).toBe(name);
    expect(resolveFighterStyle("modalidade inexistente")).toBe("Boxe");
  });
  it("possui um figurino e postura distintos por modalidade",()=>{
    expect(new Set(FIGHTER_STYLES.map(name=>fighterStyles[name].slug)).size).toBe(6);
    expect(new Set(FIGHTER_STYLES.map(name=>fighterStyles[name].outfit)).size).toBe(6);
    expect(fighterStyles.Capoeira.footwear).toBe("barefoot");
    expect(fighterStyles.Karatê.footwear).toBe("barefoot");
    expect(fighterStyles["Jiu-jítsu"].footwear).toBe("barefoot");
  });
});
