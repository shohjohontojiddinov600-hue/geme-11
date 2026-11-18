class_name BulletPool
extends Node2D

## Object Pooling Tizimi (Godot 4.x Optimizatsiyasi)
## O'qlar har safar instantiate() qilinmaydi va queue_free() qilinmaydi.
## Buning o'rniga xotirada 100 ta o'q oldindan tayyorlanadi (Garbage Collection stutter yo'qoladi).

@export var pool_size: int = 100
@export var bullet_scene: PackedScene = preload("res://scenes/objects/bullet.tscn")

var _pool: Array[Node2D] = []

func _ready() -> void:
	# Barcha o'qlarni oldindan xotirada yaratish
	for i in range(pool_size):
		var bullet = bullet_scene.instantiate() as Area2D
		bullet.visible = false
		bullet.set_physics_process(false)
		bullet.global_position = Vector2(-9999, -9999)
		add_child(bullet)
		_pool.append(bullet)

## Faol bo'lmagan o'qni olib, uni faollashtirib qaytaradi
func spawn_bullet(spawn_pos: Vector2, shoot_direction: Vector2, bullet_rotation: float) -> Area2D:
	for bullet in _pool:
		if not bullet.visible:
			bullet.global_position = spawn_pos
			bullet.rotation = bullet_rotation
			if "direction" in bullet:
				bullet.direction = shoot_direction
			bullet.visible = true
			bullet.set_physics_process(true)
			if bullet.has_method("activate"):
				bullet.activate()
			return bullet

	# Agar barcha o'qlar band bo'lsa (favqulodda holat), yangi o'q yaratib beramiz
	var new_bullet = bullet_scene.instantiate() as Area2D
	new_bullet.global_position = spawn_pos
	new_bullet.rotation = bullet_rotation
	if "direction" in new_bullet:
		new_bullet.direction = shoot_direction
	add_child(new_bullet)
	_pool.append(new_bullet)
	return new_bullet

## O'qni qayta pool'ga topshirish
func recycle_bullet(bullet: Area2D) -> void:
	bullet.visible = false
	bullet.set_physics_process(false)
	bullet.global_position = Vector2(-9999, -9999)
