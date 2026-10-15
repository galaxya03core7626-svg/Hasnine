/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { AudioAnalysis, VisualizerConfig, MediaItem, TransitionType, OverlayType } from '../types/visualizer';
import { ThemeDefinition } from './ThemeManager';
import { MediaManager } from './MediaManager';

// Reusable math helpers for zero-GC render loop
const _tempVec3 = new THREE.Vector3();
const _tempColor = new THREE.Color();

interface ParticleBurst {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

interface OverlayParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  rotation?: number;
  rotSpeed?: number;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  radius: number;
  maxRadius: number;
  life: number; // 1.0 -> 0.0
  speed: number;
}

interface LightTrail {
  x: number;
  y: number;
  vx: number;
  vy: number;
  history: { x: number; y: number }[];
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

export class VisualEngine {
  private container: HTMLElement;
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D | null;
  private threeCanvas: HTMLCanvasElement;
  private hudCanvas: HTMLCanvasElement;
  private hudCtx: CanvasRenderingContext2D | null;

  // Three.js Core
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  // 3D Visual Objects
  private galaxyParticles: THREE.Points | null = null;
  private galaxyGeo: THREE.BufferGeometry | null = null;
  private galaxyCount: number = 16000;

  // 3D Reactive Polyhedra
  private audioOrbGroup: THREE.Group | null = null;
  private audioOrbInnerMesh: THREE.Mesh | null = null;
  private audioOrbOuterWire: THREE.LineSegments | null = null;

  // Mid-Range Resonance Gimbal Rings
  private midResonanceGroup: THREE.Group | null = null;
  private midResonanceRings: THREE.LineSegments[] = [];

  // 3D Cyber Tunnel
  private tunnelGroup: THREE.Group | null = null;
  private tunnelRings: THREE.LineSegments[] = [];

  // 3D Matrix Crystals
  private matrixGroup: THREE.Group | null = null;
  private crystalMeshes: THREE.Mesh[] = [];

  // 3D Bass Shockwave Rings
  private shockwaves: ShockwaveRing[] = [];
  private shockwaveGroup: THREE.Group | null = null;
  private lastShockwaveTime: number = 0;

  // 3D Beat Particle Bursts
  private bursts: ParticleBurst[] = [];
  private burstGeo: THREE.BufferGeometry | null = null;
  private burstPoints: THREE.Points | null = null;
  private burstPositions: Float32Array = new Float32Array(4000 * 3);
  private burstColors: Float32Array = new Float32Array(4000 * 3);
  private burstSizes: Float32Array = new Float32Array(4000);

  // Treble Laser Light Trails
  private lightTrails: LightTrail[] = [];
  private lastTrailSpawnTime: number = 0;

  // 2D Overlay particles (rain, fire, hearts, stardust)
  private overlayParticles: OverlayParticle[] = [];

  // Procedural animated backgrounds
  private procTime: number = 0;

  // Camera Shake & Kick
  private cameraBaseZ: number = 32;
  private cameraKickOffset: number = 0;
  private cameraShakeX: number = 0;
  private cameraShakeY: number = 0;

  // Dimensions
  private width: number = window.innerWidth;
  private height: number = window.innerHeight;

  constructor(
    container: HTMLElement,
    bgCanvas: HTMLCanvasElement,
    threeCanvas: HTMLCanvasElement,
    hudCanvas: HTMLCanvasElement
  ) {
    this.container = container;
    this.bgCanvas = bgCanvas;
    this.bgCtx = bgCanvas.getContext('2d');
    this.threeCanvas = threeCanvas;
    this.hudCanvas = hudCanvas;
    this.hudCtx = hudCanvas.getContext('2d');

    this.initThree();
    this.initOverlays();
    this.resize();
  }

  // --- THREE.JS INITIALIZATION ---

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050713, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0, this.cameraBaseZ);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.threeCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Studio Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight1.position.set(15, 20, 15);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff007f, 2.0);
    dirLight2.position.set(-15, -10, 10);
    this.scene.add(dirLight2);

    // Build 3D objects
    this.createGalaxyParticles();
    this.createAudioOrb();
    this.createMidResonanceRings();
    this.createTunnel();
    this.createMatrixCrystals();
    this.createBurstSystem();
    this.createShockwaveGroup();
  }

  // 1. Galaxy Particle Cloud (Cosmic Mode)
  private createGalaxyParticles() {
    if (!this.scene) return;
    this.galaxyGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.galaxyCount * 3);
    const col = new Float32Array(this.galaxyCount * 3);
    const sizes = new Float32Array(this.galaxyCount);

    for (let i = 0; i < this.galaxyCount; i++) {
      const radius = Math.pow(Math.random(), 1.6) * 45 + 2;
      const angle = Math.random() * Math.PI * 2 + radius * 0.4;
      const spreadY = (Math.random() - 0.5) * (18 - radius * 0.25);

      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = spreadY;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      const t = radius / 48;
      col[i * 3] = 0.0 + t * 0.8;
      col[i * 3 + 1] = 0.8 - t * 0.4;
      col[i * 3 + 2] = 1.0;

      sizes[i] = Math.random() * 2.2 + 0.8;
    }

    this.galaxyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.galaxyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.galaxyGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.galaxyParticles = new THREE.Points(this.galaxyGeo, mat);
    this.scene.add(this.galaxyParticles);
  }

  // 2. Audio Core Sphere & Wireframe
  private createAudioOrb() {
    if (!this.scene) return;
    this.audioOrbGroup = new THREE.Group();

    // Inner glowing sphere
    const innerGeo = new THREE.IcosahedronGeometry(5.5, 3);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false,
      transparent: true,
      opacity: 0.8,
    });
    this.audioOrbInnerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.audioOrbGroup.add(this.audioOrbInnerMesh);

    // Outer responsive wireframe cage
    const outerGeo = new THREE.IcosahedronGeometry(7.2, 2);
    const wireGeo = new THREE.WireframeGeometry(outerGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xff007f,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.audioOrbOuterWire = new THREE.LineSegments(wireGeo, wireMat);
    this.audioOrbGroup.add(this.audioOrbOuterWire);

    this.scene.add(this.audioOrbGroup);
  }

  // 3. Mid-Range Resonance Gimbal Rings
  private createMidResonanceRings() {
    if (!this.scene) return;
    this.midResonanceGroup = new THREE.Group();

    const ringRadii = [8.8, 10.5, 12.2];
    ringRadii.forEach((rad, idx) => {
      const ringGeo = new THREE.RingGeometry(rad, rad + 0.22, 64);
      const wire = new THREE.WireframeGeometry(ringGeo);
      const mat = new THREE.LineBasicMaterial({
        color: idx % 2 === 0 ? 0xff007f : 0x00f0ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.LineSegments(wire, mat);
      ringMesh.rotation.x = (idx * Math.PI) / 3;
      ringMesh.rotation.y = (idx * Math.PI) / 4;
      this.midResonanceRings.push(ringMesh);
      this.midResonanceGroup!.add(ringMesh);
    });

    this.scene.add(this.midResonanceGroup);
  }

  // 4. Cyber Neon Tunnel
  private createTunnel() {
    if (!this.scene) return;
    this.tunnelGroup = new THREE.Group();
    const ringCount = 28;
    const ringSpacing = 4.5;

    for (let i = 0; i < ringCount; i++) {
      const radius = 9.0;
      const sides = 8;
      const shapeGeo = new THREE.BufferGeometry();
      const vertices: number[] = [];

      for (let j = 0; j <= sides; j++) {
        const theta1 = (j / sides) * Math.PI * 2;
        const theta2 = ((j + 1) / sides) * Math.PI * 2;
        vertices.push(
          Math.cos(theta1) * radius, Math.sin(theta1) * radius, 0,
          Math.cos(theta2) * radius, Math.sin(theta2) * radius, 0
        );
      }

      shapeGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0xff007f,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });

      const ring = new THREE.LineSegments(shapeGeo, mat);
      ring.position.z = -i * ringSpacing;
      this.tunnelRings.push(ring);
      this.tunnelGroup.add(ring);
    }

    this.scene.add(this.tunnelGroup);
    this.tunnelGroup.visible = false;
  }

  // 5. Matrix Floating Crystals
  private createMatrixCrystals() {
    if (!this.scene) return;
    this.matrixGroup = new THREE.Group();
    const count = 42;

    for (let i = 0; i < count; i++) {
      const geo = i % 2 === 0 
        ? new THREE.OctahedronGeometry(Math.random() * 1.5 + 0.8) 
        : new THREE.TetrahedronGeometry(Math.random() * 1.8 + 0.9);
      
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.5,
        roughness: 0.1,
        metalness: 0.9,
        wireframe: i % 3 === 0,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 40 - 5
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      this.crystalMeshes.push(mesh);
      this.matrixGroup.add(mesh);
    }

    this.scene.add(this.matrixGroup);
    this.matrixGroup.visible = false;
  }

  // 6. 3D Particle Bursts System (Beat & Bass Reactive)
  private createBurstSystem() {
    if (!this.scene) return;
    this.burstGeo = new THREE.BufferGeometry();
    this.burstGeo.setAttribute('position', new THREE.BufferAttribute(this.burstPositions, 3));
    this.burstGeo.setAttribute('color', new THREE.BufferAttribute(this.burstColors, 3));
    this.burstGeo.setAttribute('size', new THREE.BufferAttribute(this.burstSizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.burstPoints = new THREE.Points(this.burstGeo, mat);
    this.scene.add(this.burstPoints);
  }

  // 7. Shockwave Ring Group (Bass Explosions)
  private createShockwaveGroup() {
    if (!this.scene) return;
    this.shockwaveGroup = new THREE.Group();
    this.scene.add(this.shockwaveGroup);
  }

  public triggerBassShockwave(colorHex: string, speedMult: number = 1.0) {
    if (!this.shockwaveGroup) return;

    const ringGeo = new THREE.RingGeometry(1.0, 1.8, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    mesh.rotation.y = (Math.random() - 0.5) * 0.3;
    this.shockwaveGroup.add(mesh);

    this.shockwaves.push({
      mesh,
      radius: 1.0,
      maxRadius: 36.0 * speedMult,
      life: 1.0,
      speed: 1.1 * speedMult,
    });
  }

  public trigger3DBurst(count: number, primaryColorHex: string, secondaryColorHex: string, speedMult: number = 1.0) {
    const colA = _tempColor.set(primaryColorHex);
    const colB = new THREE.Color(secondaryColorHex);

    for (let i = 0; i < count; i++) {
      if (this.bursts.length >= 3500) {
        this.bursts.shift();
      }

      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const speed = (Math.random() * 2.2 + 1.0) * speedMult;

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed;

      const burstCol = Math.random() > 0.4 ? colA.clone() : colB.clone();

      this.bursts.push({
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(vx, vy, vz),
        color: burstCol,
        size: Math.random() * 4.0 + 1.8,
        life: 1.0,
        maxLife: Math.random() * 0.9 + 0.4,
      });
    }
  }

  // --- TREBLE LASER LIGHT TRAILS ---

  public triggerTrebleTrail(colorHex: string, intensity: number = 1.0) {
    if (this.lightTrails.length > 25) {
      this.lightTrails.shift();
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 8 + 12) * intensity;
    const startX = this.width / 2 + (Math.random() - 0.5) * 100;
    const startY = this.height / 2 + (Math.random() - 0.5) * 100;

    this.lightTrails.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      history: [{ x: startX, y: startY }],
      color: colorHex,
      life: 1.0,
      maxLife: Math.random() * 0.4 + 0.5,
      width: Math.random() * 2.5 + 1.5,
    });
  }

  // --- 2D OVERLAYS SETUP ---

  private initOverlays() {
    this.overlayParticles = [];
    const count = 200;
    for (let i = 0; i < count; i++) {
      this.overlayParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 3 + 1,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.8 + 0.2,
        color: '#ffffff',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
      });
    }
  }

  // --- RESIZE ---

  public resize(forcedWidth?: number, forcedHeight?: number) {
    this.width = Math.round(forcedWidth || this.container.clientWidth || window.innerWidth);
    this.height = Math.round(forcedHeight || this.container.clientHeight || window.innerHeight);

    if (this.bgCanvas) {
      this.bgCanvas.width = this.width;
      this.bgCanvas.height = this.height;
    }
    if (this.hudCanvas) {
      this.hudCanvas.width = this.width;
      this.hudCanvas.height = this.height;
    }
    if (this.camera && this.renderer) {
      const aspect = this.width / this.height;
      this.camera.aspect = aspect;
      // Adjust camera distance for portrait (9:16) vs landscape (16:9) to keep visualizer beautifully framed
      this.cameraBaseZ = aspect < 1.0 ? 46 : 32;
      this.camera.position.z = this.cameraBaseZ + this.cameraKickOffset;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  // --- MASTER RENDER TICK ---

  public render(
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition,
    mediaManager: MediaManager
  ) {
    this.procTime += 0.016;

    // 1. Render Background Layer (Media + GPU Transitions + Procedural Loops)
    this.renderBackgroundLayer(mediaManager, audio, config, themeDef);

    // 2. Render 3D WebGL Layer (Three.js Scene + Bass Shockwaves + Mid Gimbal + Treble Shimmer)
    this.renderThreeLayer(audio, config, themeDef);

    // 3. Render 2D HUD / Waveform / Light Trails / Overlays Layer
    this.renderHudLayer(audio, config, themeDef);
  }

  // ==========================================
  // LAYER 1: BACKGROUND & GPU TRANSITIONS
  // ==========================================

  private renderBackgroundLayer(
    mediaManager: MediaManager,
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition
  ) {
    if (!this.bgCtx) return;
    const ctx = this.bgCtx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = themeDef.colors.background;
    ctx.fillRect(0, 0, w, h);

    const currentMedia = mediaManager.getCurrentMedia();
    const prevMedia = mediaManager.getPreviousMedia();
    const isTransitioning = mediaManager.getIsTransitioning();
    const progress = mediaManager.getTransitionProgress();
    const transType = mediaManager.getActiveTransitionType();

    // Media scale with sub-bass audio pump
    const baseScale = 1.0 + audio.bass * 0.05 * config.effectIntensity * (config.frequencyReactivity?.bassBurstIntensity || 1.0);

    if (!isTransitioning || !prevMedia) {
      if (currentMedia) {
        this.drawSingleMedia(ctx, currentMedia, 1.0, baseScale, 0, 0, themeDef, audio);
      }
    } else {
      this.renderMediaTransition(
        ctx,
        prevMedia,
        currentMedia!,
        progress,
        transType,
        baseScale,
        themeDef,
        audio
      );
    }

    // Ambient radial vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0.1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawSingleMedia(
    ctx: CanvasRenderingContext2D,
    media: MediaItem,
    alpha: number,
    scale: number,
    offsetX: number,
    offsetY: number,
    themeDef: ThemeDefinition,
    audio: AudioAnalysis
  ) {
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    if (media.type === 'procedural') {
      this.drawProceduralBackground(ctx, media.proceduralId || 'aurora', themeDef, audio);
    } else if (media.type === 'video') {
      const vid = document.querySelector(`video[data-media-id="${media.id}"]`) as HTMLVideoElement;
      if (vid && vid.readyState >= 2) {
        ctx.drawImage(vid, 0, 0, w, h);
      } else {
        this.drawProceduralBackground(ctx, 'warptunnel', themeDef, audio);
      }
    } else {
      const img = new Image();
      img.src = media.url;
      if (img.complete && img.naturalWidth > 0) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const screenAspect = w / h;
        let dw = w;
        let dh = h;
        let dx = 0;
        let dy = 0;

        if (screenAspect > imgAspect) {
          dw = w;
          dh = w / imgAspect;
          dy = (h - dh) / 2;
        } else {
          dh = h;
          dw = h * imgAspect;
          dx = (w - dw) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        this.drawProceduralBackground(ctx, 'retrogrid', themeDef, audio);
      }
    }

    ctx.restore();
  }

  private renderMediaTransition(
    ctx: CanvasRenderingContext2D,
    fromMedia: MediaItem,
    toMedia: MediaItem,
    progress: number,
    type: TransitionType,
    baseScale: number,
    themeDef: ThemeDefinition,
    audio: AudioAnalysis
  ) {
    const w = this.width;

    switch (type) {
      case 'fade': {
        this.drawSingleMedia(ctx, fromMedia, 1.0 - progress, baseScale, 0, 0, themeDef, audio);
        this.drawSingleMedia(ctx, toMedia, progress, baseScale, 0, 0, themeDef, audio);
        break;
      }
      case 'zoom': {
        const zoomOut = baseScale * (1.0 + progress * 0.4);
        const zoomIn = baseScale * (0.8 + progress * 0.2);
        this.drawSingleMedia(ctx, fromMedia, 1.0 - progress, zoomOut, 0, 0, themeDef, audio);
        this.drawSingleMedia(ctx, toMedia, progress, zoomIn, 0, 0, themeDef, audio);
        break;
      }
      case 'slide': {
        const offsetOut = -w * progress;
        const offsetIn = w * (1.0 - progress);
        this.drawSingleMedia(ctx, fromMedia, 1.0, baseScale, offsetOut, 0, themeDef, audio);
        this.drawSingleMedia(ctx, toMedia, 1.0, baseScale, offsetIn, 0, themeDef, audio);
        break;
      }
      case 'glitch': {
        const sliceCount = 8;
        const sliceH = this.height / sliceCount;
        for (let i = 0; i < sliceCount; i++) {
          const sliceOffset = (Math.random() - 0.5) * 60 * (1.0 - Math.abs(progress - 0.5) * 2);
          const showIncoming = progress > 0.5 ? Math.random() > 0.3 : Math.random() > 0.7;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, i * sliceH, w, sliceH);
          ctx.clip();
          this.drawSingleMedia(
            ctx,
            showIncoming ? toMedia : fromMedia,
            1.0,
            baseScale,
            sliceOffset,
            0,
            themeDef,
            audio
          );
          ctx.restore();
        }
        break;
      }
      case 'blur': {
        const blurAmount = Math.sin(progress * Math.PI) * 16;
        ctx.filter = `blur(${blurAmount}px)`;
        if (progress < 0.5) {
          this.drawSingleMedia(ctx, fromMedia, 1.0 - progress * 2, baseScale, 0, 0, themeDef, audio);
        } else {
          this.drawSingleMedia(ctx, toMedia, (progress - 0.5) * 2, baseScale, 0, 0, themeDef, audio);
        }
        ctx.filter = 'none';
        break;
      }
      case 'dissolve': {
        this.drawSingleMedia(ctx, fromMedia, 1.0 - progress, baseScale, 0, 0, themeDef, audio);
        ctx.globalCompositeOperation = 'lighter';
        this.drawSingleMedia(ctx, toMedia, progress, baseScale, 0, 0, themeDef, audio);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }

  private drawProceduralBackground(
    ctx: CanvasRenderingContext2D,
    procId: string,
    themeDef: ThemeDefinition,
    audio: AudioAnalysis
  ) {
    const w = this.width;
    const h = this.height;
    const t = this.procTime;

    if (procId === 'aurora') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, themeDef.colors.background);
      grad.addColorStop(0.5, themeDef.colors.primary + '33');
      grad.addColorStop(1, themeDef.colors.secondary + '22');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.45;
      for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 30) {
          const y = h * 0.5 + Math.sin(x * 0.004 + t * 1.5 + layer) * (80 + audio.bass * 60)
            + Math.cos(x * 0.008 - t * 0.8) * 40;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.fillStyle = layer % 2 === 0 ? themeDef.colors.primary : themeDef.colors.secondary;
        ctx.fill();
      }
      ctx.restore();
    } else if (procId === 'warptunnel') {
      ctx.fillStyle = themeDef.colors.background;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = themeDef.colors.primary;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.35 + audio.treble * 0.4;

      const rays = 24;
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 + t * 0.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
        ctx.lineTo(Math.cos(angle) * (w + 100), Math.sin(angle) * (w + 100));
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = themeDef.colors.background;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.strokeStyle = themeDef.colors.gridColor;
      ctx.lineWidth = 1;
      const horizonY = h * 0.55;

      const lineCount = 20;
      for (let i = -lineCount; i <= lineCount; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * 15, horizonY);
        ctx.lineTo(w / 2 + i * 90, h);
        ctx.stroke();
      }

      const speed = (t * 60) % 30;
      for (let y = horizonY; y < h; y += 20) {
        const curY = y + speed;
        if (curY > h) continue;
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(w, curY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ==========================================
  // LAYER 2: THREE.JS 3D WEBGL RENDERING
  // ==========================================

  private renderThreeLayer(
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition
  ) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const t = this.procTime;
    const mode = config.visualizerMode;
    const intensity = config.effectIntensity;
    const freqCfg = config.frequencyReactivity || {
      bassBurstIntensity: 1.0,
      midPulseIntensity: 1.0,
      trebleShimmerIntensity: 1.0,
      shockwaveEnabled: true,
      trebleTrailsEnabled: true,
    };

    // 1. Bass-driven Kick & Explosions
    const now = performance.now();
    if (config.cameraKick && audio.isBeat) {
      this.cameraKickOffset = audio.beatStrength * 3.8 * intensity * freqCfg.bassBurstIntensity;
      this.cameraShakeX = (Math.random() - 0.5) * 1.0 * intensity * freqCfg.bassBurstIntensity;
      this.cameraShakeY = (Math.random() - 0.5) * 1.0 * intensity * freqCfg.bassBurstIntensity;

      // Heavy 3D Bass Particle Explosion
      const burstDensity = config.particleBurstDensity ?? 1.0;
      const burstSize = Math.floor(80 * (1 + audio.beatStrength) * config.particleDensity * freqCfg.bassBurstIntensity * burstDensity);
      this.trigger3DBurst(burstSize, themeDef.colors.primary, themeDef.colors.secondary, 1.4 * intensity);

      // Bass Shockwave Ring Explosion
      if (freqCfg.shockwaveEnabled && now - this.lastShockwaveTime > 300) {
        this.lastShockwaveTime = now;
        this.triggerBassShockwave(themeDef.colors.primary, freqCfg.bassBurstIntensity);
      }
    } else {
      this.cameraKickOffset *= 0.88;
      this.cameraShakeX *= 0.85;
      this.cameraShakeY *= 0.85;
    }

    this.camera.position.z = this.cameraBaseZ - this.cameraKickOffset;
    this.camera.position.x = this.cameraShakeX;
    this.camera.position.y = this.cameraShakeY;
    this.camera.lookAt(0, 0, 0);

    // Update Theme Colors in 3D materials
    const primCol = _tempColor.set(themeDef.colors.primary);
    const secCol = new THREE.Color(themeDef.colors.secondary);

    // Mode Visibility
    if (this.galaxyParticles) {
      this.galaxyParticles.visible = mode === 'cosmic' || mode === 'aurora';
    }
    if (this.audioOrbGroup) {
      this.audioOrbGroup.visible = mode === 'cosmic' || mode === 'radial';
    }
    if (this.midResonanceGroup) {
      this.midResonanceGroup.visible = mode === 'cosmic' || mode === 'radial';
    }
    if (this.tunnelGroup) {
      this.tunnelGroup.visible = mode === 'tunnel';
    }
    if (this.matrixGroup) {
      this.matrixGroup.visible = mode === 'matrix';
    }

    // A. Galaxy Particles (with Treble Shimmering Modulation)
    if (this.galaxyParticles && this.galaxyGeo && this.galaxyParticles.visible) {
      const vortexSpd = config.particleVortexSpeed ?? 1.0;
      const react = config.particleReactivity ?? 1.0;
      this.galaxyParticles.rotation.y = t * 0.08 * vortexSpd + audio.mid * 0.3 * freqCfg.midPulseIntensity * react;
      this.galaxyParticles.rotation.x = Math.sin(t * 0.04) * 0.2 * react;

      const scale = (1.0 + audio.bass * 0.3 * intensity * freqCfg.bassBurstIntensity * react) * config.particleSize;
      this.galaxyParticles.scale.set(scale, scale, scale);

      // Treble Shimmer: brighten particles dynamically
      const mat = this.galaxyParticles.material as THREE.PointsMaterial;
      mat.opacity = 0.75 + audio.treble * 0.25 * freqCfg.trebleShimmerIntensity;
    }

    // B. Audio Core Orb & Wireframe (Bass Expansion & Mid Modulation)
    if (this.audioOrbGroup && this.audioOrbGroup.visible) {
      this.audioOrbGroup.rotation.x = t * 0.3;
      this.audioOrbGroup.rotation.y = t * 0.45;

      const orbScale = 1.0 + audio.bass * 0.7 * intensity * freqCfg.bassBurstIntensity;
      this.audioOrbGroup.scale.set(orbScale, orbScale, orbScale);

      if (this.audioOrbInnerMesh) {
        const mat = this.audioOrbInnerMesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(primCol);
        mat.emissive.copy(primCol);
        mat.emissiveIntensity = 0.5 + audio.bass * 1.8 * freqCfg.bassBurstIntensity;
      }

      if (this.audioOrbOuterWire) {
        const mat = this.audioOrbOuterWire.material as THREE.LineBasicMaterial;
        mat.color.copy(secCol);
      }
    }

    // C. Mid-Range Resonance Gimbal Rings
    if (this.midResonanceGroup && this.midResonanceGroup.visible) {
      this.midResonanceRings.forEach((ring, idx) => {
        const speed = (idx + 1) * 0.4;
        ring.rotation.z += 0.01 * speed;
        ring.rotation.x += 0.015 * speed;

        // Pulse scale with Mid frequencies
        const midScale = 1.0 + audio.mid * 0.45 * intensity * freqCfg.midPulseIntensity;
        ring.scale.set(midScale, midScale, midScale);

        const mat = ring.material as THREE.LineBasicMaterial;
        mat.opacity = 0.5 + audio.mid * 0.5 * freqCfg.midPulseIntensity;
      });
    }

    // D. Cyber Tunnel
    if (this.tunnelGroup && this.tunnelGroup.visible) {
      const speed = 0.8 + audio.bass * 1.5 * intensity * freqCfg.bassBurstIntensity;
      const spacing = 4.5;
      const totalLen = this.tunnelRings.length * spacing;

      this.tunnelRings.forEach((ring, idx) => {
        ring.position.z += speed;
        if (ring.position.z > 10) {
          ring.position.z -= totalLen;
        }

        const pulse = 1.0 + Math.sin(idx * 0.5 + t * 4) * 0.2 * audio.mid * freqCfg.midPulseIntensity;
        ring.scale.set(pulse, pulse, 1);
      });
    }

    // E. Matrix Floating Crystals
    if (this.matrixGroup && this.matrixGroup.visible) {
      this.matrixGroup.rotation.y = t * 0.1;
      this.crystalMeshes.forEach((mesh, idx) => {
        mesh.rotation.x += 0.01 * (idx % 3 + 1);
        mesh.rotation.y += 0.015 * (idx % 2 + 1);

        const freqVal = audio.frequency[idx * 15 % audio.frequency.length] / 255;
        const crystalScale = 1.0 + freqVal * 0.9 * intensity;
        mesh.scale.set(crystalScale, crystalScale, crystalScale);

        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.copy(idx % 2 === 0 ? primCol : secCol);
        mat.emissiveIntensity = 0.3 + freqVal * 1.4;
      });
    }

    // F. Update 3D Beat Particle Bursts
    this.updateBursts();

    // G. Update Shockwaves
    this.updateShockwaves();

    // H. Spawn Treble Light Trails if treble spikes
    if (freqCfg.trebleTrailsEnabled && audio.treble > 0.32 && now - this.lastTrailSpawnTime > 180) {
      this.lastTrailSpawnTime = now;
      this.triggerTrebleTrail(themeDef.colors.secondary, freqCfg.trebleShimmerIntensity);
    }

    // Render WebGL
    this.renderer.render(this.scene, this.camera);
  }

  private updateBursts() {
    if (!this.burstGeo) return;

    let activeCount = 0;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const p = this.bursts[i];
      p.life -= 0.02;

      if (p.life <= 0) {
        this.bursts.splice(i, 1);
        continue;
      }

      p.pos.add(p.vel);
      p.vel.multiplyScalar(0.97);

      const idx = activeCount;
      this.burstPositions[idx * 3] = p.pos.x;
      this.burstPositions[idx * 3 + 1] = p.pos.y;
      this.burstPositions[idx * 3 + 2] = p.pos.z;

      this.burstColors[idx * 3] = p.color.r * p.life;
      this.burstColors[idx * 3 + 1] = p.color.g * p.life;
      this.burstColors[idx * 3 + 2] = p.color.b * p.life;

      this.burstSizes[idx] = p.size * p.life;
      activeCount++;
    }

    this.burstGeo.setDrawRange(0, activeCount);
    this.burstGeo.attributes.position.needsUpdate = true;
    this.burstGeo.attributes.color.needsUpdate = true;
    this.burstGeo.attributes.size.needsUpdate = true;
  }

  private updateShockwaves() {
    if (!this.shockwaveGroup) return;

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed;
      sw.life = Math.max(0, 1.0 - sw.radius / sw.maxRadius);

      if (sw.life <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaveGroup.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        if (Array.isArray(sw.mesh.material)) {
          sw.mesh.material.forEach((m) => m.dispose());
        } else {
          sw.mesh.material.dispose();
        }
        this.shockwaves.splice(i, 1);
        continue;
      }

      sw.mesh.scale.set(sw.radius, sw.radius, 1);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = sw.life * 0.85;
    }
  }

  // ==========================================
  // LAYER 3: 2D HUD / WAVEFORM / FREQ / OVERLAYS
  // ==========================================

  private renderHudLayer(
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition
  ) {
    if (!this.hudCtx) return;
    const ctx = this.hudCtx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const mode = config.visualizerMode;
    const intensity = config.effectIntensity;
    const freqCfg = config.frequencyReactivity || {
      bassBurstIntensity: 1.0,
      midPulseIntensity: 1.0,
      trebleShimmerIntensity: 1.0,
      shockwaveEnabled: true,
      trebleTrailsEnabled: true,
    };

    // 1. Audio-based visualizations
    if (mode === 'radial') {
      this.drawRadialSpectrum(ctx, audio, config, themeDef);
    } else {
      this.drawWaveformOscilloscope(ctx, audio, config, themeDef);
      this.drawBottomFrequencyBars(ctx, audio, config, themeDef);
    }

    // 2. Mid-Range Harmonic Ribbons
    if (freqCfg.midPulseIntensity > 0.2) {
      this.drawMidHarmonicRibbons(ctx, audio, themeDef, freqCfg.midPulseIntensity);
    }

    // 3. Treble Laser Light Trails
    if (freqCfg.trebleTrailsEnabled) {
      this.drawTrebleLightTrails(ctx);
    }

    // 4. Overlays (Rain, Fire, Love, Stardust)
    if (config.overlay !== 'none') {
      this.drawOverlayParticles(ctx, config.overlay, config.overlayIntensity, themeDef);
    }

    // 5. Beat Glow / Bloom Vignette
    if (audio.beatStrength > 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const bloomAlpha = Math.min(0.4, audio.beatStrength * 0.35 * config.bloomStrength);
      ctx.fillStyle = themeDef.colors.primary;
      ctx.globalAlpha = bloomAlpha;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // Mid-Range Harmonic Sinusoidal Ribbons
  private drawMidHarmonicRibbons(
    ctx: CanvasRenderingContext2D,
    audio: AudioAnalysis,
    themeDef: ThemeDefinition,
    midIntensity: number
  ) {
    const w = this.width;
    const h = this.height;
    const t = this.procTime;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.8;

    const layers = 3;
    for (let l = 0; l < layers; l++) {
      ctx.beginPath();
      ctx.strokeStyle = l % 2 === 0 ? themeDef.colors.secondary : themeDef.colors.primary;
      ctx.globalAlpha = (0.2 + audio.mid * 0.4) * midIntensity;

      const centerY = h * (0.35 + l * 0.15);
      const amp = (30 + audio.mid * 70) * midIntensity;
      const freq = 0.003 + l * 0.001;

      for (let x = 0; x <= w; x += 15) {
        const y = centerY + Math.sin(x * freq + t * (2 + l) + l) * amp * Math.cos(x * 0.001);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // Treble Laser Light Trails rendering
  private drawTrebleLightTrails(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = this.lightTrails.length - 1; i >= 0; i--) {
      const trail = this.lightTrails[i];
      trail.life -= 0.02;

      if (trail.life <= 0) {
        this.lightTrails.splice(i, 1);
        continue;
      }

      trail.x += trail.vx;
      trail.y += trail.vy;
      trail.history.push({ x: trail.x, y: trail.y });
      if (trail.history.length > 12) {
        trail.history.shift();
      }

      ctx.beginPath();
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = trail.width * trail.life;
      ctx.globalAlpha = trail.life * 0.9;

      trail.history.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    ctx.restore();
  }

  // Dynamic Oscilloscope Waveform Line
  private drawWaveformOscilloscope(
    ctx: CanvasRenderingContext2D,
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition
  ) {
    const w = this.width;
    const h = this.height;
    const waveform = audio.waveform;
    const len = waveform.length;

    ctx.save();
    ctx.shadowBlur = 14 * config.bloomStrength;
    ctx.shadowColor = themeDef.colors.waveformColor;
    ctx.strokeStyle = themeDef.colors.waveformColor;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    const sliceWidth = w / (len / 2);
    let x = 0;
    const centerY = h * 0.72;

    for (let i = 0; i < len / 2; i++) {
      const v = waveform[i * 2] / 128.0;
      const y = centerY + (v - 1.0) * 85 * config.effectIntensity;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.restore();
  }

  // Bottom Sleek Frequency Bars
  private drawBottomFrequencyBars(
    ctx: CanvasRenderingContext2D,
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition
  ) {
    const w = this.width;
    const h = this.height;
    const freq = audio.frequency;
    const barCount = 64;
    const barWidth = (w / barCount) * 0.68;
    const gap = (w / barCount) * 0.32;

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const freqIndex = Math.floor(Math.pow(i / barCount, 1.5) * (freq.length / 3));
      const val = (freq[freqIndex] || 0) / 255.0;
      const barHeight = Math.max(3, val * 120 * config.effectIntensity);

      const x = i * (barWidth + gap) + gap / 2;
      const y = h - barHeight - 4;

      const grad = ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, themeDef.colors.primary);
      grad.addColorStop(1, themeDef.colors.secondary + '44');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
    ctx.restore();
  }

  // 360 Radial Spectrum & Circular Oscilloscope
  private drawRadialSpectrum(
    ctx: CanvasRenderingContext2D,
    audio: AudioAnalysis,
    config: VisualizerConfig,
    themeDef: ThemeDefinition
  ) {
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.22;
    const barCount = 120;
    const freq = audio.frequency;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const freqIdx = Math.floor((i / barCount) * (freq.length * 0.4));
      const val = (freq[freqIdx] || 0) / 255.0;
      const barLen = val * 90 * config.effectIntensity;

      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + barLen);
      const y2 = Math.sin(angle) * (baseRadius + barLen);

      ctx.strokeStyle = i % 2 === 0 ? themeDef.colors.primary : themeDef.colors.secondary;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = themeDef.colors.accent;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = themeDef.colors.accent;

    const wave = audio.waveform;
    const waveCount = 180;
    for (let i = 0; i <= waveCount; i++) {
      const angle = (i / waveCount) * Math.PI * 2;
      const waveIdx = Math.floor((i / waveCount) * (wave.length / 2));
      const v = (wave[waveIdx] / 128.0 - 1.0) * 30 * config.effectIntensity;
      const r = baseRadius * 0.75 + v;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  // Overlays (Rain, Fire, Love, Stardust)
  private drawOverlayParticles(
    ctx: CanvasRenderingContext2D,
    type: OverlayType,
    intensity: number,
    themeDef: ThemeDefinition
  ) {
    const w = this.width;
    const h = this.height;

    ctx.save();

    this.overlayParticles.forEach((p) => {
      if (type === 'rain') {
        p.y += (p.vy + 8) * intensity;
        p.x += p.vx * 0.5;

        if (p.y > h) {
          p.y = -20;
          p.x = Math.random() * w;
        }

        ctx.strokeStyle = themeDef.colors.primary;
        ctx.globalAlpha = p.alpha * 0.65;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 2, p.y + 16 * intensity);
        ctx.stroke();
      } else if (type === 'fire') {
        p.y -= (p.vy + 1.5) * intensity;
        p.x += Math.sin(p.y * 0.02) * 1.5;

        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }

        ctx.fillStyle = themeDef.id === 'Cyberpunk' ? '#ff007f' : '#f59e0b';
        ctx.globalAlpha = p.alpha * 0.75;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * intensity, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'love') {
        p.y -= (p.vy * 0.6 + 0.8) * intensity;
        p.x += Math.sin(p.y * 0.015) * 1.2;
        if (p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed;
        }

        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillStyle = '#ff3366';
        ctx.globalAlpha = p.alpha * 0.7;

        const s = (p.size + 4) * intensity * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, s / 4);
        ctx.bezierCurveTo(-s / 2, -s / 2, -s, s / 3, 0, s);
        ctx.bezierCurveTo(s, s / 3, s / 2, -s / 2, 0, s / 4);
        ctx.fill();
        ctx.restore();
      } else if (type === 'stardust') {
        p.x += p.vx * 0.3 * intensity;
        p.y += p.vy * 0.3 * intensity;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const twinkle = Math.sin(this.procTime * 4 + p.x) * 0.4 + 0.6;
        ctx.fillStyle = themeDef.colors.secondary;
        ctx.globalAlpha = p.alpha * twinkle;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.2 * intensity, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }

  // --- CLEANUP ---

  public dispose() {
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
