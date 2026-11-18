class_name HealthKitReward
extends Area2D

## HealthKit (Tibbiy quticha) Sovg'a obyekti (Godot 4.x)
## O'yinchi unga tekkanda joni (HP) tiklanadi va obyekt yo'qoladi.

@export var heal_amount: float = 30.0
@export var pulse_speed: float = 4.0

var time_passed: float = 0.0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("rewards")
	body_entered.connect(_on_body_entered)

func _process(delta: float) -> void:
	time_passed += delta
	# Pulsatsiya animatsiyasi (kichik masshtab o'zgarishi)
	if sprite:
		var scale_factor = 1.0 + sin(time_passed * pulse_speed) * 0.1
		sprite.scale = Vector2(scale_factor, scale_factor)

func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("players"):
		if body.has_method("heal"):
			body.heal(heal_amount)
		elif "hp" in body:
			body.hp = min(body.max_hp if "max_hp" in body else 100.0, body.hp + heal_amount)
		print("[Reward] HealthKit olindi! Jon tiklandi: +", heal_amount)
		queue_free()
