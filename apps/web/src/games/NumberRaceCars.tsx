import { useEffect, useState } from "react";

export type CarChoice={modelId:string;color:string};
type CarModel={id:string;name:string;body:string;roof:string;windows:string;spoiler?:string};

export const CAR_MODELS:CarModel[]=[
  {id:"compacto",name:"Compacto",body:"M9 43 Q11 37 21 36 L127 36 Q139 37 141 45 L141 56 L9 56Z",roof:"M40 37 L54 20 Q59 16 71 16 L92 16 Q103 17 113 37Z",windows:"M49 35 L59 22 L75 21 L75 35Z M79 21 L92 21 Q98 21 105 35 L79 35Z"},
  {id:"esportivo",name:"Esportivo",body:"M8 47 L23 39 L52 36 L107 36 L132 40 L143 47 L141 56 L8 56Z",roof:"M46 39 L65 23 Q72 20 91 23 L111 39Z",windows:"M58 36 L69 26 L82 25 L82 36Z M86 25 L93 26 L104 36 L86 36Z",spoiler:"M14 39 L14 29 L9 29"},
  {id:"picape",name:"Picape",body:"M8 38 L8 56 L142 56 L142 34 L93 34 L90 39Z",roof:"M24 39 L29 18 L75 18 L91 39Z",windows:"M32 36 L35 22 L52 22 L52 36Z M56 22 L72 22 L83 36 L56 36Z"},
  {id:"suv",name:"SUV",body:"M7 37 L12 32 L132 32 L143 40 L143 56 L7 56Z",roof:"M24 35 L31 14 Q34 12 47 12 L105 12 Q116 13 124 35Z",windows:"M35 31 L40 17 L64 17 L64 31Z M69 17 L94 17 L94 31 L69 31Z M99 17 L107 18 L117 31 L99 31Z"},
  {id:"conversivel",name:"Conversível",body:"M7 44 L24 36 L98 36 L139 44 L143 54 L7 54Z",roof:"M48 37 Q67 28 87 37Z",windows:"M56 35 L65 27 L84 35Z",spoiler:"M18 36 L18 31 L11 31"},
  {id:"formula",name:"Fórmula",body:"M5 51 L26 47 L48 40 L90 39 L126 47 L145 50 L145 56 L5 56Z",roof:"M56 42 L70 28 L86 28 L96 42Z",windows:"M69 38 L74 31 L84 31 L90 38Z",spoiler:"M9 44 L9 23 L27 23 M126 44 L128 33 L145 33"},
  {id:"classico",name:"Clássico",body:"M8 44 Q8 33 25 33 L123 33 Q143 33 143 46 L143 56 L8 56Z",roof:"M42 36 L50 18 Q55 15 69 15 L98 15 Q109 17 118 36Z",windows:"M49 33 L57 20 L77 20 L77 33Z M81 20 L96 20 L110 33 L81 33Z"},
  {id:"rally",name:"Rally",body:"M9 41 L25 37 L113 37 L139 42 L142 56 L9 56Z",roof:"M39 39 L52 18 L91 18 L115 39Z",windows:"M49 36 L58 22 L78 22 L78 36Z M82 22 L91 22 L104 36 L82 36Z",spoiler:"M16 37 L14 24 L6 24"},
  {id:"van",name:"Van",body:"M8 30 Q8 21 18 20 L112 20 Q128 20 137 35 L143 43 L143 56 L8 56Z",roof:"M10 29 L10 16 L111 16 L129 35 L10 35Z",windows:"M17 21 L40 21 L40 33 L17 33Z M45 21 L66 21 L66 33 L45 33Z M72 21 L92 21 L92 33 L72 33Z M98 21 L110 21 L122 33 L98 33Z"},
  {id:"supercarro",name:"Supercarro",body:"M6 50 L21 40 L54 38 L107 38 L137 45 L145 50 L141 56 L6 56Z",roof:"M49 39 L70 26 L97 26 L112 39Z",windows:"M60 36 L73 28 L84 28 L84 36Z M88 28 L95 28 L105 36 L88 36Z",spoiler:"M14 40 L14 26 L6 26 M130 45 L133 34 L144 34"}
];

export const CAR_COLORS=[
  {name:"Azul",hex:"#2389dc"},{name:"Vermelho",hex:"#e84843"},
  {name:"Verde",hex:"#2ab684"},{name:"Amarelo",hex:"#f0be37"},
  {name:"Roxo",hex:"#9860d6"},{name:"Laranja",hex:"#ed8234"},
  {name:"Preto",hex:"#343e51"},{name:"Branco",hex:"#e5edf2"}
] as const;
export const DEFAULT_CAR_CHOICE:CarChoice={modelId:"esportivo",color:CAR_COLORS[0].hex};
const MODEL_KEY="number-race-selected-model";
const COLOR_KEY="number-race-selected-color";
export const carModelFor=(id:string)=>CAR_MODELS.find(model=>model.id===id)??CAR_MODELS[0]!;

export function useCarChoice(){
  const [choice,setChoice]=useState<CarChoice>(()=>{
    if(typeof window==="undefined") return DEFAULT_CAR_CHOICE;
    try{
      const modelId=window.localStorage.getItem(MODEL_KEY)??DEFAULT_CAR_CHOICE.modelId;
      const color=window.localStorage.getItem(COLOR_KEY)??DEFAULT_CAR_CHOICE.color;
      return {modelId:carModelFor(modelId).id,color:CAR_COLORS.some(c=>c.hex===color)?color:DEFAULT_CAR_CHOICE.color};
    }catch{return DEFAULT_CAR_CHOICE;}
  });
  useEffect(()=>{
    try{
      window.localStorage.setItem(MODEL_KEY,choice.modelId);
      window.localStorage.setItem(COLOR_KEY,choice.color);
    }catch{/* Armazenamento privado/indisponível: mantém seleção durante a sessão. */}
  },[choice]);
  return [choice,setChoice] as const;
}

export function opponentCar(id:string):CarChoice{
  // Aparência estável dos adversários em cada cliente, mesmo após ordenar a classificação.
  let hash=0;
  for(let i=0;i<id.length;i++) hash=(Math.imul(hash,31)+id.charCodeAt(i))|0;
  const index=hash>>>0;
  return {modelId:CAR_MODELS[index%CAR_MODELS.length]!.id,color:CAR_COLORS[(index>>>4)%CAR_COLORS.length]!.hex};
}

export function NumberVehicle({modelId,color}:{modelId:string;color:string}){
  const model=carModelFor(modelId);
  return <svg className="number-vehicle-svg" viewBox="0 0 150 82" role="img" aria-label={"Carro "+model.name} focusable="false">
    <ellipse cx="77" cy="68" rx="68" ry="8" fill="#05111c" opacity=".25"/>
    <path d={model.body} fill={color} stroke="#142637" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d={model.roof} fill={color} stroke="#142637" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d={model.windows} fill="#9ad4e5" stroke="#213c4d" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M17 44 Q71 39 131 44" fill="none" stroke="#fff" strokeWidth="3" opacity=".38" strokeLinecap="round"/>
    <path d="M26 49 H128" stroke="#172839" strokeWidth="2.2" opacity=".45" strokeLinecap="round"/>
    {model.spoiler&&<path d={model.spoiler} fill="none" stroke="#253242" strokeWidth="5" strokeLinejoin="round"/>}
    <path d="M135 44 L142 46 L142 50 L135 49Z" fill="#fff4c0"/>
    <path d="M8 45 L13 44 L13 50 L8 50Z" fill="#e34545"/>
    {[36,115].map(x=><g key={x}>
      <circle cx={x} cy="58" r="13" fill="#17212e" stroke="#111721" strokeWidth="2"/>
      <circle cx={x} cy="58" r="8.5" fill="#aebfc9" stroke="#405363" strokeWidth="2"/>
      <circle cx={x} cy="58" r="3.6" fill="#d7e4e9"/>
      {[0,90].map(deg=><path key={deg} d="M-6 0 H6" transform={`translate(${x} 58) rotate(${deg})`} stroke="#647e8d" strokeWidth="2"/> )}
    </g>)}
  </svg>;
}

export function CarPicker({choice,onChange}:{choice:CarChoice;onChange:(value:CarChoice)=>void}){
  return <section className="number-garage" aria-label="Personalização do carro">
    <div className="number-garage-heading">
      <div><span className="eyebrow">Garagem</span><h2>Escolha seu carro</h2></div>
      <div className="number-garage-preview"><NumberVehicle modelId={choice.modelId} color={choice.color}/><strong>{carModelFor(choice.modelId).name}</strong></div>
    </div>
    <div className="number-model-grid">
      {CAR_MODELS.map(model=><button type="button" key={model.id} className={choice.modelId===model.id?"number-model-option selected":"number-model-option"} aria-pressed={choice.modelId===model.id} onClick={()=>onChange({...choice,modelId:model.id})}>
        <NumberVehicle modelId={model.id} color={choice.color}/><span>{model.name}</span>
      </button>)}
    </div>
    <p className="number-color-label">Cor do carro</p>
    <div className="number-color-grid">
      {CAR_COLORS.map(color=><button type="button" key={color.hex} className={choice.color===color.hex?"number-color-option selected":"number-color-option"} style={{backgroundColor:color.hex}} aria-pressed={choice.color===color.hex} title={color.name} aria-label={"Cor "+color.name} onClick={()=>onChange({...choice,color:color.hex})}>{choice.color===color.hex?"✓":""}</button>)}
    </div>
  </section>;
}
