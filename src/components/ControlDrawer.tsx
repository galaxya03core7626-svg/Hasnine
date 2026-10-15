/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Shuffle,
  Maximize2,
  Minimize2,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
  X,
  Sparkles,
  Layers,
  Music,
  Video,
  Type,
  HelpCircle,
  Camera,
  Mic,
  Disc,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
  RotateCcw,
  Palette,
  Eye,
  EyeOff,
  Plus,
} from 'lucide-react';
import {
  VisualizerConfig,
  ThemeType,
  VisualizerMode,
  TransitionType,
  OverlayType,
  AudioAnalysis,
  TextAnimationStyle,
  TextAudioSync,
  CustomPalette,
} from '../types/visualizer';
import { THEMES, ThemeDefinition } from '../engine/ThemeManager';
import { BUILT_IN_TRACKS, AudioEngine } from '../engine/AudioEngine';
import { MediaManager } from '../engine/MediaManager';
import { generateStandaloneHtml } from '../utils/singleHtmlExporter';
import { FrequencySpectrumHUD } from './FrequencySpectrumHUD';

interface ControlDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  config: VisualizerConfig;
  onUpdateConfig: (partial: Partial<VisualizerConfig>) => void;
  themeDef: ThemeDefinition;
  audioEngine: AudioEngine;
  mediaManager: MediaManager;
  audioAnalysis: AudioAnalysis;
  onRandomize: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCaptureSnapshot: () => void;
}

type TabKey = 'audio' | 'reactivity' | 'visuals' | 'themes' | 'media' | 'text' | 'export' | 'shortcuts';

export const ControlDrawer: React.FC<ControlDrawerProps> = ({
  isOpen,
  onToggle,
  config,
  onUpdateConfig,
  themeDef,
  audioEngine,
  mediaManager,
  audioAnalysis,
  onRandomize,
  isFullscreen,
  onToggleFullscreen,
  isRecording,
  onStartRecording,
  onStopRecording,
  onCaptureSnapshot,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('audio');
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const settingsFileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Custom Palette Creator State
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#00f0ff');
  const [newSecondaryColor, setNewSecondaryColor] = useState('#ff007f');
  const [newAccentColor, setNewAccentColor] = useState('#ffe600');
  const [newBackgroundColor, setNewBackgroundColor] = useState('#050713');
  const [newWaveformColor, setNewWaveformColor] = useState('#00f0ff');
  const [paletteSuccessMsg, setPaletteSuccessMsg] = useState<string | null>(null);

  const mediaList = mediaManager.getMediaList();
  const currentMediaIdx = mediaManager.getCurrentIndex();

  // Handlers for Audio
  const handleTogglePlay = async () => {
    await audioEngine.togglePlay();
  };

  const handleSelectTrack = (trackId: string) => {
    audioEngine.selectTrack(trackId);
  };

  // Toggle between File/Synth audio source and Live System Microphone
  const handleToggleSourceMode = async (mode: 'file' | 'mic') => {
    if (mode === 'mic') {
      const success = await audioEngine.enableMicrophone();
      if (!success) {
        setUploadStatus({
          type: 'error',
          message: 'Microphone permission denied or device not found. Reverted to track playback.',
        });
      }
    } else {
      await audioEngine.switchToFileOrSynth();
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      audioEngine.loadAudioFile(file);
    }
  };

  // Upload processing with progress and validation
  const processUploadedFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setUploadStatus(null);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setUploadProgress(10);
        await mediaManager.addUploadedFileAsync(file, (pct) => {
          setUploadProgress(pct);
        });
        setUploadStatus({
          type: 'success',
          message: `Successfully added "${file.name}" to playlist!`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploadStatus({
          type: 'error',
          message: errorMsg,
        });
      }
    }

    setTimeout(() => {
      setUploadProgress(null);
    }, 800);

    setTimeout(() => {
      setUploadStatus((prev) => (prev?.type === 'success' ? null : prev));
    }, 4000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  };

  // Custom Palette Handlers
  const handleSaveCustomPalette = () => {
    if (!newPaletteName.trim()) return;

    const newPal: CustomPalette = {
      id: `custom_${Date.now()}`,
      name: newPaletteName.trim(),
      primary: newPrimaryColor,
      secondary: newSecondaryColor,
      accent: newAccentColor,
      background: newBackgroundColor,
      gridColor: `${newPrimaryColor}33`,
      waveformColor: newWaveformColor,
    };

    const updated = [...(config.customPalettes || []), newPal];
    onUpdateConfig({
      customPalettes: updated,
      theme: newPal.id,
    });

    setNewPaletteName('');
    setPaletteSuccessMsg(`Saved and activated custom palette "${newPal.name}"!`);
    setTimeout(() => setPaletteSuccessMsg(null), 3500);
  };

  const handleDeleteCustomPalette = (id: string) => {
    const updated = (config.customPalettes || []).filter((p) => p.id !== id);
    onUpdateConfig({
      customPalettes: updated,
      theme: config.theme === id ? 'Cyberpunk' : config.theme,
    });
  };

  const handleCycleAllPalettes = () => {
    const builtInIds = ['Cyberpunk', 'Vintage', 'Fantasy', 'Kinetic'];
    const customIds = (config.customPalettes || []).map((p) => p.id);
    const allIds = [...builtInIds, ...customIds];
    const curIdx = allIds.indexOf(config.theme);
    const nextIdx = (curIdx + 1) % allIds.length;
    onUpdateConfig({ theme: allIds[nextIdx] });
  };

  // Export Settings to JSON
  const handleSaveSettings = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsewave-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load Settings from JSON
  const handleLoadSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loaded = JSON.parse(event.target?.result as string);
        onUpdateConfig(loaded);
      } catch (err) {
        console.error('Invalid settings file format', err);
      }
    };
    reader.readAsText(file);
  };

  // Export Single Standalone HTML
  const handleExportStandaloneHtml = () => {
    const html = generateStandaloneHtml(config);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsewave-visualizer-standalone.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const freqCfg = config.frequencyReactivity || {
    bassBurstIntensity: 1.0,
    midPulseIntensity: 1.0,
    trebleShimmerIntensity: 1.0,
    shockwaveEnabled: true,
    trebleTrailsEnabled: true,
  };

  const textOverlay = config.textOverlay || {
    enabled: true,
    title: 'PULSEWAVE',
    subtitle: 'AUDIO VISUALIZER',
    fontFamily: "'Orbitron', sans-serif",
    color: '#ffffff',
    glowColor: '#00f0ff',
    size: 42,
    position: 'top-center',
    animationStyle: 'scale',
    syncTarget: 'beat',
    reactivity: 1.0,
    glow: true,
  };

  const isMic = audioEngine.isMicrophoneActive();

  return (
    <>
      {/* Discreet floating trigger - keeping screen 100% clean */}
      {!isOpen && (
        <button
          onClick={onToggle}
          aria-label="Open visualizer controls"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 hover:bg-black/90 text-white/60 hover:text-white border border-white/15 text-xs font-medium tracking-wide transition-all duration-300 opacity-40 hover:opacity-100 hover:scale-105 shadow-xl"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Controls</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80">H</span>
        </button>
      )}

      {/* Slide-in Collapsible Dock */}
      <div
        className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-[min(980px,96vw)] max-h-[85vh] bg-zinc-950/95 border border-white/15 border-b-0 rounded-t-2xl shadow-2xl flex flex-col text-white transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-[108%]'
        }`}
        style={{
          boxShadow: `0 -10px 40px ${themeDef.colors.primary}22`,
        }}
      >
        {/* Dock Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-bold tracking-wider uppercase"
              style={{ color: themeDef.colors.primary }}
            >
              PulseWave Studio
            </span>
            <span className="text-white/30 text-xs hidden sm:inline">·</span>
            <span className="text-xs text-white/50 hidden sm:inline">Clean Visualizer Engine</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRandomize}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Randomize themes, visualizer, and effects (R)"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Randomize</span>
              <span className="text-[10px] text-white/40">R</span>
            </button>

            <button
              onClick={onToggleFullscreen}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Toggle Fullscreen (F)"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onToggle}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1"
              title="Close Drawer (H or Esc)"
              aria-label="Close Controls"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-white/10 overflow-x-auto shrink-0 scrollbar-none bg-black/40 text-xs">
          {[
            { id: 'audio', label: 'Audio & Source', icon: Music },
            { id: 'reactivity', label: 'Frequency Reactivity', icon: Activity },
            { id: 'visuals', label: '3D Visuals', icon: Sparkles },
            { id: 'themes', label: 'Themes & Palettes', icon: Palette },
            { id: 'media', label: 'Media Gallery', icon: Video },
            { id: 'text', label: 'Dynamic Text', icon: Type },
            { id: 'export', label: 'Export & Settings', icon: Download },
            { id: 'shortcuts', label: 'Shortcuts', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* TAB 1: AUDIO & SOURCE */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              {/* Audio Source Segmented Toggle (Files/Tracks vs Live System Microphone) */}
              <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                <button
                  onClick={() => handleToggleSourceMode('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all ${
                    !isMic
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Disc className="w-4 h-4" />
                  <span>File & Preset Tracks</span>
                </button>

                <button
                  onClick={() => handleToggleSourceMode('mic')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all ${
                    isMic
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm animate-pulse'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>Live System Microphone</span>
                </button>
              </div>

              {/* Status info based on active source */}
              {isMic ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-red-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                    <span>Live Performance Mode Active: Visualizer is reacting directly to your system microphone</span>
                  </div>
                  <button
                    onClick={() => handleToggleSourceMode('file')}
                    className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/15 text-white"
                  >
                    Switch to Track
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between text-xs text-cyan-300">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    <span>Now Playing: {audioEngine.getCurrentTrackId()}</span>
                  </div>
                  <button
                    onClick={() => handleToggleSourceMode('mic')}
                    className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/15 text-white"
                  >
                    Enable Microphone
                  </button>
                </div>
              )}

              {/* Playback Controls & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Playback Control
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTogglePlay}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-black transition-transform active:scale-95"
                      style={{ backgroundColor: themeDef.colors.primary }}
                    >
                      {audioEngine.getIsPlaying() ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pause Audio</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Play Audio</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => audioEngine.setMuted(!audioEngine.isSoundMuted())}
                      className="p-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors"
                      title="Mute / Unmute (M)"
                    >
                      {audioEngine.isSoundMuted() ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-white/40">Keyboard: Space to toggle play/pause</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Volume & Sensitivity
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>Volume</span>
                      <span className="tabular-nums">{Math.round(audioEngine.getVolume() * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      defaultValue={audioEngine.getVolume()}
                      onChange={(e) => audioEngine.setVolume(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>Beat Sensitivity</span>
                      <span className="tabular-nums">Dynamic</span>
                    </div>
                    <input
                      type="range"
                      min="1.1"
                      max="2.0"
                      step="0.05"
                      defaultValue="1.35"
                      onChange={(e) => audioEngine.setBeatSensitivity(parseFloat(e.target.value))}
                      className="w-full accent-pink-500"
                    />
                  </div>
                </div>

                {/* Live VU Energy Meter */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Real-Time Bands
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-white/70 mb-1">
                        <span>Bass (20-150Hz)</span>
                        <span className="tabular-nums font-mono">{Math.round(audioAnalysis.bass * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all duration-75"
                          style={{ width: `${Math.min(100, audioAnalysis.bass * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-white/70 mb-1">
                        <span>Mid (150-2500Hz)</span>
                        <span className="tabular-nums font-mono">{Math.round(audioAnalysis.mid * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-500 transition-all duration-75"
                          style={{ width: `${Math.min(100, audioAnalysis.mid * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-white/70 mb-1">
                        <span>Treble (2.5k-16kHz)</span>
                        <span className="tabular-nums font-mono">{Math.round(audioAnalysis.treble * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-75"
                          style={{ width: `${Math.min(100, audioAnalysis.treble * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tracks & Input Mode */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Preset Synthesizer Tracks
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BUILT_IN_TRACKS.map((trk) => {
                    const isSelected =
                      audioEngine.getSourceType() === 'synth' &&
                      audioEngine.getCurrentTrackId() === trk.id;
                    return (
                      <button
                        key={trk.id}
                        onClick={() => handleSelectTrack(trk.id)}
                        className={`p-3 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-white/15 border-cyan-400 shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Disc className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold text-xs text-white">{trk.name}</span>
                        </div>
                        <div className="text-[11px] text-white/50">{trk.genre} · {trk.bpm} BPM</div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => audioFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium border border-white/10 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Custom Music File (.mp3, .wav, .flac)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FREQUENCY REACTIVITY & RECHARTS SPECTRUM */}
          {activeTab === 'reactivity' && (
            <div className="space-y-6">
              {/* Recharts Frequency-based Spectrum Bar Chart */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Real-Time Spectrum Analyzer (Recharts)
                  </div>
                  <button
                    onClick={() =>
                      onUpdateConfig({ showFrequencySpectrumHUD: !config.showFrequencySpectrumHUD })
                    }
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      config.showFrequencySpectrumHUD
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {config.showFrequencySpectrumHUD ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{config.showFrequencySpectrumHUD ? 'Visible on HUD' : 'Hidden on HUD'} (S)</span>
                  </button>
                </div>

                <FrequencySpectrumHUD
                  audioAnalysis={audioAnalysis}
                  themeDef={themeDef}
                  compact={false}
                />
              </div>

              {/* Band Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {/* 1. Bass Frequency Band */}
                <div className="p-4 rounded-xl bg-white/5 border border-cyan-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-xs text-white uppercase tracking-wider">
                        Bass (20 - 150 Hz)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">
                      {Math.round(audioAnalysis.bass * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/80">
                      <span>Explosion & Burst Intensity</span>
                      <span className="font-mono text-cyan-400">
                        {freqCfg.bassBurstIntensity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.5"
                      step="0.1"
                      value={freqCfg.bassBurstIntensity}
                      onChange={(e) =>
                        onUpdateConfig({
                          frequencyReactivity: {
                            ...freqCfg,
                            bassBurstIntensity: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer pt-2 border-t border-white/10">
                    <span>Shockwave Ring Explosions</span>
                    <input
                      type="checkbox"
                      checked={freqCfg.shockwaveEnabled}
                      onChange={(e) =>
                        onUpdateConfig({
                          frequencyReactivity: {
                            ...freqCfg,
                            shockwaveEnabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-cyan-400 rounded"
                    />
                  </label>
                </div>

                {/* 2. Mid Frequency Band */}
                <div className="p-4 rounded-xl bg-white/5 border border-pink-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-pink-400" />
                      <span className="font-bold text-xs text-white uppercase tracking-wider">
                        Mid (150 - 2500 Hz)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-pink-400">
                      {Math.round(audioAnalysis.mid * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/80">
                      <span>Harmonic Pulsing Intensity</span>
                      <span className="font-mono text-pink-400">
                        {freqCfg.midPulseIntensity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.5"
                      step="0.1"
                      value={freqCfg.midPulseIntensity}
                      onChange={(e) =>
                        onUpdateConfig({
                          frequencyReactivity: {
                            ...freqCfg,
                            midPulseIntensity: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-pink-500"
                    />
                  </div>

                  <p className="text-[11px] text-white/50 pt-2 border-t border-white/10">
                    Controls gimbal resonance rings around core and harmonic wave ribbons.
                  </p>
                </div>

                {/* 3. Treble Frequency Band */}
                <div className="p-4 rounded-xl bg-white/5 border border-amber-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-xs text-white uppercase tracking-wider">
                        Treble (2.5k - 16 kHz)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-400">
                      {Math.round(audioAnalysis.treble * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/80">
                      <span>Shimmer & Sparkle Intensity</span>
                      <span className="font-mono text-amber-400">
                        {freqCfg.trebleShimmerIntensity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.5"
                      step="0.1"
                      value={freqCfg.trebleShimmerIntensity}
                      onChange={(e) =>
                        onUpdateConfig({
                          frequencyReactivity: {
                            ...freqCfg,
                            trebleShimmerIntensity: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer pt-2 border-t border-white/10">
                    <span>Treble Laser Light Trails</span>
                    <input
                      type="checkbox"
                      checked={freqCfg.trebleTrailsEnabled}
                      onChange={(e) =>
                        onUpdateConfig({
                          frequencyReactivity: {
                            ...freqCfg,
                            trebleTrailsEnabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 3D VISUALS */}
          {activeTab === 'visuals' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    3D Visualizer Mode
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.isRandomVisualizer}
                      onChange={(e) => onUpdateConfig({ isRandomVisualizer: e.target.checked })}
                      className="rounded accent-cyan-400"
                    />
                    <span>Random Mode on Rotate</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { id: 'cosmic', name: 'Cosmic Galaxy', desc: '16,000 Stars & 3D Core' },
                    { id: 'tunnel', name: 'Cyber Tunnel', desc: 'Neon Octagonal Warp' },
                    { id: 'radial', name: '360 Radial', desc: 'Circular Frequency Ring' },
                    { id: 'matrix', name: 'Matrix Crystals', desc: 'Floating Audio Shards' },
                    { id: 'aurora', name: 'Aurora Fluid', desc: 'Flowing Plasma Waves' },
                  ].map((mode) => {
                    const isSelected = config.visualizerMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => onUpdateConfig({ visualizerMode: mode.id as VisualizerMode })}
                        className={`p-3 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-white/15 border-cyan-400 shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-semibold text-xs text-white mb-1">{mode.name}</div>
                        <div className="text-[10px] text-white/50">{mode.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Overall Effect Intensity</span>
                    <span className="tabular-nums font-mono">{config.effectIntensity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={config.effectIntensity}
                    onChange={(e) => onUpdateConfig({ effectIntensity: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Bloom & Glow Radius</span>
                    <span className="tabular-nums font-mono">{config.bloomStrength.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.5"
                    step="0.1"
                    value={config.bloomStrength}
                    onChange={(e) => onUpdateConfig({ bloomStrength: parseFloat(e.target.value) })}
                    className="w-full accent-pink-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Particle Density</span>
                    <span className="tabular-nums font-mono">{config.particleDensity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={config.particleDensity}
                    onChange={(e) => onUpdateConfig({ particleDensity: parseFloat(e.target.value) })}
                    className="w-full accent-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Particle Size</span>
                    <span className="tabular-nums font-mono">{config.particleSize.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={config.particleSize}
                    onChange={(e) => onUpdateConfig({ particleSize: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Quality Preset</span>
                    <span className="uppercase font-mono text-[11px] text-cyan-400">
                      {config.qualityPreset}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => onUpdateConfig({ qualityPreset: q })}
                        className={`py-1 text-xs rounded uppercase font-semibold transition-colors ${
                          config.qualityPreset === q
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">Camera Kick</div>
                    <div className="text-[10px] text-white/40">Subtle camera zoom on bass hits</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.cameraKick}
                    onChange={(e) => onUpdateConfig({ cameraKick: e.target.checked })}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THEMES & CUSTOM PALETTES */}
          {activeTab === 'themes' && (
            <div className="space-y-6">
              {/* Header with Cycle Button */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div>
                  <h3 className="font-semibold text-sm text-white">Themes & Custom Color Palettes</h3>
                  <p className="text-xs text-white/50">
                    Choose predefined aesthetics or create and save your own custom color palettes.
                  </p>
                </div>
                <button
                  onClick={handleCycleAllPalettes}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-xs font-semibold transition-colors"
                  title="Cycle Palettes (HotKey: C)"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Cycle All (C)</span>
                </button>
              </div>

              {/* 1. Predefined Built-In Themes */}
              <div>
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Prebuilt Themes
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {(['Cyberpunk', 'Vintage', 'Fantasy', 'Kinetic'] as ThemeType[]).map((thmKey) => {
                    const thm = THEMES[thmKey];
                    const isSelected = config.theme === thmKey;
                    return (
                      <button
                        key={thmKey}
                        onClick={() => onUpdateConfig({ theme: thmKey })}
                        className={`p-3.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-white/15 shadow-lg ring-1 ring-white/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                        style={{
                          borderColor: isSelected ? thm.colors.primary : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="font-bold text-xs tracking-wide"
                            style={{ color: thm.colors.primary }}
                          >
                            {thm.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: thm.colors.primary }}
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: thm.colors.secondary }}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-white/50 truncate">{thm.tagline}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Saved Custom Palettes */}
              <div>
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Saved Custom Palettes ({config.customPalettes?.length || 0})
                </div>

                {paletteSuccessMsg && (
                  <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{paletteSuccessMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(config.customPalettes || []).map((pal) => {
                    const isSelected = config.theme === pal.id;
                    return (
                      <div
                        key={pal.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-white/15 border-cyan-400 ring-1 ring-cyan-400/40 shadow-md'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <button
                          onClick={() => onUpdateConfig({ theme: pal.id })}
                          className="flex-1 text-left flex items-center gap-3 overflow-hidden"
                        >
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/40 shadow"
                              style={{ backgroundColor: pal.primary }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/40 shadow"
                              style={{ backgroundColor: pal.secondary }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/40 shadow"
                              style={{ backgroundColor: pal.background }}
                            />
                          </div>
                          <span className="font-semibold text-xs text-white truncate">{pal.name}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCustomPalette(pal.id)}
                          className="p-1.5 text-white/40 hover:text-red-400 rounded transition-colors ml-2"
                          title="Delete custom palette"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Custom Palette Creator Form */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-xs text-white uppercase tracking-wider">
                    Create New Custom Palette
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[11px] text-white/60">Palette Name</label>
                    <input
                      type="text"
                      value={newPaletteName}
                      onChange={(e) => setNewPaletteName(e.target.value)}
                      placeholder="e.g. Neon Horizon"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-white/60">Primary</label>
                    <input
                      type="color"
                      value={newPrimaryColor}
                      onChange={(e) => setNewPrimaryColor(e.target.value)}
                      className="w-full h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-white/60">Secondary</label>
                    <input
                      type="color"
                      value={newSecondaryColor}
                      onChange={(e) => setNewSecondaryColor(e.target.value)}
                      className="w-full h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-white/60">Canvas BG</label>
                    <input
                      type="color"
                      value={newBackgroundColor}
                      onChange={(e) => setNewBackgroundColor(e.target.value)}
                      className="w-full h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div>
                    <button
                      onClick={handleSaveCustomPalette}
                      disabled={!newPaletteName.trim()}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs disabled:opacity-30 transition-colors"
                    >
                      Save Palette
                    </button>
                  </div>
                </div>
              </div>

              {/* Overlays (Rain, Fire, Love, Stardust) */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Particle Atmosphere Overlays
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'rain', label: 'Rain Streaks' },
                    { id: 'fire', label: 'Fire Embers' },
                    { id: 'love', label: 'Hearts' },
                    { id: 'stardust', label: 'Stardust' },
                  ].map((ov) => {
                    const isSelected = config.overlay === ov.id;
                    return (
                      <button
                        key={ov.id}
                        onClick={() => onUpdateConfig({ overlay: ov.id as OverlayType })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                          isSelected
                            ? 'bg-white/20 border-white/40 text-white'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {ov.label}
                      </button>
                    );
                  })}
                </div>

                {config.overlay !== 'none' && (
                  <div className="max-w-xs space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-white/80">
                      <span>Overlay Intensity</span>
                      <span className="tabular-nums font-mono">
                        {config.overlayIntensity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.5"
                      step="0.1"
                      value={config.overlayIntensity}
                      onChange={(e) => onUpdateConfig({ overlayIntensity: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MEDIA GALLERY */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => mediaFileInputRef.current?.click()}
                className={`relative p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                    : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                }`}
              >
                <input
                  ref={mediaFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => e.target.files && processUploadedFiles(e.target.files)}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-sm text-white">
                    Drop images or video clips here, or <span className="text-cyan-400 underline">browse</span>
                  </div>
                  <p className="text-xs text-white/50 max-w-md">
                    Upload 5–10 images and 5–7 short video clips (MP4, WebM, PNG, JPG). Automatic thumbnail extraction and GPU playback.
                  </p>
                </div>

                {uploadProgress !== null && (
                  <div className="mt-4 max-w-sm mx-auto">
                    <div className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Processing media...</span>
                      <span className="font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {uploadStatus && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-3 text-xs ${
                    uploadStatus.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {uploadStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span className="flex-1">{uploadStatus.message}</span>
                  <button
                    onClick={() => setUploadStatus(null)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Rotation & Transition settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Rotation Timing</span>
                    <span className="tabular-nums font-mono">{config.mediaInterval}s</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    step="1"
                    value={config.mediaInterval}
                    onChange={(e) => onUpdateConfig({ mediaInterval: parseInt(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-white/80">Transition Effect</div>
                  <select
                    value={config.transitionType}
                    onChange={(e) => onUpdateConfig({ transitionType: e.target.value as TransitionType })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="fade">Smooth Crossfade</option>
                    <option value="zoom">Warp Zoom In/Out</option>
                    <option value="slide">Directional Slide</option>
                    <option value="glitch">Glitch RGB Slice</option>
                    <option value="blur">Blur-to-Sharp</option>
                    <option value="dissolve">Particle Dissolve</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={config.isRandomTransition}
                      onChange={(e) => onUpdateConfig({ isRandomTransition: e.target.checked })}
                      className="rounded accent-cyan-400"
                    />
                    <span>Random Mode for Transitions</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.beatSyncRotate}
                      onChange={(e) => onUpdateConfig({ beatSyncRotate: e.target.checked })}
                      className="rounded accent-pink-500"
                    />
                    <span>Rotate on Beat Hits (16/32)</span>
                  </label>
                </div>
              </div>

              {/* Gallery List Header with Reset button */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Gallery Playlist ({mediaList.length} items)
                </div>
                <button
                  onClick={() => mediaManager.resetToDefaults()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Sample Media</span>
                </button>
              </div>

              {/* Thumbnails Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {mediaList.map((item, idx) => {
                  const isActive = idx === currentMediaIdx;
                  return (
                    <div
                      key={item.id}
                      className={`group relative rounded-xl overflow-hidden border transition-all ${
                        isActive
                          ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div
                        onClick={() => mediaManager.setMediaIndex(idx, config.transitionType, config.transitionDuration)}
                        className="aspect-video bg-black/60 cursor-pointer overflow-hidden flex items-center justify-center relative"
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="p-2 text-center">
                            <Video className="w-6 h-6 mx-auto mb-1 text-cyan-400" />
                            <span className="text-[10px] text-white/60 truncate block">{item.title}</span>
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 text-white/80 uppercase">
                          {item.type}
                        </span>
                      </div>

                      <div className="p-1.5 bg-zinc-900/90 flex items-center justify-between text-[10px]">
                        <span className="truncate max-w-[80px] text-white/70" title={item.title}>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => mediaManager.moveItem(idx, idx - 1)}
                            className="p-1 text-white/50 hover:text-white disabled:opacity-20"
                            title="Move earlier"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            disabled={idx === mediaList.length - 1}
                            onClick={() => mediaManager.moveItem(idx, idx + 1)}
                            className="p-1 text-white/50 hover:text-white disabled:opacity-20"
                            title="Move later"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          {mediaList.length > 1 && (
                            <button
                              onClick={() => mediaManager.removeItem(idx)}
                              className="p-1 text-red-400/60 hover:text-red-400"
                              title="Delete from playlist"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: DYNAMIC TEXT OVERLAY */}
          {activeTab === 'text' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm text-white">Dynamic Audio-Synced Text Overlay</div>
                  <div className="text-xs text-white/50">
                    Animates your title text in real-time synchronized to audio beats or frequency bands.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={textOverlay.enabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      textOverlay: { ...textOverlay, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              {textOverlay.enabled && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-white/70">Main Text Title</label>
                      <input
                        type="text"
                        value={textOverlay.title}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: { ...textOverlay, title: e.target.value },
                          })
                        }
                        placeholder="e.g. PULSEWAVE"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/70">Subtitle / Tagline</label>
                      <input
                        type="text"
                        value={textOverlay.subtitle}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: { ...textOverlay, subtitle: e.target.value },
                          })
                        }
                        placeholder="e.g. AUDIO VISUALIZER"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-white/70">Font Typography</label>
                      <select
                        value={textOverlay.fontFamily}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: { ...textOverlay, fontFamily: e.target.value },
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="'Orbitron', sans-serif">Orbitron (Cyber / Futuristic)</option>
                        <option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans (Modern Geometric)</option>
                        <option value="'Playfair Display', serif">Playfair Display (Editorial Serif)</option>
                        <option value="'JetBrains Mono', monospace">JetBrains Mono (Techno Monospace)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-white/70">Animation Style</label>
                      <select
                        value={textOverlay.animationStyle}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: {
                              ...textOverlay,
                              animationStyle: e.target.value as TextAnimationStyle,
                            },
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="scale">Scale (Beat / Bass Pulse Expansion)</option>
                        <option value="bounce">Bounce (Rhythmic Vertical Trampoline)</option>
                        <option value="glitch">Glitch (Chromatic Split & Jitter)</option>
                        <option value="wave">Wave (Harmonic Sinusoid Float)</option>
                        <option value="fade">Fade (Breathing Opacity Pulse)</option>
                        <option value="shimmer">Shimmer (Treble Sparkle Shimmer)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-white/70">Synchronize With</label>
                      <select
                        value={textOverlay.syncTarget}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: {
                              ...textOverlay,
                              syncTarget: e.target.value as TextAudioSync,
                            },
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="beat">Beat Drops (Peak Detection)</option>
                        <option value="bass">Bass Band (20 - 150 Hz)</option>
                        <option value="mid">Mid Band (150 - 2500 Hz)</option>
                        <option value="treble">Treble Band (2.5k - 16 kHz)</option>
                        <option value="energy">Overall Energy</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white/70">
                        <span>Reactivity Intensity</span>
                        <span className="font-mono text-cyan-400">
                          {textOverlay.reactivity.toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={textOverlay.reactivity}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: {
                              ...textOverlay,
                              reactivity: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-cyan-400 mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white/70">
                        <span>Font Size</span>
                        <span className="font-mono text-cyan-400">{textOverlay.size}px</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="84"
                        step="2"
                        value={textOverlay.size}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: {
                              ...textOverlay,
                              size: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-cyan-400 mt-2"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-white/70">Screen Placement</label>
                      <select
                        value={textOverlay.position}
                        onChange={(e) =>
                          onUpdateConfig({
                            textOverlay: {
                              ...textOverlay,
                              position: e.target.value as 'top-center' | 'center' | 'bottom-center',
                            },
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="top-center">Top Center</option>
                        <option value="center">Dead Center</option>
                        <option value="bottom-center">Bottom Center</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <div className="text-xs font-semibold text-white/80">Colors & Thematic Glow</div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/70">Text:</span>
                        <input
                          type="color"
                          value={textOverlay.color}
                          onChange={(e) =>
                            onUpdateConfig({
                              textOverlay: { ...textOverlay, color: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/70">Glow Aura:</span>
                        <input
                          type="color"
                          value={textOverlay.glowColor}
                          onChange={(e) =>
                            onUpdateConfig({
                              textOverlay: { ...textOverlay, glowColor: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          checked={textOverlay.glow}
                          onChange={(e) =>
                            onUpdateConfig({
                              textOverlay: { ...textOverlay, glow: e.target.checked },
                            })
                          }
                          className="w-4 h-4 accent-cyan-400 rounded"
                        />
                        <span>Enable Neon Glow Shadow</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: EXPORT & PRESETS */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80 uppercase tracking-wider">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>MediaRecorder Video Export</span>
                  </div>
                  <p className="text-xs text-white/50">
                    Directly captures the GPU canvas visuals and audio synthesizer into a downloadable WebM video file.
                  </p>
                  <div>
                    {isRecording ? (
                      <button
                        onClick={onStopRecording}
                        className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors animate-pulse"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                        <span>Stop & Save Video Clip (.webm)</span>
                      </button>
                    ) : (
                      <button
                        onClick={onStartRecording}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-white/20 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Recording Clip</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={onCaptureSnapshot}
                    className="w-full py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium border border-white/10 transition-colors"
                  >
                    Take High-Res Still Photo (PNG)
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80 uppercase tracking-wider">
                    <Download className="w-4 h-4 text-pink-500" />
                    <span>Standalone Single HTML File</span>
                  </div>
                  <p className="text-xs text-white/50">
                    Exports this entire visualizer into a single self-contained .html file that runs anywhere without build steps!
                  </p>
                  <button
                    onClick={handleExportStandaloneHtml}
                    className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 text-black transition-transform active:scale-95"
                    style={{ backgroundColor: themeDef.colors.secondary }}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Standalone .HTML File</span>
                  </button>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={handleSaveSettings}
                      className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 transition-colors"
                    >
                      Save Settings JSON
                    </button>
                    <input
                      ref={settingsFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleLoadSettings}
                      className="hidden"
                    />
                    <button
                      onClick={() => settingsFileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 transition-colors"
                    >
                      Load Settings JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 max-w-lg text-xs">
              <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Keyboard Hotkeys (Clean Screen Friendly)
              </div>
              <div className="divide-y divide-white/10 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                {[
                  { key: 'Space', desc: 'Play / Pause Audio' },
                  { key: 'H or Esc', desc: 'Toggle / Close Controls Drawer' },
                  { key: 'F', desc: 'Toggle Fullscreen Mode' },
                  { key: 'R', desc: 'Randomize Themes, Modes & Visuals' },
                  { key: 'C', desc: 'Cycle Custom & Built-In Palettes' },
                  { key: 'S', desc: 'Toggle Spectrum HUD Chart' },
                  { key: 'T', desc: 'Cycle to Next Built-In Theme' },
                  { key: 'V', desc: 'Cycle to Next Visualizer Mode' },
                  { key: 'ArrowRight', desc: 'Next Background Media' },
                  { key: 'ArrowLeft', desc: 'Previous Background Media' },
                  { key: 'M', desc: 'Mute / Unmute Audio' },
                  { key: 'O', desc: 'Cycle Overlay (Rain, Fire, Love, Stardust)' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-2.5">
                    <span className="text-white/70">{item.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white font-mono text-[11px]">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
