class_name ParallaxController
extends ParallaxBackground

## Parallax fonini avtomatik siljitish va chuqurlik effekti (Godot 4.x)
## O'yinchi harakatlanganda Camera2D motion_scale orqali 3D chuqurlik beradi.
## O'yinchi to'xtab turganda esa sekin suzish (drift) effekti jonli atmosfera yaratadi.

@export var bg_drift_speed: Vector2 = Vector2(8.0, 2.0)    # Uzoqdagi yulduzlar/kosmosning sekin suzishi
@export var midground_drift: float = 20.0                  # Yaqindagi tuman/bulutlarning siljishi

@onready var layer1: ParallaxLayer = get_node_or_null("ParallaxLayer1")
@onready var layer2: ParallaxLayer = get_node_or_null("ParallaxLayer2")

func _process(delta: float) -> void:
	# 1-qavat: Uzoqdagi fon sekin suzadi
	if layer1:
		layer1.motion_offset += bg_drift_speed * delta

	# 2-qavat: Yaqindagi elementlar o'z tezligida gorizontal siljiydi
	if layer2:
		layer2.motion_offset.x += midground_drift * delta
