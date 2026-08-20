# Blockcraft Survival v2

This is a major foundation update for the persistent Railway/GitHub multiplayer game.

## Repository files

```text
.gitignore
package.json
railway.json
README.md
server.js
index.html
style.css
client.js
```

## Included in this build

- Persistent multiplayer world and player state
- Username login
- Translucent multiplayer chat
- Speech bubbles above players
- Improved player models
- Procedural original pixel-style block textures
- Plains, forest, desert and snow terrain
- Basic caves
- Coal and iron ore generation
- Trees
- 9-slot hotbar
- Inventory screen
- Recipe crafting
- Wooden, stone and iron pickaxes
- Axes and swords as inventory/tool items
- Tool durability
- Tool-aware mining speeds
- Mining progress bar
- Cobblestone drops from stone
- Coal and iron progression
- Crafting tables, furnaces, chests, torches and glass as placeable blocks
- Health, hunger, sprinting, jumping and fall damage
- Day/night cycle
- Persistent block placement and mining
- Railway volume-compatible saves

## Railway persistence

Keep your Railway Volume mounted at:

```text
/data
```

and keep the variable:

```text
DATA_DIR=/data
```

The server writes `/data/world.json`.

## Deployment

Upload/replace these files in GitHub. Railway should automatically redeploy.

## Important scope note

This is a foundation for a Minecraft-class voxel survival game, not literal feature parity with Minecraft. Large systems still to build include authoritative item drops, full chest UI/storage synchronization, timed furnace processing, agriculture, fluid simulation, lighting propagation, weather, hostile/passive mob AI, armor, ranged combat, enchantment-like progression, generated structures, villages/NPCs, portals/dimensions, automation circuitry, advanced world streaming/chunks, sound/music, achievements, and bosses.
