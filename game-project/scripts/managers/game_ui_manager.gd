class_name GameUIManager
extends CanvasLayer

## Game State & UI Menejeri (Update 2.0 - Centralized UI State Machine)
## Barcha UI holatlarini (Playing, Paused, Reward Card Selection, Game Over, Victory) boshqaradi.

enum UIState {
	MAIN_MENU,
	PLAYING,
	PAUSED,
	REWARD,
	GAME_OVER,
	VICTORY
}

signal state_changed(new_state: UIState)

var current_state: UIState = UIState.PLAYING

@onready var hud_panel: Control = get_node_or_null("HUDPanel")
@onready var pause_panel: Control = get_node_or_null("PausePanel")
@onready var reward_panel: Control = get_node_or_null("RewardPanel")
@onready var game_over_panel: Control = get_node_or_null("GameOverPanel")
@onready var victory_panel: Control = get_node_or_null("VictoryPanel")

@onready var hp_bar: ProgressBar = get_node_or_null("HUDPanel/TopLeft/VBox/HPBar")
@onready var stamina_bar: ProgressBar = get_node_or_null("HUDPanel/TopLeft/VBox/StaminaBar")
@onready var stats_label: Label = get_node_or_null("HUDPanel/TopLeft/VBox/StatsLabel")

var player: PlayerController = null

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group("ui_manager")
	set_state(UIState.PLAYING)

	player = get_tree().get_first_node_in_group("players") as PlayerController

	_connect_buttons()

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") or (event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE):
		if current_state == UIState.PLAYING:
			set_state(UIState.PAUSED)
		elif current_state == UIState.PAUSED:
			set_state(UIState.PLAYING)

func _process(_delta: float) -> void:
	if current_state == UIState.PLAYING and is_instance_valid(player):
		if hp_bar:
			hp_bar.value = player.hp
			hp_bar.max_value = player.max_hp
		if stamina_bar:
			stamina_bar.value = player.stamina
			stamina_bar.max_value = player.max_stamina
		if stats_label:
			var enemies = get_tree().get_nodes_in_group("enemies").size()
			stats_label.text = "Tangalar: %d | Ball: %d | Qurol: Lvl %d | Dushmanlar: %d" % [player.coins, player.score, player.weapon_upgrade_level, enemies]

			# Agar barcha dushmanlar yo'q qilinsa, G'alaba holatiga o'tish
			if enemies == 0 and current_state == UIState.PLAYING and player.score > 0:
				set_state(UIState.VICTORY)

func set_state(new_state: UIState) -> void:
	current_state = new_state
	emit_signal("state_changed", new_state)

	# Barcha oynalarni yopish
	if hud_panel: hud_panel.visible = false
	if pause_panel: pause_panel.visible = false
	if reward_panel: reward_panel.visible = false
	if game_over_panel: game_over_panel.visible = false
	if victory_panel: victory_panel.visible = false

	match current_state:
		UIState.PLAYING:
			get_tree().paused = false
			if hud_panel: hud_panel.visible = true

		UIState.PAUSED:
			get_tree().paused = true
			if pause_panel: pause_panel.visible = true

		UIState.REWARD:
			get_tree().paused = true
			if reward_panel: reward_panel.visible = true

		UIState.GAME_OVER:
			get_tree().paused = true
			if game_over_panel: game_over_panel.visible = true

		UIState.VICTORY:
			get_tree().paused = true
			if victory_panel: victory_panel.visible = true

func trigger_game_over() -> void:
	set_state(UIState.GAME_OVER)

func trigger_reward_selection() -> void:
	set_state(UIState.REWARD)

func _connect_buttons() -> void:
	# Pause Buttons
	var resume_btn = get_node_or_null("PausePanel/Center/VBox/ResumeBtn") as Button
	if resume_btn:
		resume_btn.pressed.connect(func(): set_state(UIState.PLAYING))

	var restart_btn = get_node_or_null("PausePanel/Center/VBox/RestartBtn") as Button
	if restart_btn:
		restart_btn.pressed.connect(_restart_game)

	# Game Over / Victory Restart Buttons
	var go_restart_btn = get_node_or_null("GameOverPanel/Center/VBox/RestartBtn") as Button
	if go_restart_btn:
		go_restart_btn.pressed.connect(_restart_game)

	var vic_restart_btn = get_node_or_null("VictoryPanel/Center/VBox/RestartBtn") as Button
	if vic_restart_btn:
		vic_restart_btn.pressed.connect(_restart_game)

	# Reward Cards
	var card1 = get_node_or_null("RewardPanel/HBox/Card1/Button") as Button
	if card1:
		card1.pressed.connect(func():
			if player: player.heal(50.0)
			set_state(UIState.PLAYING)
		)

	var card2 = get_node_or_null("RewardPanel/HBox/Card2/Button") as Button
	if card2:
		card2.pressed.connect(func():
			if player: player.speed += 60.0
			set_state(UIState.PLAYING)
		)

	var card3 = get_node_or_null("RewardPanel/HBox/Card3/Button") as Button
	if card3:
		card3.pressed.connect(func():
			if player: player.upgrade_weapon()
			set_state(UIState.PLAYING)
		)

func _restart_game() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()
