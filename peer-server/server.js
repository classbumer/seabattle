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

const peerServer = ExpressPeerServer(server, {
  path: "/peerjs",
  allow_discovery: true,
  proxied: true
});

app.use(peerServer);
