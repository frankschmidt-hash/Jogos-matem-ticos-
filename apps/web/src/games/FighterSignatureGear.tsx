import type { FighterStyle } from "./fighter-styles";

export type SignaturePart = "torso" | "head" | "front-arm" | "back-arm" |
  "front-thigh" | "back-thigh" | "front-shin" | "back-shin" |
  "front-hand" | "back-hand";
type Props = { part: SignaturePart; fighterStyle: FighterStyle; color: string };

/**
 * Segunda direção de arte: blocos grandes de identidade, legíveis inclusive
 * em 112px de largura. Cada elemento acompanha o seu pivô original de SVG.
 * Roupas autorais sem marcas, logotipos ou recursos externos.
 */
export function FighterSignatureGear({part,fighterStyle:style,color}:Props){
  const boxing=style==="Boxe";
  const thai=style==="Muay Thai";
  const cap=style==="Capoeira";
  const karate=style==="Karatê";
  const jiu=style==="Jiu-jítsu";
  const street=style==="Luta de rua";
  const gi=karate||jiu;
  const front=part.startsWith("front-");
  const side=front?"front":"back";

  if(part==="torso")return <g data-art-signature={style} className={"mf-art-signature mf-art-signature--"+side}>
    {cap&&<>
      {/* Regata autêntica de treino + calça/cordão branco: grande contraste. */}
      <path d="M84 122 Q94 117 102 121 L114 134 L126 121 Q139 118 148 128
        L142 166 L141 207 Q112 217 80 206 L78 168 L84 122Z"
        fill={color} stroke="#24344e" strokeWidth="3.4"/>
      <path d="M90 124 Q99 127 111 143 Q123 127 137 125"
        stroke="#f5edd8" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M85 148 Q95 161 105 164 M136 153 L132 187 M88 189 Q110 198 137 189"
        stroke="#f5eace" strokeWidth="3.2" opacity=".65" fill="none"/>
      <path d="M87 132 Q80 148 84 168" stroke="#10192b" strokeWidth="5" opacity=".35" fill="none"/>
      {/* Símbolo abstrato original de movimento, sem apropriação de marca. */}
      <circle cx="111" cy="172" r="12" fill="none" stroke="#f7e6af" strokeWidth="2.5"/>
      <path d="M101 176 Q110 163 120 171 M104 180 Q114 185 121 176"
        stroke="#f7e6af" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M80 209 Q113 215 143 207" stroke="#f7d45d" strokeWidth="7" fill="none"/>
    </>}
    {boxing&&<>
      {/* Luva, shorts e peitoral fortes, com recorte na cintura. */}
      <path d="M80 203 Q109 212 143 204 L142 228 Q111 236 80 225Z"
        fill={color} stroke="#1d2940" strokeWidth="3.6"/>
      <path d="M81 206 Q110 215 142 207" stroke="#f2d59d" strokeWidth="6" fill="none"/>
      <path d="M100 209 L109 225 L119 209" fill="#f7e1ab" stroke="#b28a5f" strokeWidth="1.8"/>
      <path d="M86 143 Q95 134 106 140 M125 139 Q136 134 143 142"
        stroke="#fbe1c0" strokeWidth="6" opacity=".67" fill="none"/>
      <path d="M103 155 L110 170 L119 153 M110 175 L110 196" stroke="#5a352e" strokeWidth="3" opacity=".4" fill="none"/>
    </>}
    {thai&&<>
      {/* Shorts tailandeses de cetim com faixa larga bordada. */}
      <path d="M80 199 Q110 206 143 198 L141 226 Q113 234 79 222Z"
        fill={color} stroke="#5e3d4e" strokeWidth="3.5"/>
      <path d="M79 205 Q111 214 143 204" stroke="#efca79" strokeWidth="8" fill="none"/>
      <path d="M85 215 L93 221 L101 215 L109 222 L116 215 L124 222 L132 214"
        fill="none" stroke="#ffe4a5" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M108 203 L111 222 L118 203" fill="#f4d79d" stroke="#6c4d3e" strokeWidth="1.6"/>
      <path d="M86 140 Q93 133 101 136 M133 133 Q141 138 147 150"
        stroke="#ffdcc0" strokeWidth="6" fill="none" opacity=".44"/>
    </>}
    {karate&&<>
      {/* Karategi triangular, mangas amplas, lapela e faixa reta. */}
      <path d="M80 123 Q100 110 108 128 L115 149 L127 119 Q145 116 151 135
        L140 203 Q111 219 79 203 L75 165Z" fill="#f6f4ed"
        stroke="#4a5566" strokeWidth="3.5"/>
      <path d="M92 125 L112 160 L136 121" fill="none" stroke="#d2d5d6" strokeWidth="12"/>
      <path d="M91 123 L111 157 L131 123" stroke="#fff" strokeWidth="4.2" fill="none"/>
      <path d="M83 169 Q105 180 143 155 M86 194 Q117 201 140 184"
        stroke="#a9b4c0" strokeWidth="3.2" opacity=".53" fill="none"/>
      <path d="M81 206 Q113 215 141 205 L141 224 Q111 233 79 219Z"
        fill="#151d29" stroke="#ded2ad" strokeWidth="2.4"/>
      <path d="M107 216 L102 246 L114 245 L117 220 M121 217 L132 239 L139 236 L127 216"
        fill="#1a2330" stroke="#d3b98a" strokeWidth="1.5"/>
      <path d="M133 150 L143 153 L143 167 L132 165Z" fill={color} stroke="#d1c3a0" strokeWidth="1.8"/>
      <path d="M136 157 L140 157" stroke="#fcf8e6" strokeWidth="2"/>
    </>}
    {jiu&&<>
      {/* Kimono pesado de jiu-jítsu e gola larga dupla, distintamente do karatê. */}
      <path d="M75 126 Q91 110 107 129 L114 143 L126 118 Q149 116 156 138
        L146 207 Q114 219 79 209 L73 163Z" fill={color}
        stroke="#24324a" strokeWidth="4.3"/>
      <path d="M90 125 L111 171 L135 121"
        stroke="#e8e9e5" strokeWidth="15" fill="none" strokeLinejoin="round"/>
      <path d="M94 126 L110 160 L128 125"
        stroke="#9aabb8" strokeWidth="3.3" fill="none"/>
      <path d="M84 154 L96 170 L90 195 M129 168 L138 190"
        fill="none" stroke="#f4f6f6" strokeWidth="3" opacity=".38"/>
      <path d="M80 207 Q111 216 143 206 L143 226 Q110 232 80 219Z"
        fill="#252137" stroke="#ad97a9" strokeWidth="3"/>
      <path d="M108 221 L105 244 L116 241 L119 219 M123 220 L130 243 L138 241 L129 220"
        fill="#26233b" stroke="#9d8fa4" strokeWidth="2"/>
      <path d="M131 158 L146 158 L146 180 L131 180Z" fill="#f7f4e6" stroke="#212f49" strokeWidth="2.3"/>
      <path d="M135 162 L142 162 M135 168 L142 168 M135 173 L142 173"
        stroke="#ae4e5f" strokeWidth="2"/>
      <path d="M86 192 L96 196 M130 194 L142 190" stroke="#d7e3ed" strokeWidth="4" opacity=".55"/>
    </>}
    {street&&<>
      {/* Colete urbano esportivo encapuzado, fecho e bolso amplo. */}
      <path d="M78 123 Q91 105 108 124 L115 139 L130 122 Q147 108 157 136
        L148 210 Q111 223 78 207 L73 168Z" fill="#242d40" stroke="#111a2a" strokeWidth="4"/>
      <path d="M89 125 L114 151 L135 124" stroke={color} strokeWidth="8" fill="none"/>
      <path d="M110 151 L111 206" stroke="#e8e8d8" strokeWidth="3.5"/>
      <path d="M105 159 L106 165 M105 172 L106 179 M106 190 L106 197" stroke="#a2abc1" strokeWidth="2.7"/>
      <path d="M83 165 Q94 176 104 165 M120 165 Q138 178 147 165" fill="none" stroke="#62708c" strokeWidth="3.5"/>
      <path d="M91 184 Q112 189 134 184 L133 202 Q110 207 90 199Z" fill="#111a29" stroke="#8ca0b7" strokeWidth="2.2"/>
      <path d="M87 128 L85 202" stroke="#5e718e" strokeWidth="2.3" opacity=".6"/>
      <path d="M88 207 L143 208" stroke={color} strokeWidth="6" opacity=".9"/>
    </>}
  </g>;

  if(part==="front-arm"||part==="back-arm")return <g className="mf-art-sleeve">
    {gi&&<>
      <path d={front
        ?"M140 124 Q164 114 176 138 L185 159 Q172 171 152 158 L137 139Z"
        :"M81 118 Q61 111 53 139 L45 160 Q60 170 79 154 L91 129Z"}
        fill={karate?"#efeee8":color} stroke="#3f5061" strokeWidth={jiu?"4":"3"}/>
      <path d={front?"M159 154 Q173 160 182 157":"M49 157 Q62 161 78 150"}
        stroke="#d2e0e8" strokeWidth={jiu?"5":"3"} fill="none"/>
      {jiu&&<path d={front?"M148 131 L174 145":"M66 132 L84 138"}
        stroke="#eef4f7" strokeWidth="4" opacity=".6"/>}
    </>}
    {thai&&<>
      <path d={front?"M148 137 L175 140 L178 151 L154 152Z":"M54 138 L78 134 L77 150 L52 154Z"}
        fill="#f1cb74" stroke="#75574b" strokeWidth="2.7"/>
      <path d={front?"M152 143 L175 146":"M55 145 L76 141"}
        stroke={color} strokeWidth="4" fill="none"/>
    </>}
    {street&&<path d={front?"M146 131 Q161 131 172 141 L166 151 L152 146Z":"M78 123 L58 139 L65 147 L80 138Z"}
      fill={color} stroke="#243349" strokeWidth="3"/>}
    {cap&&<path d={front?"M143 130 Q160 132 169 144":"M78 128 Q67 133 59 146"}
      stroke="#fff0bc" strokeWidth="4.5" opacity=".75" fill="none"/>}
    {boxing&&<path d={front?"M151 128 Q164 132 175 149":"M80 128 Q66 129 56 146"}
      stroke="#fff0d2" strokeWidth="5" opacity=".6" fill="none"/>}
  </g>;

  if(part==="front-thigh"||part==="back-thigh"){
    const mark=front
      ?"M128 226 L144 229 L151 269 L141 272Z"
      :"M87 217 L98 218 L96 269 L81 270Z";
    return <g className="mf-art-leg-panel">
      {boxing&&<>
        <path d={mark} fill={color} stroke="#f5d88c" strokeWidth="3.4"/>
        <path d={front?"M126 231 L142 232":"M88 222 L97 225"} stroke="#fff2d1" strokeWidth="2.2"/>
      </>}
      {thai&&<>
        <path d={mark} fill={color} stroke="#ebc17e" strokeWidth="3.8"/>
        <path d={front?"M135 230 L146 262 L139 261":"M90 220 L89 259"}
          stroke="#fff0b1" strokeWidth="3.5" fill="none"/>
        <circle cx={front?142:92} cy="247" r="3.5" fill="#ffe8aa"/>
      </>}
      {cap&&<>
        <path d={front?"M141 222 Q148 242 152 276":"M97 209 Q94 233 92 272"}
          fill="none" stroke={color} strokeWidth="7"/>
        <path d={front?"M137 226 L150 271":"M91 212 L88 267"}
          fill="none" stroke="#f4d567" strokeWidth="2.6"/>
        <path d={front?"M121 235 L136 242 M128 258 L149 259":"M79 238 L100 245 M76 259 L99 265"}
          stroke="#adb8c0" strokeWidth="2" fill="none" opacity=".65"/>
      </>}
      {karate&&<path d={front?"M123 237 L147 272 M131 256 L155 270":"M82 237 L99 252 M80 263 L100 270"}
        stroke="#b4bbbf" strokeWidth="3.7" opacity=".85" fill="none"/>}
      {jiu&&<>
        <path d={mark} fill={color} stroke="#e1e6eb" strokeWidth="2.5" opacity=".8"/>
        <path d={front?"M129 239 L145 245":"M82 238 L100 243"} stroke="#fff" strokeWidth="3" opacity=".66"/>
      </>}
      {street&&<>
        <path d={mark} fill="#243149" stroke={color} strokeWidth="2.6"/>
        <path d={front?"M135 244 L149 243 L149 254 L136 254Z":"M80 238 L94 238 L94 251 L80 251Z"}
          fill="#11192a" stroke="#7990ab" strokeWidth="2"/>
        <path d={front?"M138 248 L148 248":"M83 243 L93 243"} stroke="#ebedef" strokeWidth="2"/>
      </>}
    </g>;
  }
  if(part==="front-shin"||part==="back-shin")return <g className="mf-art-shin">
    {boxing&&<>
      <path d={front?"M139 303 L166 307 L168 320 L137 318Z":"M72 306 L96 304 L96 321 L70 320Z"}
        fill={color} stroke="#d3b985" strokeWidth="3"/>
      <path d={front?"M138 321 L172 326 M139 326 L180 332":"M69 320 L96 322 M60 327 L95 327"}
        stroke="#f7e4b1" strokeWidth="2.8" fill="none"/>
    </>}
    {thai&&<path d={front?"M139 297 L166 297 M138 304 L168 304":"M72 296 L101 296 M69 303 L100 303"}
      stroke="#fbf0d6" strokeWidth="5" opacity=".86" fill="none"/>}
    {cap&&<path d={front?"M141 312 L165 314":"M70 312 L94 313"}
      stroke="#e8debd" strokeWidth="2.4" fill="none"/>}
    {gi&&<path d={front?"M139 310 L167 315 M135 319 L167 322":"M72 309 L97 315 M70 318 L97 323"}
      stroke={karate?"#b7c0cb":"#ecedf6"} strokeWidth="3.7" fill="none" opacity=".86"/>}
    {street&&<>
      <path d={front?"M137 313 L168 316 L171 327 L134 326Z":"M73 313 L96 315 L98 326 L69 326Z"}
        fill="#1c2537" stroke="#b4c0d4" strokeWidth="2.6"/>
      <path d={front?"M140 326 L179 334":"M60 327 L92 329"} stroke={color} strokeWidth="3.4"/>
    </>}
  </g>;
  if(part==="front-hand"||part==="back-hand")return <g className="mf-art-hand">
    {boxing&&<path d={front?"M149 116 Q159 104 177 111 M150 133 Q163 143 182 135":"M87 132 Q100 122 110 133 M88 150 Q99 155 111 148"}
      stroke="#ffe9dd" strokeWidth="4.5" opacity=".7" strokeLinecap="round" fill="none"/>}
    {thai&&<path d={front?"M151 143 L178 149 M151 149 L177 155":"M85 156 L108 160 M88 163 L105 167"}
      stroke="#f4ddb8" strokeWidth="4.5" fill="none"/>}
    {(gi||cap||street)&&<path d={front?"M150 117 L181 127 M148 125 L184 134 M152 133 L183 142":"M88 131 L112 141 M85 139 L111 148 M88 147 L109 156"}
      stroke={street?"#eee5d4":"#f4eadb"} strokeWidth={street?"3.7":"2.6"} opacity=".9" fill="none"/>}
  </g>;
  if(part==="head")return <g className="mf-art-head">
    {boxing&&<path d="M91 59 Q105 44 124 48 M102 48 L114 42" fill="none" stroke="#c6b6a2" strokeWidth="3.5" opacity=".65"/>}
    {thai&&<path d="M100 66 Q124 60 142 69" fill="none" stroke={color} strokeWidth="7"/>}
    {karate&&<path d="M96 52 L109 36 L117 42 L131 34 L145 50" fill="none" stroke="#161b2b" strokeWidth="6.5" strokeLinecap="round"/>}
    {jiu&&<path d="M95 61 Q99 38 123 39 Q146 39 147 64" fill="none" stroke="#24212d" strokeWidth="8.5" opacity=".78"/>}
    {street&&<path d="M94 66 Q116 53 151 66" fill="none" stroke={color} strokeWidth="4.7"/>}
    {cap&&<path d="M93 49 Q109 39 128 45" fill="none" stroke="#e3c89a" strokeWidth="3.5"/>}
  </g>;
  return null;
}
