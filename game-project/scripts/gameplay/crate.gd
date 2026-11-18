class_name DestructibleCrate
extends StaticBody2D

## Buziladigan Yog'och Quti (Destructible Crate)
## O'q tekkanda sinadi, ichidan tasodifiy loot (tanga yoki jon qutisi) tushadi.

@export var max_hp: float = 30.0
var hp: float = 30.0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	hp = max_hp
	add_to_group("destructible")
	add_to_group("walls") # O'qlar to'qnashishi uchun

func take_damage(amount: float) -> void:
	hp -= amount

	# Zarba yeganda miltillash
	if sprite:
		sprite.modulate = Color(2.0, 1.8, 1.5)
		await get_tree().create_timer(0.06).timeout
		if is_instance_valid(sprite):
			sprite.modulate = Color(1, 1, 1)

	if hp <= 0.0:
		_break_and_drop_loot()

func _break_and_drop_loot() -> void:
	# 70% ehtimollik bilan sovg'a tushirish
	var rand_val = randf()
	if rand_val < 0.45:
		var coin_scene = load("res://scenes/objects/coin.tscn")
		if coin_scene:
			var coin = coin_scene.instantiate() as Node2D
			coin.global_position = global_position
			get_tree().current_scene.call_deferred("add_child", coin)
	elif rand_val < 0.70:
		var health_scene = load("res://scenes/objects/health_kit.tscn")
		if health_scene:
			var health = health_scene.instantiate() as Node2D
			health.global_position = global_position
			get_tree().current_scene.call_deferred("add_child", health)

	print("[Crate] Quti sindi va ichidan buyumlar tushdi!")
	queue_free()
