class_name PlayerController
extends CharacterBody2D

## Player Movement, Sprinting, and Shooting/Combat Controller (Godot 4.x)

@export var walk_speed: float = 120.0
@export var sprint_speed: float = 190.0
@export var max_hp: float = 100.0
@export var max_stamina: float = 100.0

@export var bullet_scene: PackedScene = preload("res://scenes/objects/bullet.tscn")
@export var fire_rate: float = 0.2 # O'q otish tezligi (sekundda)

var hp: float = 100.0
var stamina: float = 100.0
var score: int = 0
var coins: int = 0
var selected_slot: int = 0
var can_fire: bool = true

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var weapon_sprite: Sprite2D = $WeaponSprite if has_node("WeaponSprite") else null
@onready var muzzle: Marker2D = $Muzzle if has_node("Muzzle") else null
@onready var camera: Camera2D = $Camera2D if has_node("Camera2D") else null

func _ready() -> void:
	hp = max_hp
	stamina = max_stamina

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
	var target_angle = (mouse_pos - global_position).angle()
	rotation = lerp_angle(rotation, target_angle, 0.25)

	# Flip weapon vertically if looking left for natural weapon orientation
	if weapon_sprite:
		var deg = rad_to_deg(rotation)
		weapon_sprite.flip_v = (deg > 90 or deg < -90)

	# O'q otish tekshiruvi (Shoot yoki Attack action - Sichqoncha chap tugmasi)
	if (Input.is_action_pressed("shoot") or Input.is_action_pressed("attack")) and can_fire:
		shoot()

func shoot() -> void:
	if not bullet_scene:
		return

	can_fire = false

	# O'q nusxasini yaratish
	var bullet = bullet_scene.instantiate() as Area2D

	# O'qning chiqish nuqtasi (Muzzle bo'lsa Muzzle, aks holda qahramon oldi)
	if muzzle:
		bullet.global_position = muzzle.global_position
	else:
		bullet.global_position = global_position + Vector2(cos(rotation), sin(rotation)) * 24.0

	# O'q yo'nalishini sichqoncha tomonga hisoblash
	var mouse_pos = get_global_mouse_position()
	bullet.direction = (mouse_pos - bullet.global_position).normalized()

	# O'qni joriy o'yin sahnasiga qo'shish
	get_tree().current_scene.add_child(bullet)

	# Cooldown kutish
	await get_tree().create_timer(fire_rate).timeout
	can_fire = true

func heal(amount: float) -> void:
	hp = min(max_hp, hp + amount)
	print("[Player] Jon tiklandi: +", amount, " | Joriy HP: ", hp, "/", max_hp)

func add_coins(amount: int) -> void:
	coins += amount
	score += amount * 10
	print("[Player] Tanga olindi: +", amount, " | Jami tangalar: ", coins, " | Ball: ", score)

func take_damage(amount: float) -> void:
	hp = max(0.0, hp - amount)
	print("[Player] Zarar yetkazildi: -", amount, " | Qolgan HP: ", hp)
	if hp <= 0.0:
		print("[Player] O'yinchi mag'lub bo'ldi!")
