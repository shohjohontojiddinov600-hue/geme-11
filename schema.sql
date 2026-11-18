-- ====================================================================
-- MYTHIC REALMS: 2D MULTIPLAYER SURVIVAL DATABASE SCHEMA (SQL DDL)
-- Engine: SQLite 3 / PostgreSQL Compatible
-- Storage Mode: Write-Ahead Logging (WAL)
-- ====================================================================

-- 1. O'yinchilar jadvali (Players table)
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,                       -- UUID v4
    username TEXT UNIQUE NOT NULL,             -- Unikal login / qahramon nomi
    color TEXT DEFAULT '#3498db',              -- Qahramon avatari rangi
    x REAL DEFAULT 0.0,                        -- Olamdagi X koordinatasi
    y REAL DEFAULT 0.0,                        -- Olamdagi Y koordinatasi
    hp INTEGER DEFAULT 100,                    -- Joriy salomatlik (0-100)
    max_hp INTEGER DEFAULT 100,                -- Maksimal salomatlik
    hunger INTEGER DEFAULT 100,                -- Ochlik darajasi (0-100)
    stamina INTEGER DEFAULT 100,               -- Chidamlilik (0-100)
    kills INTEGER DEFAULT 0,                   -- Yo'q qilingan dushmanlar soni
    score INTEGER DEFAULT 0,                   -- Umumiy to'plangan ochko
    has_won INTEGER DEFAULT 0,                 -- G'alaba qozonganlik holati (0 yoki 1)
    updated_at INTEGER NOT NULL                -- Oxirgi yangilanish vaqti (UNIX timestamp)
);

-- 2. O'yinchilar inventari (Player Inventory: 30 katak)
CREATE TABLE IF NOT EXISTS player_inventory (
    id TEXT PRIMARY KEY,                       -- UUID v4
    player_id TEXT NOT NULL,                   -- players.id ga bog'lanish
    slot_idx INTEGER NOT NULL,                 -- Slot indeksi (0 dan 29 gacha)
    item_id TEXT NOT NULL,                     -- Buyum identifikatori (masalan, 'iron_sword')
    count INTEGER NOT NULL,                    -- Buyumlar miqdori (stack)
    durability INTEGER DEFAULT 100,            -- Asbob/qurol chidamliligi (0-100%)
    UNIQUE(player_id, slot_idx),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- 3. Xarita chunklarining persistent deltalari (Chunk Deltas)
CREATE TABLE IF NOT EXISTS chunk_deltas (
    chunk_key TEXT PRIMARY KEY,                -- Chunk koordinatasi (masalan, "0,0" yoki "2,-1")
    deltas TEXT NOT NULL,                      -- O'zgargan koshinlar JSON obyekti (qazilgan daraxt/qo'yilgan devor)
    modified_at INTEGER NOT NULL               -- O'zgarish kiritilgan vaqt
);

-- 4. Dunyoda joylashtirilgan doimiy sandiqlar (Chests)
CREATE TABLE IF NOT EXISTS chests (
    id TEXT PRIMARY KEY,                       -- UUID v4
    x INTEGER NOT NULL,                        -- X koshin koordinatasi
    y INTEGER NOT NULL,                        -- Y koshin koordinatasi
    created_by TEXT,                           -- Sandiqni o'rnatgan o'yinchi nomi
    UNIQUE(x, y)
);

-- 5. Sandiq ichidagi buyumlar (Chest Slots: 20 katak)
CREATE TABLE IF NOT EXISTS chest_items (
    id TEXT PRIMARY KEY,                       -- UUID v4
    chest_id TEXT NOT NULL,                    -- chests.id ga bog'lanish
    slot_idx INTEGER NOT NULL,                 -- Slot indeksi (0 dan 19 gacha)
    item_id TEXT NOT NULL,                     -- Buyum identifikatori
    count INTEGER NOT NULL,                    -- Miqdori
    UNIQUE(chest_id, slot_idx),
    FOREIGN KEY(chest_id) REFERENCES chests(id) ON DELETE CASCADE
);

-- Tezkor qidiruv indekslari
CREATE INDEX IF NOT EXISTS idx_player_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_inventory_player ON player_inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_chest_items_chest ON chest_items(chest_id);
