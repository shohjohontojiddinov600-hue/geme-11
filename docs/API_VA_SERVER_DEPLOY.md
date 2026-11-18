# BACKEND ARXITEKTURASI, API PROTOKOLI VA SERVER DEPLOY QO'LLANMASI
## Mythic Realms (Capstone 2D Multiplayer Survival Sandbox)

---

### 1. WebSocket Real-Time API Protokoli

Mijoz va server o'rtasida ma'lumotlar JSON formatida ikki tomonlama WebSocket orqali almashiladi.

#### 1.1. Mijozdan Serverga Yuboriladigan Xabarlar (Client -> Server)
| Xabar Turi (`type`) | Payload Parametrlari | Vazifasi |
|---|---|---|
| `JOIN` | `{ username, color }` | O'yinga kirish va qahramon ro'yxatdan o'tishi |
| `MOVE_INPUT` | `{ vx, vy, isSprinting, facingAngle }` | Harakat vektori va ko'rish burchagi |
| `SELECT_SLOT` | `{ slot }` | Tezkor paneldagi buyumni tanlash (0-7) |
| `ATTACK_ACTION` | `{ targetX, targetY }` | Hujum qilish, daraxt chopish yoki tosh qazish |
| `USE_ITEM` | `{ slotIndex, targetX, targetY }` | Oziq-ovqat iste'mol qilish yoki bino qo'yish |
| `CRAFT_RECIPE` | `{ recipeId }` | 25 ta retseptdan birini yasash |
| `INTERACT_OBJECT` | `{ tileX, tileY }` | Eshikni ochish/yopish yoki sandiqni ochish |
| `CHEST_TRANSFER` | `{ chestId, fromType, fromSlot, toType, toSlot, count }` | Sandiq va inventar o'rtasida atomik buyum o'tkazish |
| `CLOSE_CHEST` | `{}` | Sandiq sessiyasini yopish |
| `DROP_ITEM` | `{ slotIndex, count }` | Buyumni yerga tashlash |
| `RESPAWN` | `{}` | O'limdan keyin qayta tirilish |
| `REQUEST_CHUNK` | `{ cx, cy }` | Muayyan chunk koshinlarini so'rash |

#### 1.2. Serverdan Mijozga Yuboriladigan Xabarlar (Server -> Client)
| Xabar Turi (`type`) | Payload Parametrlari | Vazifasi |
|---|---|---|
| `INIT` | `{ player, inventory, items, recipes, worldTime, isNight }` | Boshlang'ich konfiguratsiya va lug'at |
| `STATE_TICK` (30Hz) | `{ worldTime, isNight, players, monsters, drops, projectiles }` | Real-vaqt dunyo sinxronizatsiyasi |
| `CHUNK_DATA` | `{ chunk }` | Chunk koshinlari va obyektlari |
| `INVENTORY_UPDATE` | `{ inventory, pickedItem, crafted }` | Inventar o'zgarishi va xabarnomalar |
| `OPEN_CHEST` | `{ chestId, items, tileX, tileY }` | Sandiq omborini ochish |
| `CHEST_SYNC` | `{ chestId, items }` | Boshqa o'yinchilar olganida sandiqni yangilash |
| `COMBAT_EFFECT` | `{ effect, x, y, damage }` | Zarrachalar va qon chaqnashi |
| `VICTORY_ANNOUNCE` | `{ winnerName, text }` | G'alaba monoliti faollashuvi |

---

### 2. HTTP Rest API Endpoints
* **`GET /`**: O'yin mijozining asosiy HTML interfeysini yuklash.
* **`GET /health`**: Server holati, ulangan o'yinchilar soni va dunyo vaqti (JSON).
* **`GET /api/chunk/:cx/:cy`**: Protsedurali chunk ma'lumotlarini REST orqali olish.

---

### 3. Serverni Deploy Qilish (Ishga tushirish) Usullari

#### 3.1. Standart Node.js bilan:
```bash
npm install
npm start
```

#### 3.2. Docker & Docker Compose orqali:
```bash
docker compose up -d
```

#### 3.3. Linux VPS (Ubuntu/Debian) da Systemd xizmati sifatida:
`/etc/systemd/system/mythic-realms.service` faylini yarating:
```ini
[Unit]
Description=Mythic Realms Game Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/mythic-realms
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
Keyin faollashtiring:
```bash
sudo systemctl enable mythic-realms
sudo systemctl start mythic-realms
```
