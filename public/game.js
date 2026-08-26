const socket=io(),$=s=>document.querySelector(s);
let mode="bot1",size=10,roomId=null,mySlot=0,myFleet=[],myShots=new Set(),enemyMarks=new Map(),enemyShots=new Set(),myTurn=false,botFleet=[];
const spec=n=>n===10?[["Линкор",4,1],["Крейсер",3,2],["Эсминец",2,3],["Катер",1,4]]:[["Авианосец",5,1],["Линкор",4,1],["Крейсер",3,2],["Эсминец",2,3],["Катер",1,5]];
const p=(x,y)=>`${x},${y}`,xy=s=>s.split(",").map(Number);
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active")}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2300)}
function near(x,y){let a=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&y+dy>=0&&x+dx<size&&y+dy<size)a.push(p(x+dx,y+dy));return a}
function randomFleet(){let used=new Set(),out=[];for(const [name,len,count] of spec(size))for(let n=0;n<count;n++){let placed=false;for(let z=0;z<1000&&!placed;z++){const h=Math.random()>.5,x=Math.floor(Math.random()*size),y=Math.floor(Math.random()*size),cells=[];for(let k=0;k<len;k++)cells.push(p(x+(h?k:0),y+(h?0:k)));if(cells.some(q=>{const[a,b]=xy(q);return a>=size||b>=size||used.has(q)}))continue;if(cells.some(q=>near(...xy(q)).some(n=>used.has(n))))continue;cells.forEach(q=>used.add(q));out.push({name,cells,hits:[]});placed=true}}return out}
function draw(el,ships,enemy=false){el.innerHTML="";el.style.gridTemplateColumns=`repeat(${size},1fr)`;const map=new Map();ships.forEach((s,i)=>s.cells.forEach(q=>map.set(q,i)));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const q=p(x,y),c=document.createElement("button");c.className="cell";c.dataset.p=q;if(!enemy&&map.has(q))c.classList.add("ship");if(enemy){const m=enemyMarks.get(q);if(m)c.classList.add(m)}if(!enemy&&enemyShots.has(q))c.classList.add("miss");c.onclick=()=>enemy&&fire(x,y);el.appendChild(c)}}
function renderFleet(){$("#fleet").innerHTML=spec(size).map(([n,l,c])=>`<div class="fleet-row"><span>${n} · ${"▰".repeat(l)}</span><b>×${c}</b></div>`).join("")}
function setup(){myFleet=randomFleet();draw($("#myBoard"),myFleet);renderFleet()}
function fire(x,y){const q=p(x,y);if(!myTurn||myShots.has(q))return;myShots.add(q);if(mode==="online"){socket.emit("fire",{roomId,x,y});return}const s=botFleet.find(z=>z.cells.includes(q));const c=$("#enemyBoard").querySelector(`[data-p="${q}"]`);if(s){s.hits.push(q);c.classList.add("hit");if(s.hits.length===s.cells.length){[...new Set(s.cells.flatMap(z=>[z,...near(...xy(z))]))].forEach(z=>enemyMarks.set(z,"dead"));draw($("#enemyBoard"),[],true);toast("Корабль уничтожен — соседние клетки закрыты")}}else c.classList.add("miss");if(botFleet.every(z=>z.hits.length===z.cells.length))return toast("ПОБЕДА! ⚓");myTurn=false;$("#turn").textContent="ХОД ПРОТИВНИКА";setTimeout(botTurn,450)}
function botTurn(){let q;do q=p(Math.floor(Math.random()*size),Math.floor(Math.random()*size));while(enemyShots.has(q));enemyShots.add(q);const s=myFleet.find(z=>z.cells.includes(q)),c=$("#myBoard").querySelector(`[data-p="${q}"]`);if(s){s.hits.push(q);c.classList.add("hit");if(s.hits.length===s.cells.length){[...new Set(s.cells.flatMap(z=>[z,...near(...xy(z))]))].forEach(z=>{const e=$("#myBoard").querySelector(`[data-p="${z}"]`);if(e)e.classList.add("dead")});toast("Ваш корабль уничтожен")}if(myFleet.every(z=>z.hits.length===z.cells.length))return toast("ПОРАЖЕНИЕ");setTimeout(botTurn,400)}else{c.classList.add("miss");myTurn=true;$("#turn").textContent="ВАШ ХОД"}}
function botStart(){botFleet=randomFleet();myShots.clear();enemyShots.clear();enemyMarks.clear();myFleet.forEach(s=>s.hits=[]);botFleet.forEach(s=>s.hits=[]);draw($("#myBoard"),myFleet);draw($("#enemyBoard"),[],true);myTurn=true;$("#turn").textContent="ВАШ ХОД";$("#modeLabel").textContent=mode==="bot2"?"2×2 БОТЫ":"1×1 БОТ";show("battle")}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-mode]").forEach(x=>x.classList.remove("on"));b.classList.add("on");mode=b.dataset.mode});
document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-size]").forEach(x=>x.classList.remove("on"));b.classList.add("on");size=+b.dataset.size;renderFleet()});
$("#start").onclick=()=>{if(mode==="online"){show("wait");socket.emit("find_match",{size})}else{setup();show("setup")}};
$("#random").onclick=setup;
$("#ready").onclick=()=>{if(mode==="online"){socket.emit("ready",{roomId,fleet:myFleet});$("#setupStatus").textContent="ОЖИДАЕМ СОПЕРНИКА"}else botStart()};
$("#cancel").onclick=()=>{socket.emit("leave_match");show("home")};
document.querySelectorAll(".back").forEach(b=>b.onclick=()=>show("home"));
socket.on("connect",()=>{$("#net").textContent="● ONLINE";$("#net").classList.add("on")});
socket.on("disconnect",()=>{$("#net").textContent="● OFFLINE";$("#net").classList.remove("on")});
socket.on("waiting",()=>toast("Ищем соперника..."));
socket.on("match_found",d=>{roomId=d.roomId;size=d.size;mySlot=d.slot;setup();show("setup");toast("Соперник найден!")});
socket.on("battle_start",d=>{myTurn=d.state.turn===mySlot;$("#turn").textContent=myTurn?"ВАШ ХОД":"ХОД СОПЕРНИКА";$("#modeLabel").textContent="1×1 ONLINE";draw($("#myBoard"),myFleet);draw($("#enemyBoard"),[],true);show("battle")});
socket.on("shot_result",d=>{const q=p(d.x,d.y);if(d.by===mySlot){enemyMarks.set(q,d.result==="hit"?"hit":"miss");if(d.sunk)d.blocked.forEach(z=>enemyMarks.set(z,"dead"));draw($("#enemyBoard"),[],true);if(d.sunk)toast("Корабль уничтожен — соседние клетки закрыты")}else{const c=$("#myBoard").querySelector(`[data-p="${q}"]`);if(d.result==="hit")c.classList.add("hit");else c.classList.add("miss");if(d.sunk){d.blocked.forEach(z=>{const e=$("#myBoard").querySelector(`[data-p="${z}"]`);if(e)e.classList.add("dead")});toast("Ваш корабль уничтожен")}}myTurn=d.turn===mySlot;$("#turn").textContent=myTurn?"ВАШ ХОД":"ХОД СОПЕРНИКА";$("#score").textContent=d.score.join(" : ")});
socket.on("game_over",d=>toast(d.winner===mySlot?"ПОБЕДА! ⚓":"ПОРАЖЕНИЕ"));
socket.on("server_error",e=>toast(e.message));
socket.on("opponent_left",()=>{toast("Соперник вышел");show("home")});
renderFleet();
