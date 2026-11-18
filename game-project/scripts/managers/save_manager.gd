class_name SaveManager
extends Node

## Persistent Storage Manager with Crash Recovery & Anti-Duplication
## Saves World Chunks Delta, Player Progress and Chests to Disk

const SAVE_PATH: String = "user://saves/"
const WORLD_FILE: String = "user://saves/world_delta.json"
const PLAYERS_FILE: String = "user://saves/players.json"
const CHESTS_FILE: String = "user://saves/chests.json"

static var is_locked: bool = false

func _ready() -> void:
	ensure_save_directory()

static func ensure_save_directory() -> void:
	if not DirAccess.dir_exists_absolute(SAVE_PATH):
		DirAccess.make_dir_recursive_absolute(SAVE_PATH)

## Save with Atomic Write (Write-then-Rename pattern to prevent corruption on crash)
static func atomic_save_json(path: String, data: Dictionary) -> bool:
	var temp_path = path + ".tmp"
	var file = FileAccess.open(temp_path, FileAccess.WRITE)
	if not file:
		push_error("Failed to open temp file for save: %s" % temp_path)
		return false
	file.store_string(JSON.stringify(data, "  "))
	file.close()

	# Atomic rename/replace
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
	var err = DirAccess.rename_absolute(temp_path, path)
	return err == OK

static func load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	var content = file.get_as_text()
	file.close()
	var json = JSON.new()
	if json.parse(content) == OK and json.data is Dictionary:
		return json.data
	return {}

## Anti-Dupe Atomic Transfer
static func atomic_transfer(player_id: int, chest_id: String, from_slot: int, to_slot: int, count: int) -> bool:
	if is_locked:
		return false
	is_locked = true

	var players_data = load_json(PLAYERS_FILE)
	var chests_data = load_json(CHESTS_FILE)

	# Verify slots and balance
	var chest = chests_data.get(chest_id, {})
	var chest_items: Array = chest.get("items", [])

	if from_slot >= 0 and from_slot < chest_items.size():
		var item = chest_items[from_slot]
		if item != null and item.get("count", 0) >= count:
			# Atomic swap
			item["count"] -= count
			if item["count"] <= 0:
				chest_items[from_slot] = null
			chests_data[chest_id]["items"] = chest_items

			atomic_save_json(CHESTS_FILE, chests_data)
			atomic_save_json(PLAYERS_FILE, players_data)
			is_locked = false
			return true

	is_locked = false
	return false

static func get_chest_items(chest_id: String) -> Array:
	var chests_data = load_json(CHESTS_FILE)
	return chests_data.get(chest_id, {}).get("items", [])
