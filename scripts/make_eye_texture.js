#!/usr/bin/env node
// Tema geçişindeki maddenin dokusu: Yhwach'ın gözleri, kenarları birbirine
// uyan (dikişsiz) kare SVG. css/theme.css'teki ::view-transition-image-pair(root)
// arka planına yapıştırılacak url("...") değerini basar.
//
//   node scripts/make_eye_texture.js [tohum=11] [kare=480]
//
// Dikişsizlik: kenara taşan göz karşı kenarda da çiziliyor; bulut dokusunda
// stitchTiles ve filtre bölgesi tam kare (yoksa her tekrarda dikiş görünür).
function rnd(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function tile(T,seed){
  const R=rnd(seed), eyes=[];
  let tries=0;
  while(eyes.length<26 && tries++<6000){
    const a=8+Math.pow(R(),1.6)*30, e={x:R()*T,y:R()*T,a,b:a*(0.66+R()*0.14),rot:(R()-.5)*70,px:(R()-.5)*0.25,py:(R()-.5)*0.2,pr:0.28+R()*0.12,melt:R()<0.5&&a>14,
      drips:Array.from({length:1+Math.floor(R()*3)},()=>({x:(R()-.5)*1.1,len:0.7+R()*1.6,w:0.12+R()*0.14}))};
    // üst üste binmesin (dikişsiz kontrol: sarmalı mesafe)
    const ok=eyes.every(o=>{let dx=Math.abs(o.x-e.x),dy=Math.abs(o.y-e.y);dx=Math.min(dx,T-dx);dy=Math.min(dy,T-dy);return Math.hypot(dx,dy)>(o.a+e.a)*0.82;});
    if(ok) eyes.push(e);
  }
  const f=n=>n.toFixed(1);
  // Eriyen göz: alt kenarından aşağı süzülen damlalar (döndürülmeden, hep aşağı).
  const drips=(e,x,y)=>e.melt?e.drips.map(d=>{
    const dx=x+d.x*e.a, top=y+e.b*0.35, w=d.w*e.a, L=d.len*e.b;
    return `<path d="M${f(dx-w)} ${f(top)}C${f(dx-w)} ${f(top+L*.6)} ${f(dx-w*.5)} ${f(top+L)} ${f(dx)} ${f(top+L)}C${f(dx+w*.5)} ${f(top+L)} ${f(dx+w)} ${f(top+L*.6)} ${f(dx+w)} ${f(top)}Z" fill="#c9466a" opacity=".85"/>`;
  }).join(''):'';
  const eye=(e,x,y)=>{
    const {a,b}=e, k=1.32;
    const lemon=`M${f(-a)} 0C${f(-a*.55)} ${f(-b*k)} ${f(a*.55)} ${f(-b*k)} ${f(a)} 0C${f(a*.55)} ${f(b*k)} ${f(-a*.55)} ${f(b*k)} ${f(-a)} 0Z`;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(e.rot)})">`+
      `<path d="${lemon}" fill="#e2566f" opacity=".55" filter="url(#g)"/>`+
      `<path d="${lemon}" fill="url(#iris)" stroke="#b83a5a" stroke-width="${f(a*.1)}"/>`+
      `<ellipse cx="${f(a*e.px)}" cy="${f(b*e.py)}" rx="${f(a*e.pr*1.15)}" ry="${f(b*e.pr*1.4)}" fill="#24040c"/>`+
      `</g>`;
  };
  // Kenara taşan göz karşı kenarda da çizilir (dikişsiz). Eriyenler ayrı
  // grupta: daha güçlü, dikey akan bir bozulma alıyorlar.
  let solid='', melted='';
  for(const e of eyes){
    const m=e.a*1.6+(e.melt?e.b*2.4:0);
    for(const dx of [-T,0,T]) for(const dy of [-T,0,T]){
      const x=e.x+dx,y=e.y+dy;
      if(x>-m&&x<T+m&&y>-m&&y<T+m){ if(e.melt) melted+=drips(e,x,y)+eye(e,x,y); else solid+=eye(e,x,y); }
    }
  }
  const body=`<g filter="url(#warp)">${solid}</g><g filter="url(#melt)">${melted}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}">`+
   `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>`+
   `<filter id="w" filterUnits="userSpaceOnUse" x="0" y="0" width="${T}" height="${T}"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.33  0 0 0 0 0.02  0 0 0 0 0.08  0 0 0 1.6 -0.75"/></filter>`+
   `<filter id="warp" filterUnits="userSpaceOnUse" x="0" y="0" width="${T}" height="${T}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" stitchTiles="stitch"/><feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.1"/></filter>`+
   `<filter id="melt" filterUnits="userSpaceOnUse" x="0" y="0" width="${T}" height="${T}"><feTurbulence type="fractalNoise" baseFrequency="0.025 0.07" numOctaves="2" seed="9" stitchTiles="stitch"/><feDisplacementMap in="SourceGraphic" scale="20" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.7"/></filter>`+
   `<radialGradient id="iris" cx=".45" cy=".42" r=".6"><stop offset="0" stop-color="#ff9fae"/><stop offset=".7" stop-color="#ec6f86"/><stop offset="1" stop-color="#d4506d"/></radialGradient></defs>`+
   `<rect width="${T}" height="${T}" filter="url(#w)"/>${body}</svg>`;
}

const seed = +process.argv[2] || 11, T = +process.argv[3] || 480;
process.stdout.write(`url("data:image/svg+xml,${encodeURIComponent(tile(T, seed))}") 0 0 / ${T}px ${T}px\n`);
