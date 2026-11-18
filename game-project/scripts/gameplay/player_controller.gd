class_name PlayerController
extends CharacterBody2D

## Qahramon va Qurol Boshqaruvi (Player.gd / Godot 4.x)
## Harakatlanadi, sichqonchaga qarab buriladi va qo'lidagi qurol bilan o'q otadi.

@export var speed: float = 300.0
@export var bullet_scene: PackedScene = preload("res://scenes/objects/bullet.tscn")
@export var fire_rate: float = 0.2 # Sekundiga otish chastotasi

@export var max_hp: float = 100.0
@export var max_stamina: float = 100.0

var hp: float = 100.0
var stamina: float = 100.0
var score: int = 0
var coins: int = 0
var weapon_upgrade_level: int = 1
var can_fire: bool = true

@onready var weapon_sprite: Sprite2D = $WeaponSprite if has_node("WeaponSprite") else null
@onready var muzzle: Marker2D = $Muzzle if has_node("Muzzle") else null
@onready var camera: Camera2D = $Camera2D if has_node("Camera2D") else null

func _ready() -> void:
	hp = max_hp
	stamina = max_stamina

func _physics_process(delta: float) -> void:
	# 1. WASD orqali harakatlanish (va Arrow keys / ui_left, ui_right...)
	var direction = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction == Vector2.ZERO:
		direction = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")

	# Shift bosilganda sprint qilish (stamina sarflaydi)
	var current_speed = speed
	if Input.is_action_pressed("sprint") and stamina > 10.0 and direction != Vector2.ZERO:
		current_speed = speed * 1.5
		stamina = max(0.0, stamina - 25.0 * delta)
	else:
		stamina = min(max_stamina, stamina + 20.0 * delta)

	velocity = direction * current_speed
	move_and_slide()

	# 2. Sichqoncha qayerda bo'lsa, o'sha tomonga qarab burilish
	var mouse_pos = get_global_mouse_position()
	look_at(mouse_pos)

	# Qurolning teskari o'girilib qolmasligi uchun tabiiy yo'nalish
	if weapon_sprite:
		var deg = rad_to_deg(rotation)
		weapon_sprite.flip_v = (deg > 90 or deg < -90)

	# 3. Sichqoncha bosilganda o'q otish
	if (Input.is_action_just_pressed("shoot") or Input.is_action_pressed("shoot") or Input.is_action_just_pressed("attack")) and can_fire:
		shoot()

func shoot() -> void:
	if not bullet_scene or not can_fire:
		return

	can_fire = false

	# Kuchaytirilgan qurol: 2-darajada Multi-shot (3 ta tarqoq o'q otadi)
	if weapon_upgrade_level >= 2:
		_spawn_bullet(0.0)
		_spawn_bullet(0.18)
		_spawn_bullet(-0.18)
	else:
		_spawn_bullet(0.0)

	# Cooldown kutish
	await get_tree().create_timer(fire_rate).timeout
	can_fire = true

func _spawn_bullet(angle_offset: float) -> void:
	var bullet = bullet_scene.instantiate() as Area2D
	if muzzle:
		bullet.global_position = muzzle.global_position
	else:
		bullet.global_position = global_position + Vector2(cos(rotation), sin(rotation)) * 26.0

	bullet.rotation = rotation + angle_offset

	# O'q uchish yo'nalishi (Sichqoncha yo'nalishi bo'yicha)
	var mouse_pos = get_global_mouse_position()
	var base_direction = (mouse_pos - bullet.global_position).normalized()
	bullet.direction = base_direction.rotated(angle_offset)

	# O'qni joriy o'yin sahnasiga qo'shish
	get_tree().current_scene.add_child(bullet)

## Sovg'alarni qabul qilish funksiyalari
func heal(amount: float) -> void:
	hp = min(max_hp, hp + amount)
	print("Hayot tiklandi! +", amount, " | Joriy HP: ", hp, "/", max_hp)

func add_coins(amount: int) -> void:
	coins += amount
	score += amount * 10
	print("Tanga olindi! Ball qo'shildi. Tangalar: ", coins, " | Ball: ", score)

func add_score(amount: int) -> void:
	score += amount
	print("Ball qo'shildi! Jami ball: ", score)

func upgrade_weapon() -> void:
	weapon_upgrade_level += 1
	fire_rate = max(0.09, fire_rate * 0.75) # Otish tezlashadi
	if weapon_sprite:
		weapon_sprite.modulate = Color(1.3, 0.7, 1.6) # Binafsha plazma qurol effekti
	print("Qurol kuchaytirildi! Daraja: ", weapon_upgrade_level, " | Otish tezligi: ", fire_rate, " sek")

func take_damage(amount: float) -> void:
	hp = max(0.0, hp - amount)
	print("[Player] Zarar: -", amount, " | Qolgan HP: ", hp)
	if hp <= 0.0:
		print("Qahramon halok bo'ldi! Game Over.")
