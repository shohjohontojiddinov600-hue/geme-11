class_name CameraSystem
extends Camera2D

## 3. Camera System
## Imkoniyatlari: Smooth follow, Screen shake, Dynamic zoom va chegaralar

@export var target: Node2D
@export var follow_speed: float = 8.0
@export var shake_decay: float = 5.0

var shake_intensity: float = 0.0
var original_offset: Vector2 = Vector2.ZERO

func _ready() -> void:
	position_smoothing_enabled = true
	position_smoothing_speed = follow_speed

func _process(delta: float) -> void:
	if target:
		global_position = global_position.lerp(target.global_position, delta * follow_speed)

	# Screen Shake processing
	if shake_intensity > 0.0:
		shake_intensity = max(0.0, shake_intensity - shake_decay * delta)
		offset = Vector2(
			randf_range(-shake_intensity, shake_intensity),
			randf_range(-shake_intensity, shake_intensity)
		)
	else:
		offset = original_offset

func apply_shake(intensity: float = 8.0) -> void:
	shake_intensity = intensity
