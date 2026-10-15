/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  VisualizerConfig,
  AudioAnalysis,
  ThemeType,
  VisualizerMode,
  OverlayType,
  VisualizerAPI,
} from './types/visualizer';
import { ThemeManager } from './engine/ThemeManager';
import { AudioEngine } from './engine/AudioEngine';
import { MediaManager } from './engine/MediaManager';
import { VisualEngine } from './engine/VisualEngine';
import { CleanScreenOverlay } from './components/CleanScreenOverlay';
import { ControlDrawer } from './components/ControlDrawer';

// Declare global window.visualizer API
declare global {
  interface Window {
    visualizer: VisualizerAPI;
  }
}

const DEFAULT_CONFIG: VisualizerConfig = {
  theme: 'Cyberpunk',
  isRandomTheme: false,
  visualizerMode: 'cosmic',
  isRandomVisualizer: false,
  effectIntensity: 1.0,
  bloomStrength: 0.9,
  particleDensity: 1.0,
  particleSize: 1.2,
  cameraKick: true,
  transitionType: 'glitch',
  isRandomTransition: false,
  transitionDuration: 1.2,
  mediaInterval: 8,
  beatSyncRotate: false,
  overlay: 'none',
  overlayIntensity: 1.0,
  textOverlay: {
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
  },
  frequencyReactivity: {
    bassBurstIntensity: 1.0,
    midPulseIntensity: 1.0,
    trebleShimmerIntensity: 1.0,
    shockwaveEnabled: true,
    trebleTrailsEnabled: true,
  },
  qualityPreset: 'high',
  showFPS: false,
};

export default function App() {
  // DOM Canvas References
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);

  // Engine Instances
  const themeManagerRef = useRef<ThemeManager>(new ThemeManager(DEFAULT_CONFIG.theme));
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const mediaManagerRef = useRef<MediaManager>(new MediaManager());
  const visualEngineRef = useRef<VisualEngine | null>(null);

  // State
  const [config, setConfig] = useState<VisualizerConfig>(DEFAULT_CONFIG);
  const configRef = useRef<VisualizerConfig>(DEFAULT_CONFIG);
  configRef.current = config;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Live Audio Analysis State for UI Meters
  const [liveAnalysis, setLiveAnalysis] = useState<AudioAnalysis>({
    bass: 0,
    mid: 0,
    treble: 0,
    overallEnergy: 0,
    isBeat: false,
    beatStrength: 0,
    waveform: new Uint8Array(1024),
    frequency: new Uint8Array(1024),
  });

  // FPS Tracking
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  // Idle mouse detection for clean screen
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const themeDef = themeManagerRef.current.getThemeDef();

  const handleUpdateConfig = useCallback((partial: Partial<VisualizerConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      if (partial.theme && partial.theme !== prev.theme) {
        themeManagerRef.current.setTheme(partial.theme);
      }
      return next;
    });
  }, []);

  // --- RANDOMIZE FUNCTION ---
  const handleRandomize = useCallback(() => {
    const themes: ThemeType[] = ['Cyberpunk', 'Vintage', 'Fantasy', 'Kinetic'];
    const modes: VisualizerMode[] = ['cosmic', 'tunnel', 'radial', 'matrix', 'aurora'];
    const overlays: OverlayType[] = ['none', 'rain', 'fire', 'love', 'stardust'];

    const randTheme = themes[Math.floor(Math.random() * themes.length)];
    const randMode = modes[Math.floor(Math.random() * modes.length)];
    const randOverlay = overlays[Math.floor(Math.random() * overlays.length)];

    themeManagerRef.current.setTheme(randTheme);

    handleUpdateConfig({
      theme: randTheme,
      visualizerMode: randMode,
      overlay: randOverlay,
      effectIntensity: Math.round((Math.random() * 1.5 + 0.6) * 10) / 10,
      bloomStrength: Math.round((Math.random() * 0.8 + 0.4) * 10) / 10,
    });
  }, [handleUpdateConfig]);

  // --- RECORDING REAL-TIME VIDEO CLIP ---
  const handleStartRecording = useCallback(() => {
    if (!bgCanvasRef.current || !threeCanvasRef.current || !hudCanvasRef.current) return;

    try {
      // Create offscreen composite canvas for recording all 3 layers merged
      const recordCanvas = document.createElement('canvas');
      recordCanvas.width = window.innerWidth;
      recordCanvas.height = window.innerHeight;
      const rCtx = recordCanvas.getContext('2d');

      const canvasStream = recordCanvas.captureStream(60);
      const audioStream = audioEngineRef.current.getAudioStream();

      const tracks = [...canvasStream.getVideoTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000,
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulsewave-visualizer-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      // Composite draw interval for recorder
      const drawTimer = setInterval(() => {
        if (recorder.state !== 'recording') {
          clearInterval(drawTimer);
          return;
        }
        if (rCtx && bgCanvasRef.current && threeCanvasRef.current && hudCanvasRef.current) {
          rCtx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
          rCtx.drawImage(bgCanvasRef.current, 0, 0);
          rCtx.drawImage(threeCanvasRef.current, 0, 0);
          rCtx.drawImage(hudCanvasRef.current, 0, 0);
        }
      }, 1000 / 60);

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start MediaRecorder recording', err);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Snapshot PNG
  const handleCaptureSnapshot = useCallback(() => {
    if (!bgCanvasRef.current || !threeCanvasRef.current || !hudCanvasRef.current) return;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = window.innerWidth;
    snapCanvas.height = window.innerHeight;
    const sCtx = snapCanvas.getContext('2d');
    if (!sCtx) return;

    sCtx.drawImage(bgCanvasRef.current, 0, 0);
    sCtx.drawImage(threeCanvasRef.current, 0, 0);
    sCtx.drawImage(hudCanvasRef.current, 0, 0);

    const dataUrl = snapCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `pulsewave-snapshot-${Date.now()}.png`;
    a.click();
  }, []);

  // --- FULLSCREEN TOGGLE ---
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  }, []);

  // --- MOUNT VISUAL ENGINE & ANIMATION LOOP ---
  useEffect(() => {
    if (!containerRef.current || !bgCanvasRef.current || !threeCanvasRef.current || !hudCanvasRef.current) {
      return;
    }

    const visualEngine = new VisualEngine(
      containerRef.current,
      bgCanvasRef.current,
      threeCanvasRef.current,
      hudCanvasRef.current
    );
    visualEngineRef.current = visualEngine;

    let animId: number;

    const renderLoop = (timestamp: number) => {
      animId = requestAnimationFrame(renderLoop);

      const currentCfg = configRef.current;
      const audioAnalysis = audioEngineRef.current.analyze();

      // FPS Calculation
      frameCountRef.current++;
      if (timestamp - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = timestamp;
      }

      // Update Media Manager (rotation timer, transition progress)
      mediaManagerRef.current.update(
        timestamp,
        currentCfg.mediaInterval,
        audioAnalysis.isBeat,
        currentCfg.beatSyncRotate,
        currentCfg.transitionType,
        currentCfg.isRandomTransition,
        currentCfg.transitionDuration
      );

      // Random Theme cycling on media rotation if configured
      if (currentCfg.isRandomTheme && mediaManagerRef.current.getIsTransitioning()) {
        const nextThm = themeManagerRef.current.getRandomTheme();
        themeManagerRef.current.setTheme(nextThm);
      }

      // Render Multi-layer visuals
      visualEngine.render(
        audioAnalysis,
        currentCfg,
        themeManagerRef.current.getThemeDef(),
        mediaManagerRef.current
      );

      // Throttled UI state updates for meters (every 4 frames)
      if (frameCountRef.current % 4 === 0) {
        setLiveAnalysis(audioAnalysis);
      }
    };

    animId = requestAnimationFrame(renderLoop);

    // Resize Handler
    const handleResize = () => {
      visualEngine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      visualEngine.dispose();
    };
  }, []);

  // --- EXPOSE GLOBAL VISUALIZER API ---
  useEffect(() => {
    window.visualizer = {
      play: () => audioEngineRef.current.play(),
      pause: () => audioEngineRef.current.pause(),
      togglePlay: () => audioEngineRef.current.togglePlay(),
      setTheme: (thm: ThemeType) => {
        themeManagerRef.current.setTheme(thm);
        handleUpdateConfig({ theme: thm });
      },
      setVisualizer: (mode: VisualizerMode) => {
        handleUpdateConfig({ visualizerMode: mode });
      },
      randomize: handleRandomize,
      nextMedia: () => mediaManagerRef.current.next(config.transitionType, config.transitionDuration),
      prevMedia: () => mediaManagerRef.current.prev(config.transitionType, config.transitionDuration),
      setMediaIndex: (idx: number) =>
        mediaManagerRef.current.setMediaIndex(idx, config.transitionType, config.transitionDuration),
      getConfig: () => configRef.current,
      updateConfig: handleUpdateConfig,
      startRecording: handleStartRecording,
      stopRecording: handleStopRecording,
      isRecording: () => isRecording,
    };
  }, [config, handleRandomize, handleUpdateConfig, handleStartRecording, handleStopRecording, isRecording]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          audioEngineRef.current.togglePlay();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          setIsDrawerOpen((prev) => !prev);
          break;
        case 'Escape':
          setIsDrawerOpen(false);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRandomize();
          break;
        case 't':
        case 'T': {
          e.preventDefault();
          const nextThm = themeManagerRef.current.cycleNextTheme();
          handleUpdateConfig({ theme: nextThm });
          break;
        }
        case 'v':
        case 'V': {
          e.preventDefault();
          const modes: VisualizerMode[] = ['cosmic', 'tunnel', 'radial', 'matrix', 'aurora'];
          const curIdx = modes.indexOf(configRef.current.visualizerMode);
          const nextMode = modes[(curIdx + 1) % modes.length];
          handleUpdateConfig({ visualizerMode: nextMode });
          break;
        }
        case 'ArrowRight':
          e.preventDefault();
          mediaManagerRef.current.next(configRef.current.transitionType, configRef.current.transitionDuration);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          mediaManagerRef.current.prev(configRef.current.transitionType, configRef.current.transitionDuration);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          audioEngineRef.current.setMuted(!audioEngineRef.current.isSoundMuted());
          break;
        case 'o':
        case 'O': {
          e.preventDefault();
          const overlays: OverlayType[] = ['none', 'rain', 'fire', 'love', 'stardust'];
          const idx = overlays.indexOf(configRef.current.overlay);
          const nextOv = overlays[(idx + 1) % overlays.length];
          handleUpdateConfig({ overlay: nextOv });
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRandomize, handleToggleFullscreen, handleUpdateConfig]);

  // --- IDLE MOUSE AUTO-HIDE FOR TOTAL CLEAN SCREEN IMMERSION ---
  const handleMouseMove = () => {
    setIsMouseIdle(false);
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
      setIsMouseIdle(true);
    }, 2800);
  };

  return (
    <main
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-screen h-screen overflow-hidden bg-black select-none"
    >
      {/* LAYER 1: Background Media & GPU Transition Canvas */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 w-full h-full z-0 block pointer-events-none"
      />

      {/* LAYER 2: Three.js WebGL 3D Canvas */}
      <canvas
        ref={threeCanvasRef}
        className="absolute inset-0 w-full h-full z-10 block pointer-events-none"
      />

      {/* LAYER 3: 2D HUD, Waveforms & Overlay Canvas */}
      <canvas
        ref={hudCanvasRef}
        className="absolute inset-0 w-full h-full z-20 block pointer-events-none"
      />

      {/* LAYER 4: Clean Screen Single Title Overlay (Only Title on screen, 0 clutter) */}
      <CleanScreenOverlay config={config} themeDef={themeDef} audioAnalysis={liveAnalysis} />

      {/* Discreet Audio Start Hint for First-time Autoplay Policy */}
      {!audioEngineRef.current.getIsPlaying() && !isDrawerOpen && (
        <div
          onClick={() => audioEngineRef.current.play()}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/90 text-xs font-semibold tracking-wider uppercase cursor-pointer hover:bg-black/90 hover:scale-105 transition-all shadow-2xl"
          style={{
            borderColor: themeDef.colors.primary,
            boxShadow: `0 0 25px ${themeDef.colors.primary}44`,
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeDef.colors.primary }} />
          <span>Click Anywhere or Press Space to Start Audio</span>
        </div>
      )}

      {/* Optional Clean FPS Display (only if enabled) */}
      {config.showFPS && (
        <div className="fixed top-4 left-4 z-30 font-mono text-xs text-white/40 tracking-wider">
          {fps} FPS
        </div>
      )}

      {/* Comprehensive Slide-in Control Drawer */}
      <div className={`transition-opacity duration-500 ${isMouseIdle && !isDrawerOpen ? 'opacity-0' : 'opacity-100'}`}>
        <ControlDrawer
          isOpen={isDrawerOpen}
          onToggle={() => setIsDrawerOpen((prev) => !prev)}
          config={config}
          onUpdateConfig={handleUpdateConfig}
          themeDef={themeDef}
          audioEngine={audioEngineRef.current}
          mediaManager={mediaManagerRef.current}
          audioAnalysis={liveAnalysis}
          onRandomize={handleRandomize}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onCaptureSnapshot={handleCaptureSnapshot}
        />
      </div>
    </main>
  );
}
