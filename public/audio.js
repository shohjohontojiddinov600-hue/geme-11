// Pure Web Audio API Sound Synthesizer with Volume and Mute Controls for Mythic Realms
class GameAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterVolume = 0.8;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
    if (this.isMuted) return;
    this.ensureContext();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal * this.masterVolume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  footstep() {
    this.playTone(80 + Math.random() * 30, 'triangle', 0.05, 0.04);
  }

  chop() {
    this.playTone(160, 'sawtooth', 0.1, 0.15);
  }

  mine() {
    this.playTone(420 + Math.random() * 60, 'square', 0.08, 0.12);
  }

  slash() {
    this.playTone(280, 'sine', 0.12, 0.18);
  }

  bowShoot() {
    this.playTone(520, 'triangle', 0.15, 0.15);
  }

  pickup() {
    this.playTone(660, 'sine', 0.08, 0.1);
    setTimeout(() => this.playTone(880, 'sine', 0.1, 0.1), 60);
  }

  craft() {
    this.playTone(550, 'triangle', 0.12, 0.15);
    setTimeout(() => this.playTone(770, 'triangle', 0.15, 0.15), 100);
  }

  hurt() {
    this.playTone(120, 'sawtooth', 0.2, 0.2);
  }

  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.4, 0.25);
      }, idx * 180);
    });
  }
}

window.gameAudio = new GameAudio();
