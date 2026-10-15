/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AudioAnalysis } from '../types/visualizer';

export interface BuiltInTrack {
  id: string;
  name: string;
  bpm: number;
  genre: string;
}

export const BUILT_IN_TRACKS: BuiltInTrack[] = [
  { id: 'synthwave', name: 'Neon Horizon', bpm: 124, genre: 'Synthwave / Cyber' },
  { id: 'chillwave', name: 'Solar Aurora', bpm: 96, genre: 'Chill Lofi Ambient' },
  { id: 'techno', name: 'Cyber Pulse', bpm: 130, genre: 'Electro / Acid Club' },
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  // Analyser data buffers
  private freqData: Uint8Array = new Uint8Array(1024);
  private timeData: Uint8Array = new Uint8Array(1024);

  // Audio state
  private isPlaying: boolean = false;
  private currentSourceType: 'synth' | 'file' | 'mic' = 'synth';
  private currentTrackId: string = 'synthwave';
  private volume: number = 0.85;
  private isMuted: boolean = false;

  // File audio element source
  private audioElement: HTMLAudioElement | null = null;
  private audioMediaSource: MediaElementAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Procedural Synth Sequencer
  private synthTimer: number | null = null;
  private synthStep: number = 0;
  private synthBpm: number = 124;
  private nextNoteTime: number = 0;
  private noiseBuffer: AudioBuffer | null = null;

  // Beat Detection
  private beatCutoffTime: number = 0;
  private energyHistory: number[] = [];
  private beatSensitivity: number = 1.35; // Multiplier over moving average

  // Smoothed Analysis
  private smoothedBass: number = 0;
  private smoothedMid: number = 0;
  private smoothedTreble: number = 0;
  private beatDecay: number = 0;

  constructor() {
    // Lazy AudioContext creation on first user interaction
  }

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);

    // Stream destination for video export recording
    if (this.ctx.createMediaStreamDestination) {
      this.destinationNode = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.destinationNode);
    }

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

    // Pre-create 1 second of white noise for procedural drums
    this.generateNoiseBuffer();
  }

  private generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public async resumeContext() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getAudioStream(): MediaStream | null {
    return this.destinationNode ? this.destinationNode.stream : null;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getSourceType(): 'synth' | 'file' | 'mic' {
    return this.currentSourceType;
  }

  public getCurrentTrackId(): string {
    return this.currentTrackId;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  public setBeatSensitivity(val: number) {
    this.beatSensitivity = Math.max(1.05, Math.min(2.5, val));
  }

  // --- PLAYBACK CONTROLS ---

  public async play(): Promise<void> {
    await this.resumeContext();
    if (this.isPlaying) return;

    this.isPlaying = true;

    if (this.currentSourceType === 'synth') {
      this.startSynthSequencer();
    } else if (this.currentSourceType === 'file' && this.audioElement) {
      this.audioElement.play().catch(console.error);
    }
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.currentSourceType === 'synth') {
      this.stopSynthSequencer();
    } else if (this.currentSourceType === 'file' && this.audioElement) {
      this.audioElement.pause();
    }
  }

  public async togglePlay(): Promise<void> {
    if (this.isPlaying) {
      this.pause();
    } else {
      await this.play();
    }
  }

  // --- PROCEDURAL SYNTH TRACK SWITCHING ---

  public selectTrack(trackId: string) {
    this.currentTrackId = trackId;
    this.currentSourceType = 'synth';

    // Stop other sources
    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    const track = BUILT_IN_TRACKS.find((t) => t.id === trackId);
    this.synthBpm = track ? track.bpm : 124;

    if (this.isPlaying) {
      this.stopSynthSequencer();
      this.synthStep = 0;
      this.startSynthSequencer();
    }
  }

  // --- LOCAL FILE UPLOAD ---

  public loadAudioFile(file: File) {
    this.initContext();
    if (!this.ctx) return;

    // Stop synth and mic
    this.stopSynthSequencer();
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = url;
    audio.crossOrigin = 'anonymous';
    audio.loop = true;

    if (!this.audioMediaSource && this.masterGain) {
      this.audioMediaSource = this.ctx.createMediaElementSource(audio);
      this.audioMediaSource.connect(this.masterGain);
    }

    this.audioElement = audio;
    this.currentSourceType = 'file';
    this.currentTrackId = file.name;

    if (this.isPlaying) {
      audio.play().catch(console.error);
    }
  }

  // --- MICROPHONE INPUT ---

  public async enableMicrophone(): Promise<boolean> {
    this.initContext();
    if (!this.ctx) return false;

    try {
      this.stopSynthSequencer();
      if (this.audioElement) {
        this.audioElement.pause();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;
      this.micSource = this.ctx.createMediaStreamSource(stream);

      // Connect mic to analyser ONLY (not to speakers to avoid painful acoustic feedback)
      if (this.analyser) {
        this.micSource.connect(this.analyser);
      }

      this.currentSourceType = 'mic';
      this.isPlaying = true;
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable, falling back to synth track', err);
      this.selectTrack('synthwave');
      await this.play();
      return false;
    }
  }

  public async switchToFileOrSynth(): Promise<void> {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micSource && this.analyser) {
      try {
        this.micSource.disconnect();
      } catch (e) {
        console.warn('Mic disconnect error', e);
      }
      this.micSource = null;
    }

    if (this.audioElement && this.audioElement.src) {
      this.currentSourceType = 'file';
      await this.play();
    } else {
      this.selectTrack(this.currentTrackId || 'synthwave');
      await this.play();
    }
  }

  public isMicrophoneActive(): boolean {
    return this.currentSourceType === 'mic';
  }

  // --- PROCEDURAL SYNTH ENGINE IMPLEMENTATION ---

  private startSynthSequencer() {
    if (!this.ctx) return;
    this.synthStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    // Lookahead timer runs every 25ms and schedules notes for next 100ms
    const interval = 25;
    this.synthTimer = window.setInterval(() => {
      this.scheduleNotes();
    }, interval);
  }

  private stopSynthSequencer() {
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }

  private scheduleNotes() {
    if (!this.ctx || !this.isPlaying) return;

    const secondsPerBeat = 60.0 / this.synthBpm;
    const secondsPer16th = secondsPerBeat / 4.0;
    const lookahead = 0.1;

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.playStep(this.synthStep, this.nextNoteTime);
      this.synthStep = (this.synthStep + 1) % 64; // 4-bar loop (16 steps per bar)
      this.nextNoteTime += secondsPer16th;
    }
  }

  private playStep(step: number, time: number) {
    if (!this.ctx || !this.masterGain) return;

    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;

    if (this.currentTrackId === 'synthwave') {
      this.playSynthwaveStep(stepInBar, bar, time);
    } else if (this.currentTrackId === 'chillwave') {
      this.playChillwaveStep(stepInBar, bar, time);
    } else {
      this.playTechnoStep(stepInBar, bar, time);
    }
  }

  // 1. Synthwave Pattern
  private playSynthwaveStep(step: number, bar: number, time: number) {
    // Kick on steps 0, 4, 8, 12 (Four on the floor)
    if (step % 4 === 0) {
      this.triggerKick(time, 140, 42, 0.35);
    }

    // Snare on steps 4 and 12 (Backbeat)
    if (step === 4 || step === 12) {
      this.triggerSnare(time, 0.22);
    }

    // Hi-hats: 16th notes with accent on off-beats
    const hatVolume = step % 2 === 1 ? 0.35 : 0.18;
    this.triggerHiHat(time, false, hatVolume);
    if (step === 14) {
      this.triggerHiHat(time, true, 0.3); // Open hat before snare
    }

    // Synthwave Bass Arpeggio: 16th notes
    // Chord progression: Dm (bar 0), Bb (bar 1), F (bar 2), C (bar 3)
    const rootNotes = [73.42, 58.27, 87.31, 65.41]; // D2, Bb1, F2, C2 in Hz
    const root = rootNotes[bar % 4];
    // Octave jumping arpeggio
    const octaveMultiplier = step % 2 === 0 ? 1 : 2;
    this.triggerSawBass(time, root * octaveMultiplier, 0.12, 0.25);

    // Lead melody / chord pad accent on quarter notes
    if (step === 0 || step === 6 || step === 10) {
      const chordPitches = [
        [293.66, 349.23, 440.0], // D4, F4, A4
        [233.08, 293.66, 349.23], // Bb3, D4, F4
        [349.23, 440.0, 523.25], // F4, A4, C5
        [261.63, 329.63, 392.0], // C4, E4, G4
      ][bar % 4];
      this.triggerSynthPad(time, chordPitches, 0.45);
    }
  }

  // 2. Chillwave Pattern
  private playChillwaveStep(step: number, bar: number, time: number) {
    // Downtempo lofi kick: 0, 3, 10
    if (step === 0 || step === 7 || step === 10) {
      this.triggerKick(time, 110, 38, 0.45);
    }

    // Soft rim snare: 4, 12
    if (step === 4 || step === 12) {
      this.triggerSnare(time, 0.15);
    }

    // Subtle swung hi-hats
    if (step % 2 === 0 || step % 4 === 3) {
      this.triggerHiHat(time, false, 0.15);
    }

    // Chill chord progression: Fmaj7 (F3, A3, C4, E4), Am7, Bbmaj7, C7
    if (step === 0 || step === 8) {
      const chords = [
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [233.08, 293.66, 349.23, 440.0], // Bbmaj7
        [261.63, 329.63, 392.0, 466.16], // C7
      ][bar % 4];
      this.triggerMellowChords(time, chords, 0.6);
    }
  }

  // 3. Techno Acid Pattern
  private playTechnoStep(step: number, bar: number, time: number) {
    // Heavy 4x4 Kick
    if (step % 4 === 0) {
      this.triggerKick(time, 160, 48, 0.48);
    }

    // Clap on 4 and 12
    if (step === 4 || step === 12) {
      this.triggerSnare(time, 0.32);
    }

    // Offbeat open hi-hat
    if (step % 4 === 2) {
      this.triggerHiHat(time, true, 0.35);
    } else {
      this.triggerHiHat(time, false, 0.12);
    }

    // Acid 303 Saw Bassline with filter sweep
    const notes = [65.41, 65.41, 130.81, 77.78, 65.41, 98.0, 65.41, 116.54];
    const pitch = notes[step % 8];
    const accent = step % 4 === 0 || step === 6;
    this.triggerAcidBass(time, pitch, accent);
  }

  // Drum sound generators using pure Web Audio synthesis
  private triggerKick(time: number, startFreq: number, endFreq: number, decay: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    gain.gain.setValueAtTime(0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  private triggerSnare(time: number, decay: number) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    // Noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Body tone
    const osc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + decay * 0.5);

    toneGain.gain.setValueAtTime(0.3, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + decay * 0.5);

    osc.connect(toneGain);
    toneGain.connect(this.masterGain);

    noise.start(time);
    osc.start(time);
    noise.stop(time + decay);
    osc.stop(time + decay);
  }

  private triggerHiHat(time: number, isOpen: boolean, volume: number) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const decay = isOpen ? 0.22 : 0.05;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + decay);
  }

  private triggerSawBass(time: number, freq: number, duration: number, volume: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.Q.setValueAtTime(4, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private triggerAcidBass(time: number, freq: number, accent: boolean) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(accent ? 3200 : 900, time);
    filter.frequency.exponentialRampToValueAtTime(250, time + 0.18);
    filter.Q.setValueAtTime(accent ? 14 : 7, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.38 : 0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private triggerSynthPad(time: number, frequencies: number[], duration: number) {
    if (!this.ctx || !this.masterGain) return;
    frequencies.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.05, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private triggerMellowChords(time: number, frequencies: number[], duration: number) {
    if (!this.ctx || !this.masterGain) return;
    frequencies.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.06, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  // --- REAL-TIME ANALYSIS TICK ---

  public analyze(): AudioAnalysis {
    if (!this.analyser || !this.ctx || !this.isPlaying) {
      // Return smooth decay fallback so visuals don't freeze abruptly
      this.smoothedBass *= 0.92;
      this.smoothedMid *= 0.92;
      this.smoothedTreble *= 0.92;
      this.beatDecay *= 0.88;

      return {
        bass: this.smoothedBass,
        mid: this.smoothedMid,
        treble: this.smoothedTreble,
        overallEnergy: (this.smoothedBass + this.smoothedMid + this.smoothedTreble) / 3,
        isBeat: false,
        beatStrength: this.beatDecay,
        waveform: this.timeData,
        frequency: this.freqData,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.analyser.getByteFrequencyData(this.freqData as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.analyser.getByteTimeDomainData(this.timeData as any);

    const binCount = this.analyser.frequencyBinCount;
    const sampleRate = this.ctx.sampleRate;
    const nyquist = sampleRate / 2;

    // Convert frequency boundaries to bin indices
    const bassEndBin = Math.max(1, Math.floor((150 / nyquist) * binCount));
    const midEndBin = Math.max(bassEndBin + 1, Math.floor((2500 / nyquist) * binCount));
    const trebleEndBin = Math.min(binCount, Math.floor((16000 / nyquist) * binCount));

    // Calculate energy in bands
    let bassSum = 0;
    for (let i = 0; i < bassEndBin; i++) {
      bassSum += this.freqData[i];
    }
    const rawBass = bassSum / (bassEndBin * 255);

    let midSum = 0;
    for (let i = bassEndBin; i < midEndBin; i++) {
      midSum += this.freqData[i];
    }
    const rawMid = midSum / ((midEndBin - bassEndBin) * 255);

    let trebleSum = 0;
    for (let i = midEndBin; i < trebleEndBin; i++) {
      trebleSum += this.freqData[i];
    }
    const rawTreble = trebleSum / ((trebleEndBin - midEndBin) * 255);

    // Exponential smoothing for visuals
    this.smoothedBass = this.smoothedBass * 0.4 + rawBass * 0.6;
    this.smoothedMid = this.smoothedMid * 0.5 + rawMid * 0.5;
    this.smoothedTreble = this.smoothedTreble * 0.6 + rawTreble * 0.4;

    const overall = (this.smoothedBass + this.smoothedMid + this.smoothedTreble) / 3;

    // Beat Detection: Sub-bass flux & dynamic thresholding
    let isBeat = false;
    let beatStrength = 0;

    // Track energy history for moving average
    this.energyHistory.push(rawBass);
    if (this.energyHistory.length > 30) {
      this.energyHistory.shift();
    }

    const avgBass = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const now = performance.now();

    // Check if current bass exceeds dynamic threshold and minimum hold time (220ms = ~270 BPM max)
    if (rawBass > 0.28 && rawBass > avgBass * this.beatSensitivity && now > this.beatCutoffTime) {
      isBeat = true;
      beatStrength = Math.min(1.0, (rawBass - avgBass) / (avgBass || 0.1) * 0.8 + 0.2);
      this.beatDecay = beatStrength;
      this.beatCutoffTime = now + 200;
    } else {
      this.beatDecay *= 0.86;
    }

    return {
      bass: this.smoothedBass,
      mid: this.smoothedMid,
      treble: this.smoothedTreble,
      overallEnergy: overall,
      isBeat,
      beatStrength: Math.max(isBeat ? beatStrength : 0, this.beatDecay),
      waveform: this.timeData,
      frequency: this.freqData,
    };
  }
}
