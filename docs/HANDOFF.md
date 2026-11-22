# ISEKAI: Project Handoff (build 33)

This document describes everything built so far, so the project can continue in a new conversation (or with another developer) without losing anything. Paste or attach it at the start of a new chat and say "continue ISEKAI from this handoff".

## 1. The project at a glance

| Item | Value |
| --- | --- |
| Game | **ISEKAI**: a 3D action RPG for the web (Three.js), played in landscape on phones and on PC |
| Owner | Tolex (GitHub: Jasperefe) |
| Live build | https://jasperefe.github.io/Isekai/ (GitHub Pages, branch `main`) |
| Repository | https://github.com/Jasperefe/Isekai |
| Engine | three.js r170, vendored in `lib/` (no build step, plain ES modules + import map) |
| Platforms | Playgama (Bridge SDK integrated since build 30; upload zip from `tools/build_playgama.sh`), CrazyGames later |
| Current build | **33** (stamped with `python3 tools/bump.py 33`) |
| Main test device | iPhone, Safari, landscape |

### Working rules agreed with the owner

1. **Wait for "Go"**: show a design or plan first, build only after the owner says Go.
2. **English only** in code, comments and all game text.
3. Tell the owner exactly what to download when new assets are needed.
4. Do not reuse assets the owner used in his other games unless edited beyond recognition. (Never open the repos pax-terra, siege-of-eternity or tiny-planet-defender.)
5. Players must never get stuck: clear quest text, a guide arrow, map markers and hints.
6. Report back with screenshots after each build.

### Where we stopped (22 Nov 2026, build 32)

- The game is feature-complete: 4 zones, 4 bosses, Jasper's 3 endings, Victory's New Game+ with her own story, abilities and 4 endings, release difficulty, Playgama ads.
- A full QA pass was just completed (see section 9). All checks pass; 3 small issues found were fixed in build 32.
- The Playgama upload zip is built (`bash tools/build_playgama.sh` makes `dist/ISEKAI_playgama.zip`, about 15 MB). **Next action for the owner:** upload it to the Playgama developer dashboard and test real ads on the phone.
- Open items: the hand checks in `docs/QA_REPORT.md` (sound, real FPS, feel, real ads), then the CrazyGames build.
- Owner preferences carried over: wait for "Go" before building, English only, show designs first, send screenshots after each build, keep the UI clean (he dislikes crowded panels and repeating pop-ups).

## 2. Story

Jasper, a game tester, wakes up inside **Aster**, an unfinished fantasy game. A floating cube called **GUIDE** helps him. Jasper can see bugs and fix them with **PATCH**. The corruption (the **Null**) comes from **NOVA**, the system that closes finished games.

| Zone | Name | Boss | Story beats |
| --- | --- | --- | --- |
| 1 | Starter Meadow | Slime King | Bram's dialogue loop, Debug Blade, slimes, deleted bridge, Nia in the wall, Tomm's one line |
| 2 | Glitchwood Forest | Thornwraith | Mira (cut beta NPC), Area Patch, the Console, Pip the fox (pet), Root Hollow seal, 4 chests incl. secrets (/noclip, /doublejump) |
| 3 | Capital of Aster | Sir Duplicate | Captain Rho, Dot's glitched shop, copy guards and error mages, Victory in a cage of light, ghost houses, throne room boss, glitch rift |
| 4 | The Unfinished Zone | NOVA | Placeholder town, the "TODO: finish bridge", Asset Graveyard, floating tiles, NOVA's Core, the ending choice |

### Endings

- Jasper's run: **Finish the game** (go home, Aster closes), **Stay** (become Aster's developer), and the secret **Patch NOVA** (true ending, needs all 14 chests: Zone 1: 4, Zone 2: 4, Zone 3: 4, Zone 4: 2).
- Victory's run (New Game+): **Finish the game**, **Stay and rebuild**, **Two Players** (her own ending) and the secret **Patch NOVA**.
- After any ending: **New Game+** as Victory or Jasper (keeps level, gear, gold and skills; every zone's story resets). Also available in Menu > Settings.

### Victory's story: "The Princess Returns"

After an ending, NOVA's rules changed and Princess Victory woke up in the player slot as **PLAYER TWO**. Jasper's save broke: he fell back into Aster as an NPC and Sir Duplicate locked him in the cage of light. 50 key dialogue lines are rewritten for her in `src/victory.js` (keyed by Jasper's original line). All other lines get a name swap (Jasper and Victory, PATCH to STARFALL and so on) in `src/dialogue.js`.

## 3. Heroes and controls

| Action | Jasper | Victory (New Game+) | PC | Phone |
| --- | --- | --- | --- | --- |
| Attack chain | 8-move sword chain | 7-move gold rapier chain (faster, thrusts) | Click | ATTACK |
| Heavy | Heavy slam | LUNGE (long dash stab) | Right-click | HEAVY / LUNGE |
| Dodge | Roll (slide while sprinting) | BLINK (5.5 m teleport, stops at ledges) | Space | DODGE / BLINK |
| Block | Block / parry | AEGIS (longer parry window, reflects 1.5x damage) | Q | BLOCK / AEGIS |
| Patch | Fix a glitched enemy (freeze, x2 damage) | STARFALL (same, 1.7x range, light from the sky) | E | PATCH / STARFALL |
| Skill | Blade Storm (4-hit spin) | RADIANCE (area burst, stun, heals 20% HP) | R | STORM / RADIANCE |
| Jump / Talk | | | F | JUMP / TALK |
| Console | Cheat commands bought with Debug Points | | C | console button by the menu |

Combos (both heroes): attack then heavy = Bash; attack, attack, heavy = Breaker; heavy during a dodge = dash strike; attack in the air = slam; attack right after a parry = Counter.

The ally follows beside you in Zones 3 and 4 (Victory, or Jasper in Victory's run): heals at low HP, casts a Barrier in boss fights and throws Starfall.

## 4. Code map (`src/`)

| File | Purpose |
| --- | --- |
| `main.js` | Boot, renderer, camera rig (auto-swings behind the hero), zone loading, frame loop, interactables, guide arrow, portraits, title screen, graphics auto-quality, New Game+ hero swap, ads wiring, test hooks `window.__step` and `window.__game` |
| `player.js` | Hero movement, combat state machine, both move sets (`MOVES` / `VMOVES`), Blink, Aegis, Radiance, Patch/Starfall, XP, death, revive |
| `characters.js` | Builds characters from GLB (headphones, Debug Blade, Victory's circlet) |
| `input.js` | Keyboard, mouse, touch joystick and buttons |
| `hud.js` | HUD bars, quest pill, message pills (no repeats within 20 s, max 3.5 s), toasts, boss bar, floating numbers |
| `dialogue.js` | Dialogue box, portraits, New Game+ swap (uses `victory.js`) |
| `victory.js` | Victory's rewritten story lines |
| `profile.js` | Save data (localStorage key `isekai_save_v2`), stats, items |
| `menu.js`, `skills.js`, `items.js`, `loot.js`, `shop.js`, `console.js` | Gear, skill tree, drops (auto-scrap when the bag is full), Dot's shop, the Console (list panel) |
| `map.js` | Zone map capture, fog of war, map screen, world map and travel, minimap |
| `audio.js` | Music tracks and synthesized sound effects, mute for ads |
| `effects.js` | Particles, slashes, beams, shockwaves |
| `ally.js`, `pet.js`, `npc.js`, `guide.js`, `portraits.js` | Ally, Pip, villagers, GUIDE, portrait renders |
| `zone1.js` ... `zone4.js` | Zone modules (same interface: world, enemies, npcs, boss, story, chests, interactables, map data, update) |
| `world.js`, `world2.js`, `world3.js`, `world4.js` | The four worlds (colliders, ground height, camera blockers) |
| `story.js` ... `story4.js` | Quest stages, dialogue, objectives, saves per zone |
| `enemies*.js`, `boss*.js`, `monsters2.js` | Enemies and bosses per zone |
| `endings.js` | Choice screen, ending scenes, ending card, New Game+ |
| `difficulty.js` | Per-zone difficulty multipliers |
| `ads.js` | Playgama Bridge: lifecycle, pause/audio, interstitials, rewarded offers |
| `style.css` | All UI styles (HUD v2 section at the end) |

Other folders: `lib/` (three.js), `assets/models` (GLB, meshopt-compressed), `assets/audio` (music), `tools/` (`bump.py` cache-bust stamp, `build_playgama.sh`, asset build scripts that need a separate Node workspace with gltf-transform).

## 5. Difficulty (release tuning, build 30)

| Zone | Level | Enemy HP / damage | Boss HP / damage | Extra |
| --- | --- | --- | --- | --- |
| 1 Starter Meadow | Medium | x1.2 / x1.2 | x1.3 / x1.25 | |
| 2 Glitchwood | Medium-Hard | x1.35 / x1.35 | x1.5 / x1.4 | |
| 3 Capital | Hard | x1.6 / x1.55 | x2.0 / x1.7 | Sir Duplicate attacks 30% sooner, 3 mirror phases |
| 4 Unfinished Zone | Hell | x1.9 / x1.85 | x2.4 / x2.1 | NOVA: faster, denser error rain, faster beam, shorter reload windows, 3 summon waves |

Enemy stats also scale with the hero's level. Tune all of it in `src/difficulty.js` (and NOVA's timings in `boss4.js`).

## 6. Ads (Playgama Bridge)

The SDK loads from `https://bridge.playgama.com/v1/stable/playgama-bridge.js` in `index.html`. If it fails to load, the game runs normally with no ads.

| # | Type | Where | Reward |
| --- | --- | --- | --- |
| 1 | Rewarded | **Revive card**: when you die outside a boss fight | Revive on the spot with full HP |
| 2 | Rewarded | **Offer card** (left side, about every 4 minutes of play, hides after 15 s; never in bosses, dialogue or menus) | One of: 2x XP for 3 minutes, gold (150 + 25 x level), shards (10 + level), full heal (only when below 60% HP) |
| 3 | Interstitial | Travelling between zones (gates, world map, rift) | |
| 4 | Interstitial | Respawning at a save crystal | |

Rewards are granted only on the SDK's `rewarded` state. Interstitials respect a 90 s minimum gap. The game sends `game_ready`, `in_game_loading_started/stopped`, `gameplay_started/stopped`, and pauses and mutes on the platform's pause/audio events and while any ad is open.

To build the upload: `bash tools/build_playgama.sh` makes `dist/ISEKAI_playgama.zip` (index.html at the root).

## 7. How to work on it

1. Clone: `git clone https://github.com/Jasperefe/Isekai`.
2. Serve the folder with any static server, for example `python3 -m http.server 8766`, then open `http://localhost:8766/`. Add `?fast` to skip waits (tests).
3. After changes: `python3 tools/bump.py <next build number>` (stamps `?v=N` on every import, so phones load fresh files), commit and push to `main`; GitHub Pages updates in a minute.
4. Headless tests use Playwright + Chromium with SwiftShader (`--use-gl=swiftshader`). Use `window.__step(dt, n)` to step frames and `window.__game` to reach the player, enemies, story, etc. Never `await` something that waits for dialogue inside `page.evaluate`: advance dialogue with `window.__game.dialogue.advanceReq = true` while stepping.
5. Save data lives in localStorage `isekai_save_v2`. A test can set it before loading the page.

## 8. Build history

| Build | What changed |
| --- | --- |
| M1-M2 | Core prototype, combat (8-move chain, parry, dash strike, Blade Storm), Zone 1 story |
| M3-M4 | Zone 2 Glitchwood, Mira, Console, Pip, Thornwraith, gear and skill tree, loot |
| 18 | Zone map (rendered from the world), fog of war, minimap, world map and travel |
| 20 | Difficulty pass 1 (Zone 1 medium, Zone 2 medium-hard, Zone 3 hard) |
| 21-27 | Zone 3 Capital: Rho, Dot's shop, copy guards, Victory and the ally system, Sir Duplicate, landscape lock, camera fixes, guide arrow |
| 28 | Milestone 7: Zone 4, NOVA, three endings, New Game+ (Victory playable), throne-room camera fix, Sir Duplicate cape fix |
| 29 | Camera always swings behind the hero; ally walks beside; bag-full pop-up replaced by auto-scrap |
| 30 | HUD v2, Victory's own abilities and story, Two Players ending, release difficulty, TEST button removed, Playgama ads (revive, offer card, interstitials) and build script |
| 31 | Console redesigned as a calm list panel; Victory is greeted as "Player Two" |
| 32 | Full QA pass (190 automated checks, both heroes, all zones, all menus, Playgama). Fixes: Victory's forge says Star Rapier, Victory's skill tree uses her ability names, the zone-cleared card hides the touch buttons |
| 33 | After each boss: the quest pill says WHAT NEXT, the marker and guide arrow point to the next zone's exit (gate, crypt door, rift), and the zone-cleared card's button is SHOW ME THE WAY |

## 9. Testing and QA

- `docs/TEST_CHECKLIST.md`: the step-by-step manual checklist (sections A to N: title, HUD, touch, menu, Console, each zone, Victory, combat edge cases, save/load, Playgama, performance).
- `docs/QA_REPORT.md`: results of the build 32 run (190 checks) and what still needs a real phone (sound, FPS, feel, real ads).

## 10. Next steps (not started)

- Upload `dist/ISEKAI_playgama.zip` to the Playgama developer dashboard and test the ads there.
- CrazyGames build (their SDK is different; Playgama Bridge also supports CrazyGames).
- Optional: cloud save through `bridge.storage`, leaderboards, achievements.
- Optional: more Victory-specific voice lines in side conversations (Bram, Nia, Mira, Dot).

## 11. Credits (in game)

Music: "Daydream of a Deity" by Fablefly Music (CC BY 4.0); "Awakening" and "Elven Companion" by kmontesdev (CC0); "Cathedral in the Forest" by congusbongus (CC0); "Medieval: King's Feast" by RandomMind (CC0). Characters, animations, village and props: Quaternius (CC0). KayKit Forest Nature, Halloween Bits and Dungeon packs: Kay Lousberg (CC0). Castle Kit and Fantasy Town Kit: Kenney (CC0). Engine: three.js (MIT). Monsters, Zone 4, sound effects and code: made for ISEKAI.
