/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaItem, TransitionType } from '../types/visualizer';

// Generated asset paths for theme backdrops
import cyberpunkImage from '../assets/images/cyberpunk_neon_cityscape_1792049438408.jpg';
import fantasyImage from '../assets/images/fantasy_ethereal_nebula_1792049438599.jpg';
import vintageImage from '../assets/images/vintage_analog_synth_1792049439442.jpg';
import kineticImage from '../assets/images/kinetic_abstract_geometry_1792049439227.jpg';

// Default sample media items (with comments for easy replacement by developer)
export const INITIAL_SAMPLE_MEDIA: MediaItem[] = [
  {
    id: 'media_cyberpunk_neon',
    type: 'image',
    url: cyberpunkImage,
    title: 'Cyberpunk Metropolis (Night)',
    thumbnail: cyberpunkImage,
  },
  {
    id: 'media_fantasy_nebula',
    type: 'image',
    url: fantasyImage,
    title: 'Astral Nebula & Stardust',
    thumbnail: fantasyImage,
  },
  {
    id: 'media_vintage_synth',
    type: 'image',
    url: vintageImage,
    title: 'Analog Studio & Tube Warmth',
    thumbnail: vintageImage,
  },
  {
    id: 'media_kinetic_swiss',
    type: 'image',
    url: kineticImage,
    title: 'Swiss Modernist Typography Grid',
    thumbnail: kineticImage,
  },
  // Procedural animated video clips (Zero external 404 risk, 60fps GPU rendered)
  {
    id: 'media_loop_aurora_plasma',
    type: 'procedural',
    url: 'proc:aurora',
    title: 'Luminescent Aurora Wave (Animated)',
    proceduralId: 'aurora',
  },
  {
    id: 'media_loop_warp_tunnel',
    type: 'procedural',
    url: 'proc:warptunnel',
    title: 'Hyperspace Tunnel (Animated)',
    proceduralId: 'warptunnel',
  },
  {
    id: 'media_loop_retro_grid',
    type: 'procedural',
    url: 'proc:retrogrid',
    title: 'Synthwave Wireframe Valley (Animated)',
    proceduralId: 'retrogrid',
  },
];

export class MediaManager {
  private mediaList: MediaItem[] = [...INITIAL_SAMPLE_MEDIA];
  private currentIndex: number = 0;
  private previousIndex: number = 0;

  // Transition state
  private isTransitioning: boolean = false;
  private transitionProgress: number = 1.0; // 0.0 -> 1.0
  private transitionStartTime: number = 0;
  private transitionDuration: number = 1.2; // in seconds
  private activeTransitionType: TransitionType = 'fade';

  // Loaded cache
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private videoCache: Map<string, HTMLVideoElement> = new Map();

  // Rotation timer
  private lastRotateTime: number = performance.now();
  private beatCounter: number = 0;

  constructor() {
    this.preloadInitialMedia();
  }

  private preloadInitialMedia() {
    this.mediaList.forEach((item) => {
      if (item.type === 'image' && !this.imageCache.has(item.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = item.url;
        this.imageCache.set(item.id, img);
      }
    });
  }

  public getMediaList(): MediaItem[] {
    return [...this.mediaList];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentMedia(): MediaItem | undefined {
    return this.mediaList[this.currentIndex];
  }

  public getPreviousMedia(): MediaItem | undefined {
    return this.mediaList[this.previousIndex];
  }

  public getTransitionProgress(): number {
    return this.transitionProgress;
  }

  public getIsTransitioning(): boolean {
    return this.isTransitioning;
  }

  public getActiveTransitionType(): TransitionType {
    return this.activeTransitionType;
  }

  public setMediaIndex(newIndex: number, transition: TransitionType = 'fade', duration: number = 1.2) {
    if (newIndex < 0 || newIndex >= this.mediaList.length || newIndex === this.currentIndex) return;

    this.previousIndex = this.currentIndex;
    this.currentIndex = newIndex;
    this.activeTransitionType = transition;
    this.transitionDuration = Math.max(0.2, duration);
    this.transitionProgress = 0.0;
    this.transitionStartTime = performance.now();
    this.isTransitioning = true;
    this.lastRotateTime = performance.now();
  }

  public next(transition: TransitionType = 'fade', duration: number = 1.2) {
    if (this.mediaList.length === 0) return;
    const nextIdx = (this.currentIndex + 1) % this.mediaList.length;
    this.setMediaIndex(nextIdx, transition, duration);
  }

  public prev(transition: TransitionType = 'fade', duration: number = 1.2) {
    if (this.mediaList.length === 0) return;
    const prevIdx = (this.currentIndex - 1 + this.mediaList.length) % this.mediaList.length;
    this.setMediaIndex(prevIdx, transition, duration);
  }

  // --- REORDERING & MANAGEMENT ---

  public moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.mediaList.length || toIndex < 0 || toIndex >= this.mediaList.length) return;
    const currentItem = this.mediaList[this.currentIndex];
    const item = this.mediaList.splice(fromIndex, 1)[0];
    this.mediaList.splice(toIndex, 0, item);
    // keep current item track
    this.currentIndex = this.mediaList.findIndex((m) => m.id === currentItem.id);
  }

  public removeItem(index: number) {
    if (this.mediaList.length <= 1) return; // Keep at least 1 media item
    const item = this.mediaList[index];
    if (this.imageCache.has(item.id)) {
      this.imageCache.delete(item.id);
    }
    if (this.videoCache.has(item.id)) {
      const vid = this.videoCache.get(item.id);
      vid?.pause();
      this.videoCache.delete(item.id);
    }
    this.mediaList.splice(index, 1);
    if (this.currentIndex >= this.mediaList.length) {
      this.currentIndex = 0;
    }
  }

  public async addUploadedFileAsync(
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<MediaItem> {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      throw new Error(`Unsupported file type: "${file.type || file.name}". Please upload an image or video file.`);
    }

    const MAX_SIZE_MB = 150;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${MAX_SIZE_MB}MB.`);
    }

    onProgress?.(25);

    const url = URL.createObjectURL(file);
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const title = file.name.replace(/\.[^/.]+$/, '');

    let thumbnail: string | undefined = undefined;

    if (isVideo) {
      onProgress?.(50);
      thumbnail = await this.generateVideoThumbnail(url);
      onProgress?.(85);

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('data-media-id', id);
      video.play().catch((err) => console.warn('Autoplay video error', err));
      this.videoCache.set(id, video);
    } else {
      thumbnail = url;
      onProgress?.(70);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      this.imageCache.set(id, img);
    }

    const newItem: MediaItem = {
      id,
      type: isVideo ? 'video' : 'image',
      url,
      title,
      thumbnail,
    };

    this.mediaList.push(newItem);
    onProgress?.(100);
    return newItem;
  }

  private generateVideoThumbnail(videoUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.muted = true;
      vid.playsInline = true;
      vid.src = videoUrl;

      const fallbackThumbnail = '';

      vid.onloadedmetadata = () => {
        vid.currentTime = Math.min(1.0, vid.duration * 0.2);
      };

      vid.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Could not generate video thumbnail', e);
        }
        resolve(fallbackThumbnail);
      };

      vid.onerror = () => {
        resolve(fallbackThumbnail);
      };

      // Timeout fallback after 2.5s
      setTimeout(() => {
        resolve(fallbackThumbnail);
      }, 2500);
    });
  }

  public resetToDefaults() {
    this.mediaList = [...INITIAL_SAMPLE_MEDIA];
    this.currentIndex = 0;
    this.previousIndex = 0;
    this.preloadInitialMedia();
  }

  public getCachedImage(item: MediaItem): HTMLImageElement | undefined {
    if (!this.imageCache.has(item.id)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = item.url;
      this.imageCache.set(item.id, img);
    }
    return this.imageCache.get(item.id);
  }

  public getCachedVideo(item: MediaItem): HTMLVideoElement | undefined {
    return this.videoCache.get(item.id);
  }

  // --- AUTOMATIC ROTATION TICK ---

  public update(
    timeNow: number,
    intervalSeconds: number,
    isBeat: boolean,
    beatSyncRotate: boolean,
    transitionType: TransitionType,
    isRandomTransition: boolean,
    transitionDuration: number
  ) {
    // Progress active transition
    if (this.isTransitioning) {
      const elapsed = (timeNow - this.transitionStartTime) / 1000;
      this.transitionProgress = Math.min(1.0, elapsed / this.transitionDuration);
      if (this.transitionProgress >= 1.0) {
        this.isTransitioning = false;
      }
    }

    // Determine target transition
    const pickTransition = (): TransitionType => {
      if (!isRandomTransition) return transitionType;
      const types: TransitionType[] = ['fade', 'zoom', 'slide', 'glitch', 'blur', 'dissolve'];
      return types[Math.floor(Math.random() * types.length)];
    };

    // Check automatic rotation
    if (beatSyncRotate) {
      if (isBeat) {
        this.beatCounter++;
        // Rotate every 16 or 32 beats
        if (this.beatCounter >= 32) {
          this.beatCounter = 0;
          this.next(pickTransition(), transitionDuration);
        }
      }
    } else {
      const elapsedSinceRotate = (timeNow - this.lastRotateTime) / 1000;
      if (elapsedSinceRotate >= intervalSeconds) {
        this.lastRotateTime = timeNow;
        this.next(pickTransition(), transitionDuration);
      }
    }
  }
}
