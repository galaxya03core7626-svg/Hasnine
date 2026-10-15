/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
} from 'recharts';
import { AudioAnalysis } from '../types/visualizer';
import { ThemeDefinition } from '../engine/ThemeManager';

interface FrequencySpectrumHUDProps {
  audioAnalysis: AudioAnalysis;
  themeDef: ThemeDefinition;
  compact?: boolean;
}

interface BandData {
  band: string;
  freq: string;
  value: number; // 0 - 100
  peak: number;
}

export const FrequencySpectrumHUD: React.FC<FrequencySpectrumHUDProps> = ({
  audioAnalysis,
  themeDef,
  compact = false,
}) => {
  // Sample 10 musical frequency bands from raw 1024 bin frequency data
  const data: BandData[] = useMemo(() => {
    const freq = audioAnalysis.frequency;
    const len = freq.length;

    // Helper to average frequency slice
    const getAvg = (startRatio: number, endRatio: number) => {
      const s = Math.floor(startRatio * len);
      const e = Math.min(len, Math.max(s + 1, Math.floor(endRatio * len)));
      let sum = 0;
      for (let i = s; i < e; i++) {
        sum += freq[i];
      }
      return Math.round((sum / ((e - s) * 255)) * 100);
    };

    return [
      { band: '30Hz', freq: 'Sub-Bass', value: getAvg(0.002, 0.008), peak: 100 },
      { band: '60Hz', freq: 'Kick', value: getAvg(0.008, 0.02), peak: 100 },
      { band: '120Hz', freq: 'Bass', value: getAvg(0.02, 0.04), peak: 100 },
      { band: '250Hz', freq: 'Warmth', value: getAvg(0.04, 0.08), peak: 100 },
      { band: '500Hz', freq: 'Low-Mid', value: getAvg(0.08, 0.15), peak: 100 },
      { band: '1kHz', freq: 'Mid', value: getAvg(0.15, 0.25), peak: 100 },
      { band: '2kHz', freq: 'Upper-Mid', value: getAvg(0.25, 0.4), peak: 100 },
      { band: '4kHz', freq: 'Presence', value: getAvg(0.4, 0.55), peak: 100 },
      { band: '8kHz', freq: 'Highs', value: getAvg(0.55, 0.75), peak: 100 },
      { band: '16kHz', freq: 'Air', value: getAvg(0.75, 0.95), peak: 100 },
    ];
  }, [audioAnalysis.frequency]);

  // Color interpolation between primary and secondary theme colors
  const primary = themeDef.colors.primary;
  const secondary = themeDef.colors.secondary;

  return (
    <div
      className={`w-full ${
        compact ? 'h-32' : 'h-48'
      } rounded-xl bg-black/40 backdrop-blur-md border border-white/10 p-2.5 flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between text-[11px] px-1 mb-1 font-mono tracking-wider text-white/70">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: primary }}
          />
          <span>Recharts Frequency Spectrum Analyzer</span>
        </span>
        <span className="text-white/40">Real-Time FFT (0–100%)</span>
      </div>

      <div className="w-full flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="band"
              stroke="rgba(255,255,255,0.3)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="rgba(255,255,255,0.2)"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              ticks={[25, 50, 75, 100]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as BandData;
                  return (
                    <div className="bg-zinc-900 border border-white/20 p-2 rounded shadow-xl text-xs font-mono">
                      <div className="font-bold text-white mb-0.5">
                        {d.freq} ({d.band})
                      </div>
                      <div style={{ color: primary }}>Magnitude: {d.value}%</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="value"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false} // Crucial for 60fps real-time audio!
            >
              {data.map((_, index) => {
                const ratio = index / (data.length - 1);
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={ratio < 0.5 ? primary : secondary}
                    fillOpacity={0.85}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
