class_name ExplosiveBarrel
extends StaticBody2D

## Portlovchi Bochkalar (Explosive Barrel)
## O'q tekkanda portlaydi va ma'lum radiusdagi barcha obyektlarga katta zarar yetkazadi.

@export var max_hp: float = 20.0
@export var blast_damage: float = 65.0
@export var blast_radius: float = 95.0

var hp: float = 20.0
var has_exploded: bool = false

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	hp = max_hp
	add_to_group("destructible")
	add_to_group("walls")

func take_damage(amount: float) -> void:
	if has_exploded:
		return

	hp -= amount
	if hp <= 0.0:
		explode()

func explode() -> void:
	if has_exploded:
		return
	has_exploded = true

	# Portlashdan oldingi qisqa miltillash (fuse flash)
	if sprite:
		sprite.modulate = Color(3.0, 1.5, 0.5)
	await get_tree().create_timer(0.08).timeout

	print("💥 [Barrel] BOOOM! Bochka portladi va atrofga zarar tarqatdi!")

	# Blast radiusdagi barcha qahramon va dushmanlarni aniqlash
	var space_state = get_world_2d().direct_space_state
	var query = PhysicsShapeQueryParameters2D.new()
	var circle = CircleShape2D.new()
	circle.radius = blast_radius
	query.shape = circle
	query.transform = global_transform

	var results = space_state.intersect_shape(query, 32)
	for hit in results:
		var collider = hit.collider
		if collider and collider != self:
			if collider.has_method("take_damage"):
				collider.take_damage(blast_damage)

	queue_free()
