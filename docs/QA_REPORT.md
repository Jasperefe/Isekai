# ISEKAI: QA Report (build 32, 22 Nov 2026)

The checklist in `docs/TEST_CHECKLIST.md` was worked through with automated browser runs (Playwright + Chromium/SwiftShader at an iPhone-landscape size, 844 x 390, touch enabled). A story bot played every zone from start to boss for **both heroes** (Jasper and Victory), and separate scripts pressed every menu button, the Console, the shop, the forge, side quests, endings, New Game+ and every ad path.

**Result: 190 automated checks, 187 passed. The other 3 were mistakes in the test scripts, not in the game (details below). 3 real issues were found by looking at the screenshots and were fixed in build 32.**

## Coverage

| Area | Checks | Result |
| --- | --- | --- |
| Title screen (new game, continue, settings, credits, erase confirm, no TEST button, portrait lock) | 10 | all pass |
| HUD and touch layout (player card, quest pill, wallet, menu dot, console button, arc buttons, no SWORD button, message pills, toast, boss bar, minimap tap) | 11 | all pass |
| Menu: Gear (details, equip, unequip, scrap, full bag auto-scrap), Skills, Map (zoom, world map, locked travel), Settings (volume, graphics, minimap, New Game+ visibility, close) | 16 | all pass |
| Console (list layout, unlock, run, passive, locked message, cooldown) | 7 | 6 pass, 1 script mistake |
| Combat and save (no stamina, glitch resist + patch x2, parry, reload mid-zone) | 5 | all pass |
| Zone 1 full story, Jasper and Victory | 18 | all pass |
| Zone 2 full story, Jasper and Victory (Mira, Console, grove, seal, Thornwraith, road) | 16 | all pass |
| Zone 3 full story, Jasper and Victory (Rho, purge, cage, ally, keep door, Sir Duplicate, rift) | 18 | all pass |
| Zone 4 full story, Jasper (Finish ending) and Victory (Two Players ending), plus a NOVA death re-test | 34 | 32 pass, 2 script mistakes |
| Side content (Nia, forge, enemy respawn, Pip, secret chest markers, Dot's shop, ghost house, secret pad chest, true ending, New Game+ from Settings) | 24 | all pass |
| Build 32 fixes (forge name, skill names, zone card) | 5 | all pass |
| Playgama (lifecycle messages, pause/resume, audio, offer card timing/close/rewards/boss lock, revive card, failed ad, no rewarded support, interstitials on respawn and travel), run against the built zip | 26 | all pass |
| **Total** | **190** | **187 pass; the 3 others are test-script mistakes** |

## Things that behaved unexpectedly

| # | What | Status |
| --- | --- | --- |
| 1 | As Victory, Bram's forge still said "Debug Blade" (title and upgrade message). | **Fixed (build 32)**: it says "Star Rapier". |
| 2 | As Victory, the skill tree still said "Blade Storm", "PATCH" and "sword damage". | **Fixed (build 32)**: Radiance, STARFALL, rapier. |
| 3 | The "Zone cleared" card showed the touch buttons on top of it. | **Fixed (build 32)**: buttons hide until "Keep exploring". |
| 4 | Script mistake: "/speed cooldown" was read while /speed was still ACTIVE (it shows READY IN Ns after the 5 s). | Not a bug. |
| 5 | Script mistake: the "die in the NOVA fight" check hit Jasper while the ally's BARRIER was up (it absorbs one hit by design). Re-tested with the barrier cleared: NOVA resets, the stage goes back to the climb, the hero respawns on the NOVA island crystal. | Not a bug. |
| 6 | Noted, not changed: in the throne room the Talk prompts list also contains far-away NPCs (Rho, Dot); they never trigger because they are out of range. | No action needed. |

## Still to check by hand on a phone (cannot be measured here)

- Sound and music levels, and that music resumes after an ad (A5, M2).
- Real FPS per zone on the iPhone and the Auto graphics drop (N1, N2).
- How the joystick and buttons feel, the camera swing behind the hero, and pillars in the throne room (C1, C2, K6).
- Real Playgama ads after uploading `dist/ISEKAI_playgama.zip` (the SDK is blocked in the test sandbox; a scripted fake Bridge was used).

## How to re-run

The QA scripts live outside the repo (in the build workspace). The approach: load `index.html?fast` with a save in `localStorage['isekai_save_v2']`, step frames with `window.__step(1/30, n)`, read state from `window.__game`, and drive the story by teleporting the hero to `zone.map.objective()`, pressing PATCH, using interactables and damaging enemies. Fake the Playgama Bridge by serving a small mock at the `playgama-bridge.js` URL.
