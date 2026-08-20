const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const WORLD_RADIUS = 24;
const MIN_Y = -2;
const MAX_Y = 14;
const VALID_BLOCKS = new Set(['grass','dirt','stone','wood','leaves','sand','plank']);

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 2e6,
  cors: { origin: true, credentials: true }
});
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (_req,res) => res.json({ ok:true, players:io.engine.clientsCount }));
app.get('/index.html', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function blockKey(x,y,z){ return `${x},${y},${z}`; }
function heightAt(x,z){
  const n = Math.sin(x*0.38)*1.2 + Math.cos(z*0.31)*1.1 + Math.sin((x+z)*0.18)*0.8;
  return Math.floor(2+n);
}
function seeded01(x,z,salt=0){
  let n = Math.imul(x + salt*1013, 374761393) + Math.imul(z - salt*977, 668265263);
  n = (n ^ (n >>> 13));
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function generateWorld(){
  const map = new Map();
  const set = (x,y,z,t) => {
    if (y < MIN_Y || y > MAX_Y) return;
    const k=blockKey(x,y,z);
    if(!map.has(k)) map.set(k,t);
  };
  for(let x=-WORLD_RADIUS;x<=WORLD_RADIUS;x++){
    for(let z=-WORLD_RADIUS;z<=WORLD_RADIUS;z++){
      const h=heightAt(x,z);
      for(let y=MIN_Y;y<=h;y++){
        const type = y===h ? (h<=1?'sand':'grass') : (y>=h-2?'dirt':'stone');
        set(x,y,z,type);
      }
      if(seeded01(x,z,9)<0.024 && h>1 && Math.abs(x)>3 && Math.abs(z)>3){
        const trunk=3+(seeded01(x,z,11)>.5?1:0);
        for(let y=h+1;y<=h+trunk;y++) set(x,y,z,'wood');
        for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) for(let dy=trunk-1;dy<=trunk+1;dy++){
          if(Math.abs(dx)+Math.abs(dz)<4) set(x+dx,h+dy,z+dz,'leaves');
        }
      }
    }
  }
  return map;
}

let blocks;
let savedPlayers = {};
let gameTime = 0.15;
let chatHistory = [];

function loadWorld(){
  try{
    if(fs.existsSync(WORLD_FILE)){
      const data=JSON.parse(fs.readFileSync(WORLD_FILE,'utf8'));
      blocks=new Map(data.blocks || []);
      savedPlayers=data.players || {};
      gameTime=Number.isFinite(data.gameTime)?data.gameTime:0.15;
      console.log(`Loaded ${blocks.size} blocks from ${WORLD_FILE}`);
      return;
    }
  }catch(err){
    console.error('Could not load world; generating a new one:',err);
  }
  blocks=generateWorld();
  saveWorldNow();
  console.log(`Generated new world with ${blocks.size} blocks`);
}

let saveTimer=null;
function saveWorldSoon(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveWorldNow,500);
}
function saveWorldNow(){
  const tmp=WORLD_FILE+'.tmp';
  const payload=JSON.stringify({
    version:1,
    blocks:[...blocks.entries()],
    players:savedPlayers,
    gameTime
  });
  fs.writeFileSync(tmp,payload);
  fs.renameSync(tmp,WORLD_FILE);
}
loadWorld();

const activeUsers = new Map(); // lowercase username -> socket id
function cleanUsername(v){
  return String(v||'').trim().replace(/[^A-Za-z0-9_\- ]/g,'').slice(0,20);
}
function cleanChat(v){
  return String(v||'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,140);
}
function validCoord(n){ return Number.isInteger(n) && n>=-64 && n<=64; }
function validY(n){ return Number.isInteger(n) && n>=MIN_Y && n<=MAX_Y; }
function safePlayerState(state){
  if(!state || typeof state!=='object') return null;
  const pos=Array.isArray(state.pos)?state.pos.map(Number):[];
  if(pos.length!==3 || pos.some(n=>!Number.isFinite(n))) return null;
  const bounded=[
    Math.max(-60,Math.min(60,pos[0])),
    Math.max(-8,Math.min(30,pos[1])),
    Math.max(-60,Math.min(60,pos[2]))
  ];
  const inv={};
  for(const k of ['grass','dirt','stone','wood','plank','sand','apple']){
    inv[k]=Math.max(0,Math.min(9999,Math.floor(Number(state.inventory?.[k])||0)));
  }
  return {
    pos:bounded,
    yaw:Number.isFinite(Number(state.yaw))?Number(state.yaw):0,
    health:Math.max(0,Math.min(20,Number(state.health)||20)),
    hunger:Math.max(0,Math.min(20,Number(state.hunger)||20)),
    inventory:inv,
    selectedSlot:Math.max(0,Math.min(5,Math.floor(Number(state.selectedSlot)||0))),
    updatedAt:Date.now()
  };
}

io.use((socket,next)=>{
  const username=cleanUsername(socket.handshake.auth?.username);
  if(username.length<2) return next(new Error('Username must be 2-20 characters.'));
  const lower=username.toLowerCase();
  if(activeUsers.has(lower)) return next(new Error('That username is already online.'));
  socket.data.username=username;
  socket.data.lower=lower;
  next();
});

io.on('connection',socket=>{
  const username=socket.data.username;
  activeUsers.set(socket.data.lower,socket.id);

  const defaultState={
    pos:[0,heightAt(0,0)+2.2,0], yaw:0, health:20, hunger:20,
    inventory:{grass:20,dirt:30,stone:20,wood:6,plank:0,sand:10,apple:3}, selectedSlot:0
  };
  const ownState={...defaultState,...(savedPlayers[username]||{})};

  const online=[];
  for(const s of io.sockets.sockets.values()){
    if(s.id===socket.id) continue;
    const name=s.data.username;
    if(!name) continue;
    online.push({ id:s.id, username:name, state:s.data.state || savedPlayers[name] || defaultState });
  }

  socket.emit('world:init',{
    selfId:socket.id,
    username,
    blocks:[...blocks.entries()],
    state:ownState,
    players:online,
    chatHistory:chatHistory.slice(-30),
    gameTime
  });
  socket.data.state=ownState;
  socket.broadcast.emit('player:join',{id:socket.id,username,state:ownState});
  io.emit('system:message',`${username} joined the world`);

  socket.on('player:state',raw=>{
    const state=safePlayerState(raw);
    if(!state) return;
    socket.data.state=state;
    savedPlayers[username]=state;
    socket.broadcast.volatile.emit('player:state',{id:socket.id,state});
  });

  socket.on('block:break',data=>{
    const x=Number(data?.x),y=Number(data?.y),z=Number(data?.z);
    if(!validCoord(x)||!validCoord(z)||!validY(y)||y<=MIN_Y) return;
    const k=blockKey(x,y,z);
    const type=blocks.get(k);
    if(!type) return;
    blocks.delete(k);
    io.emit('block:broken',{x,y,z,type,by:username});
    saveWorldSoon();
  });

  socket.on('block:place',data=>{
    const x=Number(data?.x),y=Number(data?.y),z=Number(data?.z),type=String(data?.type||'');
    if(!validCoord(x)||!validCoord(z)||!validY(y)||!VALID_BLOCKS.has(type)) return;
    const k=blockKey(x,y,z);
    if(blocks.has(k)) return;
    blocks.set(k,type);
    io.emit('block:placed',{x,y,z,type,by:username});
    saveWorldSoon();
  });

  socket.on('chat:send',raw=>{
    const text=cleanChat(raw);
    if(!text) return;
    const msg={id:`${Date.now()}-${socket.id}`,username,text,time:Date.now(),playerId:socket.id};
    chatHistory.push(msg);
    if(chatHistory.length>50) chatHistory.shift();
    io.emit('chat:message',msg);
  });

  socket.on('disconnect',()=>{
    activeUsers.delete(socket.data.lower);
    if(socket.data.state) savedPlayers[username]=socket.data.state;
    saveWorldSoon();
    socket.broadcast.emit('player:leave',{id:socket.id,username});
    socket.broadcast.emit('system:message',`${username} left the world`);
  });
});

setInterval(()=>{
  gameTime=(gameTime+0.0025)%1;
},1000);
setInterval(()=>{ try{ saveWorldNow(); }catch(e){ console.error('Periodic save failed:',e); } },10000);

function shutdown(){
  try{ saveWorldNow(); }catch(e){ console.error(e); }
  process.exit(0);
}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);

server.listen(PORT,()=>console.log(`Blockcraft multiplayer listening on port ${PORT}`));
