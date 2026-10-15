/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThemeType, ThemeColors } from '../types/visualizer';

export interface ThemeDefinition {
  id: ThemeType;
  name: string;
  tagline: string;
  colors: ThemeColors;
  particleStyle: 'points' | 'cross' | 'bokeh' | 'shard';
  glitchIntensity: number;
  bloomMultiplier: number;
  chromaticShift: number;
  fontFamily: string;
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

export class ThemeManager {
  private currentTheme: ThemeType = 'Cyberpunk';
  private allThemes: ThemeType[] = ['Cyberpunk', 'Vintage', 'Fantasy', 'Kinetic'];

  constructor(initialTheme: ThemeType = 'Cyberpunk') {
    this.currentTheme = initialTheme;
  }

  public getTheme(): ThemeType {
    return this.currentTheme;
  }

  public getThemeDef(): ThemeDefinition {
    return THEMES[this.currentTheme] || THEMES.Cyberpunk;
  }

  public setTheme(theme: ThemeType): ThemeDefinition {
    if (THEMES[theme]) {
      this.currentTheme = theme;
    }
    return this.getThemeDef();
  }

  public cycleNextTheme(): ThemeType {
    const idx = this.allThemes.indexOf(this.currentTheme);
    const nextIdx = (idx + 1) % this.allThemes.length;
    this.currentTheme = this.allThemes[nextIdx];
    return this.currentTheme;
  }

  public getRandomTheme(): ThemeType {
    const others = this.allThemes.filter((t) => t !== this.currentTheme);
    return others[Math.floor(Math.random() * others.length)];
  }

  public getAllThemes(): ThemeDefinition[] {
    return this.allThemes.map((t) => THEMES[t]);
  }
}
