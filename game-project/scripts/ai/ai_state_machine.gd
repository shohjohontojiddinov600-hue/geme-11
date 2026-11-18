class_name AIStateMachine
extends Node

## 7. AI State Machine (FSM)
## Holatlar: IDLE (Kutish), PATROL (Aylanib yurish), CHASE (Quvish), ATTACK (Hujum), FLEE (Qochish)

enum State { IDLE, PATROL, CHASE, ATTACK, FLEE }

@export var current_state: State = State.IDLE
@export var detection_radius: float = 220.0
@export var attack_range: float = 40.0
@export var flee_hp_ratio: float = 0.2

var target_player: Node2D = null

func update_ai(actor: CharacterBody2D, hp_ratio: float, delta: float) -> void:
	match current_state:
		State.IDLE:
			if target_player and actor.global_position.distance_to(target_player.global_position) <= detection_radius:
				current_state = State.CHASE

		State.CHASE:
			if not target_player:
				current_state = State.IDLE
				return
			var dist = actor.global_position.distance_to(target_player.global_position)
			if dist <= attack_range:
				current_state = State.ATTACK
			elif dist > detection_radius * 1.5:
				current_state = State.IDLE

		State.ATTACK:
			if target_player and actor.global_position.distance_to(target_player.global_position) > attack_range:
				current_state = State.CHASE

		State.FLEE:
			# Low HP escape logic
			pass
