# Blockcraft Multiplayer

This version is structured to match a GitHub repository where every project file is in the repository root.

## Exact repository structure

```text
your-repository/
├── .gitignore
├── package.json
├── railway.json
├── README.md
├── server.js
└── index.html
```

There is **no `public` folder** in this version.

## What it includes

- Multiplayer Socket.IO server
- Shared persistent voxel world
- Username login screen
- Other players visible in the world
- Multiplayer mining and block placement
- Translucent multiplayer chat panel
- Chat text above player heads
- Player join/leave notifications
- Persistent block changes
- Persistent player position and inventory
- Health and hunger
- Day/night cycle
- Collision fixes

## GitHub

Replace the files in the root of your GitHub repository with the files from this package.

If GitHub currently displays `server` instead of `server.js` and `index` instead of `index.html`, that is normally just Windows Explorer hiding known file extensions. Do not rename them to add a second extension.

The actual filenames must be:

- `server.js`
- `index.html`

## Railway deployment

Create/connect a Railway service from the GitHub repository.

Railway runs:

```bash
npm start
```

which executes:

```bash
node server.js
```

### Permanent world storage

Add a Railway Volume and mount it at:

```text
/data
```

Then add the Railway environment variable:

```text
DATA_DIR=/data
```

The multiplayer server will store the permanent world at:

```text
/data/world.json
```

Without a Railway Volume, the game can still run but server filesystem data may disappear after redeployments or container replacement.

## Opening the game

After Railway deploys successfully:

1. Open the public Railway domain.
2. Enter a username.
3. Join the world.
4. Send the same Railway URL to your friends.
5. Everyone using that deployment joins the same server world.

## Useful health check

The server exposes:

```text
/health
```

It returns a small JSON response showing whether the server is alive and how many Socket.IO clients are connected.

## Local testing

Install Node.js, then from the repository directory run:

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```
