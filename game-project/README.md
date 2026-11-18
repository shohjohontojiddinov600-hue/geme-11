# Mythic Realms — Godot 4.x Project Structure

Ushbu katalog Godot 4.x dvigateli uchun moslashtirilgan to'liq arxitektura va resurslar tuzilmasini o'z ichiga oladi.

## Papkalar tuzilishi:
* `project.godot`: Godot 4 konfiguratsiyasi va input mapping (WASD, LMB, RMB, E, I, C, Esc).
* `scenes/`: Barcha asosiy menyular, dunyo, o'yinchi, dushmanlar, binolar va UI sahnalari.
* `scripts/`:
  * `managers/`: Tarmoq boshqaruvi (`network_manager.gd`), saqlash tizimi (`save_manager.gd`), vaqt va kun/tun boshqaruvi (`game_manager.gd`).
  * `systems/`: Protsedurali dunyo generatsiyasi (`procedural_world_gen.gd`), inventar va crafting tizimi.
  * `gameplay/`: O'yinchi harakati va boshqaruvi (`player_controller.gd`).
  * `data/`: 30 ta item va 25 ta retseptlar bazasi (`items_database.gd`).
* `data/`: JSON formatidagi xomashyolar, qurollar va dushmanlar ma'lumotlar bazasi.
* `docs/`: GDD (Game Design Document), boshqaruv va changelog hujjatlari.

## Godot 4 da ochish:
1. Godot 4.x dasturini ishga tushiring;
2. `Import` tugmasini bosib, ushbu `game-project/project.godot` faylini tanlang;
3. `F5` tugmasi orqali loyihani ishga tushirishingiz mumkin.
