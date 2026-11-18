class_name NetworkManager
extends Node

## Server-Authoritative Network Manager for Mythic Realms (Godot 4.x)
## Implements ENetMultiplayerPeer and RPCs with Anti-Duplication guarantees.

signal player_connected(peer_id, player_info)
signal player_disconnected(peer_id)
signal server_disconnected()

const DEFAULT_PORT: int = 8910
const MAX_PLAYERS: int = 8

var peer: ENetMultiplayerPeer
var players: Dictionary = {} # peer_id -> PlayerData

func _ready() -> void:
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.server_disconnected.connect(_on_server_disconnected)

func host_server(port: int = DEFAULT_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var err = peer.create_server(port, MAX_PLAYERS)
	if err != OK:
		push_error("Failed to host server: %d" % err)
		return err
	multiplayer.multiplayer_peer = peer
	print("[Network] Authoritative Server hosting on port: %d" % port)
	return OK

func join_server(ip: String = "127.0.0.1", port: int = DEFAULT_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var err = peer.create_client(ip, port)
	if err != OK:
		push_error("Failed to connect to server: %d" % err)
		return err
	multiplayer.multiplayer_peer = peer
	print("[Network] Connecting to server at %s:%d" % [ip, port])
	return OK

func _on_peer_connected(id: int) -> void:
	print("[Network] Peer connected: %d" % id)

func _on_peer_disconnected(id: int) -> void:
	print("[Network] Peer disconnected: %d" % id)
	if multiplayer.is_server():
		players.erase(id)
		player_disconnected.emit(id)

func _on_server_disconnected() -> void:
	print("[Network] Disconnected from server.")
	players.clear()
	server_disconnected.emit()

## Server-Authoritative Input Validation
@rpc("any_peer", "call_remote", "unreliable")
func send_player_input(dir: Vector2, is_sprinting: bool, facing_angle: float) -> void:
	if not multiplayer.is_server():
		return
	var sender_id = multiplayer.get_remote_sender_id()
	if players.has(sender_id):
		players[sender_id].input_vector = dir.normalized()
		players[sender_id].is_sprinting = is_sprinting
		players[sender_id].facing_angle = facing_angle

## Reliable RPC for Item Transfer with Anti-Duplication
@rpc("any_peer", "call_remote", "reliable")
func request_chest_transfer(chest_id: String, from_slot: int, to_slot: int, count: int) -> void:
	if not multiplayer.is_server():
		return
	var sender_id = multiplayer.get_remote_sender_id()
	# Execute atomic transfer on server
	var success = SaveManager.atomic_transfer(sender_id, chest_id, from_slot, to_slot, count)
	if success:
		sync_chest_state.rpc(chest_id, SaveManager.get_chest_items(chest_id))

@rpc("authority", "call_remote", "reliable")
func sync_chest_state(chest_id: String, items: Array) -> void:
	pass
