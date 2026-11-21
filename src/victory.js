// "The Princess Returns": Victory's own story for New Game+.
// After an ending, NOVA's rules changed and Victory woke up in the Player slot (PLAYER TWO).
// Jasper's save broke: he fell back into Aster as an NPC and Sir Duplicate locked him in the cage of light.
// The story code is shared with Jasper's run; when Victory plays, the dialogue box swaps each line
// listed here for her version. Lines not listed get a simple name swap (see dialogue.js).
const V = (who, text, glitch) => ({ who, text, glitch, raw: true });

export const VICTORY_LINES = {
  // ---------------- Zone 1: Starter Meadow ----------------
  'Ugh... where am I? I was testing that weird build, and then...': [V('VICTORY', 'Starter Meadow...? The last thing I remember is the throne room. And Jasper making his choice.')],
  'HELLO, PLAYER ONE! Welcome to the world of ASTER! I am GUIDE, your tutorial assistant!': [V('GUIDE', 'HELLO, PLAYER TWO! Welcome to the-- Princess?! You are not supposed to be in the player slot!')],
  'A talking cube. Great. Am I... inside the game?': [V('VICTORY', 'Guide, it is me. Something rewrote the save. I think I am playing my own game.')],
  'Affirmative! Please complete the FINAL QUEST to win! Error: final quest not found. Error: error not found.': [V('GUIDE', 'Then the story has started over. And Player One\'s save file... is broken. I cannot find Jasper anywhere.')],
  'Let\'s start small. There is a village up this path. Follow the marker!': [V('GUIDE', 'Let us start where every story starts: the village up this path. Follow the marker!')],
  '...He\'s stuck. Like a broken NPC in a bad build.': [V('VICTORY', 'Bram? He polished my father\'s crown for twenty years. Now he is stuck on one line.')],
  'Dialogue loop detected! Wait... YOU can see the bug? Players are not supposed to see bugs!': [V('GUIDE', 'Dialogue loop detected! And you can SEE the bug, Princess. That is a Player\'s power.')],
  'Try this: point at him and press PATCH. It is a debug command. It fixes broken things!': [V('GUIDE', 'Point at him and use STARFALL. Your light fixes broken things, even from far away!')],
  'You fixed me, stranger. Take this. I forged it the day the sky started tearing. Never knew who it was for.': [V('BRAM', 'Your Highness?! In MY forge? Then this blade was meant for you. A rapier, light as a promise.')],
  'You got the DEBUG BLADE!': [V('SYSTEM', 'You got the STAR RAPIER!')],
  'Field cleared! You learn fast for a... what are you? A tester?': [V('GUIDE', 'Field cleared! You fight like a real Player, Princess.')],
  'I test games for a living. Find bugs, write reports. Never thought I\'d be IN one.': [V('VICTORY', 'I watched Jasper do it a hundred times. It turns out I was taking notes.')],
  'New skill unlocked: BLADE STORM. Use it when you are surrounded!': [V('GUIDE', 'New skill unlocked: RADIANCE! A burst of light that pushes enemies back and heals you. Use it when you are surrounded!')],
  'You restored deleted data! I have never seen that before. Who ARE you?': [V('GUIDE', 'You restored deleted data! A princess who can rewrite her own kingdom. NOVA will not like this.')],
  'Just a guy who reads crash logs. Come on, let\'s find this slime.': [V('VICTORY', 'Let NOVA worry. Come on, the Slime King is waiting.')],
  'Jasper... I scanned his data. The glitch was not HIS fault. Something is corrupting this world from far away.': [V('GUIDE', 'Princess... I scanned his data. The corruption is back, and it comes from the same place as last time.')],
  'And the only way home for you is to finish the FINAL QUEST... but the final quest was never finished.': [V('GUIDE', 'And there is something new inside it: a broken player file. Jasper\'s.')],
  'Then I guess I\'ll have to finish it myself.': [V('VICTORY', 'Then I will find him. He saved my world once. Now it is my turn.')],

  // ---------------- Zone 2: Glitchwood Forest ----------------
  'Those purple cracks. It looks like something is eating the textures.': [V('VICTORY', 'Glitchwood was the royal garden once. My mother planted half of these trees. Look what the Null did to them.')],
  'A Player. Here. After all this time...': [V('MIRA', 'The princess... as a Player? So the story really has changed.')],
  'You know what I am?': [V('VICTORY', 'You know who I am?')],
  'Leave... This place... was never... finished...': [V('THORNWRAITH', 'Princess...? No... the princess does not fight... You are a COPY... LEAVE...', true)],
  'I was made... to protect this forest... They left me... half made...': [V('THORNWRAITH', 'Your Highness... it was you... I guarded your garden... until they left me... half made...', true)],
  'Jasper... the Null did not start here either. The signal comes from the CAPITAL OF ASTER.': [V('GUIDE', 'Princess, the broken player signal is stronger now. It comes from the CAPITAL. From your own castle.')],
  'Then that\'s where we go next.': [V('VICTORY', 'Home, then. Let us go.')],

  // ---------------- Zone 3: Capital of Aster ----------------
  'The Capital of Aster! The royal city. This is where the main quest was always meant to go: Rescue the Princess.': [V('GUIDE', 'The Capital of Aster. Your city, Princess. The main quest here used to be "Rescue the Princess".')],
  'Is it just me, or are half these houses... the same house?': [V('VICTORY', 'And now the princess is the one doing the rescuing. Half these houses are the same house... my city looks like a broken save.')],
  '...Who goes-- Wait. I can stop saying that? Ahem. Captain Rho, commander of the castle guard. What is left of it.': [V('RHO', '...Who goes-- Your Highness?! You are FREE? Then who is in the cage? Captain Rho, at your service. What is left of the guard.')],
  'Princess Victory is locked in a cage of light in the castle courtyard, and the gate is sealed while any copy still stands.': [V('RHO', 'A stranger fell from the sky in strange clothes. Sir Duplicate locked him in the cage of light by the tower. He keeps saying your name. The gate stays sealed while any copy still stands.')],
  'Whatever you choose at the end, Jasper... I am glad it was you who came.': [V('JASPER', 'Whatever happens at the end, Victory... I am glad it was you who came for me.')],
  'Lead the way, Player One.': [V('JASPER', 'Lead the way, Player Two.')],
  'A Player. In MY hall. I was copied a hundred times, Player... and every copy is loyal.': [V('SIR DUPLICATE', 'A princess with a sword? The real princess is in her tower, where I put her. You are a COPY. And I destroy copies.', true)],
  'That is not our knight anymore. Jasper, I will heal you when you are hurt and shield you when he splits.': [V('JASPER', 'That is not your knight anymore. I will patch you up when you are hurt and shield you when he splits.')],
  'Then let\'s go rescue a princess. Never thought I would say that for real.': [V('VICTORY', 'Then let us go rescue a Player. I never thought I would say that.')],
  'Finally. Do you know how long I have been standing in that thing? Since the last patch. Which never came.': [V('JASPER', 'Victory?! You are... PLAYING? Then who is the princess?')],
  'You... know about patches?': [V('VICTORY', 'I am still the princess. The ending rewrote the save, and I woke up as Player Two.')],
  'I know I am a princess in a game, Jasper. I know my lines. I also know when someone is NOT reading theirs.': [V('JASPER', 'My save broke when you took the controls. I woke up in a cage, as an NPC with lines. It is a very strange feeling.')],
  'She is self-aware! Like Mira. Like... me?': [V('GUIDE', 'The Player is a princess and the princess is a Player. My database is crying.')],
  'Sir Duplicate is in the throne room. He was my knight once. Let me come with you. I can heal, shield and throw a little STARFALL.': [V('JASPER', 'Sir Duplicate is in the throne room. Let me come with you. I can heal, raise a barrier, and throw a little STARFALL I learned from a friend.')],
  'Princess... I only wanted... to protect you... from the ending...': [V('SIR DUPLICATE', 'Your Highness... it was really you... I only wanted... to protect you... from the ending...', true)],
  'Jasper. There is something I have not told you.': [V('JASPER', 'Victory. When my save broke, I saw something. NOVA did not just close Aster last time.')],
  'When a game is finished, its world stops. Everything in Aster, every person, every memory... gets saved and closed. Forever.': [V('JASPER', 'It is trying again. To NOVA, a finished game that opens itself back up is the worst bug there is.')],
  'You mean if I beat the game, all of you just... end?': [V('VICTORY', 'So if I finish it again... Aster closes. And this time I am inside it as the Player.')],
  'I hid it because I wanted you to choose for yourself. Not because a princess asked you to.': [V('JASPER', 'Then we finish it differently. Together. Two Players.')],
  'The Null comes from the edge of the map: the UNFINISHED ZONE. Whatever we decide, the answer is there.': [V('JASPER', 'The answer is at the edge of the map, in the UNFINISHED ZONE. Same as last time.')],

  // ---------------- Zone 4: The Unfinished Zone ----------------
  'Grey boxes. Labels. "tree_placeholder_02"... It looks like a level editor.': [V('VICTORY', 'So this is what is under my kingdom. Grey boxes and labels. "castle_placeholder_01"...')],
  'This is where the Null comes from. And somewhere above us is the one who sends it: NOVA.': [V('JASPER', 'I have been here before. NOVA is up there. Last time it asked ME to choose. This time it will ask you.')],
  'PLAYER DETECTED. ASTER: 99% COMPLETE. CLOSING FILE.': [V('NOVA', 'ERROR: CHARACTER IN PLAYER SLOT. A PRINCESS DOES NOT PLAY. CORRECTING.', true)],
  'Then we will write a different ending. Jasper, it stays out of reach: dodge until it comes down to reload, then hit its eye!': [V('JASPER', 'Then we write a different ending. Victory, it stays out of reach: dodge until it comes down to reload, then hit its eye!')],
  'If you finish the game, you go home and Aster closes. If you stay, Aster lives... and you never leave. Whatever you choose, I will not blame you.': [V('JASPER', 'It is your choice this time, Victory. Whatever you pick, I am with you. Even the new option.')],
};
