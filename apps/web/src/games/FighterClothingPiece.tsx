import type { FighterStyle } from "./fighter-styles";

type Piece = "torso" | "head" | "back-thigh" | "front-thigh" |
  "back-shin" | "front-shin" | "back-arm" | "front-arm";
type Props = { piece: Piece; fighterStyle: FighterStyle; color: string };

/**
 * Recortes de vestimenta acoplados aos grupos de articulação existentes.
 * Nenhum sprite externo: as roupas acompanham ombro, quadril e joelho.
 */
export function FighterClothingPiece({piece,fighterStyle,color}:Props) {
  const gi=fighterStyle==="Karatê"||fighterStyle==="Jiu-jítsu";
  const long=gi||fighterStyle==="Capoeira"||fighterStyle==="Luta de rua";
  const cap=fighterStyle==="Capoeira";
  const street=fighterStyle==="Luta de rua";
  const bare=fighterStyle==="Muay Thai"||cap||gi;
  const fabric=cap?"#e8e7d8":gi?color:street?"#303e58":color;
  const light=cap?"#fffdf4":gi?"#dce2ef":street?"#6f82a3":"#f1c787";
  const outline="#30354a";

  if(piece==="head") return <>
    {fighterStyle==="Muay Thai"&&<>
      <path d="M92 63 Q118 52 145 64" stroke={color} strokeWidth="7" fill="none"/>
      <path d="M99 65 L94 81 M136 63 L142 79" stroke="#f0c57b" strokeWidth="2.8" fill="none"/>
    </>}
    {cap&&<>
      <g className="mf-hair-strands">
        <path d="M93 48 Q92 30 102 25 M107 40 Q105 23 114 16 M124 39 Q124 20 133 13 M136 46 Q149 26 154 35"
          fill="none" stroke="#25232a" strokeWidth="7" strokeLinecap="round"/>
      </g>
      <path d="M99 34 L108 33 M116 27 L125 26" stroke="#ae977d" strokeWidth="2"/>
    </>}
    {fighterStyle==="Karatê"&&<path d="M97 51 L103 27 L115 38 L123 20 L133 39 L143 28 L148 56Z"
      fill="#2c2b37" stroke="#1d2430" strokeWidth="2.5"/>}
    {street&&<>
      <path d="M91 62 Q92 34 114 31 Q138 24 149 57 L149 68 Q124 61 93 72Z"
        fill="#262d40" stroke="#131a26" strokeWidth="3"/>
      <path d="M94 67 Q122 54 150 65" stroke={color} strokeWidth="4.5" fill="none"/>
    </>}
  </>;

  if(piece==="torso") return <>
    {(fighterStyle==="Boxe"||fighterStyle==="Muay Thai"||cap)&&<>
      <path d="M79 122 Q92 113 105 120 Q117 123 126 121 Q143 115 153 130
        L144 187 L140 207 Q111 220 80 207 L76 170 Q71 143 79 122Z"
        fill="#bd815e" stroke="#694735" strokeWidth="3"/>
      <path d="M83 127 Q101 143 111 136 Q128 143 149 128 M111 139 L111 195
        M86 160 Q101 167 110 159 M117 159 Q132 168 142 158
        M87 179 Q102 187 110 180 M117 181 Q131 188 140 178"
        fill="none" stroke="#744b38" strokeWidth="2.6" opacity=".65"/>
      <path d="M86 134 Q91 129 101 131 M130 129 L143 132" stroke="#f1c19d" strokeWidth="3" opacity=".65"/>
    </>}
    {gi&&<>
      <path d="M79 121 Q95 111 103 121 L112 144 L123 120 Q143 113 154 132
        L144 194 L138 211 Q111 223 80 209 L75 164Z"
        fill={fabric} stroke={outline} strokeWidth="3.4"/>
      <path d="M87 122 L110 169 L132 122" stroke={light} strokeWidth={fighterStyle==="Jiu-jítsu"?"12":"8"} fill="none"/>
      <path d="M105 131 L112 149 L122 129" stroke="#33435b" strokeWidth="3" fill="none"/>
      <path d="M86 157 Q103 167 110 164 M117 165 Q133 165 147 151 M90 190 Q116 199 139 189"
        stroke="#263650" strokeWidth="2" opacity=".28" fill="none"/>
      <path d="M79 206 Q111 214 142 205 L142 221 Q109 227 79 218Z"
        fill={fighterStyle==="Jiu-jítsu"?"#27233e":"#282e40"} stroke="#b9a677" strokeWidth="2.2"/>
      <g className="mf-fabric-trail mf-fabric-trail--belt">
        <path d="M109 219 L104 246 L114 245 L118 220 M121 219 L127 242 L137 241 L128 218"
          fill="#2d3445" stroke="#c3aa77" strokeWidth="1.8"/>
        <path d="M107 236 L112 237 M127 232 L134 231" stroke="#f9e5be" strokeWidth="1.6" opacity=".62"/>
      </g>
      {fighterStyle==="Jiu-jítsu"&&<>
        <path d="M132 154 L142 156 L143 176 L132 174Z" fill="#e3d6c3" stroke="#586781" strokeWidth="2"/>
        <path d="M84 197 L98 200 M127 199 L138 196" stroke="#b8c7d7" strokeWidth="3"/>
      </>}
    </>}
    {cap&&<>
      <path d="M79 208 Q108 215 143 206" stroke="#e2bf4f" strokeWidth="6" fill="none"/>
      <g className="mf-fabric-trail mf-fabric-trail--cord">
        <path d="M122 216 Q133 238 122 252 M127 217 Q140 241 135 256"
          stroke="#e4c853" strokeWidth="3.8" strokeLinecap="round" fill="none"/>
        <circle cx="126" cy="215" r="5" fill="#e2ca59"/>
        <path d="M120 246 L124 259 M131 251 L134 261" stroke="#f7de82" strokeWidth="2.3" fill="none"/>
      </g>
    </>}
    {fighterStyle==="Boxe"&&<>
      <path d="M80 206 Q110 214 140 207" stroke="#f4d28e" strokeWidth="7" fill="none"/>
      <path d="M105 207 L112 221 L119 207" fill="#e9c77f" stroke="#916141" strokeWidth="2"/>
    </>}
    {fighterStyle==="Muay Thai"&&<>
      <path d="M80 207 Q109 214 141 206" stroke="#e8c277" strokeWidth="6" fill="none"/>
      <path d="M105 209 L112 224 L119 209" fill="#e8c888" stroke="#6b5048" strokeWidth="2"/>
    </>}
    {street&&<>
      <path d="M80 122 Q98 113 111 127 Q136 113 154 130 L146 205 Q110 217 80 207Z"
        fill={color} stroke="#1f2a3e" strokeWidth="3.4"/>
      <path d="M86 128 L110 146 L137 128" stroke="#9eadc4" strokeWidth="4" fill="none"/>
      <path d="M85 179 Q115 188 144 176 M84 200 Q112 210 144 198"
        stroke="#151c30" strokeWidth="3" opacity=".38" fill="none"/>
      <g className="mf-fabric-trail mf-fabric-trail--hood">
        <path d="M105 208 L105 221 M118 208 L122 222" stroke="#d1d8e4" strokeWidth="3"/>
      </g>
    </>}
  </>;

  if(piece==="back-arm"||piece==="front-arm") {
    if(!gi&&!street&&fighterStyle!=="Muay Thai")return null;
    const front=piece==="front-arm";
    return <>
      {gi&&(front
        ? <path d="M141 122 Q163 116 173 139 L182 161 Q170 169 155 159 L139 140Z"
            fill={fabric} stroke={outline} strokeWidth="3"/>
        : <path d="M81 118 Q64 117 56 138 L49 158 Q67 166 79 153 L90 130Z"
            fill={fabric} stroke={outline} strokeWidth="3"/>)}
      {street&&(front
        ? <path d="M147 126 L168 135 L174 143 L158 148Z" fill="#20283b" stroke={color} strokeWidth="2"/>
        : <path d="M76 124 L59 136 L55 144 L73 150Z" fill="#20283b" stroke={color} strokeWidth="2"/>)}
      {fighterStyle==="Muay Thai"&&(front
        ? <path d="M156 142 L174 144 L176 153 L160 152Z" fill={color} stroke="#ebd18a" strokeWidth="2"/>
        : <path d="M53 141 L72 141 L71 150 L53 150Z" fill={color} stroke="#ebd18a" strokeWidth="2"/>)}
    </>;
  }

  if(piece==="back-thigh")return long&&<g>
    <path d="M91 200 Q74 209 68 247 L79 278 L103 278 L108 239 L111 205Z"
      fill={fabric} stroke={outline} strokeWidth="3"/>
    <path d="M85 214 Q88 239 80 267" stroke={light} strokeWidth="2" opacity=".6" fill="none"/>
    {cap&&<path d="M98 207 Q90 243 93 277" stroke={color} strokeWidth="3" fill="none"/>}
  </g>;

  if(piece==="front-thigh")return long&&<g>
    <path d="M116 211 Q139 208 149 232 L160 282 L134 283 Q120 259 111 232Z"
      fill={fabric} stroke={outline} strokeWidth="3"/>
    <path d="M132 219 Q146 251 149 276" stroke={light} strokeWidth="2" opacity=".55" fill="none"/>
    {cap&&<path d="M139 222 L156 279" stroke={color} strokeWidth="3" fill="none"/>}
  </g>;

  if(piece==="back-shin")return (bare||long)&&<g>
    {long&&<path d="M78 273 Q78 297 70 315 L96 325 Q104 294 101 272Z"
      fill={fabric} stroke={outline} strokeWidth="2.8"/>}
    {bare&&<>
      <path d="M72 313 L94 313 L94 328 Q71 334 47 333 Q42 329 53 318Z"
        fill="#ca9577" stroke="#704a3c" strokeWidth="2.8"/>
      <path d="M50 327 L60 327 M65 328 L73 327" stroke="#ecc5a5" strokeWidth="2.2"/>
    </>}
  </g>;

  if(piece==="front-shin")return (bare||long)&&<g>
    {long&&<path d="M138 276 Q142 298 138 319 L169 323 Q166 295 160 273Z"
      fill={fabric} stroke={outline} strokeWidth="3"/>}
    {bare&&<>
      <path d="M139 311 L166 311 L173 326 Q183 332 191 333 L191 339 L132 339 Q131 329 139 311Z"
        fill="#ca9577" stroke="#704a3c" strokeWidth="2.6"/>
      <path d="M179 332 L187 334 M171 331 L176 333" stroke="#f0c7a5" strokeWidth="2"/>
    </>}
    {street&&<path d="M139 308 L167 308 L174 327 L190 332 L190 339 L133 339 L136 321Z"
      fill="#232c3e" stroke="#151e2e" strokeWidth="3"/>}
  </g>;
  return null;
}
