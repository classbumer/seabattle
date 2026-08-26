import express from "express";
import http from "http";
import {Server} from "socket.io";
import path from "path";
import {fileURLToPath} from "url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const queues={10:[],15:[]}, rooms=new Map();
const fleets=n=>n===10?[4,3,3,2,2,2,1,1,1,1]:[5,4,4,3,3,3,2,2,2,1,1,1,1,1];
const key=(x,y)=>`${x},${y}`;
const xy=p=>p.split(",").map(Number);
const inside=(x,y,n)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<n&&y<n;
const around=(x,y,n)=>{
  const a=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
    if((dx||dy)&&inside(x+dx,y+dy,n))a.push(key(x+dx,y+dy));return a;
};
function validateFleet(list,n){
  const wanted=[...fleets(n)].sort((a,b)=>a-b);
  if(!Array.isArray(list)||list.length!==wanted.length)return false;
  const lens=list.map(s=>Array.isArray(s.cells)?s.cells.length:0).sort((a,b)=>a-b);
  if(lens.join()!=wanted.join())return false;
  const occ=new Set();
  for(const s of list){
    if(!Array.isArray(s.cells)||!s.cells.length)return false;
    const cells=s.cells.map(String);
    for(const p of cells){const [x,y]=xy(p);if(!inside(x,y,n)||occ.has(p))return false;}
    if(cells.length>1){
      const pts=cells.map(xy), sameX=pts.every(p=>p[0]===pts[0][0]),sameY=pts.every(p=>p[1]===pts[0][1]);
      if(!sameX&&!sameY)return false;
      const vals=pts.map(p=>sameX?p[1]:p[0]).sort((a,b)=>a-b);
      for(let i=1;i<vals.length;i++)if(vals[i]!==vals[i-1]+1)return false;
    }
    cells.forEach(p=>occ.add(p));
  }
  // Ships may not touch, even diagonally.
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)
    for(const p of list[i].cells){
      const [x,y]=xy(p);
      if(around(x,y,n).some(q=>list[j].cells.includes(q)))return false;
    }
  return true;
}
const newRoom=(id,a,b,n)=>({id,size:n,players:[a,b],data:[null,null],turn:0,phase:"setup",score:[0,0]});
function pub(r){return {roomId:r.id,size:r.size,players:r.players.map((id,i)=>({id,slot:i,ready:!!r.data[i]?.ready})),turn:r.turn,phase:r.phase,score:r.score};}
function slotOf(r,id){return r.players.indexOf(id);}

io.on("connection",s=>{
  s.on("find_match",({size=10}={})=>{
    const n=Number(size)===15?15:10, q=queues[n];
    const i=q.findIndex(id=>id!==s.id&&io.sockets.sockets.has(id));
    if(i<0){q.push(s.id);s.emit("waiting",{size:n});return;}
    const other=q.splice(i,1)[0],r=newRoom(Math.random().toString(36).slice(2,10),other,s.id,n);
    rooms.set(r.id,r);r.players.forEach(id=>io.sockets.sockets.get(id)?.join(r.id));
    r.players.forEach((id,slot)=>io.to(id).emit("match_found",{roomId:r.id,size:n,slot}));
  });

  s.on("ready",({roomId,fleet})=>{
    const r=rooms.get(roomId);if(!r)return;const slot=slotOf(r,s.id);if(slot<0||r.phase!=="setup")return;
    if(!validateFleet(fleet,r.size))return s.emit("server_error",{message:"Сервер отклонил расстановку флота"});
    r.data[slot]={ready:true,ships:fleet.map(x=>({name:String(x.name||""),cells:[...x.cells],hits:[]})),shots:new Set()};
    io.to(r.id).emit("state",pub(r));
    if(r.data[0]?.ready&&r.data[1]?.ready){r.phase="battle";r.turn=0;io.to(r.id).emit("battle_start",{state:pub(r)});}
  });

  s.on("fire",({roomId,x,y})=>{
    const r=rooms.get(roomId);if(!r||r.phase!=="battle")return;
    const me=slotOf(r,s.id),enemy=1-me;if(me<0||me!==r.turn)return;
    x=Number(x);y=Number(y);if(!inside(x,y,r.size))return;
    const k=key(x,y),d=r.data[me],t=r.data[enemy];if(d.shots.has(k))return;d.shots.add(k);
    let result="miss",sunk=false,shipIndex=-1;
    for(let i=0;i<t.ships.length;i++){const sh=t.ships[i];if(sh.cells.includes(k)){if(sh.hits.includes(k))return;sh.hits.push(k);result="hit";shipIndex=i;sunk=sh.hits.length===sh.cells.length;r.score[me]++;break;}}
    let blocked=[];
    if(sunk){const cells=t.ships[shipIndex].cells;blocked=[...new Set(cells.flatMap(p=>{const [a,b]=xy(p);return [p,...around(a,b,r.size)]}))];}
    const win=t.ships.every(sh=>sh.hits.length===sh.cells.length);
    if(win){r.phase="finished";io.to(r.id).emit("shot_result",{by:me,x,y,result,sunk,blocked,turn:me,score:r.score});io.to(r.id).emit("game_over",{winner:me,score:r.score});return;}
    r.turn=1-me;
    io.to(r.id).emit("shot_result",{by:me,x,y,result,sunk,blocked,turn:r.turn,score:r.score});
  });

  const leave=id=>{
    for(const n of [10,15]){const i=queues[n].indexOf(id);if(i>=0)queues[n].splice(i,1);}
    for(const [rid,r] of rooms)if(r.players.includes(id)){r.players.filter(x=>x!==id).forEach(x=>io.to(x).emit("opponent_left"));rooms.delete(rid);}
  };
  s.on("leave_match",()=>leave(s.id));s.on("disconnect",()=>leave(s.id));
});

server.listen(process.env.PORT||10000,"0.0.0.0",()=>console.log("SeaBattle v3 online"));
