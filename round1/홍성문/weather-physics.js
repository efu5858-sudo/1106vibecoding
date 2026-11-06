"use strict";
globalThis.MoodWeatherPhysics=(()=>{
 const CELL=16,MAX_HEIGHT=64,MAX_FLYING=180;
 function create(width,height){return {width,height,levels:new Float32Array(Math.ceil(width/CELL)+1),flying:[]};}
 function grow(s,dt,weather,strength){const rate=({light:1.4,medium:2.6,strong:4.2}[strength]||2.6)*(weather==='rain'?.55:1);for(let i=0;i<s.levels.length;i++)s.levels[i]=Math.min(weather==='rain'?26:MAX_HEIGHT,s.levels[i]+dt*rate*(weather==='rain'?1:.8+Math.sin(i*.65)*.18+Math.sin(i*1.7)*.13));}
 function stir(s,x,y,vx,vy,weather,random=Math.random){for(let i=0;i<s.levels.length;i++){const px=i*CELL,level=s.levels[i],d=Math.hypot(px-x,s.height-level/2-y);if(d>85||level<.4)continue;const removed=Math.min(level,(1-d/85)*9);s.levels[i]-=removed;for(let j=0;j<Math.min(8,Math.ceil(removed))&&s.flying.length<MAX_FLYING;j++)s.flying.push({x:px+(random()-.5)*CELL,y:s.height-level,vx:vx*.35+(random()-.5)*160,vy:-90-random()*150+Math.min(0,vy*.25),size:2+random()*3,angle:random()*7,age:0});}}
 function step(s,dt,weather){s.flying=s.flying.filter(p=>{p.age+=dt;p.vy+=(weather==='rain'?390:210)*dt;p.vx*=Math.exp(-dt*.7);p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=dt*3;if(p.age>4||p.x<0||p.x>s.width)return false;const i=Math.min(s.levels.length-1,Math.floor(p.x/CELL));if(p.vy>0&&p.y>=s.height-s.levels[i]){s.levels[i]=Math.min(weather==='rain'?26:MAX_HEIGHT,s.levels[i]+.7);return false;}return true;});}
 return {CELL,MAX_HEIGHT,MAX_FLYING,create,grow,stir,step};
})();
if(typeof module!=='undefined')module.exports=globalThis.MoodWeatherPhysics;
