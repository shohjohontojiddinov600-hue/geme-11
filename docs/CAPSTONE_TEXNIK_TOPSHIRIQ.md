# MYTHIC REALMS — 2D MULTIPLAYER SURVIVAL & CRAFTING SANDBOX
## Yakuniy Capstone Loyihasi uchun Kengaytirilgan Texnik Topshiriq (TZ) va Arxitektura Hujjati

---

### 1. Loyihaning Umumiy Tavsifi va Qabul Qilish Mezonlari

* **Loyiha nomi:** Mythic Realms
* **Janr:** 2D Top-Down Sandbox / Survival / Co-op Multiplayer
* **Murakkablik darajasi:** Ekspert / Capstone (12-loyiha)
* **Maqsadli platforma:** Web (HTML5 Canvas / WebGL) va Desktop (Windows)
* **Arxitektura paradigmasi:** Server-Authoritative Realtime Networking (WebSockets + Node.js / SQLite WAL)

#### Asosiy Qabul Qilish Mezonlari:
1. **Server-Authoritative Dunyo Holati (World State):** O'yin dunyosi holati, chunklar, dushmanlar, tushib qolgan buyumlar (drop items) va barcha o'yinchi atributlari to'liq serverda hisoblanadi va saqlanadi. Mijoz (client) faqat ko'rsatish (rendering) va foydalanuvchi buyruqlarini yuborish vazifasini bajaradi.
2. **Item Duplikatsiyasining Qat'iy Oldini Olish (Anti-Duplication):** Buyumlarni almashish (trade), sandiqqa solish (chest storage), yerga tashlash (drop) va yasash (crafting) jarayonlari ACID tamoyillariga asoslangan atomik tranzaksiyalar va GUID (UUID v4) orqali boshqariladi.
3. **Server Halokatidan Keyin To'liq Tiklanish (Crash Recovery):** Server kutilmaganda to'xtasa yoki qayta ishga tushsa, SQLite Write-Ahead Logging (WAL) va davriy xotira suratlari (auto-save snapshot) orqali oxirgi 5 soniyagacha bo'lgan barcha o'zgarishlar to'liq tiklanadi.
4. **Sinxron Harakat va Jang (Lag Compensation & Reconciliation):** 2–8 nafar o'yinchi real vaqtda bir-birlarining harakatlarini va jang jarayonini silliq (interpolatsiya va prediktsiya orqali) ko'radi; server-side hitbox va masofa tekshiruvi xitlar to'g'riligini kafolatlaydi.

---

### 2. Tizim Arxitekturasi va Server-Authoritative Modeli

Tizim mijoz-server arxitekturasida ishlaydi. Mijoz tomoni o'yin mantig'ini o'zgartira olmaydi (Anti-Cheat).

```mermaid
flowchart TD
    subgraph ClientA ["Client A (Browser / Desktop)"]
        CA_Input["Input Capture (WASD, Mouse)"]
        CA_Pred["Client Prediction & Interpolation"]
        CA_Render["Canvas / WebGL Renderer"]
        CA_Audio["Audio Engine (SFX / Ambient)"]
    end

    subgraph ClientB ["Client B (Browser / Desktop)"]
        CB_Input["Input Capture"]
        CB_Pred["Client Prediction & Interpolation"]
        CB_Render["Renderer"]
    end

    subgraph Server ["Authoritative Game Server (Node.js)"]
        WS_Gate["WebSocket Gateway (ws / binary protocol)"]
        TickLoop["Tick Loop (30 Ticks/sec)"]
        WorldSim["World & Chunk Simulation"]
        CombatSys["Combat & Hitbox Validation"]
        AntiDupe["Transactional Inventory Engine"]
        AoIManager["Spatial Grid / AoI Broadcaster"]
    end

    subgraph Storage ["Persistent Storage"]
        DB[(SQLite with WAL Mode)]
        WorldBlobs["World Chunks Delta Storage"]
    end

    CA_Input -->|Move / Action Intents| WS_Gate
    CB_Input -->|Move / Action Intents| WS_Gate
    WS_Gate --> TickLoop
    TickLoop --> CombatSys
    TickLoop --> WorldSim
    TickLoop --> AntiDupe
    TickLoop --> AoIManager
    AoIManager -->|Delta World State (30Hz)| CA_Pred
    AoIManager -->|Delta World State (30Hz)| CB_Pred
    CA_Pred --> CA_Render
    CB_Pred --> CB_Render
    AntiDupe <--> DB
    WorldSim <--> WorldBlobs
```

#### Asosiy parametrlar:
* **Server Tick Rate:** 30 Hz (har 33.3 ms da yangilanish).
* **Area of Interest (AoI):** O'yinchiga butun xarita emas, faqat uning ko'rish radiusi (viewport + 2 ta zaxira chunk, ya'ni $48 \times 32$ blok) ichidagi ma'lumotlar yuboriladi. Bu tarmoq trafigini 80% ga kamaytiradi.
* **Client Prediction & Server Reconciliation:** Harakatlanish paytida mijoz server javobini kutmasdan oldinga siljiydi, server tasdiqlaganda koordinatalar sinxronlanadi; tafovut yuzaga kelsa, server pozitsiyasiga silliq interpolatsiya qilinadi.

---

### 3. Item Duplikatsiyasiga Qarshi Tranzaksion Tizim (Anti-Dupe)

Multiplayer o'yinlardagi eng katta muammo — tarmoq uzilishi yoki bir vaqtda qilingan so'rovlar (race conditions) orqali buyumlarni ko'paytirib olishdir. 

#### Himoya Qoidalari:
1. **Har bir buyum uchun Unikal ID (UUIDv4):** Stackable bo'lmagan barcha asboblar, qurollar va noyob buyumlar o'ziga xos global identifikatorga ega. Stackable buyumlar esa yagona stack-ID ostida saqlanadi.
2. **Atomik Tranzaksiya (Two-Phase Transfer):**
   * Buyum o'yinchi inventaridan sandiqqa o'tkazilganda yoki yerga tashlanganda:
     Source Slot -> Lock -> Validation -> Atomic Swap -> Destination Slot -> Unlock
   * Agar jarayonning istalgan bosqichida uzilish ro'y bersa (masalan, paket yo'qolsa yoki o'yinchi Disconnect bo'lsa), tranzaksiya Rollback qilinadi. Buyum hech qachon bir vaqtning o'zida ikkita joyda mavjud bo'la olmaydi.
3. **In-Memory Lock (Mutex):** Sandiq yoki savdo oynasi (Trade Window) ochilganda, unga bir vaqtning o'zida faqat 1 ta o'yinchi yozish huquqiga ega bo'ladi (yoki tranzaksiya navbatiga qo'yiladi).

---

### 4. Protsedurali Dunyo Generatsiyasi va Doimiy (Persistent) Xotira

Dunyo cheksiz/katta koordinatali maydon bo'lib, chunk tizimiga asoslanadi.

#### Chunk va Xarita Parametrlari:
* **Chunk o'lchami:** 16x16 ta koshin (tiles). 1 koshin = 32x32 piksel.
* **Biomlar (kamida 3 ta):**
  1. *Yashil O'rmon (Whispering Woods):* Yog'och, tosh, rezavorlar, suv, Slime va Zombie dushmanlari.
  2. *Quruq Cho'l (Scorched Sands):* Qum, oltin, kaktus, qadimiy xarobalar, Skeleton va Scorpion dushmanlari.
  3. *Muzlagan G'orlar (Frozen Caverns / Ice Tundra):* Temir, muz kristallari, mitril rudasi, Ice Elemental va Bosslar.
* **Persistent Delta Saving:** Faqat o'yinchilar tomonidan qazib olingan daraxt/ruda yoki qo'yilgan devor/sandiq ma'lumotlari saqlanadi. Bu xotira hajmini megabaytlab tejaydi.

---

### 5. O'yin Kontenti Spetsifikatsiyasi

#### 5.1. 30 ta Resurs va Buyumlar Jadvali
1. Yog'och (Wood) — Daraxtlardan olinadi; qurilish va tayanch qurollar.
2. Tosh (Stone) — Tosh konlaridan; o'choq, devorlar va asboblar.
3. Somon / Ekin tolasi (Fiber) — Butalardan; arqon va xaltalar uchun.
4. Ko'mir (Coal) — Er osti; mash'ala va eritish pechi yoqilg'isi.
5. Temir rudasi (Iron Ore) — G'orlar va qoyalardan.
6. Temir quyma (Iron Ingot) — O'choqda eritilgan; mustahkam qurol va asboblar.
7. Oltin qumi (Gold Ore) — Cho'l kanyonlaridan; qimmatbaho buyumlar.
8. Oltin quyma (Gold Ingot) — Sehrli aksessuarlar va savdo.
9. Muz kristali (Frost Shard) — Muzlik biomidagi qoyalardan.
10. Qora marvarid (Obsidian) — Vulqon va lava joylaridan.
11. Slime gel (Slime) — Slime yirtqichidan; yelim va mash'ala uchun.
12. Suyak (Bone) — Skelet mergandan; o'qlar va suyak pichoqlar.
13. Teri (Leather) — Hayvonlardan; katta xalta va yengil sovut.
14. Yovvoyi rezavor (Wild Berries) — Butalardan; ochlikni +15 to'ldiradi.
15. Xom go'sht (Raw Meat) — Ov luti; pishirish kerak.
16. Qovurilgan go'sht (Cooked Meat) — Gulxanda pishirilgan; ochlikni +50, HP +25 tiklaydi.
17. Muzlagan baliq (Ice Fish) — Suv havzalaridan ovlanadi.
18. Yog'och bolta (Wooden Axe) — Daraxtlarni 2 baravar tez chopish.
19. Tosh cho'kich (Stone Pickaxe) — Tosh va ko'mir qazish.
20. Temir cho'kich (Iron Pickaxe) — Temir, oltin va obsidian qazish.
21. Yog'och qilich (Wooden Sword) — Boshlang'ich mudofaa (Zarba: 8).
22. Temir qilich (Iron Broadsword) — O'rta qurol (Zarba: 22).
23. Ov kamoni (Hunter's Bow) — Masofadan otish (Zarba: 16).
24. Yog'och o'q (Wooden Arrow) — Kamon o'q-dorisi.
25. Mash'ala (Torch) — Kechasi 6 blok radiusda atrofni yoritish.
26. Gulxan (Campfire) — Ovqat pishirish va isinish markazi.
27. Sandiq (Wooden Chest) — 20 katakli doimiy server ombori.
28. Dastgoh (Workbench) — 2-darajali retseptlarni ochadi.
29. Shifobaxsh elixir (Health Potion) — Bir zumda +50 HP tiklaydi.
30. Olam yuragi (Heart of the Realm) — 2-Bossdan tushadigan g'alaba kaliti.

#### 5.2. 25 ta Crafting Retseptlari
Mash'ala, Gulxan, Taxta, Dastgoh, Yog'och qilich, Yog'och bolta, Yog'och devor, Yog'och pol, Eshik, Sandiq, Tosh cho'kich, O'choq (Smelter), Temir quyma, Temir cho'kich, Temir qilich, Temir sovut, Kamon, O'qlar, Qovurilgan go'sht, Sandiq kengaytirgich, Katta xalta, Tosh devor, Himoya qoziqlari, Shifo elixiri, G'alaba Monoliti.

#### 5.3. 4 ta Dushman va 2 ta Boss
1. **Slime:** 30 HP, sakrab yaqinlashadi, Slime gel beradi.
2. **Zombie Marauder:** 60 HP, tunda paydo bo'ladi, to'g'ri chiziqli zarba beradi.
3. **Skeleton Archer:** 45 HP, masofadan o'q uzadi (Kiting AI), suyak va o'q beradi.
4. **Scorched Scorpion:** 75 HP, tezkor cho'l yirtqichi, zaharli chaqish.
5. **1-Boss: Ancient Treant:** 500 HP, AoE yer yorilishi, ildiz qopqoni va minionlar chaqirish.
6. **2-Boss: Shadow Wyrm:** 1200 HP, yer tagidan otilib chiqish, muz va olov maydonlari.

---

### 6. Doimiy Xotira va Tiklanish (SQLite WAL)

Server SQLite3 dan WAL (Write-Ahead Logging) rejimida foydalanadi:
* Har bir muhim harakat (inventar o'zgarishi, bino qurilishi, dushman o'limi) zudlik bilan tranzaksiyaga yoziladi.
* Har 10 soniyada butun dunyo holati uchun foniy xotira surati (snapshot checkpoint) olinadi.
* Server uzilishi (Crash) yuz bersa, qayta yoqilganda WAL jurnali avtomatik o'qilib, barcha o'yinchilarning pozitsiyasi, HP/Ochlik ko'rsatkichlari, inventari va xaritadagi barcha binolar 100% tiklanadi.

---

### 7. Foydalanuvchi Interfeysi (UI/UX) va Boshqaruv

* **WASD:** Harakatlanish (yuqoriga, chapga, pastga, o'ngga).
* **Sichqoncha (Mouse Left Click):** Hujum qilish, daraxt/tosh qazish, bino blokini joylashtirish.
* **Sichqoncha (Mouse Right Click):** Sandiqni ochish, eshikni ochish/yopish, oziq-ovqat iste'mol qilish.
* **E:** Tevarak-atrofdagi obyektlar bilan o'zaro aloqa (Interact).
* **I / Tab:** 30 katakli inventar oynasi.
* **C:** 25 retseptli Crafting menyusi.
* **Esc:** Sozlamalar / Chiqish menyusi.
