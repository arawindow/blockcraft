import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.module.js';

const socket=io({autoConnect:false});
const defs={
 grass:{c:'#5d9b46',hard:.7,drop:'dirt',tool:null}, dirt:{c:'#795238',hard:.55,drop:'dirt'}, stone:{c:'#777b7d',hard:2.2,drop:'cobble',tool:'pickaxe'}, cobble:{c:'#666a6b',hard:2.0,drop:'cobble',tool:'pickaxe'},
 sand:{c:'#d8c47e',hard:.5,drop:'sand'}, wood:{c:'#8c5d32',hard:1.6,drop:'wood',tool:'axe'}, leaves:{c:'#3f7f3b',hard:.25,drop:'leaves'}, plank:{c:'#b77c43',hard:1.2,drop:'plank',tool:'axe'},
 coal_ore:{c:'#505456',hard:2.4,drop:'coal',tool:'pickaxe',tier:1},iron_ore:{c:'#8a7a6c',hard:2.8,drop:'iron_ore',tool:'pickaxe',tier:2},snow:{c:'#eef5f6',hard:.3,drop:'snow'},glass:{c:'#b8e4ed',hard:.35,drop:'glass',alpha:.52},
 crafting_table:{c:'#9a6b3d',hard:1.5,drop:'crafting_table',tool:'axe'},furnace:{c:'#565b5d',hard:2.3,drop:'furnace',tool:'pickaxe'},chest:{c:'#b77a28',hard:1.4,drop:'chest',tool:'axe'},torch:{c:'#f3c54b',hard:.05,drop:'torch',emissive:true}
};
const itemNames={wooden_pickaxe:'Wood Pickaxe',wooden_axe:'Wood Axe',wooden_sword:'Wood Sword',stone_pickaxe:'Stone Pickaxe',stone_axe:'Stone Axe',stone_sword:'Stone Sword',iron_pickaxe:'Iron Pickaxe',iron_ingot:'Iron Ingot',coal:'Coal',apple:'Apple'};
const recipes=[
 {name:'4 Planks',need:{wood:1},give:{plank:4}},
 {name:'Crafting Table',need:{plank:4},give:{crafting_table:1}},
 {name:'Wood Pickaxe',need:{plank:3,wood:2},give:{wooden_pickaxe:1},dur:{wooden_pickaxe:60}},
 {name:'Wood Axe',need:{plank:3,wood:2},give:{wooden_axe:1},dur:{wooden_axe:60}},
 {name:'Wood Sword',need:{plank:2,wood:1},give:{wooden_sword:1},dur:{wooden_sword:60}},
 {name:'Stone Pickaxe',need:{cobble:3,wood:2},give:{stone_pickaxe:1},dur:{stone_pickaxe:132}},
 {name:'Stone Axe',need:{cobble:3,wood:2},give:{stone_axe:1},dur:{stone_axe:132}},
 {name:'Stone Sword',need:{cobble:2,wood:1},give:{stone_sword:1},dur:{stone_sword:132}},
 {name:'Furnace',need:{cobble:8},give:{furnace:1}},
 {name:'Chest',need:{plank:8},give:{chest:1}},
 {name:'4 Torches',need:{coal:1,wood:1},give:{torch:4}},
 {name:'Glass',need:{sand:1,coal:1},give:{glass:1}},
 {name:'Iron Pickaxe',need:{iron_ingot:3,wood:2},give:{iron_pickaxe:1},dur:{iron_pickaxe:251}},
 {name:'Smelt Iron',need:{iron_ore:1,coal:1},give:{iron_ingot:1}}
];
const hotbarDefault=['wooden_pickaxe','dirt','cobble','wood','plank','torch','crafting_table','furnace','chest'];

let inventory={},durability={},hotbar=[...hotbarDefault],selectedSlot=0,health=20,hunger=20,myUsername='',joined=false,chatting=false,inventoryOpen=false,gameTime=.2;
const blocks=new Map(),blockMeshes=new Map(),otherPlayers=new Map(),keys={};
const k=(x,y,z)=>`${x},${y},${z}`;

const scene=new THREE.Scene();scene.background=new THREE.Color(0x87ceeb);scene.fog=new THREE.Fog(0x87ceeb,28,72);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,160);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xffffff,0x4e5c46,1.65);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(20,35,12);sun.castShadow=true;scene.add(sun);
const cubeGeo=new THREE.BoxGeometry(1,1,1);

function seeded(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function textureFor(type){
 const d=defs[type]||{c:'#888'};const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle=d.c;x.fillRect(0,0,32,32);const r=seeded([...type].reduce((a,ch)=>a+ch.charCodeAt(0)*31,77));
 for(let i=0;i<105;i++){const xx=Math.floor(r()*32),yy=Math.floor(r()*32),v=r()>.5?'255,255,255':'0,0,0';x.fillStyle=`rgba(${v},${.035+r()*.08})`;x.fillRect(xx,yy,1+r()*3,1+r()*3)}
 if(type==='grass'){x.fillStyle='rgba(30,70,20,.28)';for(let i=0;i<20;i++)x.fillRect(r()*32,r()*8,2,5)}
 if(type==='wood'){x.strokeStyle='rgba(50,25,10,.35)';for(let i=0;i<7;i++){x.beginPath();x.moveTo(i*5,0);x.lineTo(i*5+r()*2,32);x.stroke()}}
 if(type.includes('ore')){x.fillStyle=type==='coal_ore'?'#27292a':'#c18a68';for(let i=0;i<10;i++)x.fillRect(r()*28,r()*28,3+r()*3,3+r()*3)}
 if(type==='crafting_table'){x.strokeStyle='#3a2415';x.lineWidth=2;for(let i=0;i<32;i+=8){x.strokeRect(i,0,8,32);x.strokeRect(0,i,32,8)}}
 if(type==='furnace'){x.fillStyle='#252728';x.fillRect(6,14,20,12);x.fillStyle='#d27b28';x.fillRect(10,18,12,5)}
 if(type==='chest'){x.fillStyle='#5f3b16';x.fillRect(0,14,32,3);x.fillStyle='#d8b14c';x.fillRect(14,13,4,6)}
 const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;return tex;
}
const materials={};for(const type of Object.keys(defs)){const d=defs[type];materials[type]=new THREE.MeshStandardMaterial({map:textureFor(type),transparent:!!d.alpha,opacity:d.alpha||1,roughness:1,emissive:d.emissive?0x6b4b00:0,emissiveIntensity:d.emissive?1.5:0});}
function addBlock(x,y,z,type){const key=k(x,y,z);if(blocks.has(key))return;blocks.set(key,type);const m=new THREE.Mesh(cubeGeo,materials[type]||materials.stone);m.position.set(x,y,z);m.userData={x,y,z,type};m.castShadow=type!=='glass';m.receiveShadow=true;scene.add(m);blockMeshes.set(key,m)}
function removeBlock(x,y,z){const key=k(x,y,z),type=blocks.get(key);if(!type)return null;blocks.delete(key);const m=blockMeshes.get(key);if(m)scene.remove(m);blockMeshes.delete(key);return type}
function loadBlocks(arr){for(const m of blockMeshes.values())scene.remove(m);blocks.clear();blockMeshes.clear();for(const [key,type] of arr){blocks.set(key,type)}for(const [key,type] of blocks){const [x,y,z]=key.split(',').map(Number);const exp=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([dx,dy,dz])=>!blocks.has(k(x+dx,y+dy,z+dz)));if(exp)addBlockVisible(x,y,z,type)}}
function addBlockVisible(x,y,z,type){const key=k(x,y,z);const m=new THREE.Mesh(cubeGeo,materials[type]||materials.stone);m.position.set(x,y,z);m.userData={x,y,z,type};m.castShadow=type!=='glass';m.receiveShadow=true;scene.add(m);blockMeshes.set(key,m)}
function refreshNeighbors(x,y,z){for(const [dx,dy,dz] of [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const xx=x+dx,yy=y+dy,zz=z+dz,key=k(xx,yy,zz);if(blocks.has(key)&&!blockMeshes.has(key))addBlockVisible(xx,yy,zz,blocks.get(key));}}

let yaw=0,pitch=0,velocityY=0,grounded=false;
function pbox(x,y,z){return{minX:x-.3,maxX:x+.3,minY:y-1.65,maxY:y+.15,minZ:z-.3,maxZ:z+.3}}
function collides(b){for(let x=Math.floor(b.minX-.5);x<=Math.floor(b.maxX+.5);x++)for(let y=Math.floor(b.minY-.5);y<=Math.floor(b.maxY+.5);y++)for(let z=Math.floor(b.minZ-.5);z<=Math.floor(b.maxZ+.5);z++){if(!blocks.has(k(x,y,z)))continue;const t=blocks.get(k(x,y,z));if(t==='torch')continue;if(b.maxX>x-.5&&b.minX<x+.5&&b.maxY>y-.5&&b.minY<y+.5&&b.maxZ>z-.5&&b.minZ<z+.5)return true}return false}
function axis(axis,amount){if(!amount)return true;const maxStep=.16,steps=Math.max(1,Math.ceil(Math.abs(amount)/maxStep)),step=amount/steps;for(let i=0;i<steps;i++){const p=camera.position.clone();p[axis]+=step;if(collides(pbox(p.x,p.y,p.z)))return false;camera.position[axis]+=step}return true}
function move(dt){if(!joined||inventoryOpen||chatting||document.pointerLockElement!==renderer.domElement)return;let ix=0,iz=0;if(keys.KeyW)iz--;if(keys.KeyS)iz++;if(keys.KeyA)ix--;if(keys.KeyD)ix++;if(ix||iz){const l=Math.hypot(ix,iz);ix/=l;iz/=l;const sprint=(keys.ShiftLeft||keys.ShiftRight)&&hunger>3,speed=sprint?6.6:4.45;const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),v=new THREE.Vector3().addScaledVector(f,-iz).addScaledVector(r,ix).normalize().multiplyScalar(speed*dt);axis('x',v.x);axis('z',v.z);if(sprint)hunger=Math.max(0,hunger-dt*.05)}grounded=collides(pbox(camera.position.x,camera.position.y-.045,camera.position.z));if(keys.Space&&grounded){velocityY=6.8;grounded=false}const before=velocityY;velocityY-=18*dt;if(!axis('y',velocityY*dt)){if(before<0&&Math.abs(before)>9)health=Math.max(0,health-(Math.abs(before)-8)*1.3);velocityY=0;grounded=before<0}if(camera.position.y<-12){camera.position.set(0,12,0);velocityY=0;health=Math.max(1,health-5)}}

const ray=new THREE.Raycaster();ray.far=6;function target(){ray.setFromCamera(new THREE.Vector2(0,0),camera);return ray.intersectObjects([...blockMeshes.values()],false)[0]||null}
let mining=false,miningKey=null,miningProgress=0,lastMineHit=null;
function currentItem(){return hotbar[selectedSlot]}
function toolInfo(item){if(!item)return{kind:null,tier:0,mult:1};if(item.includes('pickaxe'))return{kind:'pickaxe',tier:item.startsWith('iron')?3:item.startsWith('stone')?2:1,mult:item.startsWith('iron')?5:item.startsWith('stone')?3.5:2};if(item.includes('axe'))return{kind:'axe',tier:item.startsWith('stone')?2:1,mult:item.startsWith('stone')?4:2.6};if(item.includes('sword'))return{kind:'sword',tier:1,mult:.9};return{kind:null,tier:0,mult:1}}
function miningSpeed(type){const d=defs[type]||{hard:1};const ti=toolInfo(currentItem());let mult=1;if(d.tool&&ti.kind===d.tool)mult=ti.mult;if(d.tool&&ti.kind!==d.tool)mult=.38;if(d.tier&&ti.tier<d.tier)mult=.22;return mult/Math.max(.1,d.hard)}
function tickMining(dt){const bar=document.querySelector('#mineBar'),fill=bar.firstElementChild;if(!mining||inventoryOpen||chatting){miningProgress=0;miningKey=null;bar.style.opacity=0;return}const h=target();if(!h){miningProgress=0;miningKey=null;bar.style.opacity=0;return}const d=h.object.userData,key=k(d.x,d.y,d.z);if(d.y<=-8)return;if(key!==miningKey){miningKey=key;miningProgress=0;lastMineHit=d}miningProgress+=dt*miningSpeed(d.type);bar.style.opacity=1;fill.style.width=`${Math.min(100,miningProgress*100)}%`;if(miningProgress>=1){socket.emit('block:break',d);damageTool();mining=false;miningProgress=0;bar.style.opacity=0}}
function damageTool(){const it=currentItem();if(!it||!durability[it])return;durability[it]--;if(durability[it]<=0){inventory[it]=Math.max(0,(inventory[it]||0)-1);durability[it]=0;toast(`${itemNames[it]||it} broke`)}renderHotbar()}
function placeOrUse(){const h=target();if(!h)return;const item=currentItem();if(!defs[item]||(inventory[item]||0)<=0)return;const n=h.face.normal,p=h.object.userData,x=p.x+n.x,y=p.y+n.y,z=p.z+n.z;if(blocks.has(k(x,y,z)))return;blocks.set(k(x,y,z),item);if(collides(pbox(camera.position.x,camera.position.y,camera.position.z))){blocks.delete(k(x,y,z));return}blocks.delete(k(x,y,z));socket.emit('block:place',{x,y,z,type:item})}
renderer.domElement.addEventListener('mousedown',e=>{if(document.pointerLockElement!==renderer.domElement||inventoryOpen||chatting)return;if(e.button===0)mining=true;if(e.button===2)placeOrUse()});document.addEventListener('mouseup',e=>{if(e.button===0)mining=false});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

function itemColor(item){return defs[item]?.c||({coal:'#222',iron_ore:'#ae8066',iron_ingot:'#d7d9d9',apple:'#b83227',wooden_pickaxe:'#b98b55',stone_pickaxe:'#777',iron_pickaxe:'#d7d9d9',wooden_axe:'#ad7b47',stone_axe:'#777',wooden_sword:'#ad7b47',stone_sword:'#777'}[item]||'#888')}
function iconHTML(item){return `<div class="icon" style="background:${itemColor(item)};box-shadow:inset 0 0 0 4px rgba(0,0,0,.12)"></div>`}
function renderHotbar(){const el=document.getElementById('hotbar');el.innerHTML='';hotbar.forEach((it,i)=>{const s=document.createElement('div');s.className='slot'+(i===selectedSlot?' selected':'');const q=inventory[it]||0;let dur='';if(durability[it]&&q>0){const max=it.startsWith('iron')?251:it.startsWith('stone')?132:60;dur=`<div class="durability"><div style="width:${Math.max(0,durability[it]/max*100)}%"></div></div>`}s.innerHTML=`<span class="key">${i+1}</span>${iconHTML(it)}<span class="count">${q>1?q:''}</span>${dur}`;el.appendChild(s)})}
function renderInventory(){const grid=document.getElementById('inventoryGrid');grid.innerHTML='';const items=Object.entries(inventory).filter(([,q])=>q>0).sort(([a],[b])=>a.localeCompare(b));for(const [it,q] of items){const d=document.createElement('div');d.className='invItem';d.innerHTML=`${iconHTML(it)}<div>${itemNames[it]||it.replaceAll('_',' ')}</div><span class="qty">${q}</span>`;grid.appendChild(d)}const list=document.getElementById('recipeList');list.innerHTML='';recipes.forEach((r,i)=>{const need=Object.entries(r.need).map(([a,q])=>`${q} ${itemNames[a]||a.replaceAll('_',' ')}`).join(', ');const d=document.createElement('div');d.className='recipe';d.innerHTML=`<div><b>${r.name}</b><br><small>${need}</small></div><button data-r="${i}">Craft</button>`;list.appendChild(d)});list.querySelectorAll('button').forEach(b=>b.onclick=()=>craft(Number(b.dataset.r)))}
function craft(i){const r=recipes[i];for(const [it,q] of Object.entries(r.need))if((inventory[it]||0)<q)return toast('Missing materials');for(const [it,q] of Object.entries(r.need))inventory[it]-=q;for(const [it,q] of Object.entries(r.give))inventory[it]=(inventory[it]||0)+q;if(r.dur)for(const [it,v] of Object.entries(r.dur))durability[it]=v;toast(`Crafted ${r.name}`);renderInventory();renderHotbar()}
function toggleInventory(force){inventoryOpen=force??!inventoryOpen;document.getElementById('inventoryScreen').classList.toggle('hidden',!inventoryOpen);if(inventoryOpen){document.exitPointerLock();renderInventory()}else if(joined)renderer.domElement.requestPointerLock()}
document.getElementById('closeInventory').onclick=()=>toggleInventory(false);

function toast(t){const el=document.getElementById('toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.opacity=0,1300)}
function colorName(name){let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))|0;return new THREE.Color().setHSL(((h>>>0)%360)/360,.55,.54)}
function sprite(text,bg='rgba(0,0,0,.58)',size=24){const c=document.createElement('canvas'),x=c.getContext('2d');x.font=`bold ${size}px Arial`;const w=Math.max(150,x.measureText(text).width+30);c.width=w;c.height=52;x.font=`bold ${size}px Arial`;x.fillStyle=bg;x.fillRect(0,0,w,52);x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,26);const tex=new THREE.CanvasTexture(c),s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));s.scale.set(w/95,52/95,1);return s}
function remoteCreate(id,name,state){if(otherPlayers.has(id))return;const g=new THREE.Group(),shirt=new THREE.MeshStandardMaterial({color:colorName(name)}),skin=new THREE.MeshStandardMaterial({color:0xd6a17c}),dark=new THREE.MeshStandardMaterial({color:0x35393c});const body=new THREE.Mesh(new THREE.BoxGeometry(.72,.85,.36),shirt);body.position.y=.95;const head=new THREE.Mesh(new THREE.BoxGeometry(.58,.58,.58),skin);head.position.y=1.68;const leg1=new THREE.Mesh(new THREE.BoxGeometry(.28,.8,.3),dark),leg2=leg1.clone();leg1.position.set(-.18,.25,0);leg2.position.set(.18,.25,0);g.add(body,head,leg1,leg2);const label=sprite(name);label.position.y=2.28;g.add(label);const p=state?.pos||[0,4,0];g.position.set(p[0],p[1]-1.65,p[2]);scene.add(g);otherPlayers.set(id,{g,target:g.position.clone(),yaw:state?.yaw||0,bubble:null,timer:null})}
function remoteRemove(id){const p=otherPlayers.get(id);if(!p)return;scene.remove(p.g);otherPlayers.delete(id)}
function bubble(id,text){const p=otherPlayers.get(id);if(!p)return;if(p.bubble)p.g.remove(p.bubble);p.bubble=sprite(text,'rgba(10,10,10,.72)',21);p.bubble.position.y=2.95;p.g.add(p.bubble);clearTimeout(p.timer);p.timer=setTimeout(()=>{if(p.bubble){p.g.remove(p.bubble);p.bubble=null}},5000)}
function updateRemotes(dt){for(const p of otherPlayers.values()){p.g.position.lerp(p.target,Math.min(1,dt*12));p.g.rotation.y=p.yaw}}
function addChat(name,text,sys=false){const log=document.getElementById('chatLog'),d=document.createElement('div');d.className='chatLine'+(sys?' system':'');d.textContent=sys?text:`${name}: ${text}`;log.appendChild(d);while(log.children.length>11)log.removeChild(log.firstChild);log.scrollTop=log.scrollHeight}
function openChat(){if(!joined||inventoryOpen)return;chatting=true;document.exitPointerLock();const i=document.getElementById('chatInput');i.style.display='block';i.focus()}
function closeChat(send){const i=document.getElementById('chatInput');if(send&&i.value.trim())socket.emit('chat:send',i.value);i.value='';i.style.display='none';chatting=false;renderer.domElement.requestPointerLock()}
document.getElementById('chatInput').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();closeChat(true)}else if(e.key==='Escape'){e.preventDefault();closeChat(false)}});

document.addEventListener('keydown',e=>{if(chatting)return;if(e.code==='KeyE'){e.preventDefault();toggleInventory();return}if(e.code==='Enter'){e.preventDefault();openChat();return}keys[e.code]=true;if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5))-1;if(n>=0&&n<9){selectedSlot=n;renderHotbar()}}if(e.code==='KeyF'&&(inventory.apple||0)>0&&hunger<20){inventory.apple--;hunger=Math.min(20,hunger+5);toast('Ate apple')}});document.addEventListener('keyup',e=>{if(!chatting)keys[e.code]=false});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==renderer.domElement||chatting||inventoryOpen)return;yaw-=e.movementX*.00215;pitch-=e.movementY*.00215;pitch=Math.max(-1.5,Math.min(1.5,pitch));camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch});
document.addEventListener('pointerlockchange',()=>{if(!joined||chatting||inventoryOpen)return;document.getElementById('pause').classList.toggle('hidden',document.pointerLockElement===renderer.domElement)});document.getElementById('resumeBtn').onclick=()=>renderer.domElement.requestPointerLock();

function join(){const name=document.getElementById('username').value.trim();if(name.length<2)return document.getElementById('loginError').textContent='Use at least 2 characters.';myUsername=name;localStorage.setItem('blockcraft-name',name);socket.auth={username:name};socket.connect()}
document.getElementById('username').value=localStorage.getItem('blockcraft-name')||'';document.getElementById('joinBtn').onclick=join;document.getElementById('username').addEventListener('keydown',e=>{if(e.key==='Enter')join()});
socket.on('connect_error',e=>{document.getElementById('loginError').textContent=e.message;socket.disconnect()});
socket.on('world:init',d=>{joined=true;document.getElementById('login').classList.add('hidden');loadBlocks(d.blocks);inventory={...d.state.inventory};durability={...d.state.durability};selectedSlot=d.state.selectedSlot||0;health=d.state.health??20;hunger=d.state.hunger??20;gameTime=d.gameTime??.2;camera.position.fromArray(d.state.pos||[0,8,0]);yaw=d.state.yaw||0;camera.rotation.y=yaw;for(const p of d.players)remoteCreate(p.id,p.username,p.state);for(const m of d.chatHistory)addChat(m.username,m.text);renderHotbar();updateOnline();renderer.domElement.requestPointerLock()});
socket.on('player:join',p=>{remoteCreate(p.id,p.username,p.state);updateOnline()});socket.on('player:leave',p=>{remoteRemove(p.id);updateOnline()});socket.on('player:state',p=>{const r=otherPlayers.get(p.id);if(r){r.target.set(p.state.pos[0],p.state.pos[1]-1.65,p.state.pos[2]);r.yaw=p.state.yaw||0}});
socket.on('block:broken',b=>{const type=removeBlock(b.x,b.y,b.z);refreshNeighbors(b.x,b.y,b.z);if(b.by===myUsername&&type){const drop=defs[type]?.drop||type;if(drop==='leaves'){if(Math.random()<.18)inventory.apple=(inventory.apple||0)+1}else inventory[drop]=(inventory[drop]||0)+1;renderHotbar()}});socket.on('block:placed',b=>{if(!blocks.has(k(b.x,b.y,b.z))){blocks.set(k(b.x,b.y,b.z),b.type);addBlockVisible(b.x,b.y,b.z,b.type)}if(b.by===myUsername){inventory[b.type]=Math.max(0,(inventory[b.type]||0)-1);renderHotbar()}});
socket.on('chat:message',m=>{addChat(m.username,m.text);bubble(m.playerId,m.text)});socket.on('system:message',t=>addChat('',t,true));socket.on('time:sync',t=>gameTime=t);function updateOnline(){document.getElementById('online').textContent=`${otherPlayers.size+1} online`}
setInterval(()=>{if(joined&&socket.connected)socket.emit('player:state',{pos:[camera.position.x,camera.position.y,camera.position.z],yaw,health,hunger,inventory,durability,selectedSlot})},140);
function day(dt){gameTime=(gameTime+dt*.0025)%1;const a=gameTime*Math.PI*2,l=Math.max(.07,Math.sin(a)*.78+.22);sun.intensity=l*2.25;hemi.intensity=.32+l*1.38;const day=new THREE.Color(0x87ceeb),night=new THREE.Color(0x06101f);scene.background.copy(night).lerp(day,l);scene.fog.color.copy(scene.background);sun.position.set(Math.cos(a)*35,Math.sin(a)*38,10);document.getElementById('timeLabel').textContent=l<.34?'Night':'Day'}
let needAcc=0;function needs(dt){needAcc+=dt;if(needAcc>=1){needAcc=0;hunger=Math.max(0,hunger-.012);if(hunger<=0)health=Math.max(0,health-.25);else if(hunger>17&&health<20)health=Math.min(20,health+.12);document.getElementById('health').textContent=`❤ ${Math.ceil(health)}`;document.getElementById('hunger').textContent=`◆ ${Math.ceil(hunger)}`;if(health<=0){health=20;hunger=20;camera.position.set(0,12,0);toast('You respawned')}}}
const clock=new THREE.Clock();function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);move(dt);tickMining(dt);updateRemotes(dt);day(dt);needs(dt);renderer.render(scene,camera)}loop();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
