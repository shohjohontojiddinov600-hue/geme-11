class_name GameLevel
extends Node2D

## Asosiy O'yin Sahnasi Menejeri (Game / Level1)
## Player holatini kuzatib boradi, HUD interfeysini yangilaydi va o'yin oqimini ta'minlaydi.

@onready var player: PlayerController = $Player if has_node("Player") else null
@onready var hp_bar: ProgressBar = get_node_or_null("HUD/TopLeft/VBox/HPBar")
@onready var stamina_bar: ProgressBar = get_node_or_null("HUD/TopLeft/VBox/StaminaBar")
@onready var stats_label: Label = get_node_or_null("HUD/TopLeft/VBox/StatsLabel")
@onready var enemies_container: Node2D = get_node_or_null("Enemies")

func _ready() -> void:
	print("==================================================")
	print("  MYTHIC REALMS - 2D GAMEPLAY SAHNASI YUKLANDI   ")
	print("==================================================")
	print("Boshqaruv: WASD - Harakat | Shift - Yugurish | Sichqoncha - Nishon va O'q otish")

func _process(_delta: float) -> void:
	if is_instance_valid(player):
		if hp_bar:
			hp_bar.value = player.hp
			hp_bar.max_value = player.max_hp
		if stamina_bar:
			stamina_bar.value = player.stamina
			stamina_bar.max_value = player.max_stamina
		if stats_label:
			var enemy_count = enemies_container.get_child_count() if enemies_container else 0
			stats_label.text = "Tangalar: %d | Ball: %d | Dushmanlar: %d" % [player.coins, player.score, enemy_count]
