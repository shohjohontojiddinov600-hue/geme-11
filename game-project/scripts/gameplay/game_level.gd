class_name GameLevel
extends Node2D

## Asosiy O'yin Sahnasi Menejeri (Game / Level1 - Update 2.0)
## Player, dushmanlar, dinamik to'siqlar va GameUI holatlarini muvofiqlashtiradi.

@onready var player: PlayerController = $Player if has_node("Player") else null
@onready var enemies_container: Node2D = get_node_or_null("Enemies")

func _ready() -> void:
	print("==================================================")
	print("  ROGUE CELLS UPDATE 2.0 - GAMEPLAY SAHNASI YUKLANDI ")
	print("==================================================")
	print("Boshqaruv: WASD - Harakat | Shift - Sprint | Sichqoncha - Nishon va Otish | ESC - Pauza")
