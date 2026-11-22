# ISEKAI: Manual Test Checklist (build 31)

How to use: play on a phone in landscape (and once on PC). Tick each line. If something fails, note the ID, what you did and what happened, plus a screenshot.
Tip: Menu > Settings > Restart story gives a clean save. New Game+ buttons appear in Settings after any ending.

## A. Boot and title screen
- [ ] A1 Loading screen shows the ISEKAI logo and a progress bar that fills.
- [ ] A2 First launch: title shows NEW GAME highlighted; CONTINUE is hidden.
- [ ] A3 With a save: CONTINUE shows "Level N · Zone name"; NEW GAME asks before erasing.
- [ ] A4 SETTINGS on the title opens the settings tab; CREDITS opens the credits; BACK closes them.
- [ ] A5 First tap turns the sound on ("tap for sound" hint disappears).
- [ ] A6 Phone held upright: "Rotate your device" covers the game and time stops; turning back resumes.
- [ ] A7 Travelling to another zone skips the title and starts directly in the new zone.

## B. HUD
- [ ] B1 Player card: portrait, name, PLAYER ONE (or PLAYER TWO as Victory), level badge, HP number, stamina and XP lines.
- [ ] B2 Quest pill (top left) shows title, objective and distance in metres; it updates when the stage changes.
- [ ] B3 Guide arrow on the ground points to the objective when it is more than 7 m away.
- [ ] B4 Minimap turns with the camera, shows N, the objective, enemies; tapping it opens the Map.
- [ ] B5 Gold and shards (top right) update after pickups.
- [ ] B6 Menu button opens the menu; the gold dot appears when a skill point is waiting.
- [ ] B7 Console button only appears after Mira unlocks it (Zone 2).
- [ ] B8 Message pills appear at the top centre, fade within about 3 s, and the same message does not repeat within 20 s.
- [ ] B9 New objective toast appears at the top and does not cover the middle of the screen.
- [ ] B10 Boss bar appears at the top in boss fights; the quest pill hides during the fight.
- [ ] B11 Floating numbers: damage (white), crits, healing/XP (gold), hurt (red).
- [ ] B12 Death screen "GAME OVER?" then respawn at the last save crystal.

## C. Touch controls
- [ ] C1 Joystick appears under the thumb; small push walks, normal push runs, edge sprints.
- [ ] C2 Dragging on the right side turns the camera; the camera swings behind the hero when running.
- [ ] C3 Buttons in an arc: ATTACK, BLOCK, HEAVY, DODGE, JUMP, PATCH, STORM (Victory: AEGIS, LUNGE, BLINK, STARFALL, RADIANCE).
- [ ] C4 Before Bram gives the sword: only ATTACK (punches), DODGE and JUMP are shown.
- [ ] C5 PATCH glows when something patchable is in range; STORM shows a cooldown sweep.
- [ ] C6 TALK/OPEN/ENTER/GATE button appears near people, chests, doors and gates.
- [ ] C7 Buttons hide during dialogue, menus and the Console.

## D. Menu
- [ ] D1 GEAR: tap an item to see details; Equip, Unequip, Scrap (+shards) work; stats box updates.
- [ ] D2 GEAR: bag count shows N/24; a full bag auto-scraps the weakest item (no pop-up).
- [ ] D3 SKILLS: spend a point; locked nodes need the one above; the badge counts free points.
- [ ] D4 MAP > ZONE: map picture, fog of war, places, chests, gates, crystals, the objective; zoom +/- and "find me" work.
- [ ] D5 MAP > WORLD: four zones; reached zones can be travelled to; unreached zones are locked; cleared zones show a tick.
- [ ] D6 SETTINGS: music and effects sliders change volume and are remembered after reload.
- [ ] D7 SETTINGS: graphics Auto/High/Med/Low; FPS counter updates; Auto shows the current level.
- [ ] D8 SETTINGS: minimap switch hides/shows the minimap and is remembered.
- [ ] D9 SETTINGS: Replay this zone resets the zone story but keeps level, gear, gold.
- [ ] D10 SETTINGS: New Game+ as Victory / as Jasper only appear after an ending.
- [ ] D11 SETTINGS: Credits; Restart story asks for confirmation and erases the save.
- [ ] D12 No TEST "Next zone" button anywhere.
- [ ] D13 Closing the menu (X) resumes the game.

## E. Console (after Zone 2)
- [ ] E1 Opens as a list: name, description, state on the right; X closes it; time slows while open.
- [ ] E2 Locked command shows "LOCKED · N PTS"; tapping it explains where Debug Points come from.
- [ ] E3 With enough points: "UNLOCK · N PTS" spends the points; the state becomes RUN (or ALWAYS ON).
- [ ] E4 RUN: /speed, /noclip, /slowmo, /godmode each work for their time, then show READY IN Ns.
- [ ] E5 /doublejump: always on after unlocking; a second jump works in mid-air.

## F. Zone 1: Starter Meadow (Medium)
- [ ] F1 Intro dialogue, then follow the marker to the village.
- [ ] F2 Talk to Bram (dialogue loop) then PATCH him: Debug Blade, sword buttons unlock.
- [ ] F3 Nia stuck in a wall: PATCH her (+60 XP). Tomm repeats his one line.
- [ ] F4 Slimes in the east field: counter goes down; Blade Storm unlocks after.
- [ ] F5 Bridge: PATCH rebuilds the deleted middle.
- [ ] F6 Slime King: red ring jumps, he grows huge (immune), PATCH him back, x2 damage window; enraged wave.
- [ ] F7 Win: loot, Debug Point, Zone complete card; gate north opens to Glitchwood.
- [ ] F8 Bram's forge: upgrade with gold + shards; "Not enough" when short.
- [ ] F9 Four chests in Zone 1 (map shows them once found).

## G. Zone 2: Glitchwood Forest (Medium-Hard)
- [ ] G1 Arrival dialogue; Null Wolves pounce (dodge, then counter); Static Sprites teleport and zap.
- [ ] G2 Find Mira (lantern, west): Area Patch, the Console, +1 Debug Point; she asks about Pip.
- [ ] G3 Corrupted Grove cleared; Pip freed (PATCH); returning Pip to Mira: Pip follows you.
- [ ] G4 Break the seal: kill every Null enemy; the marker points to the nearest.
- [ ] G5 Root Hollow: Thornwraith (red circles = roots; PATCH the glitched arm; expose the heart).
- [ ] G6 Secret chests: one needs /noclip, one needs /doublejump; hints tell how many are left.
- [ ] G7 Golden door in the hollow: Road to the Capital (after the boss).

## H. Zone 3: Capital of Aster (Hard)
- [ ] H1 Arrival at the south gate; walk to the Market Plaza.
- [ ] H2 Captain Rho loop: PATCH him; the purge starts.
- [ ] H3 Copy Guards block from the front (heavy or get behind); Error Mages throw broken code.
- [ ] H4 Dot's shop: glitched prices until patched; buy items; not enough gold message.
- [ ] H5 Ghost houses: PATCH them, a chest drops out (two of the four chests).
- [ ] H6 Tower: PATCH the cage of light; Victory joins (heals, barrier, starfall); she walks BESIDE you.
- [ ] H7 Keep door (north of the courtyard): ENTER the throne room; camera stays inside the walls and in front of the pillars.
- [ ] H8 Sir Duplicate: shield, charge, slam waves, 3 mirror phases (hit the one who is LATE); x2 HP vs before.
- [ ] H9 Win: glitch rift opens behind the throne; ENTER leads to Zone 4; returning from Zone 4 arrives in the throne room.

## I. Zone 4: The Unfinished Zone (Hell)
- [ ] I1 Arrival on the spawn pad; spawn pad returns to the Capital throne room.
- [ ] I2 Placeholder town: mannequins lunge along a red lane; glitched ones blink; Missing Texture cubes leave pink puddles.
- [ ] I3 TODO bridge: PATCH it at the end of the built half; it completes.
- [ ] I4 Asset Graveyard cleared: floating tiles appear to NOVA's Core.
- [ ] I5 Falling into the void: back on the last safe tile, -15% HP, message once.
- [ ] I6 Secret path east of town (4 tiles) to a chest with a Debug Point.
- [ ] I7 NOVA: error rain squares, DELETE beam (jump it), summons at 75/50/25%, enrage under 33%; only hittable while RELOADING; PATCH the glitched eye.
- [ ] I8 Dying in the fight resets NOVA and sends you back to the climb.
- [ ] I9 Choice screen: Finish / Stay / locked secret (shows chests found x/14) / Not yet.
- [ ] I10 "Not yet" closes it; "Answer NOVA" at the core reopens it.
- [ ] I11 Each ending plays its scene and the ending card (New Game+ as Victory / as Jasper, Credits, Keep exploring).
- [ ] I12 With all 14 chests: PATCH NOVA (true ending) is available.

## J. Victory (New Game+)
- [ ] J1 New Game+ keeps level, gear, gold and skills; every zone restarts; HUD says VICTORY / PLAYER TWO in gold.
- [ ] J2 Her lines: intro, Bram (Star Rapier), Rho, the cage (Jasper is locked inside), Sir Duplicate, NOVA.
- [ ] J3 Rapier chain (7 hits), LUNGE, BLINK (stops at ledges), AEGIS (reflect on perfect block), STARFALL (longer range), RADIANCE (heals).
- [ ] J4 Jasper is the ally in Zones 3 and 4 with his own name tag and portrait.
- [ ] J5 Her endings: Finish, Stay and rebuild, Two Players, secret Patch NOVA; "Endings seen x/4".

## K. Combat and edge cases
- [ ] K1 Stamina runs out: heavy, dodge and skills flash the stamina bar and do nothing.
- [ ] K2 Perfect block = PARRY then COUNTER; late block = chip damage; empty stamina = guard break.
- [ ] K3 Glitched enemies resist until patched; patched = frozen + x2 damage; Area Patch chains.
- [ ] K4 Death outside a boss: revive card (if ads) or respawn at crystal; inside a boss: boss resets.
- [ ] K5 Enemies in a cleared zone respawn after about 3 minutes; bosses never respawn.
- [ ] K6 Camera never sits inside a wall or behind a pillar; hero never runs "backwards" for long.
- [ ] K7 Interacting with Victory never blocks a door or gate prompt.

## L. Save and load
- [ ] L1 Reload in the middle of each zone: stage, kills, chests, crystal and flags come back.
- [ ] L2 Save crystals heal and save; respawn at the last one touched.
- [ ] L3 Opened chests stay opened; cleared enemies stay dead until the zone is done.
- [ ] L4 New Game+ save shows "Level N · Zone" on the title.

## M. Playgama and ads (see the ads table in the handoff)
- [ ] M1 Bridge messages: in_game_loading_started/stopped, game_ready, gameplay_started/stopped.
- [ ] M2 Platform pause/resume and audio on/off events pause and mute the game.
- [ ] M3 Offer card: about every 4 minutes, closes with X, hides after 15 s, never in bosses/dialogue/menus.
- [ ] M4 Offer rewards: 2x XP (timer badge, XP really doubled), gold, shards, full heal (only when hurt).
- [ ] M5 No reward when the ad is skipped or fails.
- [ ] M6 Revive card: rewarded revive; failed ad = normal respawn; never in boss fights.
- [ ] M7 Interstitial before zone travel and on respawn (minimum 90 s apart); never at game start.
- [ ] M8 Without the SDK (blocked) the game runs with no ads and no offer cards.

## N. Performance
- [ ] N1 Each zone holds 30+ FPS on the phone (Settings shows FPS); Auto lowers quality if needed.
- [ ] N2 No long freeze when entering a zone after the loading bar.
