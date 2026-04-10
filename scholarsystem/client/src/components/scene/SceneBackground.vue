<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'

export type Biome =
  | 'crystal-cave'
  | 'alien-ruins'
  | 'space-station'
  | 'volcanic-surface'
  | 'frozen-tundra'
  | 'jungle-canopy'
  | 'deep-ocean'
  | 'desert-mesa'
  | 'floating-islands'
  | 'neon-city'

const props = defineProps<{ biome: Biome }>()

// ─── Biome configs ────────────────────────────────────────────────────────────

interface BiomeConfig {
  // Sky gradient: top → mid → bottom
  skyTop: string
  skyMid: string
  skyBot: string
  // Horizon glow
  horizonColor: string
  // Ground
  groundTop: string
  groundBot: string
  // Layers (SVG path strings in 0 0 1800 900 space, overflow for parallax)
  layer1: { path: string; fill: string; opacity: number }[]
  layer2: { path: string; fill: string; opacity: number }[]
  layer3: { path: string; fill: string; opacity: number }[]
  layer4: { path: string; fill: string; opacity: number }[]
  // Glows
  glows: { cx: number; cy: number; r: number; color: string; opacity: number; pulse: boolean }[]
  // Particles
  particle: { color: string; glow: string; type: 'mote' | 'ember' | 'snow' | 'bubble' | 'spore' | 'rain' | 'dust' }
}

const BIOMES: Record<Biome, BiomeConfig> = {
  'crystal-cave': {
    skyTop: '#0a0416',
    skyMid: '#0d0a2a',
    skyBot: '#091a1f',
    horizonColor: '#1affee',
    groundTop: '#040d10',
    groundBot: '#020608',
    layer1: [
      { path: 'M-100,900 L-100,540 L0,420 L120,530 L240,340 L360,480 L480,300 L600,440 L720,280 L840,400 L960,260 L1080,380 L1200,300 L1320,440 L1440,360 L1560,480 L1700,400 L1900,900 Z', fill: '#1a0a3a', opacity: 0.9 },
      { path: 'M-100,900 L-100,560 L60,460 L160,540 L280,400 L400,500 L520,380 L680,500 L820,360 L940,460 L1080,380 L1200,480 L1320,400 L1440,500 L1580,420 L1900,900 Z', fill: '#0f0525', opacity: 0.7 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,680 L0,600 L80,680 L180,580 L300,680 L400,580 L520,700 L640,580 L780,680 L900,560 L1040,680 L1160,580 L1300,700 L1420,600 L1560,700 L1700,620 L1900,900 Z', fill: '#12063a', opacity: 0.95 },
      // Tall crystal spires layer 2
      { path: 'M200,900 L200,500 L220,420 L240,500 L240,900 Z M500,900 L500,480 L525,380 L550,480 L550,900 Z M850,900 L850,520 L875,400 L900,520 L900,900 Z M1200,900 L1200,460 L1230,340 L1260,460 L1260,900 Z M1500,900 L1500,500 L1520,420 L1540,500 L1540,900 Z', fill: '#1affee', opacity: 0.12 },
    ],
    layer3: [
      { path: 'M-100,760 L-100,900 L1900,900 L1900,760 Q950,720 -100,760 Z', fill: '#040d10', opacity: 1 },
      { path: 'M-100,760 Q950,740 1900,760 L1900,780 Q950,760 -100,780 Z', fill: '#1affee', opacity: 0.06 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,700 L0,620 L60,700 L60,900 Z', fill: '#0e0630', opacity: 0.95 },
      { path: 'M120,900 L120,640 L160,540 L200,640 L200,900 Z', fill: '#1affee', opacity: 0.08 },
      { path: 'M1540,900 L1540,660 L1590,550 L1640,660 L1640,900 Z', fill: '#0e0630', opacity: 0.95 },
      { path: 'M1660,900 L1660,700 L1700,620 L1740,700 L1740,900 Z', fill: '#1affee', opacity: 0.08 },
    ],
    glows: [
      { cx: 900, cy: 760, r: 280, color: '#1affee', opacity: 0.04, pulse: true },
      { cx: 480, cy: 580, r: 60, color: '#a06aff', opacity: 0.25, pulse: true },
      { cx: 1200, cy: 540, r: 80, color: '#1affee', opacity: 0.2, pulse: true },
    ],
    particle: { color: '#1affee', glow: '#a0ffee', type: 'mote' },
  },

  'alien-ruins': {
    skyTop: '#0d0600',
    skyMid: '#1a0e00',
    skyBot: '#2a1800',
    horizonColor: '#ff8c42',
    groundTop: '#1a0e00',
    groundBot: '#0a0600',
    layer1: [
      { path: 'M-100,900 L-100,480 L100,460 L200,380 L300,440 L500,340 L700,420 L900,300 L1100,380 L1300,340 L1500,400 L1700,360 L1900,900 Z', fill: '#1a0800', opacity: 0.9 },
      // Distant arch silhouette
      { path: 'M760,900 L760,320 Q760,260 800,260 L840,260 Q880,260 900,280 L920,260 L960,260 Q1000,260 1000,320 L1000,900 Z M800,400 Q800,340 840,330 Q880,340 880,400 L880,600 L800,600 Z', fill: '#120700', opacity: 0.95 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,640 L80,600 L200,640 L320,560 L440,640 L560,600 L680,660 L800,580 L920,660 L1040,600 L1160,660 L1280,580 L1400,640 L1520,600 L1700,660 L1900,900 Z', fill: '#1a0c00', opacity: 0.92 },
      // Column pillars
      { path: 'M300,900 L300,540 L340,540 L340,900 Z M350,540 L300,540 L320,520 Z M700,900 L700,560 L740,560 L740,900 Z M750,560 L700,560 L720,538 Z M1100,900 L1100,520 L1140,520 L1140,900 Z M1150,520 L1100,520 L1120,498 Z', fill: '#2a1400', opacity: 0.95 },
    ],
    layer3: [
      { path: 'M-100,720 L-100,900 L1900,900 L1900,720 Q950,680 -100,720 Z', fill: '#120900', opacity: 1 },
      { path: 'M-100,720 Q950,700 1900,720 L1900,740 Q950,718 -100,740 Z', fill: '#ff8c42', opacity: 0.05 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,680 L0,640 L40,640 L40,900 Z', fill: '#1a0800', opacity: 1 },
      { path: 'M1700,900 L1700,660 L1740,640 L1780,640 L1780,900 Z', fill: '#1a0800', opacity: 1 },
      // Foreground broken column
      { path: 'M1400,900 L1400,700 L1440,700 L1440,900 Z M1400,700 L1440,700 L1420,680 Z', fill: '#2a1200', opacity: 0.95 },
    ],
    glows: [
      { cx: 900, cy: 720, r: 400, color: '#ff8c42', opacity: 0.04, pulse: false },
      { cx: 830, cy: 430, r: 30, color: '#ffaa60', opacity: 0.15, pulse: true },
    ],
    particle: { color: '#c86020', glow: '#ff9040', type: 'dust' },
  },

  'space-station': {
    skyTop: '#010408',
    skyMid: '#020810',
    skyBot: '#030c18',
    horizonColor: '#2a6aff',
    groundTop: '#060c14',
    groundBot: '#020408',
    layer1: [
      { path: 'M-100,900 L-100,400 L200,380 L300,320 L500,360 L700,280 L900,340 L1100,280 L1300,320 L1500,360 L1700,300 L1900,900 Z', fill: '#050c1a', opacity: 0.9 },
      // Circular ring station distant
      { path: 'M700,400 A100,30 0 1 0 1100,400 A100,30 0 1 0 700,400 Z', fill: 'none', opacity: 0 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,600 L100,560 L200,580 L300,540 L500,580 L700,540 L900,580 L1100,540 L1300,580 L1500,540 L1700,580 L1900,900 Z', fill: '#040a14', opacity: 0.92 },
      // Corridor rings
      { path: 'M500,580 A180,40 0 1 0 860,580 A180,40 0 1 0 500,580 Z M940,580 A180,40 0 1 0 1300,580 A180,40 0 1 0 940,580 Z', fill: 'none', opacity: 0 },
      // Panel lines
      { path: 'M0,620 L1800,620 M0,660 L1800,660 M0,700 L1800,700', fill: 'none', opacity: 0 },
    ],
    layer3: [
      { path: 'M-100,700 L-100,900 L1900,900 L1900,700 Q950,680 -100,700 Z', fill: '#030810', opacity: 1 },
      // Metal grating horizontal lines
      { path: 'M-100,710 L1900,710 M-100,730 L1900,730 M-100,750 L1900,750', fill: '#0a1828', opacity: 0.6 },
      { path: 'M0,700 L0,900 M100,700 L100,900 M200,700 L200,900 M300,700 L300,900 M400,700 L400,900 M500,700 L500,900 M600,700 L600,900 M700,700 L700,900 M800,700 L800,900 M900,700 L900,900 M1000,700 L1000,900 M1100,700 L1100,900 M1200,700 L1200,900 M1300,700 L1300,900 M1400,700 L1400,900 M1500,700 L1500,900 M1600,700 L1600,900 M1700,700 L1700,900', fill: '#0a1828', opacity: 0.3 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,640 L0,620 L80,640 L80,900 Z M1720,900 L1720,640 L1800,620 L1900,640 L1900,900 Z', fill: '#030a18', opacity: 1 },
      // Warning light bar
      { path: 'M0,596 L400,596 L400,606 L0,606 Z', fill: '#ff4040', opacity: 0.6 },
      { path: 'M1400,596 L1800,596 L1800,606 L1400,606 Z', fill: '#2a6aff', opacity: 0.6 },
    ],
    glows: [
      { cx: 200, cy: 601, r: 40, color: '#ff4040', opacity: 0.3, pulse: true },
      { cx: 1600, cy: 601, r: 40, color: '#2a6aff', opacity: 0.3, pulse: true },
      { cx: 900, cy: 700, r: 600, color: '#0a2a6a', opacity: 0.08, pulse: false },
    ],
    particle: { color: '#2a6aff', glow: '#6aaaff', type: 'mote' },
  },

  'volcanic-surface': {
    skyTop: '#050000',
    skyMid: '#1a0400',
    skyBot: '#2a0800',
    horizonColor: '#ff4400',
    groundTop: '#0d0200',
    groundBot: '#050000',
    layer1: [
      { path: 'M-100,900 L-100,400 L100,360 L200,420 L400,300 L600,380 L800,260 L900,340 L1000,260 L1200,340 L1400,280 L1600,360 L1900,900 Z', fill: '#0f0200', opacity: 0.95 },
      // Distant volcano peak
      { path: 'M750,900 L750,200 L850,120 L950,200 L950,900 Z', fill: '#0a0100', opacity: 0.9 },
      { path: 'M820,200 L850,120 L880,200 Q870,190 850,185 Q830,190 820,200 Z', fill: '#ff3300', opacity: 0.4 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,620 L100,580 L250,640 L400,560 L550,640 L700,580 L850,660 L1000,580 L1150,640 L1300,560 L1450,640 L1600,580 L1900,900 Z', fill: '#120300', opacity: 0.95 },
    ],
    layer3: [
      { path: 'M-100,700 L-100,900 L1900,900 L1900,700 Q950,660 -100,700 Z', fill: '#0a0100', opacity: 1 },
      // Lava cracks
      { path: 'M100,720 Q200,710 300,730 Q400,720 500,740 M600,750 Q700,740 800,760 Q900,748 1000,768 M1100,740 Q1200,730 1300,750 Q1400,738 1500,755', fill: 'none', opacity: 0 },
      { path: 'M80,718 Q200,706 320,726 L310,732 Q200,712 90,724 Z M580,748 Q700,737 820,758 L810,764 Q700,743 570,754 Z M1080,738 Q1200,727 1320,747 L1310,753 Q1200,733 1090,744 Z', fill: '#ff4400', opacity: 0.5 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,680 L80,640 L120,680 L120,900 Z M1680,900 L1680,660 L1720,640 L1900,680 L1900,900 Z', fill: '#0d0200', opacity: 1 },
      { path: 'M1200,900 L1200,680 L1260,620 L1320,680 L1320,900 Z', fill: '#0d0200', opacity: 1 },
    ],
    glows: [
      { cx: 900, cy: 700, r: 600, color: '#ff3300', opacity: 0.05, pulse: false },
      { cx: 850, cy: 180, r: 80, color: '#ff6600', opacity: 0.3, pulse: true },
      { cx: 200, cy: 722, r: 30, color: '#ff4400', opacity: 0.5, pulse: true },
      { cx: 700, cy: 752, r: 25, color: '#ff4400', opacity: 0.45, pulse: true },
    ],
    particle: { color: '#ff4400', glow: '#ff8800', type: 'ember' },
  },

  'frozen-tundra': {
    skyTop: '#010810',
    skyMid: '#030f1a',
    skyBot: '#071828',
    horizonColor: '#88ccff',
    groundTop: '#0a1a28',
    groundBot: '#050d16',
    layer1: [
      { path: 'M-100,900 L-100,440 L0,400 L200,360 L400,320 L600,300 L800,280 L1000,300 L1200,280 L1400,320 L1600,360 L1900,900 Z', fill: '#0a1220', opacity: 0.9 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,620 Q0,580 200,600 Q400,560 600,580 Q800,540 1000,570 Q1200,540 1400,570 Q1600,548 1900,580 L1900,900 Z', fill: '#0d1a2c', opacity: 0.9 },
      // Ice crystal formations
      { path: 'M300,620 L320,500 L330,520 L340,480 L350,520 L360,500 L380,620 Z M900,600 L920,480 L930,510 L940,460 L950,510 L960,480 L980,600 Z M1400,610 L1420,500 L1430,530 L1440,490 L1450,530 L1460,500 L1480,610 Z', fill: '#aaddff', opacity: 0.12 },
    ],
    layer3: [
      { path: 'M-100,700 L-100,900 L1900,900 L1900,700 Q1400,660 900,670 Q400,660 -100,700 Z', fill: '#0a1828', opacity: 1 },
      // Snow surface highlight
      { path: 'M-100,700 Q400,685 900,692 Q1400,684 1900,700 L1900,712 Q1400,698 900,706 Q400,698 -100,714 Z', fill: '#aaddff', opacity: 0.08 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,680 Q0,660 80,680 L80,900 Z M1720,900 L1720,680 Q1800,660 1900,680 L1900,900 Z', fill: '#0c1a28', opacity: 1 },
    ],
    glows: [
      { cx: 900, cy: 320, r: 300, color: '#4488ff', opacity: 0.06, pulse: true },
      { cx: 330, cy: 540, r: 50, color: '#88ccff', opacity: 0.2, pulse: true },
      { cx: 940, cy: 510, r: 50, color: '#88ccff', opacity: 0.18, pulse: true },
    ],
    particle: { color: '#aaddff', glow: '#ddeeff', type: 'snow' },
  },

  'jungle-canopy': {
    skyTop: '#010a02',
    skyMid: '#020f03',
    skyBot: '#041404',
    horizonColor: '#44ff88',
    groundTop: '#041004',
    groundBot: '#020802',
    layer1: [
      { path: 'M-100,900 L-100,300 Q200,220 400,280 Q600,180 800,240 Q1000,160 1200,220 Q1400,180 1600,260 L1900,900 Z', fill: '#061006', opacity: 0.9 },
      // Canopy leaf shapes distant
      { path: 'M0,300 Q100,240 200,280 Q150,260 200,240 Q250,200 300,240 Q250,240 300,280 Q350,240 400,200 Q350,220 400,260', fill: '#0a1a0a', opacity: 0.7 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,560 Q100,500 300,540 Q500,480 700,520 Q900,480 1100,520 Q1300,490 1500,520 L1900,900 Z', fill: '#071407', opacity: 0.95 },
      // Large alien leaf shapes
      { path: 'M100,560 Q200,480 300,520 Q200,500 300,480 Q350,440 400,480 Q350,490 400,520 Z', fill: '#0d200d', opacity: 0.8 },
      { path: 'M800,520 Q900,440 1000,480 Q900,460 1000,440 Q1050,400 1100,440 Q1050,450 1100,480 Z', fill: '#0d200d', opacity: 0.8 },
    ],
    layer3: [
      { path: 'M-100,720 L-100,900 L1900,900 L1900,720 Q950,690 -100,720 Z', fill: '#050e05', opacity: 1 },
      { path: 'M-100,720 Q950,704 1900,720 L1900,735 Q950,718 -100,735 Z', fill: '#44ff88', opacity: 0.04 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,680 Q0,640 60,680 L60,900 Z M1740,900 L1740,680 Q1800,640 1900,680 L1900,900 Z', fill: '#060e06', opacity: 1 },
      // Foreground leaf
      { path: 'M-100,800 Q0,700 100,780 Q50,760 100,800 Z M1700,780 Q1800,700 1900,800 Q1800,790 1900,800 Z', fill: '#0f200f', opacity: 0.9 },
    ],
    glows: [
      { cx: 900, cy: 720, r: 500, color: '#22aa44', opacity: 0.04, pulse: false },
      { cx: 400, cy: 500, r: 40, color: '#44ff88', opacity: 0.15, pulse: true },
      { cx: 1100, cy: 480, r: 35, color: '#44ff88', opacity: 0.12, pulse: true },
    ],
    particle: { color: '#44ff88', glow: '#aaffcc', type: 'spore' },
  },

  'deep-ocean': {
    skyTop: '#000408',
    skyMid: '#00080e',
    skyBot: '#000c14',
    horizonColor: '#0088ff',
    groundTop: '#000a12',
    groundBot: '#000408',
    layer1: [
      { path: 'M-100,900 L-100,420 Q200,380 400,420 Q600,360 800,400 Q1000,360 1200,400 Q1400,380 1600,420 L1900,900 Z', fill: '#000810', opacity: 0.9 },
    ],
    layer2: [
      { path: 'M-100,900 L-100,600 Q100,560 300,580 Q500,540 700,560 Q900,520 1100,550 Q1300,530 1500,560 L1900,900 Z', fill: '#000c18', opacity: 0.92 },
      // Coral formations
      { path: 'M200,600 L200,500 Q220,480 240,500 Q230,490 240,600 Z M210,540 Q220,520 240,530 Q225,535 240,540 Z M450,580 L450,470 Q470,450 490,470 Q480,460 490,580 Z M460,520 Q470,500 490,510 Q477,515 490,520 Z M1100,560 L1100,450 Q1120,430 1140,450 Q1130,440 1140,560 Z M1110,500 Q1120,480 1140,490 Q1127,495 1140,500 Z', fill: '#004466', opacity: 0.7 },
    ],
    layer3: [
      { path: 'M-100,720 L-100,900 L1900,900 L1900,720 Q950,695 -100,720 Z', fill: '#000810', opacity: 1 },
      { path: 'M-100,720 Q950,705 1900,720 L1900,734 Q950,718 -100,734 Z', fill: '#0088ff', opacity: 0.04 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,700 Q0,680 60,700 L60,900 Z M1740,900 L1740,700 Q1800,680 1900,700 L1900,900 Z', fill: '#000a14', opacity: 1 },
    ],
    glows: [
      { cx: 240, cy: 540, r: 50, color: '#00aaff', opacity: 0.2, pulse: true },
      { cx: 480, cy: 520, r: 40, color: '#0088ff', opacity: 0.18, pulse: true },
      { cx: 1130, cy: 500, r: 45, color: '#00ccff', opacity: 0.2, pulse: true },
      { cx: 900, cy: 720, r: 600, color: '#003366', opacity: 0.06, pulse: false },
    ],
    particle: { color: '#0088ff', glow: '#44ccff', type: 'bubble' },
  },

  'desert-mesa': {
    skyTop: '#0a0402',
    skyMid: '#160a02',
    skyBot: '#200e02',
    horizonColor: '#ff9a44',
    groundTop: '#1a0c02',
    groundBot: '#0c0600',
    layer1: [
      // Distant mesa silhouettes flat-topped
      { path: 'M-100,900 L-100,420 L0,420 L0,360 L200,360 L200,420 L300,420 L300,340 L500,340 L500,420 L600,420 L600,360 L700,360 L700,300 L900,300 L900,360 L1000,360 L1000,280 L1200,280 L1200,360 L1300,360 L1300,340 L1500,340 L1500,400 L1600,400 L1600,380 L1900,380 L1900,900 Z', fill: '#120600', opacity: 0.92 },
    ],
    layer2: [
      // Closer mesa walls
      { path: 'M-100,900 L-100,560 L0,560 L0,500 L300,500 L300,560 L400,560 L400,520 L700,520 L700,560 L800,560 L800,500 L1100,500 L1100,560 L1200,560 L1200,520 L1500,520 L1500,560 L1600,560 L1600,520 L1900,520 L1900,900 Z', fill: '#1a0a00', opacity: 0.95 },
    ],
    layer3: [
      { path: 'M-100,700 L-100,900 L1900,900 L1900,700 Q950,670 -100,700 Z', fill: '#140800', opacity: 1 },
      // Sand ripple lines
      { path: 'M0,720 Q450,710 900,718 Q1350,710 1800,720 M0,740 Q450,730 900,738 Q1350,730 1800,740', fill: 'none', opacity: 0 },
      { path: 'M-100,718 Q450,707 900,715 Q1350,708 1900,718 L1900,723 Q1350,713 900,720 Q450,712 -100,723 Z M-100,738 Q450,727 900,735 Q1350,728 1900,738 L1900,743 Q1350,733 900,740 Q450,732 -100,743 Z', fill: '#ff9a44', opacity: 0.04 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,680 L80,640 L80,900 Z M1720,900 L1720,640 L1900,680 L1900,900 Z', fill: '#1a0a00', opacity: 1 },
    ],
    glows: [
      { cx: 900, cy: 700, r: 700, color: '#ff6600', opacity: 0.04, pulse: false },
      { cx: 900, cy: 360, r: 200, color: '#ff9a44', opacity: 0.06, pulse: false },
    ],
    particle: { color: '#c86020', glow: '#ff9a44', type: 'dust' },
  },

  'floating-islands': {
    skyTop: '#020810',
    skyMid: '#040e1c',
    skyBot: '#061428',
    horizonColor: '#aaccff',
    groundTop: '#0a1828',
    groundBot: '#040c18',
    layer1: [
      // Distant floating island silhouettes
      { path: 'M100,380 Q200,340 300,360 Q250,360 300,380 Q350,400 200,400 Q100,400 100,380 Z M900,300 Q1000,260 1100,280 Q1050,280 1100,300 Q1150,320 1000,320 Q900,320 900,300 Z M1400,360 Q1500,320 1600,340 Q1550,340 1600,360 Q1650,380 1500,380 Q1400,380 1400,360 Z', fill: '#0a1428', opacity: 0.85 },
      // Distant clouds/wisps
      { path: 'M0,260 Q100,240 200,260 Q150,252 200,268 Q100,268 0,260 Z M1200,220 Q1300,200 1400,220 Q1350,212 1400,228 Q1300,228 1200,220 Z', fill: '#0e1e38', opacity: 0.5 },
    ],
    layer2: [
      // Main floating island platform
      { path: 'M300,560 Q500,520 700,540 Q700,540 700,560 Q700,600 500,620 Q300,600 300,560 Z', fill: '#0c1828', opacity: 0.95 },
      { path: 'M900,520 Q1100,480 1300,500 Q1300,500 1300,520 Q1300,560 1100,580 Q900,560 900,520 Z', fill: '#0c1828', opacity: 0.95 },
      // Waterfalls from islands
      { path: 'M480,620 Q485,680 490,740 Q488,680 486,620 Z M1100,580 Q1105,640 1110,700 Q1108,640 1106,580 Z', fill: '#aaccff', opacity: 0.15 },
    ],
    layer3: [
      { path: 'M-100,740 L-100,900 L1900,900 L1900,740 Q950,720 -100,740 Z', fill: '#060e1c', opacity: 1 },
      // Cloud wisps at mid level
      { path: 'M-100,640 Q100,620 300,640 Q200,630 300,648 Q100,648 -100,640 Z M900,600 Q1100,580 1300,600 Q1200,590 1300,608 Q1100,608 900,600 Z', fill: '#0e1e36', opacity: 0.6 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,760 Q0,740 80,760 L80,900 Z M1720,900 L1720,760 Q1800,740 1900,760 L1900,900 Z', fill: '#080e1c', opacity: 1 },
    ],
    glows: [
      { cx: 500, cy: 560, r: 120, color: '#4488ff', opacity: 0.06, pulse: false },
      { cx: 1100, cy: 520, r: 120, color: '#4488ff', opacity: 0.06, pulse: false },
      { cx: 487, cy: 680, r: 15, color: '#aaccff', opacity: 0.3, pulse: true },
      { cx: 1107, cy: 640, r: 15, color: '#aaccff', opacity: 0.3, pulse: true },
    ],
    particle: { color: '#aaccff', glow: '#ddeeff', type: 'mote' },
  },

  'neon-city': {
    skyTop: '#010006',
    skyMid: '#020008',
    skyBot: '#03000a',
    horizonColor: '#ff00aa',
    groundTop: '#050008',
    groundBot: '#020004',
    layer1: [
      // Distant building silhouettes
      { path: 'M-100,900 L-100,320 L0,320 L0,280 L100,280 L100,240 L200,240 L200,200 L280,200 L280,160 L380,160 L380,200 L440,200 L440,180 L520,180 L520,220 L600,220 L600,180 L700,180 L700,140 L800,140 L800,180 L880,180 L880,160 L960,160 L960,200 L1040,200 L1040,180 L1120,180 L1120,140 L1200,140 L1200,160 L1280,160 L1280,180 L1360,180 L1360,200 L1440,200 L1440,160 L1520,160 L1520,200 L1600,200 L1600,220 L1700,220 L1700,280 L1800,280 L1800,320 L1900,320 L1900,900 Z', fill: '#04000a', opacity: 0.95 },
    ],
    layer2: [
      // Mid buildings with neon accent edges
      { path: 'M-100,900 L-100,500 L0,500 L0,460 L120,460 L120,420 L240,420 L240,460 L360,460 L360,440 L480,440 L480,480 L600,480 L600,440 L720,440 L720,400 L840,400 L840,440 L960,440 L960,420 L1080,420 L1080,460 L1200,460 L1200,420 L1320,420 L1320,460 L1440,460 L1440,480 L1560,480 L1560,440 L1680,440 L1680,500 L1900,500 L1900,900 Z', fill: '#06000c', opacity: 0.95 },
      // Neon window lights
      { path: 'M130,440 L160,440 L160,450 L130,450 Z M170,428 L200,428 L200,438 L170,438 Z M250,432 L270,432 L270,442 L250,442 Z M730,412 L760,412 L760,422 L730,422 Z M850,412 L880,412 L880,422 L850,422 Z M1090,432 L1120,432 L1120,442 L1090,442 Z M1330,432 L1360,432 L1360,442 L1330,442 Z', fill: '#ff00aa', opacity: 0.7 },
      { path: 'M600,452 L630,452 L630,462 L600,462 Z M960,432 L990,432 L990,442 L960,442 Z M490,452 L510,452 L510,462 L490,462 Z M1210,432 L1240,432 L1240,442 L1210,442 Z', fill: '#00ffff', opacity: 0.6 },
    ],
    layer3: [
      { path: 'M-100,700 L-100,900 L1900,900 L1900,700 Q950,675 -100,700 Z', fill: '#040008', opacity: 1 },
      // Puddle reflections (horizontal neon streaks)
      { path: 'M100,720 Q200,716 300,722 L300,726 Q200,720 100,724 Z M500,730 Q600,726 700,732 L700,736 Q600,730 500,734 Z M800,718 Q950,713 1100,720 L1100,724 Q950,717 800,722 Z M1200,728 Q1350,723 1500,730 L1500,734 Q1350,727 1200,732 Z', fill: '#ff00aa', opacity: 0.2 },
      { path: 'M300,740 Q400,736 500,742 L500,746 Q400,740 300,744 Z M700,735 Q800,730 900,736 L900,740 Q800,734 700,739 Z M1100,745 Q1200,740 1300,746 L1300,750 Q1200,744 1100,749 Z', fill: '#00ffff', opacity: 0.15 },
    ],
    layer4: [
      { path: 'M-100,900 L-100,660 L0,640 L80,660 L80,900 Z M1720,900 L1720,660 L1800,640 L1900,660 L1900,900 Z', fill: '#040008', opacity: 1 },
      // Foreground neon sign bar
      { path: 'M200,640 L400,640 L400,650 L200,650 Z', fill: '#ff00aa', opacity: 0.8 },
      { path: 'M1400,640 L1600,640 L1600,650 L1400,650 Z', fill: '#00ffff', opacity: 0.8 },
    ],
    glows: [
      { cx: 265, cy: 645, r: 60, color: '#ff00aa', opacity: 0.35, pulse: true },
      { cx: 1500, cy: 645, r: 60, color: '#00ffff', opacity: 0.3, pulse: true },
      { cx: 900, cy: 700, r: 800, color: '#220033', opacity: 0.15, pulse: false },
      { cx: 740, cy: 418, r: 20, color: '#ff00aa', opacity: 0.4, pulse: false },
      { cx: 850, cy: 418, r: 20, color: '#00ffff', opacity: 0.4, pulse: false },
    ],
    particle: { color: '#aaaacc', glow: '#ccccee', type: 'rain' },
  },
}

// ─── Parallax ─────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null)
// Parallax multipliers per layer (fraction of pointer offset)
const PARALLAX = [0, 0.008, 0.02, 0, 0.04, 0.07]
const px = ref([0, 0, 0, 0, 0, 0])

let pointer = { x: 0, targetX: 0 }
let rafId: number | null = null

function onPointerMove(e: PointerEvent) {
  const cx = window.innerWidth / 2
  pointer.targetX = (e.clientX - cx) / cx // -1 to 1
}

function tick() {
  pointer.x += (pointer.targetX - pointer.x) * 0.06
  const w = window.innerWidth
  for (let i = 0; i < 6; i++) {
    px.value[i] = pointer.x * w * PARALLAX[i]
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// ─── Particles ────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 18
const particles = computed(() => {
  const cfg = BIOMES[props.biome]
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const seed = i * 137.508 + props.biome.charCodeAt(0) * 17
    const pseudo = (n: number) => Math.abs(Math.sin(seed + n * 91.3))
    return {
      id: i,
      x: pseudo(1) * 100,
      y: pseudo(2) * 80 + 10,
      size: pseudo(3) * 3 + 1,
      delay: pseudo(4) * 8,
      duration: pseudo(5) * 6 + 4,
      opacity: pseudo(6) * 0.5 + 0.2,
      color: cfg.particle.color,
      glow: cfg.particle.glow,
      type: cfg.particle.type,
    }
  })
})

const config = computed(() => BIOMES[props.biome])
</script>

<template>
  <div ref="containerRef" class="scene-bg" aria-hidden="true">
    <!-- ─── Main SVG layers ──────────────────────────────────────────────── -->
    <svg
      class="bg-svg"
      viewBox="-100 0 1800 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- Sky gradient -->
        <linearGradient id="bg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="config.skyTop" />
          <stop offset="50%" :stop-color="config.skyMid" />
          <stop offset="100%" :stop-color="config.skyBot" />
        </linearGradient>

        <!-- Horizon glow gradient -->
        <radialGradient id="bg-horizon" cx="50%" cy="100%" r="60%">
          <stop offset="0%" :stop-color="config.horizonColor" stop-opacity="0.18" />
          <stop offset="100%" :stop-color="config.horizonColor" stop-opacity="0" />
        </radialGradient>

        <!-- Ground gradient -->
        <linearGradient id="bg-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="config.groundTop" />
          <stop offset="100%" :stop-color="config.groundBot" />
        </linearGradient>

        <!-- Per-glow radial gradients -->
        <radialGradient
          v-for="(g, i) in config.glows"
          :id="`glow-${i}`"
          :key="`glow-grad-${i}`"
          cx="50%" cy="50%" r="50%"
        >
          <stop offset="0%" :stop-color="g.color" :stop-opacity="g.opacity" />
          <stop offset="100%" :stop-color="g.color" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Layer 0: Sky (no parallax) -->
      <rect x="-100" y="0" width="1800" height="900" fill="url(#bg-sky)" />
      <rect x="-100" y="0" width="1800" height="900" fill="url(#bg-horizon)" />

      <!-- Glow spots -->
      <g class="layer-glows">
        <ellipse
          v-for="(g, i) in config.glows"
          :key="`glow-${i}`"
          :cx="g.cx"
          :cy="g.cy"
          :rx="g.r"
          :ry="g.r * 0.6"
          :fill="`url(#glow-${i})`"
          :class="g.pulse ? 'glow-pulse' : ''"
          :style="g.pulse ? `animation-delay: ${i * 1.3}s` : ''"
        />
      </g>

      <!-- Layer 1: Distant silhouettes (slowest parallax) -->
      <g :transform="`translate(${px[1]}, 0)`" class="layer-1">
        <path
          v-for="(item, i) in config.layer1"
          :key="`l1-${i}`"
          :d="item.path"
          :fill="item.fill"
          :opacity="item.opacity"
        />
      </g>

      <!-- Layer 2: Midground (medium parallax) -->
      <g :transform="`translate(${px[2]}, 0)`" class="layer-2">
        <path
          v-for="(item, i) in config.layer2"
          :key="`l2-${i}`"
          :d="item.path"
          :fill="item.fill"
          :opacity="item.opacity"
        />
      </g>

      <!-- Layer 3: Ground plane (no parallax, anchored) -->
      <g class="layer-3">
        <rect x="-100" y="0" width="1800" height="900" fill="url(#bg-ground)" opacity="0" />
        <path
          v-for="(item, i) in config.layer3"
          :key="`l3-${i}`"
          :d="item.path"
          :fill="item.fill"
          :opacity="item.opacity"
        />
      </g>

      <!-- Layer 4: Near foreground elements (strong parallax) -->
      <g :transform="`translate(${px[4]}, 0)`" class="layer-4">
        <path
          v-for="(item, i) in config.layer4"
          :key="`l4-${i}`"
          :d="item.path"
          :fill="item.fill"
          :opacity="item.opacity"
        />
      </g>
    </svg>

    <!-- ─── Particle layer (CSS-animated) ──────────────────────────────── -->
    <div class="particles" :class="`particles--${config.particle.type}`">
      <span
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="{
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: `${p.size}px`,
          height: p.type === 'rain' ? `${p.size * 8}px` : `${p.size}px`,
          opacity: p.opacity,
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.glow}`,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
        }"
      />
    </div>

    <!-- ─── Vignette overlay ─────────────────────────────────────────────── -->
    <div class="vignette" />
  </div>
</template>

<style scoped>
.scene-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.bg-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ─── Glow animations ─────────────────────────────────────────────────── */
.glow-pulse {
  animation: glow-breathe 4s ease-in-out infinite alternate;
}
@keyframes glow-breathe {
  from { opacity: 0.6; transform: scale(0.95); }
  to   { opacity: 1;   transform: scale(1.05); }
}

/* ─── Particles ───────────────────────────────────────────────────────── */
.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, opacity;
}

/* Mote: float up and fade */
.particles--mote .particle {
  border-radius: 50%;
  animation: particle-mote linear infinite;
}
@keyframes particle-mote {
  0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(-120px) translateX(20px) scale(0.3); opacity: 0; }
}

/* Ember: drift up with horizontal wobble */
.particles--ember .particle {
  border-radius: 50%;
  animation: particle-ember ease-in-out infinite;
}
@keyframes particle-ember {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  15%  { opacity: 1; }
  50%  { transform: translateY(-80px) translateX(15px); }
  85%  { opacity: 0.8; }
  100% { transform: translateY(-180px) translateX(-10px); opacity: 0; }
}

/* Snow: fall and drift */
.particles--snow .particle {
  border-radius: 50%;
  animation: particle-snow linear infinite;
}
@keyframes particle-snow {
  0%   { transform: translateY(-20px) translateX(0); opacity: 0; }
  10%  { opacity: 0.8; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(120px) translateX(30px); opacity: 0; }
}

/* Bubble: rise slowly */
.particles--bubble .particle {
  border-radius: 50%;
  border: 1px solid currentColor;
  background: transparent !important;
  animation: particle-bubble ease-in infinite;
}
@keyframes particle-bubble {
  0%   { transform: translateY(0) scale(0.5); opacity: 0; }
  20%  { opacity: 0.7; transform: translateY(-20px) scale(1); }
  100% { transform: translateY(-200px) scale(1.2); opacity: 0; }
}

/* Spore: slow float + gentle spin */
.particles--spore .particle {
  border-radius: 50%;
  animation: particle-spore ease-in-out infinite;
}
@keyframes particle-spore {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  15%  { opacity: 0.9; }
  50%  { transform: translateY(-60px) translateX(20px) rotate(180deg); }
  85%  { opacity: 0.7; }
  100% { transform: translateY(-130px) translateX(-10px) rotate(360deg); opacity: 0; }
}

/* Rain: fall fast, near-vertical */
.particles--rain .particle {
  border-radius: 2px;
  animation: particle-rain linear infinite;
  transform: rotate(15deg);
}
@keyframes particle-rain {
  0%   { transform: translateY(-20px) rotate(15deg); opacity: 0; }
  10%  { opacity: 0.4; }
  90%  { opacity: 0.3; }
  100% { transform: translateY(200px) rotate(15deg); opacity: 0; }
}

/* Dust: drift sideways slowly */
.particles--dust .particle {
  border-radius: 50%;
  animation: particle-dust linear infinite;
}
@keyframes particle-dust {
  0%   { transform: translateX(0) translateY(0); opacity: 0; }
  20%  { opacity: 0.6; }
  80%  { opacity: 0.4; }
  100% { transform: translateX(60px) translateY(-20px); opacity: 0; }
}

/* ─── Vignette ────────────────────────────────────────────────────────── */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%);
  pointer-events: none;
}
</style>
