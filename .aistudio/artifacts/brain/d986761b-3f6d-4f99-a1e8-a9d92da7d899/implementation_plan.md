# Advanced Audio-Reactive Particle Visual Effects & Enhanced 3D Controls

Integrate sophisticated, high-performance audio-reactive particle systems, vortex physics, and custom visual modes into PulseWave's 3D rendering engine.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed wanting to add more audio-reactive particle visual effects. We will implement high-performance GPU/CPU particle systems that react dynamically to frequency bands (bass, mids, treble), featuring customizable particle shapes, swirl/vortex physics, burst triggers, and trail effects.

- **Confirmed Decision**: Add advanced audio-reactive particle effects integrated into the Three.js visual engine.
- **Open Question / Choice**: Default particle shape and color presets (Recommended: Glowing starbursts, energy rings, and frequency-mapped floating orbs).

---

## 1. Overview & Core Concept

- **What It Does**: Enhances the 3D visual engine with interactive, audio-reactive particle emission, vortex swirls, beat-drop explosions, and customizable particle density/speed controls in the ControlDrawer.
- **Target Audience**: Electronic music producers, DJs, and visual creators wanting immersive audio-visual experiences.
- **Key Value**: Deep audio reactivity where bass hits trigger particle shockwaves, mids pulse particle orbit speed, and highs cause sparkling shimmer effects.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Open ControlDrawer -> 3D Visuals tab.
  2. Configure particle density, behavior (vortex, fountain, sphere explosion, matrix grid), particle color palettes, and audio reactivity sensitivity.
  3. Real-time visual feedback on the main stage canvas.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Immersive, high-energy cybernetic audio visualizer.
  - *Color Palette & Mood*: Deep obsidian background with vibrant neon accents (`#06B6D4` cyan, `#F59E0B` amber, `#EC4899` pink) mapped to frequency spectrum bins.
  - *Typography*: Clean sans-serif UI with tabular monospace metrics.
- **Interactive Feedback**: Instant preview in the 3D viewport, toggleable particle wireframes, and smooth transition damping.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Performance Optimization for Particle Count
  - *Chosen Approach*: Use `THREE.BufferGeometry` with `THREE.PointsMaterial` and custom attribute buffers to maintain 60 FPS even with 10,000+ particles.
  - *Why*: Ensures butter-smooth audio synchronization and recording capability without frame drops.
- **Decision 2**: Audio Band Mapping
  - *Chosen Approach*: Separate bass (kick/sub), mid (vocals/synth), and treble (hi-hats/cymbals) into distinct particle physics parameters (scale, rotation speed, emission rate).
  - *Why*: Creates a rich, layered visual response rather than a single flashing trigger.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      ControlDrawer                     │
│  (Particle Density, Behavior, Colors, Audio Sensitivity)│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   VisualizerConfig                     │
│             (Updated State & Particle Props)           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                     VisualEngine                       │
│        (Three.js Scene + AudioAnalyser Integration)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 AudioReactiveParticles                 │
│    (BufferGeometry Points + Velocity/Frequency Buffers) │
└────────────────────────────────────────────────────────┘
```

- **State & Data**: Extend `VisualizerConfig` to store particle settings (`particleCount`, `particleMode`, `particleSpeed`, `audioReactivity`).
- **Data Flow**: `VisualEngine` reads `audioAnalyser` frequency data every frame (`requestAnimationFrame`), computes vertex displacement and velocity offsets, and updates the `BufferGeometry` attributes in real time.
