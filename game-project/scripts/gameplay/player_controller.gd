class_name PlayerController
extends CharacterBody2D

## Humanoid Qahramon va Qurol Boshqaruvi (Update 2.0)
## Inson anatomiyasiga asoslangan: CapsuleShape2D hitbox, 360-darajali Weapon Pivot, Object Pooling o'q otish

@export var speed: float = 300.0
@export var bullet_scene: PackedScene = preload("res://scenes/objects/bullet.tscn")
@export var fire_rate: float = 0.18 # Otish tezligi (sekundda)

@export var max_hp: float = 100.0
@export var max_stamina: float = 100.0

var hp: float = 100.0
var stamina: float = 100.0
var score: int = 0
var coins: int = 0
var weapon_upgrade_level: int = 1
var can_fire: bool = true

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var weapon_pivot: Node2D = $WeaponPivot if has_node("WeaponPivot") else null
@onready var weapon_sprite: Sprite2D = get_node_or_null("WeaponPivot/WeaponSprite")
@onready var muzzle: Marker2D = get_node_or_null("WeaponPivot/Muzzle")
@onready var anim_player: AnimationPlayer = $AnimationPlayer if has_node("AnimationPlayer") else null
@onready var camera: Camera2D = $Camera2D if has_node("Camera2D") else null

var _walk_cycle: float = 0.0
var _bullet_pool: BulletPool = null

func _ready() -> void:
	hp = max_hp
	stamina = max_stamina
	add_to_group("players")

	# BulletPool izlash (agar sahnada mavjud bo'lsa)
	_bullet_pool = get_tree().get_first_node_in_group("bullet_pool") as BulletPool

func _physics_process(delta: float) -> void:
	# 1. WASD harakatlanishi (va strelkalar)
	var direction = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction == Vector2.ZERO:
		direction = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")

	var is_sprinting = Input.is_action_pressed("sprint") and stamina > 10.0 and direction != Vector2.ZERO
	var current_speed = speed * (1.4 if is_sprinting else 1.0)

	if is_sprinting:
		stamina = max(0.0, stamina - 25.0 * delta)
	else:
		stamina = min(max_stamina, stamina + 20.0 * delta)

	velocity = direction * current_speed
	move_and_slide()

	# 2. Insoniy yurish animatsiyasi (Procedural Walk Bobbing)
	if direction != Vector2.ZERO and sprite:
		_walk_cycle += delta * 12.0
		sprite.position.y = sin(_walk_cycle) * 2.0
	elif sprite:
		sprite.position.y = 0.0

	# 3. Sichqoncha tomon qarash va Weapon Pivot
	var mouse_pos = get_global_mouse_position()

	# Qahramon tanasi sichqoncha tomon qarashi (chap yoki o'ng)
	if sprite:
		sprite.flip_h = (mouse_pos.x < global_position.x)

	# Qurolning 360 darajaga mustaqil aylanishi (Weapon Pivot)
	if weapon_pivot:
		var angle = (mouse_pos - weapon_pivot.global_position).angle()
		weapon_pivot.rotation = angle

		# Qurol teskari aylanib qolmasligi uchun vertikal flip
		if weapon_sprite:
			weapon_sprite.flip_v = (mouse_pos.x < global_position.x)

	# 4. O'q otish tekshiruvi
	if (Input.is_action_just_pressed("shoot") or Input.is_action_pressed("shoot") or Input.is_action_just_pressed("attack")) and can_fire:
		shoot()

func shoot() -> void:
	if not can_fire:
		return

	can_fire = false

	# Qurol orqaga silkinish (Recoil) effekti
	if weapon_sprite:
		weapon_sprite.position.x -= 4.0
		await get_tree().create_timer(0.05).timeout
		if is_instance_valid(weapon_sprite):
			weapon_sprite.position.x += 4.0

	# Qurol darajasiga qarab o'q otish
	if weapon_upgrade_level >= 2:
		# Multi-shot (3 ta tarqoq snaryad)
		_fire_projectile(0.0)
		_fire_projectile(0.16)
		_fire_projectile(-0.16)
	else:
		_fire_projectile(0.0)

	await get_tree().create_timer(fire_rate).timeout
	can_fire = true

func _fire_projectile(angle_offset: float) -> void:
	var spawn_pos = muzzle.global_position if muzzle else global_position
	var base_rot = weapon_pivot.rotation if weapon_pivot else rotation
	var bullet_rot = base_rot + angle_offset

	var mouse_pos = get_global_mouse_position()
	var dir = (mouse_pos - spawn_pos).normalized().rotated(angle_offset)

	# Agar Object Pool mavjud bo'lsa, xotiradan tayyor o'q olamiz
	if _bullet_pool:
		_bullet_pool.spawn_bullet(spawn_pos, dir, bullet_rot)
	elif bullet_scene:
		var bullet = bullet_scene.instantiate() as Area2D
		bullet.global_position = spawn_pos
		bullet.rotation = bullet_rot
		if "direction" in bullet:
			bullet.direction = dir
		get_tree().current_scene.add_child(bullet)

## Bonuslar va Zarar qabul qilish
func heal(amount: float) -> void:
	hp = min(max_hp, hp + amount)
	print("[Player] Jon tiklandi: +", amount, " | Joriy HP: ", hp, "/", max_hp)

func add_coins(amount: int) -> void:
	coins += amount
	score += amount * 10
	print("[Player] Tanga olindi! Jami tangalar: ", coins, " | Ball: ", score)

func add_score(amount: int) -> void:
	score += amount
	print("[Player] Ball qo'shildi: +", amount, " | Jami: ", score)

func upgrade_weapon() -> void:
	weapon_upgrade_level += 1
	fire_rate = max(0.08, fire_rate * 0.75)
	if weapon_sprite:
		weapon_sprite.modulate = Color(1.3, 0.7, 1.6)
	print("[Player] Qurol kuchaytirildi! Yangi daraja: ", weapon_upgrade_level)

func take_damage(amount: float) -> void:
	hp = max(0.0, hp - amount)
	print("[Player] Zarar yedi: -", amount, " | Qolgan HP: ", hp)

	if sprite:
		sprite.modulate = Color(2.5, 0.4, 0.4)
		await get_tree().create_timer(0.08).timeout
		if is_instance_valid(sprite):
			sprite.modulate = Color(1, 1, 1)

	if hp <= 0.0:
		# O'yin tugashi signalini GameUIManager ga yuborish
		var ui_manager = get_tree().get_first_node_in_group("ui_manager")
		if ui_manager and ui_manager.has_method("trigger_game_over"):
			ui_manager.trigger_game_over()
		else:
			print("GAME OVER! Qahramon halok bo'ldi.")
