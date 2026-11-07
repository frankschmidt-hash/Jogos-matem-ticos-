import { useId, type CSSProperties } from "react";
import { fighterStyles, type FighterStyle } from "./fighter-styles";
import { FighterClothingPiece } from "./FighterClothingPiece";
import { FighterVolumeLayer, type FighterVolumePart } from "./FighterVolumeLayer";
import "./fighter-figure.css";

/**
 * Lutador vetorial autoral em camadas articuladas.
 * Cada grupo SVG possui uma articulação própria para receber keyframes
 * e interpolação de poses nas próximas fases, sem bibliotecas pesadas.
 */
export type FighterPose = "idle" | "step" | "retreat" | "jab" | "cross" | "kick" | "block" | "hit" | "victory" | "defeat";
type FighterFigureProps = {
  color: string;
  fighterStyle?: FighterStyle;
  enemy?: boolean;
  pose?: FighterPose;
  label?: string;
};

export function FighterFigure({
  color, fighterStyle = "Boxe", enemy = false, pose = "idle", label = enemy ? "Lutador adversário" : "Lutador do jogador"
}: FighterFigureProps) {
  const selectedStyle=fighterStyles[fighterStyle];
  const gloves=selectedStyle.handwear==="boxing-gloves"||selectedStyle.handwear==="thai-gloves";
  // Gradientes únicos por instância: a cor do uniforme pertence ao perfil atual.
  const uid = useId().replace(/:/g, "");
  const url = (part: string) => `url(#${uid}-${part})`;
  const volume = (part: FighterVolumePart) => <FighterVolumeLayer part={part} fighterStyle={fighterStyle} color={color} gradientId={uid}/>;
  const skin = enemy ? "#e0a47c" : "#c98b68";
  const skinLight = enemy ? "#f7c8a1" : "#eeb797";
  const skinShadow = enemy ? "#945c43" : "#754736";

  return (
    <div
      className={`mf-figure mf-figure--style-${selectedStyle.slug} mf-figure--pose-${pose} ${enemy ? "mf-figure--enemy" : "mf-figure--player"}`}
      style={{ "--mf-primary": color } as CSSProperties}
      role="img"
      aria-label={label}
    >
      <svg className="mf-figure-svg" viewBox="0 0 230 350" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="1" y2=".25" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor={skinShadow}/>
            <stop offset=".28" stopColor={skin}/>
            <stop offset=".64" stopColor={skinLight}/>
            <stop offset="1" stopColor={skinShadow}/>
          </linearGradient>
          <linearGradient id={`${uid}-shirt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dce4ff"/>
            <stop offset=".07" stopColor={color}/>
            <stop offset=".52" stopColor={color}/>
            <stop offset="1" stopColor="#19233f"/>
          </linearGradient>
          <linearGradient id={`${uid}-shorts`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#495879"/>
            <stop offset=".5" stopColor="#293657"/>
            <stop offset="1" stopColor="#101727"/>
          </linearGradient>
          <linearGradient id={`${uid}-glove`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={enemy?"#ffbc68":"#fb7a66"}/>
            <stop offset=".45" stopColor={enemy?"#df6538":"#c42f46"}/>
            <stop offset="1" stopColor={enemy?"#803226":"#761e39"}/>
          </linearGradient>
          <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={enemy?"#695240":"#44465a"}/>
            <stop offset=".45" stopColor={enemy?"#302923":"#292c39"}/>
            <stop offset="1" stopColor="#131923"/>
          </linearGradient>
          <linearGradient id={`${uid}-boot`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#525f78"/>
            <stop offset=".5" stopColor="#29334e"/>
            <stop offset="1" stopColor="#101522"/>
          </linearGradient>
          <radialGradient id={`${uid}-volume-light`} cx="25%" cy="24%" r="87%">
            <stop offset="0" stopColor="#fff5e7" stopOpacity=".95"/>
            <stop offset=".36" stopColor="#efdac6" stopOpacity=".66"/>
            <stop offset="1" stopColor="#fff4e8" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id={`${uid}-volume-shadow`} x1="0" y1="0" x2="1" y2=".18">
            <stop offset="0" stopColor="#231b32" stopOpacity=".78"/>
            <stop offset=".48" stopColor="#37415b" stopOpacity=".43"/>
            <stop offset="1" stopColor="#171e33" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id={`${uid}-fabric-sheen`} x1="0" y1="0" x2="1" y2=".3">
            <stop offset="0" stopColor="#fff9ea" stopOpacity=".8"/>
            <stop offset=".44" stopColor={color} stopOpacity=".12"/>
            <stop offset="1" stopColor="#263249" stopOpacity=".5"/>
          </linearGradient>
        </defs>

        <ellipse className="mf-rig-shadow" cx="113" cy="332" rx="83" ry="10" fill="#182337" opacity=".19"/>
        <ellipse className="mf-rig-shadow-core" cx="113" cy="334" rx="50" ry="5" fill="#101729" opacity=".31"/>

        {/* Perna e canela traseiras: pivôs no quadril e no joelho. */}
        <g className="mf-rig-leg mf-rig-leg--back" data-joint="hip-back">
          <path d="M91 200 C77 206 68 229 69 250 L79 276 L101 276 L108 238 L111 205Z" fill={url("shorts")} stroke="#19223a" strokeWidth="3"/>
          <path d="M70 251 Q84 260 103 250 L100 279 Q86 283 79 277Z" fill="#c6a186" stroke="#674939" strokeWidth="2"/>
          <FighterClothingPiece piece="back-thigh" fighterStyle={fighterStyle} color={color}/>
          {volume("back-thigh")}
          <g className="mf-rig-shin mf-rig-shin--back" data-joint="knee-back">
            <path d="M78 274 Q77 294 70 316 L95 320 Q104 294 101 272Z" fill={url("skin")} stroke="#613d32" strokeWidth="3"/>
            <path d="M72 309 L94 310 L94 326 Q74 332 44 331 Q38 322 55 316Z" fill={url("boot")} stroke="#1c2536" strokeWidth="3"/>
            <path d="M48 325 Q73 327 97 323" stroke="#aab5c7" strokeWidth="2.5" opacity=".7" fill="none"/>
            <FighterClothingPiece piece="back-shin" fighterStyle={fighterStyle} color={color}/>
          {volume("back-shin")}
          </g>
        </g>

        {/* Braço traseiro, antebraço e luva individualizados. */}
        <g className="mf-rig-arm mf-rig-arm--back" data-joint="shoulder-back">
          <path d="M82 117 Q62 117 56 138 L45 167 Q43 174 52 180 L64 184 Q72 183 75 169 L89 145Z" fill={url("skin")} stroke="#754735" strokeWidth="3"/>
          <path d="M54 139 Q48 159 54 168" fill="none" stroke={skinLight} strokeWidth="5" opacity=".32"/>
          <FighterClothingPiece piece="back-arm" fighterStyle={fighterStyle} color={color}/>
          {volume("back-arm")}
          <g className="mf-rig-forearm mf-rig-forearm--back" data-joint="elbow-back">
            <path d="M53 170 Q66 175 80 149 L89 133 Q95 128 103 134 L110 143 Q107 154 96 164 L73 192 Q58 196 47 185Z" fill={url("skin")} stroke="#754735" strokeWidth="3"/>
            <path d="M65 179 L84 152" stroke={skinLight} strokeWidth="4" opacity=".38"/>
            <g className="mf-rig-glove mf-rig-glove--back" data-joint="wrist-back">
              <path d="M87 128 Q97 116 108 125 Q118 128 118 141 Q117 157 103 163 L88 158 Q77 143 87 128Z" fill={gloves ? url("glove") : url("skin")} stroke="#532b32" strokeWidth="3"/>
              <path d="M89 151 Q103 156 113 148" fill="none" stroke="#ffbbb1" strokeWidth="3" opacity=".55"/>
              <path d="M86 159 Q102 165 109 157 L105 169 Q92 173 85 165Z" fill="#2a354d"/>
              {volume("back-hand")}
            </g>
          </g>
        </g>

        {/* Tronco com peitoral, abdômen, gola e uniforme próprio. */}
        <g className="mf-rig-torso" data-joint="waist">
          <path d="M99 100 L124 99 L126 124 L101 128Z" fill={url("skin")} stroke="#754735" strokeWidth="3"/>
          <path d="M78 121 Q90 111 103 119 L122 120 Q140 111 153 131 Q156 162 145 187 L140 211 Q112 223 79 210 L76 170 Q70 142 78 121Z"
            fill={url("shirt")} stroke="#202a42" strokeWidth="3.5"/>
          <path d="M95 125 Q107 137 117 133 Q125 137 138 124" fill="none" stroke="#e4e9ff" strokeWidth="2.5" opacity=".54"/>
          <path d="M112 137 L111 199 M89 152 Q104 160 112 157 M130 151 Q123 159 113 157 M87 177 Q101 181 111 177 M131 177 Q123 182 115 178"
            stroke="#151d32" strokeWidth="2.3" opacity=".34" fill="none"/>
          <path d="M79 205 Q111 211 140 204 L140 219 Q116 229 79 218Z" fill={url("shorts")} stroke="#1b2338" strokeWidth="3"/>
          <path d="M88 212 L131 212" stroke="#d8e4fc" strokeWidth="3" opacity=".66"/>
          <path d="M89 128 L108 136 L112 149 L116 136 L140 126" fill="none" stroke="#b6c6e9" strokeWidth="3" opacity=".55"/>
          <path d="M126 130 Q138 148 133 177" fill="none" stroke="#ecf1ff" strokeWidth="4" opacity=".16"/>
          <FighterClothingPiece piece="torso" fighterStyle={fighterStyle} color={color}/>
          {volume("torso")}
        </g>

        {/* Perna dianteira: base de guarda afastada. */}
        <g className="mf-rig-leg mf-rig-leg--front" data-joint="hip-front">
          <path d="M117 212 Q139 207 148 231 L159 274 L134 280 Q121 260 111 233Z" fill={url("shorts")} stroke="#19223a" strokeWidth="3"/>
          <path d="M133 264 Q149 260 158 266 L160 282 Q149 290 139 281Z" fill={url("skin")} stroke="#674939" strokeWidth="2"/>
          <FighterClothingPiece piece="front-thigh" fighterStyle={fighterStyle} color={color}/>
          {volume("front-thigh")}
          <g className="mf-rig-shin mf-rig-shin--front" data-joint="knee-front">
            <path d="M138 277 Q141 295 141 314 L167 318 Q165 295 160 271Z" fill={url("skin")} stroke="#694637" strokeWidth="3"/>
            <path d="M139 307 L168 307 L172 326 Q181 332 190 334 L190 339 L133 338 Q129 327 139 307Z" fill={url("boot")} stroke="#172136" strokeWidth="3"/>
            <path d="M142 316 L164 316 M143 323 L167 323" stroke="#8e9eb3" strokeWidth="3" opacity=".65"/>
            <FighterClothingPiece piece="front-shin" fighterStyle={fighterStyle} color={color}/>
          {volume("front-shin")}
          </g>
        </g>

        {/* Cabeça em perspectiva 3/4: queixo, orelhas, nariz e expressão. */}
        <g className="mf-rig-head" data-joint="neck">
          <path d="M97 58 Q96 43 112 39 Q138 41 146 68 L145 94 Q139 112 117 118 Q98 114 92 92Z"
            fill={url("skin")} stroke="#6b4538" strokeWidth="3.2"/>
          <path d="M97 76 Q84 71 85 87 Q86 98 99 97" fill={url("skin")} stroke="#795241" strokeWidth="3"/>
          <path d="M139 84 Q149 84 148 95 L141 99" fill={url("skin")} stroke="#7d503b" strokeWidth="2"/>
          <path d="M102 99 Q122 106 137 96 Q126 119 116 118 Q105 116 102 99Z" fill="#a46e53" opacity=".28"/>
          <path d="M130 78 L143 89 L137 92" stroke="#754e40" strokeWidth="2.3" fill="none"/>
          <path d="M106 81 Q115 77 120 81 M125 79 Q133 76 138 79" stroke="#322827" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <path d="M109 87 L118 88 M127 85 L135 85" stroke="#1c2635" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M114 103 Q125 106 132 100" stroke="#653e3d" strokeWidth="2.4" fill="none"/>
          {enemy
            ? <path d="M91 67 Q92 36 111 34 L110 19 L123 32 L133 24 L133 39 Q148 43 146 75 L135 63 L112 58 L102 72Z"
                fill={url("hair")} stroke="#242730" strokeWidth="3"/>
            : <path d="M92 75 Q86 60 94 49 Q96 36 118 34 Q138 34 143 48 L149 68 Q132 59 125 50 Q115 61 93 62Z"
                fill={url("hair")} stroke="#242730" strokeWidth="3"/>}
          <path d="M99 49 Q114 39 132 45" stroke="#fff" strokeWidth="3.5" opacity=".19" fill="none"/>
          <FighterClothingPiece piece="head" fighterStyle={fighterStyle} color={color}/>
          {volume("head")}
        </g>

        {/* Ombro, braço, antebraço e luva da frente possuem pivôs independentes. */}
        <g className="mf-rig-arm mf-rig-arm--front" data-joint="shoulder-front">
          <path d="M142 121 Q161 117 171 141 L183 170 Q183 179 175 184 L161 182 Q153 163 141 143Z"
            fill={url("skin")} stroke="#754735" strokeWidth="3.2"/>
          <path d="M151 127 Q168 142 172 166" stroke={skinLight} strokeWidth="6" opacity=".26" fill="none"/>
          <FighterClothingPiece piece="front-arm" fighterStyle={fighterStyle} color={color}/>
          {volume("front-arm")}
          <g className="mf-rig-forearm mf-rig-forearm--front" data-joint="elbow-front">
            <path d="M168 172 Q158 159 155 151 L151 136 Q155 123 166 123 L177 133 Q181 155 187 176 Q183 190 168 188Z"
              fill={url("skin")} stroke="#704638" strokeWidth="3.2"/>
            <path d="M165 155 Q169 167 177 176" stroke={skinLight} strokeWidth="5" opacity=".38" fill="none"/>
            <g className="mf-rig-glove mf-rig-glove--front" data-joint="wrist-front">
              <path d="M145 117 Q146 104 158 99 Q175 94 184 107 Q194 118 190 132 Q187 146 170 148 L151 144 Q142 134 145 117Z"
                fill={gloves ? url("glove") : url("skin")} stroke="#512731" strokeWidth="3.5"/>
              <path d="M152 110 Q165 99 179 108" stroke="#ffe0c7" strokeWidth="4" opacity=".55" fill="none"/>
              <path d="M152 142 Q165 150 181 141 L179 153 Q161 161 153 152Z" fill="#29354d" stroke="#18223a" strokeWidth="2"/>
              <path d="M162 151 L174 151" stroke="#cbd8eb" strokeWidth="2"/>
              {volume("front-hand")}
            </g>
          </g>
        </g>

        <path d="M83 210 Q109 221 136 210" stroke="#f1d4b9" strokeWidth="2" opacity=".4" fill="none"/>
      </svg>
    </div>
  );
}
