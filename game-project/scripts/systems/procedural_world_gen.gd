class_name ProceduralWorldGen
extends Node

## Procedural Chunk World Generator with 3 Biomes (Forest, Desert, Ice)
## Uses FastNoiseLite for coherent terrain generation in Godot 4.x

const CHUNK_SIZE: int = 16
const TILE_SIZE: int = 32

var noise: FastNoiseLite
var world_seed: int = 9841235

enum BiomeType { FOREST, DESERT, ICE }

func _init(seed_val: int = 9841235) -> void:
	world_seed = seed_val
	noise = FastNoiseLite.new()
	noise.seed = world_seed
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.04

func get_biome(tile_x: int, tile_y: int) -> BiomeType:
	var cell_x = int(floor(tile_x / 64.0))
	var cell_y = int(floor(tile_y / 64.0))
	var hash_val = abs(sin(cell_x * 12.9898 + cell_y * 78.233 + world_seed) * 43758.5453)
	var frac = hash_val - floor(hash_val)

	if cell_x == 0 and cell_y == 0:
		return BiomeType.FOREST

	if frac < 0.33:
		return BiomeType.DESERT
	elif frac < 0.66:
		return BiomeType.ICE
	else:
		return BiomeType.FOREST

func generate_chunk(cx: int, cy: int) -> Dictionary:
	var start_x = cx * CHUNK_SIZE
	var start_y = cy * CHUNK_SIZE
	var tiles: Array = []
	var objects: Array = []

	var chunk_biome = get_biome(start_x + 8, start_y + 8)

	for ly in range(CHUNK_SIZE):
		for lx in range(CHUNK_SIZE):
			var tx = start_x + lx
			var ty = start_y + ly
			var tile_biome = get_biome(tx, ty)
			var elev = (noise.get_noise_2d(tx, ty) + 1.0) * 0.5
			var detail = abs(sin(tx * 37.1 + ty * 59.3 + world_seed))

			var ground_tile = "grass"
			var obj_type = ""

			match tile_biome:
				BiomeType.FOREST:
					if elev < 0.25:
						ground_tile = "water"
					elif elev < 0.32:
						ground_tile = "dirt"
					else:
						ground_tile = "grass"
						if detail > 0.88:
							obj_type = "tree"
						elif detail > 0.82:
							obj_type = "rock"
						elif detail > 0.78:
							obj_type = "berry_bush"
						elif detail > 0.75 and elev > 0.45:
							obj_type = "iron_vein"

				BiomeType.DESERT:
					ground_tile = "sand"
					if detail > 0.90:
						obj_type = "cactus"
					elif detail > 0.85:
						obj_type = "rock"
					elif detail > 0.80:
						obj_type = "gold_vein"

				BiomeType.ICE:
					ground_tile = "snow" if elev > 0.35 else "ice"
					if detail > 0.88:
						obj_type = "frost_crystal"
					elif detail > 0.83:
						obj_type = "iron_vein"
					elif detail > 0.79 and elev > 0.50:
						obj_type = "obsidian_node"

			tiles.append(ground_tile)
			objects.append(obj_type)

	return {
		"cx": cx,
		"cy": cy,
		"biome": chunk_biome,
		"tiles": tiles,
		"objects": objects
	}
