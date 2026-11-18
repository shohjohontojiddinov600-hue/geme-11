class_name Bullet
extends Area2D

## Snaryad / O'q Skripti (Godot 4.x)
## Yo'nalish bo'yicha uchadi, dushmanga yoki devorga tekkanda zararlaydi va yo'qoladi.

@export var speed: float = 800.0
@export var damage: int = 20
var direction: Vector2 = Vector2.ZERO

func _ready() -> void:
	# O'q yo'nalishiga qarab burilishi
	if direction != Vector2.ZERO:
		rotation = direction.angle()

	# Dushmanga yoki devorga tekkanini aniqlash signallari
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)

	# O'q 3 sekunddan keyin o'chib ketadi (xotirani band qilmasligi uchun)
	await get_tree().create_timer(3.0).timeout
	if is_instance_valid(self):
		queue_free()

func _physics_process(delta: float) -> void:
	# O'qni ko'rsatilgan yo'nalish bo'yicha uchirish
	position += direction * speed * delta

# PhysicsBody2D (CharacterBody2D, TileMap, StaticBody2D) bilan to'qnashuv
func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("enemies"):
		# Dushmanga zarar yetkazish funksiyasi
		if body.has_method("take_damage"):
			body.take_damage(damage)
		queue_free() # O'q tegishi bilan yo'qoladi
	elif body.is_in_group("walls"):
		queue_free() # Devorga tekkanida ham yo'qoladi

# Area2D bilan to'qnashuv
func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("enemies"):
		if area.has_method("take_damage"):
			area.take_damage(damage)
		queue_free()
	elif area.is_in_group("walls"):
		queue_free()
