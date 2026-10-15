/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { VisualizerConfig, AudioAnalysis } from '../types/visualizer';
import { ThemeDefinition } from '../engine/ThemeManager';

interface CleanScreenOverlayProps {
  config: VisualizerConfig;
  themeDef: ThemeDefinition;
  audioAnalysis: AudioAnalysis;
}

export const CleanScreenOverlay: React.FC<CleanScreenOverlayProps> = ({
  config,
  themeDef,
  audioAnalysis,
}) => {
  const { textOverlay } = config;

  // Position classes
  const positionClasses = {
    'top-center': 'top-8 md:top-12 left-1/2 -translate-x-1/2',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-center': 'bottom-16 md:bottom-20 left-1/2 -translate-x-1/2',
  }[textOverlay?.position || 'top-center'];

  // Calculate audio synchronization factor
  const syncValue = useMemo(() => {
    if (!textOverlay) return 0;
    const { syncTarget } = textOverlay;
    switch (syncTarget) {
      case 'beat':
        return audioAnalysis.beatStrength;
      case 'bass':
        return audioAnalysis.bass;
      case 'mid':
        return audioAnalysis.mid;
      case 'treble':
        return audioAnalysis.treble;
      case 'energy':
      default:
        return audioAnalysis.overallEnergy;
    }
  }, [textOverlay, audioAnalysis]);

  if (!textOverlay || !textOverlay.enabled || !textOverlay.title) {
    return null;
  }

  const reactivity = textOverlay.reactivity ?? 1.0;
  const animStyle = textOverlay.animationStyle || 'scale';
  const fontFam = textOverlay.fontFamily || themeDef.fontFamily;
  const textColor = textOverlay.color || '#ffffff';
  const glowColor = textOverlay.glowColor || themeDef.colors.primary;
  const fontSizePx = textOverlay.size || 42;

  // Dynamic transforms and effects based on animation style
  let dynamicTransform = '';
  let dynamicOpacity = 1.0;
  let dynamicTextShadow = 'none';
  let dynamicFilter = 'none';

  const baseGlow = textOverlay.glow
    ? `0 0 20px ${glowColor}aa, 0 0 40px ${glowColor}66`
    : 'none';

  switch (animStyle) {
    case 'scale': {
      const scaleMult = 1.0 + syncValue * 0.28 * reactivity;
      dynamicTransform = `scale(${scaleMult})`;
      dynamicTextShadow = textOverlay.glow
        ? `0 0 ${20 + syncValue * 30 * reactivity}px ${glowColor}`
        : 'none';
      break;
    }
    case 'bounce': {
      const bounceY = -syncValue * 24 * reactivity;
      const stretchY = 1.0 + syncValue * 0.12 * reactivity;
      dynamicTransform = `translateY(${bounceY}px) scaleY(${stretchY})`;
      dynamicTextShadow = baseGlow;
      break;
    }
    case 'glitch': {
      if (syncValue > 0.35) {
        const jitterX = (Math.random() - 0.5) * 14 * syncValue * reactivity;
        const jitterY = (Math.random() - 0.5) * 6 * syncValue * reactivity;
        dynamicTransform = `translate(${jitterX}px, ${jitterY}px)`;
        dynamicTextShadow = `${-3 * reactivity}px 0 #00f0ff, ${3 * reactivity}px 0 #ff007f, ${baseGlow}`;
      } else {
        dynamicTextShadow = baseGlow;
      }
      break;
    }
    case 'wave': {
      const timeMs = performance.now() * 0.004;
      const waveY = Math.sin(timeMs) * (8 + syncValue * 18 * reactivity);
      const waveRot = Math.cos(timeMs * 0.7) * (2 * syncValue * reactivity);
      dynamicTransform = `translateY(${waveY}px) rotate(${waveRot}deg)`;
      dynamicTextShadow = baseGlow;
      break;
    }
    case 'fade': {
      dynamicOpacity = Math.max(0.25, Math.min(1.0, 0.45 + syncValue * 0.55 * reactivity));
      dynamicTransform = `scale(${1.0 + syncValue * 0.08 * reactivity})`;
      dynamicTextShadow = baseGlow;
      break;
    }
    case 'shimmer': {
      const shimmerBrightness = 1.0 + syncValue * 0.9 * reactivity;
      dynamicFilter = `brightness(${shimmerBrightness}) drop-shadow(0 0 ${12 + syncValue * 25 * reactivity}px ${glowColor})`;
      dynamicTextShadow = `0 0 ${15 + syncValue * 35 * reactivity}px ${glowColor}`;
      dynamicTransform = `scale(${1.0 + syncValue * 0.05 * reactivity})`;
      break;
    }
  }

  return (
    <div
      className={`fixed ${positionClasses} z-20 pointer-events-none text-center select-none will-change-transform`}
      style={{
        fontFamily: fontFam,
        transform: dynamicTransform,
        opacity: dynamicOpacity,
        filter: dynamicFilter,
        transition: 'transform 0.06s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.1s ease',
      }}
    >
      <h1
        className="font-black uppercase tracking-[0.25em] drop-shadow-lg leading-tight"
        style={{
          fontSize: `${fontSizePx}px`,
          color: textColor,
          textShadow: dynamicTextShadow,
        }}
      >
        {textOverlay.title}
      </h1>

      {textOverlay.subtitle && (
        <p
          className="font-semibold uppercase tracking-[0.35em] mt-2 drop-shadow-md text-xs md:text-sm"
          style={{
            color: themeDef.colors.accent,
            opacity: 0.85,
          }}
        >
          {textOverlay.subtitle}
        </p>
      )}
    </div>
  );
};
