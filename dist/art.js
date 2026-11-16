/* Original Canvas pixel artwork for Kaiju City Clash. No external assets. */
(() => {
  'use strict';
  const INK = '#15223c';
  const P = {
    hero: { dark: '#546b87', base: '#afc2cd', light: '#e8f1df', accent: '#ec9260', deep: '#33445e', eye: '#75fff0' },
    dino: { dark: '#23574c', base: '#4d9a69', light: '#a6cd78', accent: '#dbe3a1', deep: '#1a3b3b', eye: '#ffce71' },
    ape: { dark: '#493857', base: '#745477', light: '#a78196', accent: '#cead9d', deep: '#302d45', eye: '#f7d37f' },
    beetle: { dark: '#2a5584', base: '#438ec1', light: '#80cae5', accent: '#eeae6c', deep: '#203c61', eye: '#ffe691' },
    rock: { dark: '#885640', base: '#bd8555', light: '#efbd77', accent: '#ffe0a3', deep: '#5a3f37', eye: '#b8ffe8' },
    slime: { dark: '#513865', base: '#9669aa', light: '#d098cb', accent: '#e1bae0', deep: '#342a53', eye: '#ffdd7c' }
  };
  function r(ctx, color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function poly(ctx, color, pts) {
    ctx.fillStyle = color; ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1])));
    ctx.closePath(); ctx.fill();
  }
  function block(ctx, x, y, w, h, p, bevel=3) {
    poly(ctx, INK, [[x+bevel,y],[x+w-bevel,y],[x+w,y+bevel],[x+w,y+h-bevel],[x+w-bevel,y+h],[x+bevel,y+h],[x,y+h-bevel],[x,y+bevel]]);
    poly(ctx, p.dark, [[x+bevel,y+2],[x+w-bevel,y+2],[x+w-2,y+bevel],[x+w-2,y+h-bevel],[x+w-bevel,y+h-2],[x+bevel,y+h-2],[x+2,y+h-bevel],[x+2,y+bevel]]);
    r(ctx,p.base,x+3,y+3,w-7,h-7);
    r(ctx,p.light,x+bevel+1,y+3,w-bevel*2-3,2);
    r(ctx,p.light,x+3,y+bevel+1,2,h-bevel*2-3);
  }
  function strokeSquares(ctx, color, x1,y1,x2,y2,width) {
    const n = Math.max(1, Math.ceil(Math.hypot(x2-x1,y2-y1)/2));
    for(let i=0;i<=n;i++) r(ctx,color,x1+(x2-x1)*i/n-width/2,y1+(y2-y1)*i/n-width/2,width,width);
  }
  function limb(ctx,a,b,width,p) {
    strokeSquares(ctx,INK,a[0],a[1],b[0],b[1],width+3);
    strokeSquares(ctx,p.dark,a[0],a[1],b[0],b[1],width);
    strokeSquares(ctx,p.base,a[0]-1,a[1]-1,b[0]-1,b[1]-1,Math.max(3,width-3));
    strokeSquares(ctx,p.light,a[0]-2,a[1]-2,b[0]-2,b[1]-2,2);
  }
  function joints(pose, phase, broad=false) {
    const walk = pose==='walk' ? Math.sin(phase*Math.PI*2) : 0;
    const strike = Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI);
    let front = [[12,-45],[20,-33],[20,-24]], back=[[-12,-45],[-19,-36],[-19,-29]];
    let lf=[[-7,-25],[-9-walk*4,-13],[-10-walk*8,-3]], rf=[[8,-25],[10+walk*4,-13],[11+walk*8,-3]];
    if(pose==='punch') front=[[12,-44],[19+10*strike,-40-8*strike],[20+25*strike,-32-15*strike]];
    if(pose==='special') {front=[[12,-44],[21+3*strike,-48],[30+6*strike,-49]];back=[[-12,-45],[8,-47],[19+3*strike,-46]];}
    if(pose==='grab') {front=[[12,-44],[22+4*strike,-39],[25+8*strike,-45]];back=[[-12,-45],[5,-41],[16+6*strike,-45]];}
    if(pose==='kick') {rf=[[8,-25],[14+10*strike,-17-6*strike],[13+27*strike,-4-17*strike]];front=[[12,-44],[22,-48],[24,-55]];}
    if(pose==='victory') {const wave=Math.sin(phase*Math.PI*2)*3;front=[[12,-45],[24,-57],[22+wave,-72]];back=[[-12,-45],[-24,-56],[-22-wave,-71]];}
    if(broad) {front=front.map((v,i)=>[v[0]+(i===0?3:4),v[1]+(i===0?0:2)]);back=back.map((v,i)=>[v[0]-3,v[1]+(i===0?0:3)]);}
    return {front,back,lf,rf};
  }
  function arm(ctx, j, width,p,fist=true) {limb(ctx,j[0],j[1],width,p);limb(ctx,j[1],j[2],width+1,p);if(fist)block(ctx,j[2][0]-width/2-1,j[2][1]-width/2-1,width+3,width+3,p,2);}
  function leg(ctx,j,width,p) {limb(ctx,j[0],j[1],width,p);limb(ctx,j[1],j[2],width+1,p);block(ctx,j[2][0]-width/2-2,j[2][1]-3,width+8,7,p,2);}

  function hero(ctx,p,pose,phase) {
    const j=joints(pose,phase);
    arm(ctx,j.back,6,{...p,base:p.dark,light:p.base});
    leg(ctx,j.lf,8,p);leg(ctx,j.rf,8,p);
    r(ctx,p.accent,j.lf[1][0]-4,j.lf[1][1]-3,7,7);r(ctx,p.accent,j.rf[1][0]-4,j.rf[1][1]-3,7,7);
    block(ctx,-14,-50,28,29,p,4);
    poly(ctx,p.accent,[[-11,-46],[-5,-39],[0,-43],[6,-39],[11,-46],[11,-36],[0,-30],[-11,-36]]);
    r(ctx,p.deep,-8,-28,17,5);r(ctx,p.accent,-3,-28,6,5);
    block(ctx,-4,-40,8,8,{...p,base:p.eye,dark:'#2f928d',light:'#ecfff4'},2);
    block(ctx,-10,-69,21,21,p,5);
    poly(ctx,p.accent,[[-2,-69],[-2,-76],[2,-78],[5,-73],[5,-56],[1,-55]]);
    poly(ctx,p.deep,[[-8,-61],[-2,-60],[0,-57],[-8,-57]]);
    poly(ctx,p.eye,[[-7,-61],[-2,-60],[-1,-58],[-7,-58]]);
    poly(ctx,p.deep,[[3,-60],[9,-62],[9,-57],[3,-57]]);
    poly(ctx,p.eye,[[4,-60],[8,-61],[8,-58],[4,-58]]);
    r(ctx,p.deep,-3,-53,9,2);r(ctx,p.light,6,-66,3,3);
    arm(ctx,j.front,7,p);
    if(pose==='special') {r(ctx,p.eye,35,-53,7,8);r(ctx,'#f4fff0',39,-51,6,4);}
  }
  function dino(ctx,p,pose,phase) {
    const j=joints(pose,phase,true);
    const sway=Math.sin(phase*Math.PI*2)*2;
    poly(ctx,INK,[[-8,-30],[-27,-23],[-40,-13+sway],[-48,-14+sway],[-38,-5],[-19,-9],[2,-18]]);
    poly(ctx,p.dark,[[-7,-27],[-27,-20],[-40,-11+sway],[-44,-12+sway],[-36,-8],[-18,-12],[0,-19]]);
    poly(ctx,p.base,[[-10,-25],[-27,-18],[-34,-12],[-19,-15],[-5,-18]]);
    for(let i=0;i<4;i++)poly(ctx,p.accent,[[-13-i*7,-31+i*5],[-21-i*7,-31+i*5],[-15-i*7,-38+i*6]]);
    arm(ctx,j.back,6,p);leg(ctx,j.lf,11,p);leg(ctx,j.rf,11,p);
    poly(ctx,INK,[[-12,-56],[7,-56],[16,-45],[20,-27],[15,-14],[-13,-14],[-22,-28],[-19,-44]]);
    poly(ctx,p.base,[[-10,-53],[6,-53],[13,-44],[17,-27],[12,-17],[-12,-17],[-19,-29],[-16,-43]]);
    poly(ctx,p.dark,[[-15,-42],[-9,-39],[-8,-18],[-13,-17],[-19,-29]]);
    poly(ctx,p.light,[[-1,-47],[7,-46],[12,-32],[10,-20],[-2,-19],[-6,-28]]);
    for(let i=0;i<3;i++)r(ctx,p.base,-3,-36+i*6,15,2);
    block(ctx,-10,-72,24,23,p,4);block(ctx,5,-65,21,13,p,3);
    r(ctx,p.deep,10,-57,16,4);r(ctx,p.accent,13,-57,3,3);r(ctx,p.accent,21,-57,3,3);
    r(ctx,p.eye,7,-67,6,4);r(ctx,INK,11,-67,2,3);r(ctx,p.deep,20,-63,3,2);
    poly(ctx,p.accent,[[-11,-65],[-18,-66],[-12,-73]]);poly(ctx,p.accent,[[-14,-52],[-23,-55],[-16,-62]]);
    arm(ctx,j.front,7,p);
    for(let i=0;i<3;i++)r(ctx,p.accent,j.front[2][0]+3+i*2,j.front[2][1]-1,2,5);
    for(const foot of [j.lf[2],j.rf[2]]){r(ctx,p.accent,foot[0]+3,foot[1]+1,3,3);r(ctx,p.accent,foot[0]+7,foot[1]+1,3,3);}
  }
  function ape(ctx,p,pose,phase) {
    const j=joints(pose,phase,true);
    j.front[0]=[17,-44];j.back[0]=[-17,-44];
    if(pose==='idle'||pose==='walk'){j.front[1]=[27,-29];j.front[2]=[24,-15];j.back[1]=[-26,-29];j.back[2]=[-24,-15];}
    arm(ctx,j.back,12,{...p,base:p.dark,light:p.base});leg(ctx,j.lf,12,p);leg(ctx,j.rf,12,p);
    poly(ctx,INK,[[-17,-53],[17,-53],[24,-44],[18,-22],[10,-17],[-11,-17],[-20,-23],[-25,-43]]);
    poly(ctx,p.base,[[-15,-50],[15,-50],[21,-42],[15,-25],[9,-20],[-9,-20],[-17,-25],[-22,-42]]);
    poly(ctx,p.dark,[[-12,-42],[9,-44],[13,-34],[6,-24],[-7,-24],[-15,-33]]);
    r(ctx,p.light,-17,-47,8,4);r(ctx,p.light,10,-48,8,3);
    block(ctx,-14,-69,28,24,p,6);
    block(ctx,-10,-62,22,17,{...p,base:p.accent,dark:'#916f79',light:'#e8c8ac'},4);
    r(ctx,p.deep,-9,-61,20,4);r(ctx,p.eye,-7,-59,5,3);r(ctx,p.eye,5,-59,5,3);
    r(ctx,p.deep,-2,-55,6,4);r(ctx,p.deep,-5,-48,13,2);
    r(ctx,p.light,-8,-69,14,3);r(ctx,p.base,-3,-74,8,6);
    arm(ctx,j.front,13,p);
    r(ctx,p.accent,j.front[2][0]-5,j.front[2][1]-2,13,5);
    r(ctx,p.deep,j.front[2][0]-1,j.front[2][1]-2,2,5);r(ctx,p.deep,j.front[2][0]+4,j.front[2][1]-2,2,5);
  }
  function beetle(ctx,p,pose,phase) {
    const j=joints(pose,phase);
    const wing=Math.sin(phase*Math.PI*2)*2;
    poly(ctx,INK,[[-9,-52],[-25,-56+wing],[-29,-30],[-12,-24]]);
    poly(ctx,p.dark,[[-12,-49],[-23,-52+wing],[-26,-32],[-13,-27]]);
    r(ctx,p.light,-23,-45,3,12);
    arm(ctx,j.back,6,p);leg(ctx,j.lf,8,p);leg(ctx,j.rf,8,p);
    block(ctx,-15,-53,30,34,p,6);
    r(ctx,p.deep,-1,-49,3,27);r(ctx,p.light,5,-46,4,18);r(ctx,p.light,-10,-46,4,18);
    poly(ctx,p.accent,[[-12,-32],[-3,-28],[-3,-23],[-12,-27]]);poly(ctx,p.accent,[[3,-28],[12,-32],[12,-27],[3,-23]]);
    block(ctx,-12,-71,25,23,p,5);
    poly(ctx,INK,[[-3,-69],[-6,-82],[-3,-86],[0,-80],[3,-84],[7,-82],[5,-69]]);
    poly(ctx,p.accent,[[-1,-69],[-3,-80],[-1,-78],[3,-81],[4,-80],[3,-70]]);
    poly(ctx,p.deep,[[-10,-64],[-2,-61],[-4,-56],[-10,-58]]);poly(ctx,p.eye,[[-9,-63],[-3,-61],[-5,-58],[-9,-59]]);
    poly(ctx,p.deep,[[3,-61],[10,-64],[10,-58],[5,-56]]);poly(ctx,p.eye,[[4,-61],[9,-63],[9,-59],[6,-58]]);
    r(ctx,p.deep,-4,-53,10,3);r(ctx,p.light,-8,-69,7,2);
    arm(ctx,j.front,7,p);
    const h=j.front[2];poly(ctx,p.accent,[[h[0]+3,h[1]-6],[h[0]+10,h[1]-9],[h[0]+7,h[1]-2],[h[0]+10,h[1]+5],[h[0]+3,h[1]+4]]);
  }
  function rock(ctx,p,pose,phase) {
    const j=joints(pose,phase,true);
    arm(ctx,j.back,12,{...p,base:p.dark,light:p.base});leg(ctx,j.lf,13,p);leg(ctx,j.rf,13,p);
    block(ctx,-22,-53,44,34,p,7);
    poly(ctx,p.dark,[[-16,-48],[-6,-40],[-8,-22],[-18,-25],[-19,-38]]);
    poly(ctx,p.light,[[-4,-48],[13,-48],[18,-43],[9,-40],[-3,-42]]);
    poly(ctx,p.deep,[[-3,-45],[0,-39],[-3,-34],[2,-27],[0,-21],[5,-27],[0,-34],[4,-39],[0,-45]]);
    poly(ctx,p.eye,[[-3,-42],[1,-38],[-1,-35],[-4,-39]]);
    block(ctx,-14,-73,29,26,p,5);
    poly(ctx,p.dark,[[-10,-68],[-4,-64],[-6,-57],[-11,-57]]);
    r(ctx,p.deep,-10,-63,22,5);r(ctx,p.eye,-8,-61,6,3);r(ctx,p.eye,5,-61,6,3);
    r(ctx,p.deep,-4,-53,12,3);r(ctx,p.light,1,-70,10,3);
    arm(ctx,j.front,13,p);
    const h=j.front[2];poly(ctx,p.dark,[[h[0]-4,h[1]-4],[h[0]+3,h[1]-2],[h[0]+1,h[1]+6],[h[0]-2,h[1]+3]]);
    r(ctx,p.eye,h[0],h[1]-4,2,5);
  }
  function slime(ctx,p,pose,phase) {
    const wob=Math.sin(phase*Math.PI*2)*2;
    const j=joints(pose,phase,true);
    arm(ctx,j.back,8,{...p,base:p.dark,light:p.base});
    poly(ctx,INK,[[-12,-65],[4,-69],[16,-59],[15,-46],[22,-30],[20,-13],[29,-7],[27,-1],[11,0],[3,-4],[-6,0],[-24,-1],[-29,-7],[-22,-13],[-23,-29],[-19,-45],[-20,-57]]);
    poly(ctx,p.base,[[-11,-62],[3,-66],[13,-57],[12,-45],[19,-29],[17,-12],[25,-6],[24,-3],[12,-3],[3,-7],[-7,-3],[-23,-4],[-25,-7],[-19,-12],[-20,-28],[-16,-44],[-17,-55]]);
    poly(ctx,p.dark,[[-17,-42],[-10,-29],[-12,-17],[-4,-8],[-8,-3],[-23,-4],[-25,-7],[-19,-12],[-20,-28]]);
    poly(ctx,p.light,[[-8,-59],[0,-62],[6,-58],[3,-54],[-6,-54]]);
    r(ctx,p.light,10,-49,3,11);r(ctx,p.light,12,-32,3,7);r(ctx,p.light,15,-16,4,6);
    r(ctx,p.deep,-12,-51,11,8);r(ctx,p.deep,5,-53,10,8);
    r(ctx,p.eye,-10,-50,7,5);r(ctx,p.eye,7,-52,6,5);r(ctx,INK,-5,-49,2,4);r(ctx,INK,11,-51,2,4);
    poly(ctx,p.deep,[[-7,-40],[2,-36],[11,-40],[9,-31],[-5,-31]]);
    r(ctx,p.accent,-3,-37,3,4);r(ctx,p.accent,6,-37,3,4);
    r(ctx,p.accent,-8,-20+wob,3,3);r(ctx,p.light,4,-28-wob,4,4);
    if(pose==='kick') limb(ctx,[10,-14],[38,-12],12,p);
    arm(ctx,j.front,9,p);
    if(pose==='special'){r(ctx,p.accent,j.front[2][0]+5,j.front[2][1]-5,6,5);r(ctx,p.light,j.front[2][0]+8,j.front[2][1]-2,3,5);}
  }
  const renderers={hero,dino,ape,beetle,rock,slime};
  function drawDown(ctx,kind,p) {
    if(kind==='slime') {
      poly(ctx,INK,[[-32,-4],[-25,-12],[-12,-15],[0,-12],[18,-15],[31,-10],[36,-3],[24,1],[-24,1]]);
      poly(ctx,p.base,[[-29,-4],[-23,-10],[-12,-12],[0,-9],[18,-12],[29,-8],[32,-3],[23,-2],[-23,-2]]);
      r(ctx,p.light,-19,-10,13,2);r(ctx,p.eye,11,-10,5,3);r(ctx,p.eye,22,-9,5,3);
      r(ctx,p.deep,17,-5,8,2);return;
    }
    if(kind==='dino') {
      poly(ctx,INK,[[-16,-17],[-37,-11],[-52,-13],[-43,-3],[-21,-3],[0,-7]]);
      poly(ctx,p.base,[[-16,-14],[-37,-8],[-46,-10],[-42,-6],[-21,-6],[-2,-9]]);
      for(let i=0;i<3;i++)poly(ctx,p.accent,[[-23-i*7,-11],[-29-i*7,-10],[-25-i*7,-17]]);
    }
    block(ctx,-25,-21,43,19,p,5);
    block(ctx,-30,-10,15,10,p,3);block(ctx,-26,-25,13,9,p,3);
    block(ctx,14,-23,23,20,p,4);
    limb(ctx,[-1,-16],[15,-7],8,p);block(ctx,11,-9,12,8,p,2);
    if(kind==='hero') {
      r(ctx,p.accent,-15,-18,18,5);r(ctx,p.eye,-7,-18,5,5);
      poly(ctx,p.accent,[[20,-22],[27,-29],[32,-28],[31,-20]]);
      r(ctx,p.deep,24,-16,10,2);r(ctx,p.eye,26,-17,7,1);
    } else if(kind==='dino') {
      block(ctx,30,-17,19,12,p,3);r(ctx,p.eye,27,-19,6,3);
      r(ctx,p.deep,36,-9,11,2);r(ctx,p.accent,38,-9,3,3);
    } else if(kind==='ape') {
      block(ctx,27,-17,14,13,{...p,base:p.accent,light:'#e4c6ad'},3);
      r(ctx,p.deep,27,-16,10,2);r(ctx,p.deep,33,-10,5,3);
    } else if(kind==='beetle') {
      r(ctx,p.light,-18,-18,23,3);r(ctx,p.deep,-5,-17,2,12);
      poly(ctx,p.accent,[[32,-20],[44,-25],[48,-24],[39,-17]]);r(ctx,p.eye,28,-16,7,3);
    } else {
      r(ctx,p.eye,28,-16,7,3);poly(ctx,p.deep,[[-15,-19],[-6,-13],[-9,-5],[-6,-5],[-3,-14],[-12,-20]]);
    }
  }
  function drawMonster(ctx,kind,x,y,opts={}) {
    const p=P[kind]||P.hero, pose=opts.pose||'idle', phase=Number(opts.phase)||0;
    const scale=Number(opts.scale)||1, facing=opts.facing===-1?-1:1;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale*facing,scale);
    if(opts.shadow!==false) {
      const radius=pose==='down'?32:kind==='ape'||kind==='rock'?26:23;
      poly(ctx,'rgba(6,15,28,.27)',[[-radius,-2],[-radius+9,-7],[radius-8,-7],[radius+4,-1],[radius-4,4],[-radius+7,4]]);
    }
    const colors=opts.hurt?{...p,base:'#ffe6c2',light:'#fff8eb',dark:'#df8f8a',accent:'#fff0ce'}:p;
    if(pose==='down')drawDown(ctx,kind,colors);
    else {
      if(pose==='idle'||pose==='walk') ctx.translate(0,Math.round(Math.sin(phase*Math.PI*2)*(pose==='walk'?1.7:.7)));
      (renderers[kind]||hero)(ctx,colors,pose,phase);
    }
    ctx.restore();
  }

  const architecture=[
    {front:'#49667c',side:'#2c445b',roof:'#7b99a8',rim:'#a1bac1',window:'#a9e0dd',unlit:'#2a4357'},
    {front:'#5b647b',side:'#3b435c',roof:'#8e95ab',rim:'#bec1cc',window:'#f0c58a',unlit:'#394256'},
    {front:'#677f80',side:'#3c565e',roof:'#99b1ad',rim:'#c5cdc0',window:'#c0e3cf',unlit:'#3c595f'},
    {front:'#806c72',side:'#574a60',roof:'#b69a9b',rim:'#ddc5b7',window:'#f4d399',unlit:'#57495b'}
  ];
  const themeArchitecture={
    harbor:[
      {front:'#587580',side:'#334f62',roof:'#9fb8b8',rim:'#d2d9cc',window:'#d9e4b8',unlit:'#34535d'},
      {front:'#807967',side:'#565e5a',roof:'#b4b49b',rim:'#dfd7ba',window:'#b8dfd7',unlit:'#465956'},
      {front:'#5e7a79',side:'#34565a',roof:'#9db8a8',rim:'#cbd7bd',window:'#e9c17f',unlit:'#365354'},
      {front:'#68778d',side:'#38485d',roof:'#a1aec0',rim:'#d1d8dc',window:'#b6dfe4',unlit:'#3c4d63'}
    ],
    neon:[
      {front:'#51466b',side:'#302847',roof:'#827599',rim:'#a99cb9',window:'#db89cb',unlit:'#352d4c'},
      {front:'#395c70',side:'#23384e',roof:'#648b9e',rim:'#8dbcc9',window:'#76ddd4',unlit:'#25394f'},
      {front:'#655172',side:'#3b2e50',roof:'#9a7899',rim:'#c49db6',window:'#e8bc77',unlit:'#3f304f'},
      {front:'#455572',side:'#28314c',roof:'#6d82a6',rim:'#99accb',window:'#91b9f3',unlit:'#2b3655'}
    ]
  };
  function drawBuilding(ctx,b) {
    const x=Math.round(b.x||0),y=Math.round(b.y||0),w=Math.max(14,Math.round(b.w||32)),h=Math.max(12,Math.round(b.h||45));
    const d=Math.max(5,Math.round(b.depth||9)),v=Math.abs(Math.floor(b.variant||0)),health=Math.max(0,Math.min(1,b.health===undefined?1:b.health));
    const palettes=themeArchitecture[b.theme]||architecture;
    const p=palettes[v%palettes.length],left=-Math.floor(w/2),right=left+w;
    ctx.save();ctx.translate(x,y);ctx.imageSmoothingEnabled=false;
    if(health<=0) {
      poly(ctx,'#293841',[[left-3,0],[left+d,-d-4],[right+d+4,-d],[right+6,3],[left+2,5]]);
      for(let i=0;i<11;i++) {
        const a=left+((i*13+v*7)%(w+6)),by=-((i*7+v)%(d+7));
        r(ctx,i%3===0?p.roof:p.side,a,by,5+i%5,3+i%3);
        if(i%3===1)r(ctx,p.rim,a,by,4,1);
      }
      r(ctx,'#6e5346',left+8,-2,6,3);
      ctx.restore();return;
    }
    poly(ctx,'rgba(10,22,34,.24)',[[left,1],[right,2],[right+d+17,-d-6],[left+d+14,-d-9]]);
    poly(ctx,INK,[[left-1,1],[left-1,-h],[left+d,-h-d-1],[right+d+1,-h-d-1],[right+d+1,-d],[right,1]]);
    poly(ctx,p.side,[[right,-h],[right+d,-h-d],[right+d,-d],[right,0]]);
    r(ctx,p.front,left,-h,w,h);
    poly(ctx,p.roof,[[left,-h],[left+d,-h-d],[right+d,-h-d],[right,-h]]);
    r(ctx,p.rim,left,-h,w,2);r(ctx,p.side,left,0,w,2);
    poly(ctx,p.rim,[[left+2,-h],[left+d,-h-d+2],[right+d-2,-h-d+2],[right,-h+1]]);
    poly(ctx,p.roof,[[left+5,-h-2],[left+d+1,-h-d+4],[right+d-6,-h-d+4],[right-5,-h-2]]);
    if(w>26&&h>32){
      r(ctx,p.side,left+8,-h-d+2,10,5);
      r(ctx,p.front,left+8,-h-d+2,10,2);
      r(ctx,p.rim,left+9,-h-d+2,7,1);
    }
    const cols=Math.max(2,Math.floor((w-7)/7)),rows=Math.floor((h-8)/8);
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const hash=(row*23+col*17+v*11)%13;
      const damaged=health<.62&&hash<Math.floor((1-health)*9);
      r(ctx,damaged?'#252d3d':hash<8?p.window:p.unlit,left+4+col*7,-h+6+row*8,4,4);
      if(!damaged&&hash<8)r(ctx,'rgba(233,245,227,.35)',left+4+col*7,-h+6+row*8,2,1);
    }
    for(let row=0;row<rows;row++)r(ctx,(row+v)%3===0?p.window:p.unlit,right+3,-h+4+row*8,3,4);
    if(h>20){r(ctx,p.unlit,left+Math.floor(w/2)-3,-7,7,7);r(ctx,p.rim,left+Math.floor(w/2)-3,-7,7,1);}
    if(v%3===0&&h>35){
      r(ctx,INK,left-3,-h+10,9,22);r(ctx,b.theme==='neon'?'#b25aa3':'#d97866',left-2,-h+11,7,20);
      r(ctx,'#ffe3b5',left,-h+14,3,3);r(ctx,'#ffe3b5',left,-h+20,3,3);r(ctx,'#ffe3b5',left,-h+26,3,2);
    }
    if(v%4===2&&h>50){r(ctx,p.side,right-8,-h-d-11,2,12);r(ctx,p.rim,right-12,-h-d-7,10,1);r(ctx,'#ef9f70',right-8,-h-d-12,2,2);}
    if(health<.7) {
      const crackx=left+Math.floor(w*.6);
      poly(ctx,'#293446',[[crackx,-h+4],[crackx-3,-h+14],[crackx+2,-h+20],[crackx-3,-h+30],[crackx-1,-h+32],[crackx+5,-h+20],[crackx,-h+13],[crackx+2,-h+5]]);
      if(health<.3){r(ctx,'#2d3039',left+4,-Math.floor(h*.45),10,9);r(ctx,'#ed945a',left+5,-Math.floor(h*.45)+6,6,3);}
    }
    ctx.restore();
  }
  window.KaijuArt={drawMonster,drawBuilding};
})();
