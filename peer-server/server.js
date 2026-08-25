const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({ ok: true, service: "Sea Battle PeerServer" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sea Battle PeerServer listening on port ${PORT}`);
});

const const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.json({
        ok: true,
        service: "Sea Battle PeerServer"
    });
});

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sea Battle PeerServer listening on ${PORT}`);
});

const peerServer = ExpressPeerServer(server, {
    debug: true,
    proxied: true
});

app.use("/peerjs", peerServer);

app.use(peerServer);
