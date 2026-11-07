import type { FighterStyle } from "./fighter-styles";

export type FighterVolumePart =
  | "torso" | "head" | "back-arm" | "front-arm"
  | "back-thigh" | "front-thigh" | "back-shin" | "front-shin"
  | "back-hand" | "front-hand";

type Props = {
  part: FighterVolumePart;
  fighterStyle: FighterStyle;
  color: string;
  gradientId: string;
};

/**
 * Modelagem vetorial 2.5D: reflexos, oclusão e costuras distribuídos pelos
 * mesmos pivôs do rig. Nada aqui altera colisão, dano ou estado do combate.
 * Os paths ficam DENTRO dos grupos móveis para acompanhar cada articulação.
 */
export function FighterVolumeLayer({ part, fighterStyle, color, gradientId }: Props) {
  const gi = fighterStyle === "Karatê" || fighterStyle === "Jiu-jítsu";
  const bareChest = fighterStyle === "Boxe" || fighterStyle === "Muay Thai" || fighterStyle === "Capoeira";
  const capoeira = fighterStyle === "Capoeira";
  const street = fighterStyle === "Luta de rua";
  const longPants = gi || capoeira || street;
  const gloves = fighterStyle === "Boxe" || fighterStyle === "Muay Thai";
  const light = `url(#${gradientId}-volume-light)`;
  const shadow = `url(#${gradientId}-volume-shadow)`;
  const sheen = `url(#${gradientId}-fabric-sheen)`;
  const seam = gi ? "#edf0fa" : capoeira ? "#f7f2da" : "#d7e2f4";

  if (part === "torso") {
    return <g className="mf-volume-mf-body" pointerEvents="none">
      {bareChest ? <>
        <path d="M80 133 Q92 123 106 134 L109 151 Q89 159 80 146Z"
          fill={light} opacity=".42"/>
        <path d="M121 135 Q140 128 150 136 L146 166 Q135 153 122 150Z"
          fill={shadow} opacity=".6"/>
        <path d="M77 152 Q83 160 84 191 L91 208 L79 205 Q72 179 77 152Z"
          fill={shadow} opacity=".42"/>
        <path d="M108 151 Q112 170 109 197" fill="none" stroke="#472c2b" strokeWidth="3" opacity=".35"/>
        <path d="M91 169 Q104 176 110 168 M117 169 Q129 175 138 167
          M91 187 Q102 191 109 185 M117 187 Q130 192 139 184"
          stroke="#f9d2b2" strokeWidth="1.9" opacity=".37" fill="none"/>
        <path d="M88 135 Q95 128 104 135 M128 133 Q140 129 147 135"
          stroke="#ffe0bc" strokeWidth="2.8" opacity=".44" fill="none"/>
      </> : <>
        <path d="M77 142 L86 125 L102 140 L109 163 Q93 154 81 170Z"
          fill={sheen} opacity=".45"/>
        <path d="M140 130 L154 139 L145 198 L134 209 Q142 165 130 147Z"
          fill={shadow} opacity=".4"/>
        <path d="M91 147 L103 169 L95 203 M123 173 L129 203
          M84 185 L95 194 M128 193 L141 182"
          fill="none" stroke={seam} strokeWidth="2.2" opacity=".38"/>
        {gi && <>
          <path d="M92 127 L110 168 L129 127" fill="none" stroke="#24324a"
            strokeWidth="2.4" opacity=".5"/>
          <path d="M90 126 L107 165" fill="none" stroke="#fffdf6"
            strokeWidth="3" opacity=".66"/>
          <path d="M83 216 Q114 222 139 214" fill="none" stroke="#f2d3a5"
            strokeWidth="2.4" opacity=".55"/>
        </>}
        {street && <path d="M89 131 Q108 148 135 130 M88 172 Q118 183 141 168"
          fill="none" stroke="#d6e6fb" strokeWidth="2.5" opacity=".38"/>}
      </>}
      <path d="M81 207 Q111 215 140 207" fill="none" stroke={sheen}
        strokeWidth="6" opacity=".38"/>
      <path d="M78 219 Q109 225 143 218" stroke="#14203c" strokeWidth="3.2"
        opacity=".24" fill="none"/>
      {(gi || capoeira) && <g className="mf-volume-belt" opacity=".66">
        <path d="M104 218 Q102 232 104 238 M122 218 Q125 234 123 242"
          stroke={gi ? "#bac8d6" : "#eac965"} strokeWidth="2.8" strokeLinecap="round" fill="none"/>
      </g>}
    </g>;
  }

  if (part === "head") {
    return <g className="mf-volume-face" pointerEvents="none">
      <path d="M97 61 Q95 78 99 93 Q104 109 114 113 Q103 108 94 94 Q88 74 97 61Z"
        fill={shadow} opacity=".38"/>
      <path d="M122 47 Q139 54 142 72 L140 85 Q130 73 122 67Z"
        fill={shadow} opacity=".27"/>
      <path d="M102 65 Q109 51 123 48" fill="none" stroke={light}
        strokeWidth="7" opacity=".58"/>
      <path d="M115 76 Q121 84 118 92 Q124 95 129 92"
        fill="none" stroke="#f4c8a9" strokeWidth="2.2" opacity=".72"/>
      <path d="M113 102 Q122 106 132 101" fill="none" stroke="#eb9e8e"
        strokeWidth="1.8" opacity=".7"/>
      <path d="M99 93 Q101 105 111 108" fill="none" stroke="#703f38"
        strokeWidth="2.2" opacity=".3"/>
      <path d="M99 53 Q115 38 135 47" fill="none" stroke={light}
        strokeWidth="2.2" opacity=".52"/>
      <circle cx="105" cy="86" r="1.9" fill="#f8ded0" opacity=".58"/>
    </g>;
  }

  if (part === "back-arm" || part === "front-arm") {
    const front = part === "front-arm";
    const path = front
      ? "M148 128 Q158 123 166 143 Q170 153 174 159"
      : "M80 124 Q70 121 65 138 Q57 150 56 159";
    const inner = front
      ? "M158 142 Q168 148 174 168"
      : "M71 141 Q63 152 59 168";
    return <g className="mf-volume-arm" pointerEvents="none">
      <path d={path} stroke={gi ? seam : "#ffe2c4"} strokeWidth={gi ? "5.4" : "8"}
        strokeLinecap="round" opacity={gi ? ".39" : ".28"} fill="none"/>
      <path d={inner} stroke={shadow} strokeWidth="8" strokeLinecap="round"
        opacity={gi ? ".22" : ".37"} fill="none"/>
      {gi && <path d={front ? "M152 153 L168 158" : "M57 151 L74 153"}
        stroke="#23344b" strokeWidth="1.6" opacity=".5" fill="none"/>}
    </g>;
  }

  if (part === "back-thigh" || part === "front-thigh") {
    const front = part === "front-thigh";
    return <g className="mf-volume-thigh" pointerEvents="none">
      <path d={front
          ? "M118 216 Q140 217 145 243 L151 267"
          : "M88 209 Q75 227 80 247 L85 266"}
        stroke={longPants ? sheen : light} strokeWidth={longPants ? "9" : "12"}
        opacity={longPants ? ".38" : ".34"} fill="none" strokeLinecap="round"/>
      <path d={front ? "M136 239 L151 274" : "M100 233 L94 269"}
        stroke={shadow} strokeWidth="10" opacity=".35" fill="none" strokeLinecap="round"/>
      {longPants && <path d={front
        ? "M134 247 Q147 255 153 253 M140 263 L157 269"
        : "M79 250 Q91 254 103 249 M80 269 L99 268"}
        stroke={seam} strokeWidth="2" opacity=".42" fill="none"/>}
      {capoeira && <path d={front ? "M154 244 L156 272" : "M99 226 L93 269"}
        stroke={color} strokeWidth="2.8" opacity=".72" fill="none"/>}
    </g>;
  }

  if (part === "back-shin" || part === "front-shin") {
    const front = part === "front-shin";
    return <g className="mf-volume-shin" pointerEvents="none">
      <path d={front ? "M148 282 Q155 298 153 314" : "M87 280 Q88 294 83 311"}
        stroke={longPants ? sheen : light} strokeWidth="8" strokeLinecap="round"
        opacity={longPants ? ".43" : ".3"} fill="none"/>
      <path d={front ? "M163 291 L163 316" : "M99 290 L93 316"}
        stroke={shadow} strokeWidth="6" opacity=".3" fill="none"/>
      {longPants && <path d={front
        ? "M143 310 L166 312 M140 318 L169 321"
        : "M72 309 L97 315 M70 318 L96 323"}
        stroke={seam} strokeWidth="1.8" opacity=".48" fill="none"/>}
    </g>;
  }

  const front = part === "front-hand";
  return <g className="mf-volume-fist" pointerEvents="none">
    {gloves ? <>
      <path d={front
        ? "M148 116 Q157 103 173 104 Q184 108 185 119"
        : "M88 136 Q96 124 106 132"}
        stroke={light} strokeWidth="6.2" opacity=".55" strokeLinecap="round" fill="none"/>
      <path d={front
        ? "M151 137 Q170 150 183 135"
        : "M87 148 Q102 160 113 148"}
        stroke={shadow} strokeWidth="6" opacity=".56" fill="none"/>
      <path d={front
        ? "M155 117 Q169 114 180 123 M155 128 Q169 127 181 134"
        : "M91 137 Q101 134 111 142"}
        stroke="#f9dee0" strokeWidth="1.5" opacity=".46" fill="none"/>
      <path d={front ? "M157 151 L176 153" : "M88 165 L103 166"}
        stroke={color} strokeWidth="3" opacity=".67" fill="none"/>
    </> : <>
      <path d={front
        ? "M150 116 Q165 102 180 113"
        : "M88 131 Q100 122 111 138"}
        stroke={light} strokeWidth="5" opacity=".48" fill="none"/>
      <path d={front
        ? "M150 126 L182 133 M154 134 L177 141"
        : "M90 145 Q101 151 111 150"}
        stroke={fighterStyle === "Luta de rua" ? "#efe5d6" : "#e4b293"}
        strokeWidth="2.2" opacity=".7" fill="none"/>
    </>}
  </g>;
}
