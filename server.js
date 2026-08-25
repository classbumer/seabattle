const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "Sea Battle Online", websocket: "/game" });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/game" });
const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}
function broadcast(room, data, except) {
  for (const p of room.players) if (p.ws !== except) send(p.ws, data);
}
function remove(ws) {
  const code = ws.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter(p => p.ws !== ws);
  ws.roomCode = null;
  if (!room.players.length) rooms.delete(code);
  else broadcast(room, { t: "peer_left" });
}

wss.on("connection", ws => {
  ws.isAlive = true;
  ws.on("pong", () => ws.isAlive = true);

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.t === "join") {
      const code = String(m.room || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!code) return send(ws, { t:"error", message:"Bad room" });

      let room = rooms.get(code);
      if (!room) {
        room = { mode: Number(m.mode) === 2 ? 2 : 1, players: [] };
        rooms.set(code, room);
      }

      const max = room.mode === 2 ? 4 : 2;
      if (room.players.length >= max) return send(ws, { t:"room", status:"full" });

      room.players.push({ ws, host: !!m.host });
      ws.roomCode = code;

      send(ws, { t:"room", status:room.players.length === 1 ? "waiting" : "joined",
        count:room.players.length, maxPlayers:max });

      if (room.players.length === max) {
        room.players.forEach((p,i) => send(p.ws,{t:"start",host:i===0}));
      }
      return;
    }

    if (m.t === "game") {
      const room = rooms.get(ws.roomCode);
      if (room) broadcast(room, { t:"game", data:m.data }, ws);
    }
  });

  ws.on("close", () => remove(ws));
  ws.on("error", () => remove(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} }
    else { ws.isAlive = false; try { ws.ping(); } catch {} }
  }
}, 25000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sea Battle Online listening on ${PORT}`);
});
