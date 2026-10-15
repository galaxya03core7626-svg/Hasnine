/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThemeType, ThemeColors, CustomPalette } from '../types/visualizer';

export interface ThemeDefinition {
  id: ThemeType | string;
  name: string;
  tagline: string;
  colors: ThemeColors;
  particleStyle: 'points' | 'cross' | 'bokeh' | 'shard';
  glitchIntensity: number;
  bloomMultiplier: number;
  chromaticShift: number;
  fontFamily: string;
  isCustom?: boolean;
}

export const THEMES: Record<ThemeType, ThemeDefinition> = {
  Cyberpunk: {
    id: 'Cyberpunk',
    name: 'Cyberpunk',
    tagline: 'High-tech neon grid & chromatic glitch',
    colors: {
      primary: '#00f0ff',     // Electric Cyan
      secondary: '#ff007f',   // Hot Magenta
      accent: '#ffe600',      // Neon Yellow
      background: '#050713',  // Dark Obsidian
      gridColor: '#00f0ff33', // Cyan grid
      waveformColor: '#00f0ff',
      fontDisplay: "'Orbitron', sans-serif",
    },
    particleStyle: 'points',
    glitchIntensity: 1.2,
    bloomMultiplier: 1.3,
    chromaticShift: 0.008,
    fontFamily: "'Orbitron', sans-serif",
  },
  Vintage: {
    id: 'Vintage',
    name: 'Vintage',
    tagline: 'Sepia warmth, vinyl dust & analog warmth',
    colors: {
      primary: '#d97706',     // Amber Honey
      secondary: '#f59e0b',   // Golden Sun
      accent: '#fef3c7',      // Warm Cream
      background: '#140c08',  // Walnut Sepia
      gridColor: '#78350f33',
      waveformColor: '#f59e0b',
      fontDisplay: "'Playfair Display', serif",
    },
    particleStyle: 'bokeh',
    glitchIntensity: 0.2,
    bloomMultiplier: 0.8,
    chromaticShift: 0.002,
    fontFamily: "'Playfair Display', serif",
  },
  Fantasy: {
    id: 'Fantasy',
    name: 'Fantasy',
    tagline: 'Ethereal stardust, astral aurora & celestial gold',
    colors: {
      primary: '#c084fc',     // Amethyst Lilac
      secondary: '#fbbf24',   // Ethereal Gold
      accent: '#38bdf8',      // Astral Starlight
      background: '#0a0518',  // Cosmic Deep Violet
      gridColor: '#6b21a833',
      waveformColor: '#e879f9',
      fontDisplay: "'Playfair Display', serif",
    },
    particleStyle: 'cross',
    glitchIntensity: 0.0,
    bloomMultiplier: 1.4,
    chromaticShift: 0.003,
    fontFamily: "'Playfair Display', serif",
  },
  Kinetic: {
    id: 'Kinetic',
    name: 'Kinetic Typography',
    tagline: 'Modernist Swiss geometry & striking vermillion',
    colors: {
      primary: '#ef4444',     // Stark Vermillion
      secondary: '#ffffff',   // Pure White
      accent: '#a1a1aa',      // Cool Zinc
      background: '#08080a',  // Pure Jet Black
      gridColor: '#27272a44',
      waveformColor: '#ef4444',
      fontDisplay: "'Plus Jakarta Sans', sans-serif",
    },
    particleStyle: 'shard',
    glitchIntensity: 0.4,
    bloomMultiplier: 0.9,
    chromaticShift: 0.005,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
};

export const INITIAL_CUSTOM_PALETTES: CustomPalette[] = [
  {
    id: 'palette_emerald_matrix',
    name: 'Emerald Matrix',
    primary: '#10b981',
    secondary: '#84cc16',
    accent: '#a7f3d0',
    background: '#02180e',
    gridColor: '#10b98133',
    waveformColor: '#34d399',
  },
  {
    id: 'palette_sunset_synth',
    name: 'Sunset Synth',
    primary: '#f43f5e',
    secondary: '#8b5cf6',
    accent: '#fde047',
    background: '#13041a',
    gridColor: '#f43f5e33',
    waveformColor: '#fb7185',
  },
  {
    id: 'palette_deep_ocean',
    name: 'Deep Oceanic',
    primary: '#06b6d4',
    secondary: '#3b82f6',
    accent: '#38bdf8',
    background: '#030e1c',
    gridColor: '#0284c733',
    waveformColor: '#0ea5e9',
  },
];

const STORAGE_KEY = 'pulsewave_custom_palettes_v1';

export class ThemeManager {
  private currentThemeId: string = 'Cyberpunk';
  private allBuiltInThemes: ThemeType[] = ['Cyberpunk', 'Vintage', 'Fantasy', 'Kinetic'];
  private customPalettes: Map<string, CustomPalette> = new Map();

  constructor(initialTheme: ThemeType | string = 'Cyberpunk') {
    this.currentThemeId = initialTheme;
    this.loadCustomPalettes();
  }

  private loadCustomPalettes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CustomPalette[] = JSON.parse(stored);
        parsed.forEach((p) => this.customPalettes.set(p.id, p));
      } else {
        INITIAL_CUSTOM_PALETTES.forEach((p) => this.customPalettes.set(p.id, p));
        this.saveCustomPalettes();
      }
    } catch {
      INITIAL_CUSTOM_PALETTES.forEach((p) => this.customPalettes.set(p.id, p));
    }
  }

  private saveCustomPalettes() {
    try {
      const list = Array.from(this.customPalettes.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save custom palettes to localStorage', e);
    }
  }

  public getTheme(): string {
    return this.currentThemeId;
  }

  public getThemeDef(): ThemeDefinition {
    // 1. Check built-in themes
    if (THEMES[this.currentThemeId as ThemeType]) {
      return THEMES[this.currentThemeId as ThemeType];
    }

    // 2. Check custom palettes
    if (this.customPalettes.has(this.currentThemeId)) {
      const p = this.customPalettes.get(this.currentThemeId)!;
      return this.convertPaletteToThemeDef(p);
    }

    return THEMES.Cyberpunk;
  }

  public convertPaletteToThemeDef(p: CustomPalette): ThemeDefinition {
    return {
      id: p.id,
      name: p.name,
      tagline: 'User-created custom color aesthetic',
      colors: {
        primary: p.primary,
        secondary: p.secondary,
        accent: p.accent,
        background: p.background,
        gridColor: p.gridColor || `${p.primary}33`,
        waveformColor: p.waveformColor || p.primary,
        fontDisplay: "'Plus Jakarta Sans', sans-serif",
      },
      particleStyle: 'points',
      glitchIntensity: 0.8,
      bloomMultiplier: 1.1,
      chromaticShift: 0.005,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      isCustom: true,
    };
  }

  public setTheme(themeId: string): ThemeDefinition {
    this.currentThemeId = themeId;
    return this.getThemeDef();
  }

  public saveCustomPalette(p: CustomPalette): ThemeDefinition {
    this.customPalettes.set(p.id, p);
    this.saveCustomPalettes();
    return this.setTheme(p.id);
  }

  public deleteCustomPalette(id: string): void {
    if (this.customPalettes.has(id)) {
      this.customPalettes.delete(id);
      this.saveCustomPalettes();
      if (this.currentThemeId === id) {
        this.currentThemeId = 'Cyberpunk';
      }
    }
  }

  public getCustomPalettes(): CustomPalette[] {
    return Array.from(this.customPalettes.values());
  }

  public cycleNextTheme(): string {
    // Cycle across both built-in themes and saved custom palettes!
    const allIds: string[] = [
      ...this.allBuiltInThemes,
      ...Array.from(this.customPalettes.keys()),
    ];

    const curIdx = allIds.indexOf(this.currentThemeId);
    const nextIdx = (curIdx + 1) % allIds.length;
    this.currentThemeId = allIds[nextIdx];
    return this.currentThemeId;
  }

  public getRandomTheme(): string {
    const allIds: string[] = [
      ...this.allBuiltInThemes,
      ...Array.from(this.customPalettes.keys()),
    ];
    const others = allIds.filter((t) => t !== this.currentThemeId);
    return others[Math.floor(Math.random() * others.length)] || 'Cyberpunk';
  }

  public getAllThemes(): ThemeDefinition[] {
    const builtIns = this.allBuiltInThemes.map((t) => THEMES[t]);
    const customs = Array.from(this.customPalettes.values()).map((p) =>
      this.convertPaletteToThemeDef(p)
    );
    return [...builtIns, ...customs];
  }
}
