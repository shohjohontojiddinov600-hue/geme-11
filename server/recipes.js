// 25 Crafting Recipes for Mythic Realms
const RECIPES = [
  {
    id: 'craft_torch',
    result: 'torch',
    count: 4,
    category: 'survival',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 1 }, { item: 'coal', count: 1 }]
  },
  {
    id: 'craft_campfire',
    result: 'campfire',
    count: 1,
    category: 'building',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 4 }, { item: 'stone', count: 6 }]
  },
  {
    id: 'craft_wood_floor',
    result: 'wood_floor',
    count: 2,
    category: 'building',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 1 }]
  },
  {
    id: 'craft_wood_wall',
    result: 'wood_wall',
    count: 2,
    category: 'building',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 2 }]
  },
  {
    id: 'craft_workbench',
    result: 'workbench',
    count: 1,
    category: 'building',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 8 }]
  },
  {
    id: 'craft_wooden_axe',
    result: 'wooden_axe',
    count: 1,
    category: 'tools',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 4 }, { item: 'stone', count: 3 }]
  },
  {
    id: 'craft_wooden_sword',
    result: 'wooden_sword',
    count: 1,
    category: 'weapons',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 5 }, { item: 'fiber', count: 2 }]
  },
  {
    id: 'craft_stone_pickaxe',
    result: 'stone_pickaxe',
    count: 1,
    category: 'tools',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 4 }, { item: 'stone', count: 6 }]
  },
  {
    id: 'craft_wood_door',
    result: 'wood_door',
    count: 1,
    category: 'building',
    reqWorkbench: true,
    ingredients: [{ item: 'wood', count: 6 }]
  },
  {
    id: 'craft_chest',
    result: 'chest',
    count: 1,
    category: 'building',
    reqWorkbench: true,
    ingredients: [{ item: 'wood', count: 10 }, { item: 'iron_ingot', count: 2 }]
  },
  {
    id: 'craft_iron_pickaxe',
    result: 'iron_pickaxe',
    count: 1,
    category: 'tools',
    reqWorkbench: true,
    ingredients: [{ item: 'wood', count: 4 }, { item: 'iron_ingot', count: 4 }]
  },
  {
    id: 'craft_iron_sword',
    result: 'iron_sword',
    count: 1,
    category: 'weapons',
    reqWorkbench: true,
    ingredients: [{ item: 'wood', count: 2 }, { item: 'iron_ingot', count: 5 }]
  },
  {
    id: 'craft_iron_armor',
    result: 'iron_armor',
    count: 1,
    category: 'armor',
    reqWorkbench: true,
    ingredients: [{ item: 'iron_ingot', count: 12 }, { item: 'leather', count: 4 }]
  },
  {
    id: 'craft_bow',
    result: 'bow',
    count: 1,
    category: 'weapons',
    reqWorkbench: true,
    ingredients: [{ item: 'wood', count: 5 }, { item: 'fiber', count: 3 }]
  },
  {
    id: 'craft_arrow',
    result: 'arrow',
    count: 8,
    category: 'weapons',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 2 }, { item: 'stone', count: 1 }]
  },
  {
    id: 'smelt_iron_ingot',
    result: 'iron_ingot',
    count: 1,
    category: 'materials',
    reqWorkbench: false,
    ingredients: [{ item: 'iron_ore', count: 1 }, { item: 'coal', count: 1 }]
  },
  {
    id: 'smelt_gold_ingot',
    result: 'gold_ingot',
    count: 1,
    category: 'materials',
    reqWorkbench: false,
    ingredients: [{ item: 'gold_ore', count: 1 }, { item: 'coal', count: 1 }]
  },
  {
    id: 'cook_meat',
    result: 'cooked_meat',
    count: 1,
    category: 'survival',
    reqWorkbench: false,
    ingredients: [{ item: 'raw_meat', count: 1 }, { item: 'coal', count: 1 }]
  },
  {
    id: 'craft_stone_wall',
    result: 'stone_wall',
    count: 2,
    category: 'building',
    reqWorkbench: true,
    ingredients: [{ item: 'stone', count: 4 }]
  },
  {
    id: 'craft_spikes',
    result: 'spikes',
    count: 1,
    category: 'building',
    reqWorkbench: true,
    ingredients: [{ item: 'wood', count: 6 }, { item: 'stone', count: 2 }]
  },
  {
    id: 'craft_backpack',
    result: 'backpack',
    count: 1,
    category: 'gear',
    reqWorkbench: true,
    ingredients: [{ item: 'leather', count: 8 }, { item: 'fiber', count: 4 }]
  },
  {
    id: 'craft_health_potion',
    result: 'health_potion',
    count: 1,
    category: 'survival',
    reqWorkbench: true,
    ingredients: [{ item: 'berry', count: 3 }, { item: 'frost_shard', count: 1 }]
  },
  {
    id: 'craft_bone_arrows',
    result: 'arrow',
    count: 12,
    category: 'weapons',
    reqWorkbench: true,
    ingredients: [{ item: 'bone', count: 2 }, { item: 'wood', count: 2 }]
  },
  {
    id: 'craft_slime_torch',
    result: 'torch',
    count: 4,
    category: 'survival',
    reqWorkbench: false,
    ingredients: [{ item: 'wood', count: 1 }, { item: 'slime_gel', count: 1 }]
  },
  {
    id: 'craft_monolith',
    result: 'monolith',
    count: 1,
    category: 'victory',
    reqWorkbench: true,
    ingredients: [
      { item: 'heart_of_realm', count: 1 },
      { item: 'obsidian', count: 20 },
      { item: 'gold_ingot', count: 10 }
    ]
  }
];

module.exports = RECIPES;
