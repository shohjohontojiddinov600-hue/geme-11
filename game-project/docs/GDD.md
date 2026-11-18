# MYTHIC REALMS — GAME DESIGN DOCUMENT (GDD)
## Capstone Loyiha: 2D Multiplayer Survival & Crafting Sandbox

### 1. O'yin Maqsadi va Falsafasi
Mythic Realms — o'yinchilarni xavfli va resurslarga boy umumiy protsedurali dunyoga tashlaydi. O'yinchilar qadimiy sirlarni o'rganishi, boshpana qurishi, omon qolish qiyinchiliklarini yengishi va yakuniy bosqichda "Olam Yuragi"ni qo'lga kiritib, "G'alaba Monoliti"ni qurishi lozim.

### 2. Core Gameplay Loop
$$\text{Resurslarni Qazish / Chopish} \to \text{Baza Qurish va Qurol Yasash} \to \text{Tungi Hujumlardan Himoyalanish} \to \text{Boss Janglari} \to \text{G'alaba}$$

### 3. Asosiy Mexanikalar
* **Procedural Generation:** 3 ta biom (Whispering Woods, Scorched Sands, Frozen Caverns) har bir serverda cheksiz koordinatalarda yaratiladi.
* **Server-Authoritative State:** Mijoz hech qachon o'zboshimchalik bilan inventar yoki dushman HP sini o'zgartira olmaydi.
* **Transactional Inventory:** Sandiq omborlari va inventar slotlari atomik tranzaksiyalar orqali himoyalanadi.
* **Day/Night Cycle:** 12 daqiqalik davr (8 daqiqa kun, 4 daqiqa tun). Tunda ko'rish cheklanadi va yorug'lik manbalari zarur bo'ladi.
* **Capstone Bosses:** Ancient Treant (O'rmon Giganti) va Shadow Wyrm (Zulmat Ajdari).
