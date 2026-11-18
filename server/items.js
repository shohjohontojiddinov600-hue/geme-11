// Database of all 30 Items and Resources in Mythic Realms
const ITEMS = {
  // Raw materials
  wood: { id: 'wood', name: "Yog'och", category: 'material', maxStack: 99, color: '#8B5A2B', icon: '🪵', desc: "Asosiy yog'och xomashyosi" },
  stone: { id: 'stone', name: 'Tosh', category: 'material', maxStack: 99, color: '#808080', icon: '🪨', desc: "Qurilish va tosh asboblar uchun" },
  fiber: { id: 'fiber', name: 'Somon / Tolalar', category: 'material', maxStack: 99, color: '#A2CD5A', icon: '🌾', desc: "Arqon va kiyimlar uchun o'simlik tolasi" },
  coal: { id: 'coal', name: "Ko'mir", category: 'material', maxStack: 99, color: '#2B2B2B', icon: '⚫', desc: "Mash'ala va eritish pechi yoqilg'isi" },
  iron_ore: { id: 'iron_ore', name: 'Temir rudasi', category: 'material', maxStack: 99, color: '#C0A080', icon: '🧱', desc: "O'choqda eritiladigan xom temir" },
  iron_ingot: { id: 'iron_ingot', name: 'Temir quyma', category: 'material', maxStack: 99, color: '#DCDCDC', icon: '⚙️', desc: "Chidamli qurollar uchun eritilgan temir" },
  gold_ore: { id: 'gold_ore', name: 'Oltin qumi', category: 'material', maxStack: 99, color: '#FFD700', icon: '✨', desc: "Qimmatbaho oltin rudasi" },
  gold_ingot: { id: 'gold_ingot', name: 'Oltin quyma', category: 'material', maxStack: 99, color: '#FFDF00', icon: '🪙', desc: "Sehrli narsalar va savdo uchun" },
  frost_shard: { id: 'frost_shard', name: 'Muz kristali', category: 'material', maxStack: 99, color: '#A0E6FF', icon: '❄️', desc: "Muzlik biomidagi sehrli kristall" },
  obsidian: { id: 'obsidian', name: 'Obsidian', category: 'material', maxStack: 99, color: '#1C0D2A', icon: '💎', desc: "Lava va suv qo'shilishidan hosil bo'lgan tosh" },
  slime_gel: { id: 'slime_gel', name: 'Slime geli', category: 'material', maxStack: 99, color: '#32CD32', icon: '🟢', desc: "Yelim va mash'ala uchun elastik modda" },
  bone: { id: 'bone', name: 'Suyak', category: 'material', maxStack: 99, color: '#F5F5DC', icon: '🦴', desc: "O'qlar va o'g'it uchun suyak" },
  leather: { id: 'leather', name: 'Teri', category: 'material', maxStack: 99, color: '#8B4513', icon: '📜', desc: "Xalta va zirhlar tayyorlash uchun" },

  // Food & Consumables
  berry: { id: 'berry', name: 'Yovvoyi rezavor', category: 'food', maxStack: 50, color: '#DC143C', icon: '🍓', foodVal: 15, healVal: 5, desc: "Ochlikni +15, HP ni +5 to'ldiradi" },
  raw_meat: { id: 'raw_meat', name: "Xom go'sht", category: 'food', maxStack: 30, color: '#CD5C5C', icon: '🥩', foodVal: 10, healVal: -5, desc: "Xom iste'mol qilish xavfli" },
  cooked_meat: { id: 'cooked_meat', name: "Qovurilgan go'sht", category: 'food', maxStack: 30, color: '#8B2500', icon: '🍗', foodVal: 50, healVal: 25, desc: "Ochlikni +50, HP ni +25 tiklaydi" },
  ice_fish: { id: 'ice_fish', name: 'Muzlagan baliq', category: 'food', maxStack: 30, color: '#70DBDB', icon: '🐟', foodVal: 35, healVal: 15, desc: "Ochlikni +35 to'ldiradi" },
  health_potion: { id: 'health_potion', name: 'Shifo eliksiri', category: 'potion', maxStack: 20, color: '#FF1493', icon: '🧪', healVal: 50, desc: "Bir zumda +50 HP tiklaydi" },

  // Tools & Weapons
  wooden_axe: { id: 'wooden_axe', name: "Yog'och bolta", category: 'tool', toolType: 'axe', toolLevel: 1, damage: 6, maxStack: 1, durability: 60, color: '#CD853F', icon: '🪓', desc: "Daraxtlarni 2x tez chopadi" },
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Tosh cho\'kich', category: 'tool', toolType: 'pickaxe', toolLevel: 1, damage: 7, maxStack: 1, durability: 100, color: '#A9A9A9', icon: '⛏️', desc: "Tosh va ko'mir qazish uchun" },
  iron_pickaxe: { id: 'iron_pickaxe', name: 'Temir cho\'kich', category: 'tool', toolType: 'pickaxe', toolLevel: 2, damage: 12, maxStack: 1, durability: 250, color: '#B0C4DE', icon: '⛏️', desc: "Temir, oltin va obsidian qazish" },
  wooden_sword: { id: 'wooden_sword', name: "Yog'och qilich", category: 'weapon', damage: 10, attackRange: 45, maxStack: 1, durability: 80, color: '#DEB887', icon: '🗡️', desc: "Boshlang'ich mudofaa (Zarba: 10)" },
  iron_sword: { id: 'iron_sword', name: 'Temir qilich', category: 'weapon', damage: 24, attackRange: 55, maxStack: 1, durability: 220, color: '#E0EEEE', icon: '⚔️', desc: "Kuchli qurol (Zarba: 24)" },
  bow: { id: 'bow', name: 'Ov kamoni', category: 'weapon', damage: 16, attackRange: 260, isRanged: true, maxStack: 1, durability: 150, color: '#8B4513', icon: '🏹', desc: "Masofadan o'q otish (Zarba: 16)" },
  arrow: { id: 'arrow', name: "O'qlar", category: 'ammo', maxStack: 99, color: '#D2B48C', icon: '🎯', desc: "Kamon uchun zarur o'q-dori" },
  iron_armor: { id: 'iron_armor', name: 'Temir sovut', category: 'armor', defense: 10, maxStack: 1, durability: 300, color: '#778899', icon: '🛡️', desc: "Dushman zarbalarini 35% pasaytiradi" },

  // Buildings & Placed Structures
  torch: { id: 'torch', name: "Mash'ala", category: 'building', maxStack: 50, placeTile: 'torch', lightRadius: 180, color: '#FFA500', icon: '🔥', desc: "Atrofni yorituvchi mash'ala" },
  campfire: { id: 'campfire', name: 'Gulxan', category: 'building', maxStack: 10, placeTile: 'campfire', lightRadius: 240, color: '#FF4500', icon: '⛺', desc: "Ovqat pishirish va isinish" },
  wood_wall: { id: 'wood_wall', name: "Yog'och devor", category: 'building', maxStack: 99, placeTile: 'wood_wall', isSolid: true, hp: 120, color: '#8B4513', icon: '🧱', desc: "Mustahkam yog'och to'siq" },
  wood_floor: { id: 'wood_floor', name: "Yog'och pol", category: 'building', maxStack: 99, placeTile: 'wood_floor', isSolid: false, color: '#D2B48C', icon: '🪵', desc: "Baza uchun tekis pol qoplamasi" },
  wood_door: { id: 'wood_door', name: "Yog'och eshik", category: 'building', maxStack: 20, placeTile: 'wood_door', isSolid: true, isOpenable: true, hp: 100, color: '#A0522D', icon: '🚪', desc: "Ochilib-yopiladigan eshik" },
  chest: { id: 'chest', name: "Yog'och sandiq", category: 'building', maxStack: 10, placeTile: 'chest', isInteractive: true, slots: 20, color: '#B8860B', icon: '📦', desc: "20 katakli doimiy server ombori" },
  workbench: { id: 'workbench', name: 'Dastgoh', category: 'building', maxStack: 10, placeTile: 'workbench', isInteractive: true, color: '#8B5A2B', icon: '🔨', desc: "2-darajali murakkab retseptlarni ochadi" },
  stone_wall: { id: 'stone_wall', name: 'Tosh devor', category: 'building', maxStack: 99, placeTile: 'stone_wall', isSolid: true, hp: 300, color: '#696969', icon: '🏛️', desc: "Yuqori chidamli tosh mudofaa devori" },
  spikes: { id: 'spikes', name: 'Himoya qoziqlari', category: 'building', maxStack: 50, placeTile: 'spikes', damage: 15, color: '#708090', icon: '⚡', desc: "Dushmanlar bosganda 15 zarba yetkazadi" },
  backpack: { id: 'backpack', name: 'Katta xalta', category: 'gear', maxStack: 1, color: '#8B4513', icon: '🎒', desc: "Inventar sig'imini oshiradi" },

  // Capstone Relic
  heart_of_realm: { id: 'heart_of_realm', name: 'Olam Yuragi', category: 'relic', maxStack: 1, isLegendary: true, color: '#9400D3', icon: '💜', desc: "2-Boss o'ljasi. Olamni birlashtirish kaliti" },
  monolith: { id: 'monolith', name: "G'alaba Monoliti", category: 'building', maxStack: 1, placeTile: 'monolith', isVictoryItem: true, color: '#FFD700', icon: '🏆', desc: "Capstone g'alabasini nishonlash yodgorligi" }
};

module.exports = ITEMS;
