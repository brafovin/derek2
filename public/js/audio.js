// Web Audio API - Procedural horror sounds
const AudioManager = (() => {
  let ctx = null;
  let masterGain = null;
  const sounds = {};

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('Audio not available');
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function noise(duration = 0.1, volume = 0.3) {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400 + Math.random() * 200;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    gain.gain.setTargetAtTime(0, ctx.currentTime + duration * 0.5, 0.05);
    return source;
  }

  function tone(freq, duration, type = 'sine', volume = 0.3) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    gain.gain.setTargetAtTime(0, ctx.currentTime + duration * 0.7, 0.05);
    return osc;
  }

  function playJumpscare() {
    if (!ctx) return;
    // Loud screech
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 800;
    osc1.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.5);
    osc2.type = 'square';
    osc2.frequency.value = 1200;
    osc2.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
    gain.gain.value = 0.8;
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.3, 0.1);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);
    osc1.start(); osc2.start();
    osc1.stop(ctx.currentTime + 0.8);
    osc2.stop(ctx.currentTime + 0.8);
    noise(0.5, 0.6);
  }

  function playChainsaw() {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.sign(Math.sin(i * 0.05)) * (Math.random() * 0.3 + 0.7);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    sounds.chainsaw = { source, gain };
    return source;
  }

  function stopChainsaw() {
    if (sounds.chainsaw) {
      sounds.chainsaw.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => {
        try { sounds.chainsaw.source.stop(); } catch(e) {}
        sounds.chainsaw = null;
      }, 300);
    }
  }

  function setChainsawVolume(vol) {
    if (sounds.chainsaw) {
      sounds.chainsaw.gain.gain.setTargetAtTime(vol * 0.4, ctx.currentTime, 0.1);
    }
  }

  function playFootstep() {
    if (!ctx) return;
    noise(0.08, 0.15);
    tone(80 + Math.random() * 40, 0.1, 'sine', 0.1);
  }

  function playGrannyFootstep() {
    if (!ctx) return;
    tone(60, 0.15, 'sine', 0.25);
    noise(0.1, 0.2);
  }

  function playDoorCreak() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 300;
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.8);
    gain.gain.value = 0.3;
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.6, 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  }

  function playHammerHit() {
    if (!ctx) return;
    noise(0.2, 0.5);
    tone(150, 0.3, 'square', 0.3);
    tone(80, 0.4, 'sine', 0.2);
  }

  function playPickup() {
    if (!ctx) return;
    tone(600, 0.1, 'sine', 0.2);
    tone(800, 0.1, 'sine', 0.15);
    setTimeout(() => tone(1000, 0.1, 'sine', 0.1), 80);
  }

  function playHeartbeat(fast = false) {
    if (!ctx || sounds.heartbeat) return;
    const interval = fast ? 300 : 800;
    function beat() {
      if (!sounds.heartbeatActive) return;
      tone(60, 0.08, 'sine', 0.4);
      setTimeout(() => tone(55, 0.06, 'sine', 0.3), 120);
      sounds.heartbeatTimer = setTimeout(beat, interval);
    }
    sounds.heartbeatActive = true;
    beat();
  }

  function stopHeartbeat() {
    sounds.heartbeatActive = false;
    clearTimeout(sounds.heartbeatTimer);
  }

  function playAmbient() {
    if (!ctx) return;
    // Low drone
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 5;
    gain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    lfo.start();
    sounds.ambient = { osc, lfo };
  }

  function playScream() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 400 + Math.random() * 200;
    osc.frequency.linearRampToValueAtTime(200 + Math.random() * 100, ctx.currentTime + 0.8);
    gain.gain.value = 0.6;
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.5, 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 1);
    noise(0.8, 0.4);
  }

  function playGrannyLaugh() {
    if (!ctx) return;
    const freqs = [300, 350, 280, 320, 300];
    freqs.forEach((f, i) => {
      setTimeout(() => {
        tone(f, 0.15, 'sawtooth', 0.35);
        noise(0.1, 0.2);
      }, i * 200);
    });
  }

  // ── Verstimmte Spieluhr (eigene, gruselige Melodie) ──────────────────
  // Eine einzelne Glockennote: Sinus + leichtes Detune, schneller Abfall.
  function musicBoxNote(freq, time, vol = 0.22) {
    if (!ctx) return;
    [0, 3.5].forEach((detune, k) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune + (Math.random() - 0.5) * 12; // verstimmt
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol * (k ? 0.4 : 1), time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.9);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(time);
      osc.stop(time + 1.0);
    });
  }

  function playMusicBox() {
    if (!ctx || sounds.musicBoxActive) return;
    sounds.musicBoxActive = true;
    // Eigene Moll-Melodie (A-Moll), bewusst etwas „daneben"
    const A4 = 440;
    const semi = n => A4 * Math.pow(2, n / 12);
    // Notenfolge in Halbtonschritten relativ zu A4
    const melody = [0, 7, 3, 5, 2, 3, -2, 0,  0, 7, 10, 7, 3, 2, 0, -5];
    const step = 0.46; // Sekunden pro Note
    function loop() {
      if (!sounds.musicBoxActive) return;
      const t0 = ctx.currentTime + 0.05;
      melody.forEach((n, i) => musicBoxNote(semi(n) * 0.5, t0 + i * step));
      sounds.musicBoxTimer = setTimeout(loop, melody.length * step * 1000 + 1400);
    }
    loop();
  }

  function stopMusicBox() {
    sounds.musicBoxActive = false;
    clearTimeout(sounds.musicBoxTimer);
  }

  // ── Knarzende Diele / Holz ───────────────────────────────────────────
  function playCreak() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const base = 90 + Math.random() * 120;
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(base * 0.6, ctx.currentTime + 0.4 + Math.random() * 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    gain.gain.value = 0.0;
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.05);
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.3, 0.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  }

  // ── Geflüster (gefilterter Rauschimpuls) ─────────────────────────────
  function playWhisper() {
    if (!ctx) return;
    const dur = 0.6 + Math.random() * 0.7;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // amplitudenmoduliertes Rauschen ~ Silben
      const env = 0.5 + 0.5 * Math.sin(i * 0.0025 * (1 + Math.random() * 0.2));
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600 + Math.random() * 600;
    filter.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.1);
    gain.gain.setTargetAtTime(0, ctx.currentTime + dur * 0.5, 0.2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  // ── Schrotflinten-Schuss (lauter Knall + Nachhall) ───────────────────
  function playShotgun() {
    if (!ctx) return;
    // Harter Knall: kurzer Rauschimpuls durch Tiefpass
    const dur = 0.4;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 2.5); // schneller Abfall
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    // Tiefer Sub-Punch
    tone(55, 0.25, 'sine', 0.7);
    tone(90, 0.15, 'square', 0.3);
  }

  // ── Schreck-Sting: kurzer, harter Akzent (z.B. wenn Granny auftaucht) ─
  function playStinger() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.55, ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.15, 0.08);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    // tiefer Rumms darunter
    tone(45, 0.6, 'sine', 0.5);
    noise(0.2, 0.35);
  }

  // ── Zufällige Hintergrund-Schrecken (Knarzen/Flüstern/Ferne Schreie) ─
  function startRandomAmbience() {
    if (!ctx || sounds.ambienceActive) return;
    sounds.ambienceActive = true;
    function schedule() {
      if (!sounds.ambienceActive) return;
      const r = Math.random();
      if (r < 0.5)      playCreak();
      else if (r < 0.8) playWhisper();
      else { // ferner, leiser Schrei
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 300 + Math.random() * 150;
        osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.6);
        gain.gain.value = 0.08;
        gain.gain.setTargetAtTime(0, ctx.currentTime + 0.4, 0.15);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(); osc.stop(ctx.currentTime + 0.9);
      }
      sounds.ambienceTimer = setTimeout(schedule, 5000 + Math.random() * 9000);
    }
    sounds.ambienceTimer = setTimeout(schedule, 3000 + Math.random() * 4000);
  }

  function stopRandomAmbience() {
    sounds.ambienceActive = false;
    clearTimeout(sounds.ambienceTimer);
  }

  return {
    init, resume, playJumpscare, playChainsaw, stopChainsaw, setChainsawVolume,
    playFootstep, playGrannyFootstep, playDoorCreak, playHammerHit, playPickup,
    playHeartbeat, stopHeartbeat, playAmbient, playScream, playGrannyLaugh,
    playMusicBox, stopMusicBox, playCreak, playWhisper, playStinger, playShotgun,
    startRandomAmbience, stopRandomAmbience, noise, tone
  };
})();
