SEA BATTLE 2x2 — PEERSERVER

This is the small signaling server needed by the GitHub Pages version of the game.
GitHub Pages stays as the website. This server is only for PeerJS signaling.

RENDER SETTINGS
---------------
1. Create a new Web Service from this folder/repository.
2. Build command: npm install
3. Start command: npm start
4. Instance: Free (for testing)
5. No environment variables are required.

After deployment, Render gives a URL such as:
https://seabattle-peer-server-xxxx.onrender.com

The PeerJS endpoint is:
https://seabattle-peer-server-xxxx.onrender.com/peerjs

IMPORTANT
---------
The frontend file has a placeholder for the server hostname. Replace it with
YOUR actual Render hostname after deployment. Do not include https:// in the
host field.

The game remains on GitHub Pages; only the signaling backend is on Render.
