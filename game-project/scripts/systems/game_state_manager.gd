class_name GameStateManager
extends Node

## 1. Game State Manager
## Boshqaradi: Menu, Lobby, Playing, Paused, GameOver, Victory

enum State {
	MAIN_MENU,
	LOBBY,
	PLAYING,
	PAUSED,
	GAME_OVER,
	VICTORY
}

signal state_changed(old_state: State, new_state: State)

var current_state: State = State.MAIN_MENU

func change_state(new_state: State) -> void:
	if current_state == new_state:
		return
	var old = current_state
	current_state = new_state
	state_changed.emit(old, new_state)

	match current_state:
		State.PAUSED:
			get_tree().paused = true
		State.PLAYING:
			get_tree().paused = false
		State.VICTORY:
			print("[GameState] Victory achieved!")
