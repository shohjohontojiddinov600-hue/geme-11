// Modern Web Audio API Engine with Ambient Synth BGM and Dynamic SFX
class GameAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.musicEnabled = true;
    this.masterVolume = 0.8;
    this.bgmTimer = null;
    this.bgmStep = 0;
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
    if (this.isMuted) {
      this.stopBGM();
    } else if (this.musicEnabled) {
      this.startBGM();
    }
    return this.isMuted;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled && !this.isMuted) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.musicEnabled;
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

  // Atmospheric Synthesized Ambient BGM (Soft ambient pads)
  startBGM() {
    if (this.bgmTimer || this.isMuted || !this.musicEnabled) return;
    this.ensureContext();

    const chords = [
      [261.63, 311.13, 392.00], // C minor
      [220.00, 261.63, 329.63], // A minor
      [196.00, 246.94, 293.66], // G major
      [174.61, 220.00, 261.63]  // F major
    ];

    this.bgmTimer = setInterval(() => {
      if (this.isMuted || !this.musicEnabled) return;
      const chord = chords[this.bgmStep % chords.length];
      this.bgmStep++;
      for (const note of chord) {
        this.playTone(note, 'sine', 1.8, 0.025);
      }
    }, 2400);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
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

  slash(isCrit = false) {
    if (isCrit) {
      this.playTone(380, 'sawtooth', 0.18, 0.25);
      setTimeout(() => this.playTone(620, 'triangle', 0.15, 0.2), 60);
    } else {
      this.playTone(280, 'sine', 0.12, 0.18);
    }
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

  levelUp() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.2), idx * 100);
    });
  }

  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.45, 0.25);
      }, idx * 160);
    });
  }
}

window.gameAudio = new GameAudio();
