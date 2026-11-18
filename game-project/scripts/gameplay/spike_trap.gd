class_name SpikeTrap
extends Area2D

## Tikanli Qopqon (Spike Trap)
## Taymer orqali ma'lum vaqtda chiqib-tushadi va ustida turganlarga doimiy zarar beradi.

@export var trap_damage: float = 16.0
@export var retracted_time: float = 2.0
@export var active_time: float = 1.6

var is_active: bool = false
var _cycle_timer: float = 0.0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

var tex_retracted: Texture2D = preload("res://assets/sprites/spike_trap.png")
var tex_active: Texture2D = preload("res://assets/sprites/spike_trap_active.png")

func _ready() -> void:
	add_to_group("traps")
	_set_trap_state(false)
	body_entered.connect(_on_body_entered)

func _process(delta: float) -> void:
	_cycle_timer += delta
	var limit = active_time if is_active else retracted_time
	if _cycle_timer >= limit:
		_cycle_timer = 0.0
		_set_trap_state(not is_active)

func _set_trap_state(active: bool) -> void:
	is_active = active
	if sprite:
		sprite.texture = tex_active if is_active else tex_retracted

	# Agar tikanlar chiqqan paytda uning ustida kimdir bo'lsa, zarar yetkazish
	if is_active:
		var overlapping = get_overlapping_bodies()
		for body in overlapping:
			_damage_entity(body)

func _on_body_entered(body: Node2D) -> void:
	if is_active:
		_damage_entity(body)

func _damage_entity(body: Node2D) -> void:
	if body.has_method("take_damage"):
		body.take_damage(trap_damage)
		print("[SpikeTrap] Qopqon ishga tushdi va zarar yetkazdi: -", trap_damage)
