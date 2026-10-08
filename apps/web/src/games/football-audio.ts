/* Noise-based stadium crowd and applause. No downloaded or copyrighted audio. */
const MUTE_KEY="jogos:audio-muted";
let audioContext:AudioContext|null=null;

export function playFootballCrowd(goal:boolean):void{
  try{
    if(localStorage.getItem(MUTE_KEY)==="true"||typeof AudioContext==="undefined") return;
    const ctx=audioContext??new AudioContext();
    audioContext=ctx;
    if(ctx.state==="suspended") void ctx.resume().catch(()=>{});
    const duration=goal?2.1:1.35;
    const rate=ctx.sampleRate;
    const buffer=ctx.createBuffer(1,Math.floor(rate*duration),rate);
    const data=buffer.getChannelData(0);
    // Broadband crowd noise; amplitude-envelope avoids sudden blasts.
    for(let i=0;i<data.length;i++){
      const t=i/rate;
      const fadeIn=Math.min(1,t/.22);
      const fadeOut=Math.min(1,(duration-t)/.4);
      const pulse=goal?(0.55+0.28*Math.sin(t*19)+.17*Math.sin(t*11)):0.55+.17*Math.sin(t*8);
      data[i]=(Math.random()*2-1)*fadeIn*fadeOut*pulse;
    }
    const source=ctx.createBufferSource();
    source.buffer=buffer;
    const filter=ctx.createBiquadFilter();
    filter.type=goal?"bandpass":"lowpass";
    filter.frequency.value=goal?850:480;
    filter.Q.value=.55;
    const gain=ctx.createGain();
    gain.gain.value=goal?.17:.12;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    if(goal){
      // Rhythmic, filtered clap accents, layered over the cheering crowd.
      for(let n=0;n<6;n++){
        const clap=ctx.createBufferSource();
        const cl=ctx.createBuffer(1,Math.floor(rate*.06),rate);
        const a=cl.getChannelData(0);
        for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,3);
        clap.buffer=cl;
        const band=ctx.createBiquadFilter();
        band.type="highpass";band.frequency.value=950;
        const volume=ctx.createGain();volume.gain.value=.11;
        clap.connect(band).connect(volume).connect(ctx.destination);
        clap.start(ctx.currentTime+.35+n*.23);
      }
    }
  }catch{
    // Audio is optional: gameplay must work even when audio is blocked.
  }
}
