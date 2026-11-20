# ISEKAI

A 3D isekai mini RPG for the web (Three.js), built for CrazyGames and Playgama.

## Milestone 2: Zone 1, Starter Meadow (story)

Jasper wakes up in Aster, meets GUIDE, and plays through the first chapter:

1. **Wake Up, Player One:** intro cinematic, follow the path to the village.
2. **A Loop Too Long:** Bram the blacksmith is stuck in a dialogue loop. PATCH him to get the Debug Blade.
3. **Slimes in the Field:** defeat 5 slimes in the east field (unlocks Blade Storm).
4. **The Broken Bridge:** the bridge's middle is deleted. PATCH it to rebuild it.
5. **Big Slime Problem:** boss fight with the Slime King. When he turns huge ("Unscaled") he is immune: PATCH him back, then hit him for double damage.

Side quest: Nia is stuck inside a wall in the village (PATCH her). Tomm only has one line.
Save crystals save progress and heal you. Progress is saved in the browser; use the menu (top right) to restart the story.
Jasper starts bare-handed (punch combo); the sword and other buttons unlock as the story goes.

| Action | PC | Phone |
| --- | --- | --- |
| Move / Look | WASD + mouse (click the screen first) | Joystick + drag right side |
| 8-move chain (slash, backslash, jab, hook, spin, rising spin, stab, finisher) | Keep clicking | Keep tapping ATK |
| Pommel Bash (stuns) | Click, Right-click | ATK, HVY |
| Glitch Breaker (ignores glitch resist) | Click, Click, Right-click | ATK, ATK, HVY |
| Heavy slam (shockwave) | Right-click | HVY |
| Block (hold) / Parry (block as a slime lunges) | Q | BLOCK |
| Counter (after a parry) | Click within 1.2 s | ATK |
| Dodge / Slide sweep (while sprinting) | Space | DASH |
| Dash strike | Click during a dodge, or while sprinting | ATK |
| Jump slam | F (away from villagers), then click in the air | JUMP, ATK |
| Blade Storm (4-hit spin) | R | SKILL |
| Talk | F (near a villager) | TALK |
| Patch | E | PATCH |
| Draw / put away sword | X | SWORD |

### Patch

Patch has one job: **fix glitched (purple) enemies**.

1. Purple enemies are bugged: your attacks barely hurt them (RESIST).
2. Press **PATCH** (E) near one: a beam fixes the bug, it turns green and freezes for 3 s.
3. While frozen it takes **double damage**. Hit it with a heavy, finisher or counter to **SHATTER** the ice for splash damage.

The PATCH button pulses when a glitched enemy is in range. Cooldown: 8 s.

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

All 3D models and animations are by Quaternius (CC0): Universal Base Characters, Modular Character Outfits (Fantasy), Universal Animation Library 1 and 2, Stylized Nature MegaKit and Medieval Village MegaKit.
