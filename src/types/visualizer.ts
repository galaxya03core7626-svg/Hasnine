/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeType = 'Cyberpunk' | 'Vintage' | 'Fantasy' | 'Kinetic';

export type VisualizerMode = 
  | 'cosmic'    // 3D Starfield & Audio Core Sphere
  | 'tunnel'    // Neon Cyber Grid Tunnel
  | 'radial'    // 360 Radial Spectrum & Oscilloscope Wave
  | 'matrix'    // Floating Polyhedral Crystals & Shards
  | 'aurora';   // Flowing Harmonic Fluid Ribbons

export type TransitionType = 
  | 'fade' 
  | 'zoom' 
  | 'slide' 
  | 'glitch' 
  | 'blur' 
  | 'dissolve';

export type OverlayType = 'none' | 'rain' | 'fire' | 'love' | 'stardust';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  gridColor: string;
  waveformColor: string;
  fontDisplay: string;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'procedural';
  url: string;
  title: string;
  thumbnail?: string;
  proceduralId?: string;
}

export interface AudioAnalysis {
  bass: number;        // Normalized 0.0 - 1.0 (20Hz - 150Hz)
  mid: number;         // Normalized 0.0 - 1.0 (150Hz - 2500Hz)
  treble: number;      // Normalized 0.0 - 1.0 (2500Hz - 16000Hz)
  overallEnergy: number; // Normalized 0.0 - 1.0
  isBeat: boolean;     // Instantaneous beat detected on current frame
  beatStrength: number;// Magnitude of detected beat 0.0 - 1.0
  waveform: Uint8Array;// Time domain samples for oscilloscope
  frequency: Uint8Array;// Frequency domain magnitudes
}

export type TextAnimationStyle = 'scale' | 'bounce' | 'glitch' | 'wave' | 'fade' | 'shimmer';
export type TextAudioSync = 'beat' | 'bass' | 'mid' | 'treble' | 'energy';

export interface DynamicTextOverlayConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  fontFamily: string;
  color: string;
  glowColor: string;
  size: number; // font size in px (20 - 96)
  position: 'top-center' | 'center' | 'bottom-center';
  animationStyle: TextAnimationStyle;
  syncTarget: TextAudioSync;
  reactivity: number; // 0.0 - 2.0
  glow: boolean;
}

export interface FrequencyReactivityConfig {
  bassBurstIntensity: number;     // 0.0 - 2.5 (bass explosions & shockwaves)
  midPulseIntensity: number;      // 0.0 - 2.5 (mid-range geometry pulse & ribbons)
  trebleShimmerIntensity: number; // 0.0 - 2.5 (treble sparkles & laser light trails)
  shockwaveEnabled: boolean;      // Shockwave ring explosion on bass drops
  trebleTrailsEnabled: boolean;   // Light trails on high treble
}

export interface CustomPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  gridColor: string;
  waveformColor: string;
}

export type DisplayAspectRatio = '16:9' | '9:16' | 'responsive';
export type VideoResolution = 'FHD' | 'HD';

export interface VisualizerConfig {
  theme: ThemeType | string;
  isRandomTheme: boolean;
  visualizerMode: VisualizerMode;
  isRandomVisualizer: boolean;
  effectIntensity: number; // 0.2 - 2.5
  bloomStrength: number;   // 0.0 - 1.5
  particleDensity: number; // 0.5 - 2.0
  particleSize: number;    // 0.5 - 3.0
  particleVortexSpeed: number; // 0.0 - 3.0
  particleReactivity: number; // 0.0 - 2.0
  particleBurstDensity: number; // 0.5 - 3.0
  cameraKick: boolean;     // camera responds to bass beat kick
  transitionType: TransitionType;
  isRandomTransition: boolean;
  transitionDuration: number; // seconds (0.4 - 3.0)
  mediaInterval: number;   // seconds between automatic rotation (3 - 30)
  beatSyncRotate: boolean; // Rotate media on every 16/32 beats instead of fixed time
  overlay: OverlayType;
  overlayIntensity: number;// 0.1 - 1.5
  textOverlay: DynamicTextOverlayConfig;
  frequencyReactivity: FrequencyReactivityConfig;
  customPalettes: CustomPalette[];
  activeCustomPaletteId?: string;
  showFrequencySpectrumHUD: boolean;
  qualityPreset: 'low' | 'medium' | 'high';
  showFPS: boolean;
  aspectRatio: DisplayAspectRatio; // '16:9' (1920x1080 FHD), '9:16' (1080x1920 FHD), or 'responsive'
  videoResolution: VideoResolution; // 'FHD' (1080p Full HD) or 'HD' (720p)
  showAspectGuides: boolean; // Show safe-area guides for video creators (Reels/TikTok/YouTube)
}

export interface VisualizerAPI {
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  setTheme: (theme: ThemeType) => void;
  setVisualizer: (mode: VisualizerMode) => void;
  setAspectRatio: (aspect: DisplayAspectRatio) => void;
  randomize: () => void;
  nextMedia: () => void;
  prevMedia: () => void;
  setMediaIndex: (idx: number) => void;
  getConfig: () => VisualizerConfig;
  updateConfig: (partial: Partial<VisualizerConfig>) => void;
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: () => boolean;
}
