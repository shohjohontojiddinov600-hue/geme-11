class_name GameManager
extends Node

## Core Game Manager for Mythic Realms (Godot 4.x)
## Handles Day/Night Cycle, Biome Tracking and Victory State

signal day_night_changed(is_night: bool, world_time: float)
signal game_won(winner_name: String)

const DAY_DURATION: float = 720.0 # 12 minutes per full day cycle
const NIGHT_THRESHOLD: float = 480.0 # Night starts at 8 minutes

var world_time: float = 120.0 # Starts in morning
var is_night: bool = false
var has_game_won: bool = false

func _process(delta: float) -> void:
	world_time = fmod(world_time + delta, DAY_DURATION)
	var night_state = world_time >= NIGHT_THRESHOLD
	if night_state != is_night:
		is_night = night_state
		day_night_changed.emit(is_night, world_time)

func trigger_victory(player_name: String) -> void:
	if not has_game_won:
		has_game_won = true
		game_won.emit(player_name)
