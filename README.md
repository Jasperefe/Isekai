# ISEKAI

A 3D isekai mini RPG for the web (Three.js), built for CrazyGames and Playgama.

## Milestone 1: core prototype

Play as Jasper in Starter Meadow and fight slimes.

| Action | PC | Phone |
| --- | --- | --- |
| Move | WASD / arrows | Left joystick |
| Look | Mouse (click the screen first) | Drag the right side |
| Attack (3-hit combo) | Left click / J | ATK |
| Heavy attack (shockwave) | Right click / K | HVY |
| Block (hold) / Parry (block just as a slime lunges) | Q | BLOCK |
| Dodge (Debug Dash) | Space | DASH |
| Dash strike | Attack during a dodge or while sprinting | same |
| Jump slam | Attack in the air | same |
| Blade Storm (4-hit spin, 40 stamina) | R | SKILL |
| Patch | E | PATCH |
| Sprint | Shift | Push the stick fully |
| Jump | F | JUMP |

**Patch:** purple slimes are GLITCHED and resist damage. Patch removes the glitch for good, freezes the slime for 3 s and makes it take double damage.

## Run it

The game must be served over HTTP (not opened as a file):

- **cPanel:** upload the folder contents to a subfolder (e.g. `public_html/isekai/`) and open `https://yourdomain/isekai/`.
- **Local:** `python3 -m http.server` in this folder, then open `http://localhost:8000`.

## Structure

- `index.html`: entry page, HUD and touch controls
- `src/`: game code (`main.js`, `player.js`, `enemies.js`, `world.js`, `characters.js`, `effects.js`, `hud.js`, `input.js`)
- `lib/`: Three.js r170 and the loaders it needs (no CDN required)
- `assets/models/`: compressed GLB models (meshopt + WebP), about 6.4 MB total
- `tools/`: scripts used to build the assets from the Quaternius packs

## Credits

All 3D models and animations are by Quaternius (CC0): Universal Base Characters, Modular Character Outfits (Fantasy), Universal Animation Library 1 and 2, and Stylized Nature MegaKit.
