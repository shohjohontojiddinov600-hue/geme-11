class_name EnemyHumanoid
extends CharacterBody2D

## Humanoid Dushman (Update 2.0 - Inson anatomiyasi, A* Navigatsiya va Culling)

@export var max_hp: float = 60.0
@export var speed: float = 130.0
@export var attack_damage: float = 12.0
@export var attack_cooldown: float = 1.0

var hp: float = 60.0
var target_direction: Vector2 = Vector2.ZERO
var can_attack: bool = true
var is_on_screen: bool = true

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var anim_player: AnimationPlayer = $AnimationPlayer if has_node("AnimationPlayer") else null
@onready var notifier: VisibleOnScreenNotifier2D = $VisibleOnScreenNotifier2D if has_node("VisibleOnScreenNotifier2D") else null
@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D if has_node("NavigationAgent2D") else null

var _ai_timer: float = 0.0
const AI_TICK_INTERVAL: float = 0.25 # Har 0.25 soniyada AI yo'lni hisoblaydi (Pathfinding optimizatsiyasi)

func _ready() -> void:
	hp = max_hp
	add_to_group("enemies")

	if notifier:
		notifier.screen_entered.connect(_on_screen_entered)
		notifier.screen_exited.connect(_on_screen_exited)

func _physics_process(delta: float) -> void:
	if not is_on_screen or hp <= 0:
		return

	# AI mantig'ini har frame'da emas, har 0.25s da bir marta hisoblash
	_ai_timer += delta
	if _ai_timer >= AI_TICK_INTERVAL:
		_ai_timer = 0.0
		_update_ai_target()

	velocity = target_direction * speed
	move_and_slide()

	# Qahramonga qarab yuzlanish
	if target_direction.x != 0 and sprite:
		sprite.flip_h = (target_direction.x < 0)

	# Qahramon bilan to'qnashuvda zarar yetkazish
	for i in range(get_slide_collision_count()):
		var collision = get_slide_collision(i)
		var collider = collision.get_collider()
		if collider and collider.is_in_group("players") and can_attack:
			_attack_player(collider)

func _update_ai_target() -> void:
	var players = get_tree().get_nodes_in_group("players")
	if players.size() > 0:
		var player = players[0] as Node2D
		var diff = player.global_position - global_position
		var dist = diff.length()
		if dist < 700.0:
			# A* Navigatsiya agenti orqali to'siqlarni aylanib o'tish
			if nav_agent:
				nav_agent.target_position = player.global_position
				var next_pos = nav_agent.get_next_path_position()
				target_direction = (next_pos - global_position).normalized()
			else:
				target_direction = diff.normalized()
		else:
			target_direction = Vector2.ZERO
	else:
		target_direction = Vector2.ZERO

func _attack_player(player: Node2D) -> void:
	can_attack = false
	if player.has_method("take_damage"):
		player.take_damage(attack_damage)
	await get_tree().create_timer(attack_cooldown).timeout
	can_attack = true

func take_damage(amount: float) -> void:
	hp -= amount
	print("[Enemy] Zarar yedi: -", amount, " | Qolgan HP: ", hp)

	# Zarba yeganda miltillash (Hurt Flash)
	if sprite:
		sprite.modulate = Color(2.5, 0.4, 0.4)
		await get_tree().create_timer(0.08).timeout
		if is_instance_valid(sprite):
			sprite.modulate = Color(1, 1, 1)

	if hp <= 0:
		_die()

func _die() -> void:
	# O'lganda tasodifiy loot tashlash (40% ehtimollik bilan tanga)
	if randf() < 0.4:
		var coin_scene = load("res://scenes/objects/coin.tscn")
		if coin_scene:
			var coin = coin_scene.instantiate() as Node2D
			coin.global_position = global_position
			get_tree().current_scene.call_deferred("add_child", coin)

	queue_free()

## Visibility Culling hodisalari
func _on_screen_entered() -> void:
	is_on_screen = true
	set_physics_process(true)

func _on_screen_exited() -> void:
	is_on_screen = false
	set_physics_process(false)
