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

  return {
    init, resume, playJumpscare, playChainsaw, stopChainsaw, setChainsawVolume,
    playFootstep, playGrannyFootstep, playDoorCreak, playHammerHit, playPickup,
    playHeartbeat, stopHeartbeat, playAmbient, playScream, playGrannyLaugh, noise, tone
  };
})();
