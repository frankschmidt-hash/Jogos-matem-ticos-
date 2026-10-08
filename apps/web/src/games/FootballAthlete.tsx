type Props={keeper?:boolean;celebrating?:boolean;disappointed?:boolean};
export function FootballAthlete({keeper=false,celebrating=false,disappointed=false}:Props){
  const prefix=keeper?"fm-goalkeeper":"fm-shooter";
  return <svg className={"football-athlete "+(keeper?"keeper-athlete":"striker-athlete")+(celebrating?" celebrating":"")+(disappointed?" disappointed":"")}
    viewBox="0 0 200 300" role="img"
    aria-label={keeper?"Goleiro defendendo o gol":"Jogador de costas pronto para chutar"}>
    <defs>
      <linearGradient id={prefix+"-kit"} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={keeper?"#64717c":"#fff1a0"}/>
        <stop offset=".24" stopColor={keeper?"#364a5d":"#ffe347"}/>
        <stop offset=".64" stopColor={keeper?"#121f30":"#efc118"}/>
        <stop offset="1" stopColor={keeper?"#020a12":"#96710b"}/>
      </linearGradient>
      <linearGradient id={prefix+"-shorts"} x1="0" y1="0" x2=".9" y2="1">
        <stop stopColor={keeper?"#455367":"#5496ea"}/>
        <stop offset=".55" stopColor={keeper?"#1a273c":"#2067c7"}/>
        <stop offset="1" stopColor={keeper?"#08111f":"#08265b"}/>
      </linearGradient>
      <linearGradient id={prefix+"-skin"} x1="0" y1="0" x2="1" y2=".7">
        <stop stopColor="#fbd2a2"/><stop offset=".4" stopColor="#d8915a"/>
        <stop offset=".72" stopColor="#b36a42"/><stop offset="1" stopColor="#79412b"/>
      </linearGradient>
      <linearGradient id={prefix+"-socks"} x1="0" y1="0" x2=".8" y2=".7">
        <stop stopColor="#f8fbff"/><stop offset=".58" stopColor="#e0e6e7"/><stop offset="1" stopColor="#8493a0"/>
      </linearGradient>
      <radialGradient id={prefix+"-hair"} cx=".27" cy=".18" r=".91">
        <stop stopColor="#504032"/><stop offset=".36" stopColor="#302823"/><stop offset="1" stopColor="#0c1117"/>
      </radialGradient>
    </defs>
    <ellipse cx="105" cy="286" rx="73" ry="10" fill="#07190f" opacity=".35"/>
    <g stroke="#192333" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
      <path d={keeper?"M68 174 Q69 197 58 231 L48 271 L71 274 Q91 245 99 196 L102 174Z":"M64 172 Q66 193 59 226 L40 269 L62 280 Q84 254 92 224 L103 185Z"}
        fill={`url(#${prefix}-shorts)`}/>
      <path d={keeper?"M101 176 L116 230 L130 274 L156 268 Q147 235 139 214 L140 168Z":"M107 180 Q127 205 124 237 L146 278 L169 268 Q158 245 152 217 L138 175Z"}
        fill={`url(#${prefix}-shorts)`}/>
      <path d="M45 252 L38 276 Q49 288 68 281 L76 253Z M127 255 L138 280 Q153 288 165 274 L149 250Z"
        fill={`url(#${prefix}-socks)`}/>
      <path d="M38 270 Q14 271 9 287 Q26 295 73 288 L66 277 L45 271Z" fill={keeper?"#c2e9f8":"#ef3734"}/>
      <path d="M140 273 Q157 260 181 278 L188 289 Q165 297 136 286Z" fill={keeper?"#c2e9f8":"#e62e2a"}/>
      <path d="M14 287 Q34 292 69 288 M143 286 Q163 294 182 288" stroke="#ffffff" strokeWidth="2.3" fill="none"/>
      <path d="M53 95 Q33 103 26 126 L7 180 Q8 196 19 200 Q31 196 35 186 L58 139 L67 117Z"
        fill={`url(#${prefix}-kit)`}/>
      <path d="M137 94 Q156 101 166 127 L192 177 Q190 190 179 195 L168 190 L139 143 L128 117Z"
        fill={`url(#${prefix}-kit)`}/>
      <path d="M12 184 Q8 195 13 208 Q22 217 34 202 L29 184Z" fill={keeper?"#f0faff":`url(#${prefix}-skin)`}/>
      <path d="M174 186 Q184 180 191 189 Q198 204 188 216 L172 206Z" fill={keeper?"#f0faff":`url(#${prefix}-skin)`}/>
      <path d="M55 99 Q69 86 93 88 Q122 84 143 101 L146 134 L140 178 Q102 196 56 178 L51 137Z"
        fill={`url(#${prefix}-kit)`}/>
      <path d="M55 171 Q100 188 142 171 L140 210 L105 219 L97 198 L87 217 L56 205Z"
        fill={`url(#${prefix}-shorts)`}/>
      <path d="M87 75 L84 94 Q101 110 113 93 L111 75Z" fill={`url(#${prefix}-skin)`}/>
      <path d="M68 54 Q68 17 98 13 Q128 10 134 47 L128 72 Q118 93 101 96 Q77 92 69 73Z"
        fill={`url(#${prefix}-skin)`}/>
      <path d={keeper?"M67 55 Q60 18 93 9 Q118 4 136 33 L132 55 Q127 32 116 37 Q85 45 69 39Z":"M67 58 Q61 20 84 13 Q105 -2 124 15 Q143 26 134 64 Q116 78 90 76 Q74 73 67 58Z"}
        fill={`url(#${prefix}-hair)`}/>
      <path d="M72 46 Q89 22 113 28 M80 64 Q102 73 127 58" stroke="#9f8264" strokeWidth="2" opacity=".24" fill="none"/>
    </g>
    <g fill="none" strokeLinecap="round">
      <path d="M53 105 Q65 121 62 153 M144 105 Q133 125 139 156 M62 168 Q92 176 134 169"
        stroke={keeper?"#9bb0c3":"#fff3ab"} strokeWidth="2.5" opacity=".55"/>
      <path d="M66 112 Q77 123 78 154 M125 106 Q117 143 126 163 M62 183 Q77 188 88 183"
        stroke="#342b1d" strokeWidth="2.3" opacity=".26"/>
      <path d="M55 210 L70 215 M111 216 L134 210" stroke="#fff" strokeWidth="2" opacity=".35"/>
      <path d="M43 261 L66 264 M134 264 L157 262" stroke={keeper?"#7db2d7":"#138c47"} strokeWidth="5"/>
      <path d="M57 105 Q99 120 142 104" stroke={keeper?"#7192a8":"#148444"} strokeWidth="5"/>
    </g>
    {keeper?<g>
      <path d="M81 56 L88 55 M114 55 L121 57" stroke="#1b2029" strokeWidth="3"/>
      <circle cx="88" cy="59" r="2.8" fill="#131a23"/><circle cx="115" cy="59" r="2.8" fill="#131a23"/>
      <path d="M93 74 Q102 79 110 72" stroke="#74432c" strokeWidth="2" fill="none"/>
      <text x="101" y="166" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="42" fontWeight="900" fill="#f0f7ff">1</text>
      <path d="M9 200 L29 204 M177 204 L191 207" stroke="#6fbdff" strokeWidth="3"/>
    </g>:<g>
      <path d="M77 32 Q103 10 124 33" stroke="#7a6254" strokeWidth="3" fill="none" opacity=".48"/>
      <text x="99" y="165" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="57" fontWeight="900" fill="#157f46" stroke="#086339" strokeWidth="1">10</text>
      <path d="M63 173 Q100 180 136 171" stroke="#0f9146" strokeWidth="4" fill="none"/>
      <path d="M66 111 L59 165 M137 111 L139 165" stroke="#25884e" strokeWidth="4"/>
    </g>}
    {celebrating&&!keeper&&<path d="M182 196 Q173 146 185 103 L190 64" fill="none" stroke="#d88958" strokeWidth="11" strokeLinecap="round"/>}
    {disappointed&&!keeper&&<path d="M21 185 Q28 142 64 72" fill="none" stroke="#d58b5b" strokeWidth="10" strokeLinecap="round"/>}
  </svg>;
}
