const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT) || 9000;
const PEER_PATH = process.env.PEER_PATH || '/peerjs';

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'Sea Battle PeerServer',
    peerPath: PEER_PATH
  });
});

const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sea Battle PeerServer listening on port ${PORT}, path ${PEER_PATH}`);
});

const peerServer = ExpressPeerServer(httpServer, {
  path: '/',
  proxied: true,
  allow_discovery: false,
  alive_timeout: 60000,
  expire_timeout: 5000
});

app.use(PEER_PATH, peerServer);

peerServer.on('connection', client => {
  console.log('Peer connected:', client.getId());
});

peerServer.on('disconnect', client => {
  console.log('Peer disconnected:', client.getId());
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
