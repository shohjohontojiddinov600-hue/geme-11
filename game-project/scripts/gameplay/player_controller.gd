class_name PlayerController
extends CharacterBody2D

## Player Movement, Sprinting, and Combat Controller (Godot 4.x)

@export var walk_speed: float = 110.0
@export var sprint_speed: float = 175.0
@export var max_hp: float = 100.0
@export var max_stamina: float = 100.0

var hp: float = 100.0
var hunger: float = 100.0
var stamina: float = 100.0
var selected_slot: int = 0

@onready var camera: Camera2D = $Camera2D

func _physics_process(delta: float) -> void:
	var input_vector = Vector2.ZERO
	input_vector.x = Input.get_axis("move_left", "move_right")
	input_vector.y = Input.get_axis("move_up", "move_down")

	var is_sprinting = Input.is_action_pressed("sprint") and stamina > 10.0

	var speed = walk_speed
	if is_sprinting and input_vector != Vector2.ZERO:
		speed = sprint_speed
		stamina = max(0.0, stamina - 20.0 * delta)
	else:
		stamina = min(max_stamina, stamina + 15.0 * delta)

	velocity = input_vector.normalized() * speed
	move_and_slide()

	# Facing rotation towards mouse
	var mouse_pos = get_global_mouse_position()
	rotation = lerp_angle(rotation, (mouse_pos - global_position).angle(), 0.2)
