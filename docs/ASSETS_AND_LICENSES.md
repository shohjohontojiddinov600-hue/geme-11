# ASSETLAR RO'YXATI VA LITSENZIYA MA'LUMOTLARI
## Mythic Realms (2D Multiplayer Survival Sandbox — Capstone Loyiha)

Ushbu hujjat loyihada foydalanilgan barcha vizual, audio, matn va shrift resurslarining kelib chiqishi, litsenziyasi va atributsiya ma'lumotlarini qamrab oladi.

---

### 1. Vizual Grafika va Spritelar
* **Metod:** Protsedurali HTML5 Canvas 2D renderlash va Pixel Art uslubi.
* **Manba:** Dasturiy kod orqali dinamik chizilgan (In-Code Procedural Rendering).
* **Fayllar:** `public/renderer.js`
* **Litsenziya:** **MIT License** (Mualliflik cheklovlarisiz ochiq kod).
* **Tarkibi:**
  * 6 xil asosiy koshinlar (Maysa, Tuproq, Qum, Qor, Muz, Suv to'lqinlari);
  * Tabiiy obyektlar (Daraxtlar, Qoyalar, Temir/Oltin rudalari, Muz kristallari, Rezavor butalari, Kaktuslar);
  * Arxitektura bloklari (Yog'och/Tosh devorlar, Eshiklar, Mash'ala, Gulxan, Dastgoh, Sandiq, Monolit);
  * 4 ta Dushman (Slime, Zombie, Skeleton, Scorpion) va 2 ta Boss (Ancient Treant, Shadow Wyrm);
  * Dinamik Zarrachalar (Particles) va Radial Kun/Tun yorug'lik effektlari.

---

### 2. Audio va Ovoz Effektlari (SFX & Ambient)
* **Metod:** Web Audio API asosidagi real-vaqt chastotali sintezator (Realtime Procedural Audio Synthesis).
* **Manba:** Dasturiy algoritm orqali brauzerda hosil qilingan (Zero External Audio Assets).
* **Fayllar:** `public/audio.js`
* **Litsenziya:** **MIT License** / Public Domain (Hech qanday uchinchi tomon mualliflik huquqiga bog'liq emas).
* **Tarkibi:**
  * Qadam tovushlari (`footstep` — past chastotali uchburchak to'lqin);
  * Daraxt chopish (`chop` — arra to'lqini zarbasi);
  * Kon qazish (`mine` — metall/tosh to'rtburchak to'lqini);
  * Qilich zarbasi (`slash` — silliq sinus tebranishi);
  * Kamon o'qi otilishi (`bowShoot` — yuqori chastotali uchburchak to'lqin);
  * Buyum yig'ish (`pickup` — ikki bosqichli ko'tariluvchi akkord);
  * Hunarmandchilik (`craft` — metall jaranglashi);
  * Zarba olish (`hurt` — xirillagan arra to'lqini);
  * G'alaba tantanasi (`victory` — C-E-G-C mayor arpejiosi).

---

### 3. Shriftlar (Typography)
* **Manba:** Tizim Shriftlari (Native System Fonts: Segoe UI, Roboto, Apple-System, sans-serif).
* **Litsenziya:** Tizim litsenziyasi (Har qanday OS uchun litsenziya to'lovlarisiz va optimallashtirilgan).

---

### 4. Dasturiy Kutubxonalar va Bog'liqliklar
* **Node.js (v22 / v26):** MIT License.
* **ws (v8.18.0):** MIT License (Yuqori tezlikdagi WebSocket mijoz-server protokoli).
* **node:sqlite (Built-in Node.js module):** SQLite Public Domain / Node.js MIT License.
