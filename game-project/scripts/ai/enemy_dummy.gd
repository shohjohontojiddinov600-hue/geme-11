class_name EnemyDummy
extends CharacterBody2D

## Sinov Dushmani (Enemy Dummy)
## "enemies" guruhiga kiradi va o'q tekkanda take_damage() orqali zararlanadi.

@export var max_hp: int = 60
var hp: int = 60

func _ready() -> void:
	hp = max_hp
	add_to_group("enemies")

func take_damage(amount: int) -> void:
	hp -= amount
	print("[Enemy Hit] Zarar: -%d | Qolgan HP: %d/%d" % [amount, hp, max_hp])

	# Visual flash red
	var rect = $ColorRect as ColorRect
	if rect:
		rect.color = Color(1, 0, 0)
		await get_tree().create_timer(0.1).timeout
		if is_instance_valid(rect):
			rect.color = Color(0.18, 0.8, 0.44)

	if hp <= 0:
		print("[Enemy Defeated] Dushman yo'q qilindi!")
		queue_free()
