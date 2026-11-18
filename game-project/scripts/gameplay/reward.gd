class_name RewardItem
extends Area2D

## Sovg'alar va Bonuslar (Rewards / Collectibles)
## O'yin davomida yig'ib olinadigan sovg'alar: Tanga, Jon qutisi, Qurol kuchaytirgich

enum RewardType { COIN, HEALTH, WEAPON_UPGRADE }
@export var reward_type: RewardType = RewardType.COIN

@export var float_speed: float = 3.5
@export var float_amplitude: float = 4.0

var base_y: float = 0.0
var time_passed: float = 0.0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("rewards")
	base_y = position.y
	body_entered.connect(_on_body_entered)

	# Har bir sovg'a turiga mos sprite teksturasini avtomatik tanlash
	if sprite:
		match reward_type:
			RewardType.COIN:
				sprite.texture = preload("res://assets/sprites/coin.png")
			RewardType.HEALTH:
				sprite.texture = preload("res://assets/sprites/health_kit.png")
			RewardType.WEAPON_UPGRADE:
				sprite.texture = preload("res://assets/sprites/weapon_upgrade.png")

func _process(delta: float) -> void:
	time_passed += delta
	# Suvda suzgandek havoda yengil tebranish (floating animation)
	position.y = base_y + sin(time_passed * float_speed) * float_amplitude
	if sprite:
		if reward_type == RewardType.COIN:
			sprite.rotation += 2.5 * delta
		else:
			var scale_factor = 1.0 + sin(time_passed * 4.0) * 0.08
			sprite.scale = Vector2(scale_factor, scale_factor)

func _on_body_entered(body: Node2D) -> void:
	# Agar qahramon tegilinsa (ismi "Player" yoki "players" guruhida)
	if body.name == "Player" or body.is_in_group("players"):
		apply_reward(body)
		queue_free() # Sovg'a yo'qoladi

func apply_reward(player: Node2D) -> void:
	match reward_type:
		RewardType.COIN:
			print("Tanga olindi! Ball qo'shildi.")
			if player.has_method("add_coins"):
				player.add_coins(1)
			elif player.has_method("add_score"):
				player.add_score(10)
		RewardType.HEALTH:
			print("Hayot tiklandi!")
			if player.has_method("heal"):
				player.heal(25.0)
		RewardType.WEAPON_UPGRADE:
			print("Qurol kuchaytirildi!")
			if player.has_method("upgrade_weapon"):
				player.upgrade_weapon()
