class_name Bullet
extends Area2D

## Snaryad / O'q Skripti (Godot 4.x - Object Pooling qo'llab-quvvatlaydi)
## Yo'nalish bo'yicha uchadi, dushman, devor yoki qutilarga tekkanda zararlaydi.

@export var speed: float = 850.0
@export var damage: int = 25
var direction: Vector2 = Vector2.ZERO
var lifetime: float = 2.5
var current_lifetime: float = 0.0
var is_active: bool = true

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	activate()

func activate() -> void:
	current_lifetime = 0.0
	is_active = true
	set_physics_process(true)
	visible = true

func _physics_process(delta: float) -> void:
	position += direction * speed * delta
	current_lifetime += delta
	if current_lifetime >= lifetime:
		deactivate()

func deactivate() -> void:
	if not is_active:
		return
	is_active = false
	visible = false
	set_physics_process(false)
	global_position = Vector2(-9999, -9999)
	# Agar alohida chaqirilgan bo'lsa (pool'siz), xotirani bo'shatadi
	if not (get_parent() is BulletPool):
		queue_free()

func _on_body_entered(body: Node2D) -> void:
	if not is_active:
		return
	if body.is_in_group("enemies") or body.is_in_group("destructible") or body.has_method("take_damage"):
		body.take_damage(damage)
		deactivate()
	elif body.is_in_group("walls"):
		deactivate()

func _on_area_entered(area: Area2D) -> void:
	if not is_active:
		return
	if area.is_in_group("enemies") or area.is_in_group("destructible") or area.has_method("take_damage"):
		area.take_damage(damage)
		deactivate()
	elif area.is_in_group("walls"):
		deactivate()
