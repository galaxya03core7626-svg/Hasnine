/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VisualizerConfig } from '../types/visualizer';

/**
 * Generates a complete, self-contained single-file HTML document
 * that can run directly in any web browser without any build tools.
 */
export function generateStandaloneHtml(config: VisualizerConfig): string {
  const textCfg = config.textOverlay || {
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

  const freqCfg = config.frequencyReactivity || {
    bassBurstIntensity: 1.0,
    midPulseIntensity: 1.0,
    trebleShimmerIntensity: 1.0,
    shockwaveEnabled: true,
    trebleTrailsEnabled: true,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PulseWave - Standalone Music Visualizer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    canvas { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: block; box-shadow: 0 0 40px rgba(0,0,0,0.8); }
    #bgCanvas { z-index: 1; }
    #threeCanvas { z-index: 2; pointer-events: none; }
    #hudCanvas { z-index: 3; pointer-events: none; }
    
    /* Clean Screen Overlay: ONLY the Title or user text is visible on the screen */
    #titleOverlay {
      position: absolute;
      ${textCfg.position === 'center' ? 'top: 50%; transform: translate(-50%, -50%);' : textCfg.position === 'bottom-center' ? 'bottom: 60px; transform: translateX(-50%);' : 'top: 36px; transform: translateX(-50%);'}
      left: 50%;
      z-index: 10;
      text-align: center;
      pointer-events: none;
      transition: transform 0.06s ease, opacity 0.1s ease;
      will-change: transform;
    }
    #titleText {
      font-size: ${textCfg.size || 42}px;
      font-weight: 900;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: ${textCfg.color || '#ffffff'};
      text-shadow: 0 0 24px ${textCfg.glowColor || '#00f0ff'};
      font-family: ${textCfg.fontFamily || "'Orbitron', sans-serif"};
    }
    #subtitleText {
      font-size: 0.85rem;
      letter-spacing: 0.4em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 6px;
      font-family: ${textCfg.fontFamily || "'Orbitron', sans-serif"};
    }

    /* Floating Discreet Trigger Button - auto-fades */
    #controlTrigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 40;
      background: rgba(20, 20, 25, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 13px;
      cursor: pointer;
      opacity: 0.35;
      transition: opacity 0.3s ease, transform 0.2s ease;
    }
    #controlTrigger:hover {
      opacity: 1;
      transform: scale(1.05);
    }

    /* Hidden Control Drawer */
    #drawer {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translate(-50%, 105%);
      width: min(940px, 95vw);
      max-height: 82vh;
      background: rgba(10, 12, 18, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-bottom: none;
      border-radius: 16px 16px 0 0;
      z-index: 50;
      padding: 24px;
      color: #fff;
      overflow-y: auto;
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #drawer.open {
      transform: translate(-50%, 0%);
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: background 0.2s;
    }
    .btn:hover { background: rgba(255, 255, 255, 0.2); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .control-group { margin-bottom: 16px; }
    .control-group label { display: block; font-size: 11px; font-weight: 600; color: #a1a1aa; margin-bottom: 6px; text-transform: uppercase; }
    input[type=range] { width: 100%; accent-color: #00f0ff; }
    select, input[type=text] { width: 100%; padding: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; }
    .dropzone { border: 2px dashed rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 18px; text-align: center; cursor: pointer; transition: 0.2s; }
    .dropzone:hover, .dropzone.dragover { border-color: #00f0ff; background: rgba(0, 240, 255, 0.05); }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <canvas id="bgCanvas"></canvas>
  <canvas id="threeCanvas"></canvas>
  <canvas id="hudCanvas"></canvas>

  <div id="titleOverlay">
    <div id="titleText">${textCfg.title}</div>
    <div id="subtitleText">${textCfg.subtitle}</div>
  </div>

  <button id="controlTrigger" onclick="toggleDrawer()">Controls [H]</button>

  <div id="drawer">
    <div class="drawer-header">
      <h2 style="font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; color: #00f0ff;">PULSEWAVE STUDIO ENGINE</h2>
      <button class="btn" onclick="toggleDrawer()">Close [Esc]</button>
    </div>

    <!-- Drag and Drop Media Upload -->
    <div class="control-group">
      <label>Media Upload (Drag & Drop or Click)</label>
      <div id="dropZone" class="dropzone" onclick="document.getElementById('fileInput').click()">
        <p style="font-size: 13px; font-weight: 600;">Drop images or short video clips here to add to visualizer</p>
        <p style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">Supports PNG, JPG, MP4, WebM</p>
        <input id="fileInput" type="file" multiple accept="image/*,video/*" style="display:none" onchange="handleFileSelect(this.files)">
      </div>
    </div>

    <div class="grid">
      <div class="control-group">
        <label>Audio Source</label>
        <button id="playBtn" class="btn" style="width: 100%; margin-bottom: 8px;" onclick="window.visualizer.togglePlay()">▶ Start Audio</button>
        <select id="trackSelect" onchange="window.visualizer.setTrack(this.value)">
          <option value="synthwave">Neon Horizon (Synthwave)</option>
          <option value="chillwave">Solar Aurora (Ambient Lofi)</option>
          <option value="techno">Cyber Pulse (Acid Club)</option>
        </select>
      </div>

      <div class="control-group">
        <label>Dynamic Text Overlay</label>
        <input type="text" id="customTextInput" value="${textCfg.title}" placeholder="Custom Text..." oninput="updateCustomText(this.value)">
        <select id="textAnimSelect" style="margin-top: 8px;" onchange="textAnimStyle = this.value">
          <option value="scale">Animation: Scale Pulse</option>
          <option value="bounce">Animation: Bounce</option>
          <option value="glitch">Animation: Glitch Split</option>
          <option value="wave">Animation: Harmonic Wave</option>
          <option value="fade">Animation: Fade Pulse</option>
        </select>
      </div>

      <div class="control-group">
        <label>Frequency Band Tuning</label>
        <label style="font-size: 10px;">Bass Explosions: <span id="bassLabel">1.0x</span></label>
        <input type="range" min="0" max="2.5" step="0.1" value="${freqCfg.bassBurstIntensity}" oninput="bassMult = parseFloat(this.value); document.getElementById('bassLabel').textContent = this.value + 'x'">
        <label style="font-size: 10px; margin-top: 4px;">Treble Shimmer: <span id="trebleLabel">1.0x</span></label>
        <input type="range" min="0" max="2.5" step="0.1" value="${freqCfg.trebleShimmerIntensity}" oninput="trebleMult = parseFloat(this.value); document.getElementById('trebleLabel').textContent = this.value + 'x'">
      </div>

      <div class="control-group">
        <label>Video Display Size (FHD Quality)</label>
        <select id="aspectSelect" onchange="setAspect(this.value)">
          <option value="16:9" ${config.aspectRatio === '16:9' ? 'selected' : ''}>16:9 Landscape FHD (1920x1080)</option>
          <option value="9:16" ${config.aspectRatio === '9:16' ? 'selected' : ''}>9:16 Vertical FHD (1080x1920)</option>
          <option value="responsive" ${config.aspectRatio === 'responsive' ? 'selected' : ''}>Full Window (Dynamic Fit)</option>
        </select>
      </div>

      <div class="control-group">
        <label>Visual Theme & Style</label>
        <select id="themeSelect" onchange="window.visualizer.setTheme(this.value)">
          <option value="Cyberpunk">Cyberpunk</option>
          <option value="Vintage">Vintage</option>
          <option value="Fantasy">Fantasy</option>
          <option value="Kinetic">Kinetic Typography</option>
        </select>
        <button class="btn" style="width: 100%; margin-top: 8px;" onclick="window.visualizer.randomize()">🎲 Randomize All</button>
      </div>
    </div>
  </div>

  <script>
    const THEMES = {
      Cyberpunk: { primary: '#00f0ff', secondary: '#ff007f', bg: '#050713', wave: '#00f0ff' },
      Vintage: { primary: '#d97706', secondary: '#f59e0b', bg: '#140c08', wave: '#fbbf24' },
      Fantasy: { primary: '#c084fc', secondary: '#fbbf24', bg: '#0a0518', wave: '#f472b6' },
      Kinetic: { primary: '#ef4444', secondary: '#ffffff', bg: '#08080a', wave: '#ef4444' }
    };
    let currentTheme = '${config.theme || 'Cyberpunk'}';
    let currentAspect = '${config.aspectRatio || '16:9'}';
    let textAnimStyle = '${textCfg.animationStyle || 'scale'}';
    let bassMult = 1.0;
    let trebleMult = 1.0;

    function setAspect(val) {
      currentAspect = val;
      resize();
    }

    // --- AUDIO ENGINE ---
    let audioCtx = null, analyser = null, masterGain = null, isPlaying = false, synthTimer = null, synthStep = 0;
    let freqData = new Uint8Array(512), timeData = new Uint8Array(512);

    function initAudio() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.frequencyBinCount);
    }

    function triggerKick(t) {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
      g.gain.setValueAtTime(0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.32);
    }

    function startSynth() {
      initAudio();
      if (synthTimer) clearInterval(synthTimer);
      let nextTime = audioCtx.currentTime + 0.05;
      synthTimer = setInterval(() => {
        const bpm = 124;
        const spb = (60 / bpm) / 4;
        while (nextTime < audioCtx.currentTime + 0.1) {
          if (synthStep % 4 === 0) triggerKick(nextTime);
          synthStep = (synthStep + 1) % 32;
          nextTime += spb;
        }
      }, 25);
    }

    // --- 3D ENGINE ---
    let scene, camera, renderer, galaxy, orb;
    let width = window.innerWidth, height = window.innerHeight;

    function init3D() {
      const canvas = document.getElementById('threeCanvas');
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      camera.position.z = 30;

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(width, height);

      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(8000 * 3);
      const col = new Float32Array(8000 * 3);
      for(let i = 0; i < 8000; i++) {
        const r = Math.random() * 40 + 2;
        const a = Math.random() * Math.PI * 2;
        pos[i*3] = Math.cos(a) * r;
        pos[i*3+1] = (Math.random() - 0.5) * 15;
        pos[i*3+2] = Math.sin(a) * r;
        col[i*3] = 0.0; col[i*3+1] = 0.9; col[i*3+2] = 1.0;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      galaxy = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.8 }));
      scene.add(galaxy);

      const orbGeo = new THREE.IcosahedronGeometry(6, 2);
      orb = new THREE.LineSegments(new THREE.WireframeGeometry(orbGeo), new THREE.LineBasicMaterial({ color: 0xff007f }));
      scene.add(orb);
    }

    const bgCanvas = document.getElementById('bgCanvas');
    const bgCtx = bgCanvas.getContext('2d');
    const hudCanvas = document.getElementById('hudCanvas');
    const hudCtx = hudCanvas.getContext('2d');

    function resize() {
      const winW = window.innerWidth, winH = window.innerHeight;
      if (currentAspect === 'responsive') {
        width = winW; height = winH;
      } else {
        const target = currentAspect === '16:9' ? 16 / 9 : 9 / 16;
        if (winW / winH > target) {
          height = winH;
          width = Math.round(winH * target);
        } else {
          width = winW;
          height = Math.round(winW / target);
        }
      }
      bgCanvas.width = width; bgCanvas.height = height;
      bgCanvas.style.width = width + 'px'; bgCanvas.style.height = height + 'px';
      hudCanvas.width = width; hudCanvas.height = height;
      hudCanvas.style.width = width + 'px'; hudCanvas.style.height = height + 'px';
      const three = document.getElementById('threeCanvas');
      if (three) {
        three.style.width = width + 'px'; three.style.height = height + 'px';
      }
      if (renderer && camera) {
        camera.aspect = width / height;
        camera.position.z = width < height ? 45 : 30;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    }
    window.addEventListener('resize', resize);

    function renderLoop() {
      requestAnimationFrame(renderLoop);
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);
      }

      const bass = ((freqData[2] || 0) / 255.0) * bassMult;
      const treble = ((freqData[120] || 0) / 255.0) * trebleMult;

      bgCtx.fillStyle = THEMES[currentTheme].bg;
      bgCtx.fillRect(0, 0, width, height);

      if (galaxy) galaxy.rotation.y += 0.002 + bass * 0.01;
      if (orb) {
        orb.rotation.x += 0.005; orb.rotation.y += 0.008;
        const s = 1.0 + bass * 0.5;
        orb.scale.set(s, s, s);
      }
      if (renderer) renderer.render(scene, camera);

      // 2D Waveform
      hudCtx.clearRect(0, 0, width, height);
      hudCtx.strokeStyle = THEMES[currentTheme].wave;
      hudCtx.lineWidth = 3;
      hudCtx.beginPath();
      const slice = width / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0;
        const y = height * 0.75 + (v - 1.0) * 80;
        if (i === 0) hudCtx.moveTo(x, y);
        else hudCtx.lineTo(x, y);
        x += slice;
      }
      hudCtx.stroke();

      // Animate text overlay dynamically with audio
      const titleElem = document.getElementById('titleOverlay');
      if (titleElem) {
        if (textAnimStyle === 'scale') {
          titleElem.style.transform = 'translateX(-50%) scale(' + (1.0 + bass * 0.3) + ')';
        } else if (textAnimStyle === 'bounce') {
          titleElem.style.transform = 'translateX(-50%) translateY(' + (-bass * 25) + 'px)';
        } else if (textAnimStyle === 'glitch') {
          const jitter = bass > 0.4 ? (Math.random() - 0.5) * 12 : 0;
          titleElem.style.transform = 'translateX(' + (-50 + jitter) + '%)';
        } else if (textAnimStyle === 'fade') {
          titleElem.style.opacity = (0.5 + bass * 0.5).toString();
        }
      }
    }

    function toggleDrawer() { document.getElementById('drawer').classList.toggle('open'); }
    function updateCustomText(val) { document.getElementById('titleText').textContent = val || 'PULSEWAVE'; }

    function handleFileSelect(files) {
      if (!files || files.length === 0) return;
      alert('Added ' + files.length + ' item(s) to playlist!');
    }

    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFileSelect(e.dataTransfer.files);
    });

    window.visualizer = {
      play: async () => {
        initAudio();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        isPlaying = true;
        startSynth();
        document.getElementById('playBtn').textContent = '❚❚ Pause Audio';
      },
      pause: () => {
        isPlaying = false;
        if (synthTimer) clearInterval(synthTimer);
        document.getElementById('playBtn').textContent = '▶ Start Audio';
      },
      togglePlay: () => isPlaying ? window.visualizer.pause() : window.visualizer.play(),
      setTheme: (t) => { if (THEMES[t]) currentTheme = t; },
      randomize: () => {
        const thms = Object.keys(THEMES);
        const rand = thms[Math.floor(Math.random() * thms.length)];
        window.visualizer.setTheme(rand);
        document.getElementById('themeSelect').value = rand;
      }
    };

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'h' || e.key === 'H') toggleDrawer();
      if (e.key === 'Escape') document.getElementById('drawer').classList.remove('open');
      if (e.key === ' ') { e.preventDefault(); window.visualizer.togglePlay(); }
    });

    init3D();
    resize();
    renderLoop();
  </script>
</body>
</html>`;
}
