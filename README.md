# Blockcraft Multiplayer

A small persistent multiplayer voxel sandbox built with Three.js, Express and Socket.IO.

## Features
- Username login screen
- One shared multiplayer world
- Real-time player movement
- Real-time block mining and placing
- Persistent world edits
- Persistent per-username position, inventory, health and hunger
- Translucent in-game chat box
- Chat text bubbles over other players' heads
- Hotbar, gravity, jumping, sprinting, collision and day/night cycle

## Run locally
```bash
npm install
npm start
```
Open `http://localhost:3000` in two browser windows to test multiplayer.

## GitHub
Create a new GitHub repository and upload the contents of this folder. Do not upload `node_modules`.

## Railway deployment
1. Create a new Railway project from your GitHub repository.
2. Railway will detect Node.js and use `npm start`.
3. Add a Railway **Volume** to the service.
4. Mount the volume at `/data`.
5. Add an environment variable: `DATA_DIR=/data`.
6. Deploy, then generate a public domain in Railway Networking.

The volume is important. Without it, `world.json` lives on ephemeral container storage and can disappear on redeploy/restart. With the `/data` volume, world edits and saved player states persist.

## Controls
- WASD: move
- Space: jump
- Shift: sprint
- Left click: mine
- Right click: place
- 1–6: hotbar
- Enter: open chat
- Esc: release mouse / close chat

## Notes
This prototype uses usernames as lightweight identities, not secure accounts. If you later want passwords/accounts, use a database and hashed passwords rather than storing credentials in `world.json`.
