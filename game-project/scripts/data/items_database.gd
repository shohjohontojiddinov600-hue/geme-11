class_name ItemsDatabase
extends Node

## Central In-Memory Database for Items in Godot 4.x
var items: Dictionary = {}

func _init() -> void:
	load_items()

func load_items() -> void:
	var path = "res://data/items/items.json"
	if FileAccess.file_exists(path):
		var file = FileAccess.open(path, FileAccess.READ)
		var json = JSON.new()
		if json.parse(file.get_as_text()) == OK:
			var data = json.data
			for it in data.get("items", []):
				items[it.id] = it
		file.close()

func get_item(item_id: String) -> Dictionary:
	return items.get(item_id, {})
