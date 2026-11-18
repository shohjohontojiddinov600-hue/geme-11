class_name AudioManager
extends Node

## 4. Audio Manager
## Boshqaradi: Musiqa (BGM), SFX, audio buslar (Master, Music, SFX), ovoz balandligi

@export var master_volume: float = 1.0
@export var sfx_volume: float = 1.0
@export var music_volume: float = 0.8

var sfx_players: Array[AudioStreamPlayer] = []

func _ready() -> void:
	for i in range(8):
		var p = AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		sfx_players.append(p)

func play_sfx(stream: AudioStream, pitch_scale: float = 1.0) -> void:
	for p in sfx_players:
		if not p.playing:
			p.stream = stream
			p.pitch_scale = pitch_scale
			p.volume_db = linear_to_db(sfx_volume * master_volume)
			p.play()
			return

func set_bus_volume(bus_name: String, linear_vol: float) -> void:
	var bus_idx = AudioServer.get_bus_index(bus_name)
	if bus_idx != -1:
		AudioServer.set_bus_volume_db(bus_idx, linear_to_db(linear_vol))
