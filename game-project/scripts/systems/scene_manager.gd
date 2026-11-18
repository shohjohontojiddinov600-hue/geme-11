class_name SceneManager
extends Node

## 6. Level / Scene Manager
## Boshqaradi: Sahnalararo o'tishlar, levelni qayta yuklash va animatsiyalar

signal scene_transition_started(scene_name: String)
signal scene_transition_finished(scene_name: String)

var current_scene_path: String = ""

func change_scene(target_scene_path: String) -> void:
	scene_transition_started.emit(target_scene_path)
	current_scene_path = target_scene_path
	get_tree().change_scene_to_file(target_scene_path)
	scene_transition_finished.emit(target_scene_path)

func reload_current_scene() -> void:
	if current_scene_path != "":
		change_scene(current_scene_path)
	else:
		get_tree().reload_current_scene()
