const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const app = express();
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT) || 9000;

app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'Sea Battle PeerServer' });
});

const httpServer = http.createServer(app);

// PeerJS is mounted at /peerjs. The client must use the same path.
const peerServer = ExpressPeerServer(httpServer, {
  path: '/',
  proxied: true,
  allow_discovery: false,
  alive_timeout: 60000,
  expire_timeout: 5000,
  corsOptions: { origin: true, credentials: true }
});

app.use('/peerjs', peerServer);

peerServer.on('connection', client => {
  console.log('Peer connected:', client.getId());
});

peerServer.on('disconnect', client => {
  console.log('Peer disconnected:', client.getId());
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Sea Battle PeerServer listening on port ${PORT}`);
  console.log('PeerJS endpoint: /peerjs/');
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
