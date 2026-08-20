const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const WORLD_RADIUS = 42;
const MIN_Y = -8;
const MAX_Y = 24;
const VALID_BLOCKS = new Set([
  'grass','dirt','stone','sand','wood','leaves','plank','cobble','coal_ore','iron_ore',
  'snow','glass','crafting_table','furnace','chest','torch'
]);

fs.mkdirSync(DATA_DIR, { recursive: true });
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 6e6, cors: { origin: true, credentials: true } });
for (const file of ['index.html','style.css','client.js']) {
  app.get('/' + (file === 'index.html' ? '' : file), (_req,res) => res.sendFile(path.join(__dirname,file)));
}
app.get('/index.html', (_req,res) => res.sendFile(path.join(__dirname,'index.html')));
app.get('/health', (_req,res) => res.json({ok:true,players:io.engine.clientsCount,blocks:blocks?.size||0}));

function key(x,y,z){ return `${x},${y},${z}`; }
function hash2(x,z,s=0){
  let n=Math.imul(x+s*1013,374761393)+Math.imul(z-s*977,668265263);
  n=(n^(n>>>13)); n=Math.imul(n,1274126177); return ((n^(n>>>16))>>>0)/4294967296;
}
function hash3(x,y,z,s=0){ return hash2(x + Math.imul(y,31), z + Math.imul(y,17), s); }
function biomeAt(x,z){
  const v=Math.sin(x*.055)+Math.cos(z*.047)+Math.sin((x-z)*.026);
  if(v<-1.15) return 'desert';
  if(v>1.35) return 'snow';
  if(hash2(Math.floor(x/7),Math.floor(z/7),72)>.62) return 'forest';
  return 'plains';
}
function heightAt(x,z){
  const broad=Math.sin(x*.075)*2.2+Math.cos(z*.066)*2.0+Math.sin((x+z)*.035)*1.5;
  const detail=Math.sin(x*.29)*.65+Math.cos(z*.27)*.55;
  return Math.floor(3+broad+detail);
}
function generateWorld(){
  const map=new Map();
  const set=(x,y,z,t)=>{ if(y>=MIN_Y&&y<=MAX_Y&&!map.has(key(x,y,z))) map.set(key(x,y,z),t); };
  for(let x=-WORLD_RADIUS;x<=WORLD_RADIUS;x++){
    for(let z=-WORLD_RADIUS;z<=WORLD_RADIUS;z++){
      const biome=biomeAt(x,z), h=heightAt(x,z);
      for(let y=MIN_Y;y<=h;y++){
        // Sparse cave pockets below the upper soil layer.
        const cave=y<h-3 && y>-7 && hash3(Math.floor(x/2),Math.floor(y/2),Math.floor(z/2),54)>.92;
        if(cave) continue;
        let type='stone';
        if(y===h) type=biome==='desert'?'sand':biome==='snow'?'snow':'grass';
        else if(y>=h-2) type=biome==='desert'?'sand':'dirt';
        else {
          const ore=hash3(x,y,z,91);
          if(y<1&&ore>.975) type='iron_ore';
          else if(y<4&&ore>.94) type='coal_ore';
        }
        set(x,y,z,type);
      }
      const treeChance=biome==='forest'?.075:biome==='plains'?.022:biome==='snow'?.018:0;
      if(hash2(x,z,9)<treeChance && h>1 && Math.abs(x)>4 && Math.abs(z)>4){
        const trunk=3+(hash2(x,z,11)>.55?1:0);
        for(let y=h+1;y<=h+trunk;y++) set(x,y,z,'wood');
        for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) for(let dy=trunk-1;dy<=trunk+1;dy++){
          if(Math.abs(dx)+Math.abs(dz)<4 && !(dx===0&&dz===0&&dy<=trunk)) set(x+dx,h+dy,z+dz,'leaves');
        }
      }
    }
  }
  return map;
}

let blocks, players={}, containers={}, gameTime=.20, chatHistory=[];
function defaultPlayer(){ return {
  pos:[0,heightAt(0,0)+2.7,0], yaw:0, health:20, hunger:20, selectedSlot:0,
  inventory:{dirt:16,cobble:0,wood:0,plank:0,stone:0,sand:0,coal:0,iron_ore:0,iron_ingot:0,apple:3,
    wooden_pickaxe:1,wooden_axe:0,wooden_sword:0,stone_pickaxe:0,stone_axe:0,stone_sword:0,iron_pickaxe:0,
    crafting_table:0,furnace:0,chest:0,torch:0,glass:0},
  durability:{wooden_pickaxe:60,wooden_axe:60,wooden_sword:60,stone_pickaxe:132,stone_axe:132,stone_sword:132,iron_pickaxe:251},
  updatedAt:Date.now()
};}
function loadWorld(){
  try{
    if(fs.existsSync(WORLD_FILE)){
      const d=JSON.parse(fs.readFileSync(WORLD_FILE,'utf8'));
      blocks=new Map(d.blocks||[]); players=d.players||{}; containers=d.containers||{};
      gameTime=Number.isFinite(d.gameTime)?d.gameTime:.20;
      console.log(`Loaded world: ${blocks.size} blocks`); return;
    }
  }catch(e){ console.error('World load failed:',e); }
  blocks=generateWorld(); saveNow(); console.log(`Generated world: ${blocks.size} blocks`);
}
let saveQueued=false;
function saveNow(){
  if(!blocks) return;
  saveQueued=false;
  const tmp=WORLD_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({version:2,blocks:[...blocks],players,containers,gameTime}));
  fs.renameSync(tmp,WORLD_FILE);
}
function saveSoon(){ if(saveQueued)return; saveQueued=true; setTimeout(saveNow,700); }
loadWorld();
setInterval(saveNow,15000);
process.on('SIGTERM',()=>{ try{saveNow();}finally{process.exit(0);} });
process.on('SIGINT',()=>{ try{saveNow();}finally{process.exit(0);} });

const active=new Map();
function cleanName(v){ return String(v||'').trim().replace(/[^A-Za-z0-9_\- ]/g,'').slice(0,20); }
function cleanChat(v){ return String(v||'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,140); }
function safeNum(v,a,b,d=0){ v=Number(v); return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d; }
function safeState(s){
  if(!s||!Array.isArray(s.pos)||s.pos.length!==3) return null;
  const base=defaultPlayer(), inv={}, dur={};
  for(const [k,v] of Object.entries(s.inventory||{})) if(/^[a-z0-9_]+$/.test(k)) inv[k]=Math.max(0,Math.min(9999,Math.floor(Number(v)||0)));
  for(const [k,v] of Object.entries(s.durability||{})) if(/^[a-z0-9_]+$/.test(k)) dur[k]=Math.max(0,Math.min(10000,Math.floor(Number(v)||0)));
  return {
    pos:[safeNum(s.pos[0],-80,80),safeNum(s.pos[1],-15,40,8),safeNum(s.pos[2],-80,80)],
    yaw:safeNum(s.yaw,-1000,1000),health:safeNum(s.health,0,20,20),hunger:safeNum(s.hunger,0,20,20),
    selectedSlot:Math.floor(safeNum(s.selectedSlot,0,8,0)), inventory:{...base.inventory,...inv}, durability:{...base.durability,...dur}, updatedAt:Date.now()
  };
}
function playerNearBlock(state,x,y,z,dist=7){
  if(!state?.pos)return false; const dx=state.pos[0]-x,dy=state.pos[1]-y,dz=state.pos[2]-z; return dx*dx+dy*dy+dz*dz<=dist*dist;
}

io.use((socket,next)=>{
  const username=cleanName(socket.handshake.auth?.username); if(username.length<2)return next(new Error('Username must be 2-20 characters.'));
  const lower=username.toLowerCase(); if(active.has(lower))return next(new Error('That username is already online.'));
  socket.data.username=username;socket.data.lower=lower;next();
});
io.on('connection',socket=>{
  const username=socket.data.username; active.set(socket.data.lower,socket.id);
  const state={...defaultPlayer(),...(players[username]||{})}; socket.data.state=state;
  const online=[]; for(const s of io.sockets.sockets.values()) if(s.id!==socket.id&&s.data.username) online.push({id:s.id,username:s.data.username,state:s.data.state||defaultPlayer()});
  socket.emit('world:init',{selfId:socket.id,username,blocks:[...blocks],state,players:online,chatHistory:chatHistory.slice(-40),gameTime,worldRadius:WORLD_RADIUS});
  socket.broadcast.emit('player:join',{id:socket.id,username,state}); io.emit('system:message',`${username} joined the world`);

  socket.on('player:state',raw=>{const s=safeState(raw);if(!s)return;socket.data.state=s;players[username]=s;socket.broadcast.volatile.emit('player:state',{id:socket.id,state:s});});
  socket.on('block:break',d=>{
    const x=Math.round(Number(d?.x)),y=Math.round(Number(d?.y)),z=Math.round(Number(d?.z));
    if(Math.abs(x)>WORLD_RADIUS+6||Math.abs(z)>WORLD_RADIUS+6||y<=MIN_Y||y>MAX_Y||!playerNearBlock(socket.data.state,x,y,z))return;
    const k=key(x,y,z),type=blocks.get(k);if(!type)return;blocks.delete(k);delete containers[k];io.emit('block:broken',{x,y,z,type,by:username});saveSoon();
  });
  socket.on('block:place',d=>{
    const x=Math.round(Number(d?.x)),y=Math.round(Number(d?.y)),z=Math.round(Number(d?.z)),type=String(d?.type||'');
    if(Math.abs(x)>WORLD_RADIUS+6||Math.abs(z)>WORLD_RADIUS+6||y<MIN_Y||y>MAX_Y||!VALID_BLOCKS.has(type)||!playerNearBlock(socket.data.state,x,y,z)||blocks.has(key(x,y,z)))return;
    blocks.set(key(x,y,z),type);if(type==='chest')containers[key(x,y,z)]={type:'chest',items:{}};if(type==='furnace')containers[key(x,y,z)]={type:'furnace',input:null,fuel:0,output:null};io.emit('block:placed',{x,y,z,type,by:username});saveSoon();
  });
  socket.on('chat:send',raw=>{const text=cleanChat(raw);if(!text)return;const m={username,text,time:Date.now(),playerId:socket.id};chatHistory.push(m);if(chatHistory.length>60)chatHistory.shift();io.emit('chat:message',m);});
  socket.on('craft',d=>{ /* inventory is client-managed for responsiveness; authoritative recipes can be moved here later */ });
  socket.on('disconnect',()=>{active.delete(socket.data.lower);if(socket.data.state)players[username]=socket.data.state;socket.broadcast.emit('player:leave',{id:socket.id,username});io.emit('system:message',`${username} left the world`);saveSoon();});
});

setInterval(()=>{ gameTime=(gameTime+.0007)%1; io.emit('time:sync',gameTime); },5000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Blockcraft listening on ${PORT}; data=${WORLD_FILE}`));
