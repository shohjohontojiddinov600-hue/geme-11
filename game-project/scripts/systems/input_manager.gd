class_name InputManager
extends Node

## 2. Input Manager
## Qamraydi: Klaviatura (WASD), Sichqoncha (LMB, RMB), Geympad va Touch boshqaruv

signal move_input(direction: Vector2, is_sprinting: bool)
signal action_primary(target_pos: Vector2)
signal action_secondary(target_pos: Vector2)
signal toggle_inventory()
signal toggle_crafting()
signal select_quickslot(slot_idx: int)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("inventory"):
		toggle_inventory.emit()
	elif event.is_action_pressed("crafting"):
		toggle_crafting.emit()

	for i in range(1, 9):
		if event.is_action_pressed(str(i)):
			select_quickslot.emit(i - 1)

	if event.is_action_pressed("attack"):
		action_primary.emit(get_viewport().get_mouse_position())
	elif event.is_action_pressed("use_secondary"):
		action_secondary.emit(get_viewport().get_mouse_position())

func _process(_delta: float) -> void:
	var dir = Vector2.ZERO
	dir.x = Input.get_axis("move_left", "move_right")
	dir.y = Input.get_axis("move_up", "move_down")
	var is_sprint = Input.is_action_pressed("sprint")
	move_input.emit(dir.normalized(), is_sprint)
