// Original synthesized audio: no network fetches or third-party music assets.
export class Audio {
  context: AudioContext | null = null;
  music: GainNode | null = null;
  unlocked = false;
  unlock() {
    if (this.context) return;
    try {
      this.context = new AudioContext();
      this.music = this.context.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.context.destination);
      for (const frequency of [65.406, 97.999, 130.813]) {
        const oscillator = this.context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(this.music);
        oscillator.start();
      }
      this.unlocked = true;
    } catch {
      /* Audio is optional on unsupported browsers. */
    }
  }
  sync(music: number, paused: boolean) {
    if (!this.context || !this.music) return;
    this.music.gain.setTargetAtTime(
      paused ? 0 : music * 0.025,
      this.context.currentTime,
      0.08,
    );
    if (paused) void this.context.suspend();
    else void this.context.resume();
  }
  effect(volume: number, hit = false) {
    if (!this.context || this.context.state !== "running" || !volume) return;
    const c = this.context,
      o = c.createOscillator(),
      gain = c.createGain();
    o.type = hit ? "triangle" : "sine";
    o.frequency.setValueAtTime(hit ? 350 : 180, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.16);
    gain.gain.setValueAtTime(volume * 0.07, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
    o.connect(gain);
    gain.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.21);
  }
}
