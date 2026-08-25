const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Sea Battle Online Server",
    websocket: "/game"
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/game" });

const rooms = new Map();

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data, except = null) {
  for (const player of room.players) {
    if (player !== except) send(player.ws, data);
  }
}

function removePlayer(ws) {
  const roomCode = ws.roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  room.players = room.players.filter(p => p.ws !== ws);
  ws.roomCode = null;

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  broadcast(room, { t: "peer_left" });
}

wss.on("connection", (ws) => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { t: "error", message: "Invalid JSON" });
    }

    if (msg.t === "join") {
      const code = String(msg.room || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

      if (!code) {
        return send(ws, { t: "error", message: "Room code is empty" });
      }

      let room = rooms.get(code);

      if (!room) {
        room = {
          mode: Number(msg.mode) === 2 ? 2 : 1,
          players: []
        };
        rooms.set(code, room);
      }

      const maxPlayers = room.mode === 2 ? 4 : 2;

      if (room.players.length >= maxPlayers) {
        return send(ws, { t: "room", status: "full" });
      }

      const player = {
        ws,
        host: !!msg.host,
        mode: room.mode
      };

      room.players.push(player);
      ws.roomCode = code;

      send(ws, {
        t: "room",
        status: room.players.length === 1 ? "waiting" : "joined",
        count: room.players.length,
        maxPlayers
      });

      if (room.players.length === maxPlayers) {
        room.players.forEach((p, index) => {
          send(p.ws, {
            t: "start",
            host: index === 0
          });
        });
      }

      return;
    }

    if (msg.t === "game") {
      const room = rooms.get(ws.roomCode);
      if (!room) return;

      /*
        Для 1×1 сообщение отправляется второму игроку.
        Для 2×2 пока ретранслируем всем остальным игрокам комнаты.
      */
      broadcast(room, { t: "game", data: msg.data }, ws);
      return;
    }
  });

  ws.on("close", () => removePlayer(ws));
  ws.on("error", () => removePlayer(ws));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch {}
      continue;
    }

    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 25000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sea Battle Online Server listening on ${PORT}`);
});

process.on("SIGTERM", () => {
  clearInterval(heartbeat);
  server.close(() => process.exit(0));
});
