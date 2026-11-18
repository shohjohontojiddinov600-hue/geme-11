# 10 TA MAJBURIY O'YIN TIZIMLARI: TO'LIQ IMPLEMENTATSIYA MATRITSASI
## Mythic Realms (2D Multiplayer Survival Sandbox — Capstone Loyiha)

Ushbu hujjat loyihada amalga oshirilgan 10 ta majburiy o'yin tizimining texnik tavsifi, koddagi joylashuvi va bajaradigan vazifalari to'g'risidagi hisobotdir.

---

| № | Tizim Nomi | Tizim Vazifasi | Web/Node.js Implementatsiyasi | Godot 4 Implementatsiyasi |
|---|---|---|---|---|
| 1 | **Game State Manager** | Menu, lobbi, o‘yin jarayoni, pauza, g‘alaba va mag‘lubiyat holatlarini boshqarish | `public/client.js`<br>`public/index.html`<br>`server/game.js` | [game-project/scripts/systems/game_state_manager.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/systems/game_state_manager.gd) |
| 2 | **Input Manager** | Klaviatura (WASD), sichqoncha (LMB, RMB), tezkor tugmalar va qulay boshqaruv | `public/client.js`<br>(WASD, Shift, Click, 1-8) | [game-project/scripts/systems/input_manager.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/systems/input_manager.gd)<br>[project.godot](file:///c:/Users/209/Desktop/game 1/game-project/project.godot) |
| 3 | **Camera System** | O'yinchini silliq kuzatish (lerp follow), ekran silkinishi, chegaralar va ko'rish maydoni | `public/renderer.js`<br>(Smooth camera lerp, frustum culling) | [game-project/scripts/systems/camera_system.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/systems/camera_system.gd) |
| 4 | **Audio Manager** | Musiqa, SFX (zarba, qadam, qazish, ovqat, o'q), ovoz balandligi | `public/audio.js`<br>(Web Audio API 8/16-bit sintezator) | [game-project/scripts/systems/audio_manager.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/systems/audio_manager.gd) |
| 5 | **Save/Load (Server Save)** | O'yinchi progressi, inventar, sandiqlar va dunyo holatini doimiy saqlash | `server/db.js`<br>(SQLite WAL rejimida 5 ta jadval) | [game-project/scripts/managers/save_manager.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/managers/save_manager.gd) |
| 6 | **Level/Scene Manager** | Bosh menyu, dunyo koshinlari, qayta tirilish va g'alaba sahnalariga o'tish | `public/client.js`<br>`public/index.html` | [game-project/scripts/systems/scene_manager.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/systems/scene_manager.gd) |
| 7 | **AI State Machine** | Dushmanlar va bosslarning xatti-harakati: Idle, Patrol, Chase, Attack, Kiting | `server/monsters.js`<br>(4 ta mob + 2 ta boss) | [game-project/scripts/ai/ai_state_machine.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/ai/ai_state_machine.gd) |
| 8 | **Inventory/Item DB** | 30 ta item, stack, qurollar, asboblar chidamliligi va 25 ta crafting retsepti | `server/items.js`<br>`server/recipes.js`<br>`server/game.js` | [game-project/scripts/data/items_database.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/data/items_database.gd)<br>[game-project/data/items/items.json](file:///c:/Users/209/Desktop/game 1/game-project/data/items/items.json) |
| 9 | **Procedural Generator** | 3 ta biom (O'rmon, Cho'l, Muzlik), 16x16 chunklar va resurslar generatsiyasi | `server/world.js`<br>(Deterministik koherent xarita) | [game-project/scripts/systems/procedural_world_gen.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/systems/procedural_world_gen.gd) |
| 10 | **Networking** | Lobby, real-vaqt sinxronizatsiya, server avtoriteti va lag kompensatsiyasi | `server/index.js`<br>`server/game.js`<br>(30 Hz WebSockets) | [game-project/scripts/managers/network_manager.gd](file:///c:/Users/209/Desktop/game 1/game-project/scripts/managers/network_manager.gd) |

---

### Barcha 10 ta Tizimning Qabul Sinovi Natijasi:
Barcha 10 ta tizim to'liq integratsiya qilingan va `npm test` orqali 5/5 (100%) avtomatlashtirilgan sinovlardan muvaffaqiyatli o'tgan.
