# ⚔️ MYTHIC REALMS — 2D MULTIPLAYER SURVIVAL & CRAFTING SANDBOX
### Yakuniy Capstone Loyihasi (12-Loyiha)

> **Maqsad:** Tarmoqli (multiplayer), dunyo holati to'g'ridan-to'g'ri serverda saqlanadigan, protsedurali va doimiy (persistent) olamga ega to'liq ishchi Capstone o'yinini yaratish.

---

## 🚀 Loyihani Ishga Tushirish va O'ynash

Server hozirda lokal kompyuteringizda ishga tushirilgan va faol holatda!

1. Brauzeringizda (Chrome, Edge yoki Opera) quyidagi manzilni oching:
   👉 **[http://localhost:3000](http://localhost:3000)**

2. **Multiplayer rejimini sinash uchun:**
   * Birinchi tabda brauzerni ochib, birinchi o'yinchi nomini kiriting (masalan, `Jasur`);
   * Ikkinchi tab yoki Inkognito oynasida yana **http://localhost:3000** manzilini oching va ikkinchi o'yinchi nomini kiriting (masalan, `Farhod`);
   * Ikkala o'yinchi bir xil dunyoda bir vaqtning o'zida harakatlanishi, birga resurs yig'ishi, baza qurishi va jang qilishi mumkin!

3. Serverni to'xtatish yoki qayta ishga tushirish:
   ```bash
   npm start
   ```

---

## 🧪 Avtomatlashtirilgan Testlarni Ishga Tushirish
Barcha 5 ta asosiy qabul mezonlari (SQLite WAL, Anti-duplication, Crash recovery, 3 biom protsedurali generatsiya, 30 ta item va 25 ta retsept) bo'yicha testlarni tekshirish uchun:

```bash
npm test
```

Test natijalari:
* `✅ 1. SQLite WAL rejimi va barcha 5 ta jadvalning to'g'ri yaratilishi`
* `✅ 2. Item Duplikatsiyasiga qarshi atomik tranzaksiya (Anti-Dupe)`
* `✅ 3. Server halokatidan keyin 100% tiklanish (Crash Recovery)`
* `✅ 4. Protsedurali xarita va 3 ta Biom (O'rmon, Cho'l, Muzlik) mavjudligi`
* `✅ 5. Kontent to'liqligi: 30 ta Item, 25 ta Crafting retsepti, 4 ta dushman va 2 ta boss`
* **Natija: 5/5 (100% PASSED)**

---

## 🎯 Asosiy Qabul Qilish Mezonlarining Amalga Oshirilishi

| № | Qabul Qilish Mezoni | Tizimdagi Texnik Yechim |
|---|---|---|
| 1 | **Dunyo holati serverda saqlanadi** | Server-Authoritative arxitektura. Server 30 Hz chastotada ishlaydi. Harakat, to'qnashuvlar (collisions), resurslar va jonzotlar serverda hisoblanadi. |
| 2 | **Item duplikatsiyasining oldi olinadi** | `node:sqlite` da ACID atomik tranzaksiyalari (`BEGIN IMMEDIATE TRANSACTION`). Sandiqdan olish va solishda ikkala tomon bir vaqtda qulflanadi va tasdiqlanadi. |
| 3 | **Server uzilishidan keyin progress tiklanadi** | SQLite `journal_mode = WAL` (Write-Ahead Logging). Har 10 soniyada avto-saqlash va server to'satdan o'chganda (crash/power outage) WAL jurnali orqali ma'lumotlar buzilmasdan 100% tiklanadi. |
| 4 | **Sinxron harakat va jang jarayonlari** | WebSockets orqali har 33 ms da delta xolati uzatiladi. Mijozda silliq LERP interpolatsiyasi va server-side hitbox tekshiruvi. |

---

## 🎮 O'yin Boshqaruvi va Mexanikasi

* **WASD:** Harakatlanish (yuqoriga, chapga, pastga, o'ngga)
* **Shift (ushlab turish):** Yugurish (Sprinting - chidamlilik sarflanadi)
* **Sichqoncha Chap Tugmasi (LMB):**
  * Yaqin masofadagi dushmanga hujum qilish;
  * Daraxt chopish (bolta bilan 2x tezroq);
  * Tosh va rudalarni qazish (cho'kich bilan);
  * Quickslotda devor, pol, mash'ala, gulxan yoki sandiq tanlangan bo'lsa — blokni yerga qo'yish.
* **Sichqoncha O'ng Tugmasi (RMB) / E:**
  * Obyektlar bilan aloqa: yog'och eshikni ochish/yopish, sandiq omborini ochish.
* **I yoki Tab:** 30 katakli Inventar oynasini ochish/yopish.
  * *Oziq-ovqat/eliksirni iste'mol qilish:* ustiga bosing;
  * *Yerga tashlash:* `Shift + Click`.
* **C:** 25 ta Crafting retseptlari menyusi (Dastgoh talab qilinadigan va cho'ntakda yasaladigan buyumlar).
* **1 – 8:** Tezkor panel (Action bar) buyumlarini almashtirish.
* **Esc:** Barcha ochilgan oynalarni yopish.

---

## 🗺️ Kontent va Olam Tuzilishi

### 1. Uchta Xilma-xil Biom
1. **Yashil O'rmon (Whispering Woods):** Qulay boshlang'ich zona, daraxtlar, toshlar, suv havzalari, rezavor butalari, Slime va Zombie dushmanlari. 1-Boss: *Ancient Treant*.
2. **Quruq Cho'l (Scorched Sands):** Qum, kaktuslar, oltin qumi konlari, tezkor va zaharli *Scorched Scorpion* dushmanlari.
3. **Muzlagan G'orlar (Frozen Caverns):** Qor va muz qoplamasi, temir rudasi, muz kristallari, *Obsidian* toshlari. 2-Final Boss: *Shadow Wyrm*.

### 2. Omon Qolish (Survival Stats)
* **Salomatlik (HP - 100):** Zarba, ochlik va zahar tufayli kamayadi. 0 bo'lganda o'yinchi halok bo'ladi va qabr toshi qoldirib, boshlang'ich nuqtada qayta tiriladi.
* **Ochlik (Hunger - 100):** Asta-sekin pasayadi. 80 dan baland bo'lsa HP o'z-o'zidan tiklanadi, 0 bo'lsa ochlikdan jon ketadi.
* **Chidamlilik (Stamina - 100):** Yugurganda sarflanadi, yurganda yoki to'xtaganda tez tiklanadi.

### 3. Dinamik Kun va Tun Sikli
* 12 daqiqalik kun/tun aylanishi.
* Kechasi ko'rish maydoni qisqaradi va atrof qorong'i bo'ladi. Mash'ala va gulxanlar atrofida dinamik radial yorug'lik paydo bo'ladi. Tunda tajovuzkor yirtqichlar ko'payadi.

### 4. Yakuniy Capstone G'alabasi (Victory Condition)
Muzliklar tubidagi afsonaviy 2-Boss **Shadow Wyrm**ni mag'lub etib, **"Olam Yuragi" (Heart of the Realm)** relikviyasini qo'lga kiriting. Dastgohda 20 ta obsidian va 10 ta oltin quyma bilan **"G'alaba Monoliti" (Monolith)**ni yasab, yerga o'rnating!

---

## 📂 Loyiha Tuzilmasi

```text
game 1/
├── server/
│   ├── index.js        # HTTP va WebSocket serveri, marshrutlash
│   ├── game.js         # 30Hz Server-authoritative o'yin mantig'i va tick loop
│   ├── world.js        # Protsedurali generator, 3 biom, chunk deltalari
│   ├── monsters.js     # 4 ta mob va 2 ta bossning AI va o'q otish tizimi
│   ├── db.js           # SQLite WAL persistence va anti-dupe tranzaksiyalari
│   ├── items.js        # 30 ta item va resurslar ma'lumotlar bazasi
│   └── recipes.js      # 25 ta crafting retseptlari
├── public/
│   ├── index.html      # Responsive o'yin UI, HUD, modallar va lobbi
│   ├── style.css       # Qorong'u fantaziya pikselli vizual stillar
│   ├── renderer.js     # 60 FPS HTML5 Canvas 2D renderlash va yorug'lik shaderi
│   ├── client.js       # Tarmoq mijoz boshqaruvi, interfeys va prediktsiya
│   └── audio.js        # Web Audio API 8/16-bit toza ovoz sintezatori
├── tests/
│   └── run-tests.js    # Barcha 5 ta mezon bo'yicha integratsion testlar
├── docs/
│   ├── CAPSTONE_TEXNIK_TOPSHIRIQ.md      # To'liq texnik topshiriq (TZ)
│   └── 10_BOSQICH_ISHLAB_CHIQISH_REJASI.md # 10 ta ishlab chiqish bosqichi
└── package.json        # Loyiha konfiguratsiyasi va skriptlar
```
