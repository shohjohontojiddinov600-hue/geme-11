# "ROGUE CELLS" — YANGILANISH 2.0 (UPDATE 2.0) TEXNIK TOPSHIRIQ (TZ)

**Asosiy yo‘nalishlar:** Personajlarni insonlashtirish, Dinamik to‘siqlar, UI holatlari (State Management) va Tizim optimizatsiyasi.

## 1. Yangilanishning umumiy maqsadi

O‘yinni abstrakt shakllardan to‘laqonli insoniy qiyofadagi vizual uslubga o‘tkazish. Zindonlarda taktik chuqurlikni oshirish uchun turli xil to‘siqlar va tuzoqlarni joriy etish. O‘yin arxitekturasini qat'iy "Game State Machine" asosida qayta qurish va UI (foydalanuvchi interfeysi) o‘tishlarini silliq, xatosiz ishlashini ta'minlash. Tizim yuklamasini (memory leak va frame drop) kamaytirish.

---

## 2. Asosiy o‘zgarishlar va arxitektura (Scope of Work)

### 2.1. Personajlarni inson qiyofasiga keltirish (Humanoid System)

* **Vizual dizayn (Art & Animation):** Inson anatomiyasiga asoslangan 2D sprite'lar (`humanoid_player.png`, `humanoid_enemy.png`).
* **Qurol integratsiyasi (Weapon Pivot):** Qurol `WeaponPivot` (Node2D) orqali yelka/qo'l balandligiga biriktirilgan va sichqoncha kursori bo‘yicha 360 darajaga aylanadi. Kursorni chap/o'ng tomonga o'tishiga qarab qahramon tanasi va qurol tabiiy ravishda gorizontal/vertikal flip bo'ladi.
* **Hitbox va Kolliziya:** Inson qiyofasiga mos vertikal `CapsuleShape2D` (radius: 10, height: 36). Qurol hitbox ichiga kirmaydi.

### 2.2. To‘siqlar va qopqonlar tizimi (Obstacles & Traps)

* **Statik to‘siqlar (StaticBody2D):** Zindondagi tosh devorlar va ustunlar (`Wall1`, `Wall2`).
* **Dinamik to‘siqlar:**
  * **Buziladigan qutilar (`DestructibleCrate` / `crate.tscn`):** O‘q tekkanda miltillaydi, sinadi va ichidan tasodifiy tanga yoki dori tushadi.
  * **Portlovchi bochkalar (`ExplosiveBarrel` / `explosive_barrel.tscn`):** O‘q tekkanda portlaydi va 95px radiusdagi barcha obyektlarga 65 AoE zarar beradi.
* **Qopqonlar (`SpikeTrap` / `spike_trap.tscn`):** Taymer orqali avtomatik chiqib-tushadigan tikanlar. Tikanlar chiqqanda ustidagi har qanday qahramon yoki dushmanga 16 zarar yetkazadi.

### 2.3. Barcha UI holatlarini boshqarish (UI State Management)

Markazlashgan `GameUIManager.gd` (CanvasLayer, process_mode: PROCESS_MODE_ALWAYS):
* **State: PLAYING:** HUD ekranda jon (HP), Stamina, Tangalar, Ball, Qurol darajasi va dushmanlar soni.
* **State: PAUSED:** `ESC` tugmasi bosilganda o‘yin to‘xtaydi (`get_tree().paused = true`), xiralashtirilgan fon va Resume/Restart tugmalari chiqadi.
* **State: REWARD:** 3 ta mukofot kartasi (Jon tiklash, Tezlik etigi, Multi-shot qurol) chiqadi va o'yinchi birini tanlagach o'yin davom etadi.
* **State: GAME_OVER / VICTORY:** Natijalar paneli va qayta boshlash tugmasi.

### 2.4. Tizimni optimallashtirish (System Optimization)

* **Object Pooling (`BulletPool` / `bullet_pool.gd`):** Xotirada oldindan 100 ta o‘q yaratiladi. Otilganda faollashadi, tekkanda yoki vaqti tugaganda poolga qaytadi (Garbage Collection stutter yo'qoladi).
* **Physics Ticks Throttling:** Dushman AIsi yo‘lni har kadrda emas, har 0.25 soniyada hisoblaydi (`_ai_timer`).
* **Visibility Culling:** `VisibleOnScreenNotifier2D` orqali ekranda ko‘rinmaydigan dushmanlarning fizikasi to‘xtatiladi.
