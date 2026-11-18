class_name CoinReward
extends Area2D

## Coin / Gift Sovg'a obyekti (Godot 4.x)
## O'yinchi unga tekkanda tangalar qo'shiladi va obyekt yo'qoladi.

@export var coin_value: int = 1
@export var float_speed: float = 3.0
@export var float_amplitude: float = 4.0

var base_y: float = 0.0
var time_passed: float = 0.0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("rewards")
	base_y = position.y
	body_entered.connect(_on_body_entered)

func _process(delta: float) -> void:
	time_passed += delta
	# Suvda suzgandek yoki havoda aylangandek tebranish (floating animation)
	position.y = base_y + sin(time_passed * float_speed) * float_amplitude
	if sprite:
		sprite.rotation += 2.0 * delta

func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("players"):
		if body.has_method("add_coins"):
			body.add_coins(coin_value)
		elif "coins" in body:
			body.coins += coin_value
		print("[Reward] Tanga olindi! Qimmat: +", coin_value)
		queue_free()
