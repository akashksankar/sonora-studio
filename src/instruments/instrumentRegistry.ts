import { InstrumentCategory, InstrumentDefinition, InstrumentId } from '../types';

export const INSTRUMENTS: Record<InstrumentId, InstrumentDefinition> = {
  // --- Indian Classical ---
  veena: {
    id: 'veena',
    name: 'Saraswati Veena',
    nativeName: 'सरस्वती वीणा',
    subtitle: 'Ancient Carnatic plucked lute with 24 brass frets',
    category: 'indian',
    description:
      'The queen of South Indian classical instruments. Features 4 main playing strings and 3 drone strings (tala) over a wax-set fretboard, producing rich sustained plucks with expressive gamaka glides.',
    color: '#f59e0b', // Amber / Gold
    glowColor: 'rgba(245, 158, 11, 0.45)',
    icon: '🪕',
    minMidi: 36, // C2
    maxMidi: 84, // C6
    defaultOctave: 3,
    soundType: 'plucked',
    features: ['24 Brass Frets', 'Gamaka Pitch-Bend', '4 Melodic Strings', '3 Tala Drones'],
  },
  sitar: {
    id: 'sitar',
    name: 'Sitar',
    nativeName: 'सितार',
    subtitle: 'North Indian classical lute with sympathetic strings',
    category: 'indian',
    description:
      'Famed Hindustani instrument with curved movable frets and vibrating jawari bridge. Shimmers with sympathetic resonance (taraf) and wide multi-semitone meend string deflection bends.',
    color: '#ea580c', // Saffron / Orange
    glowColor: 'rgba(234, 88, 12, 0.45)',
    icon: '🎸',
    minMidi: 38,
    maxMidi: 86,
    defaultOctave: 3,
    soundType: 'plucked',
    features: ['Curved Frets', 'Meend Pitch Glides', 'Sympathetic Resonance', 'Jawari Buzz'],
  },
  bansuri: {
    id: 'bansuri',
    name: 'Bansuri',
    nativeName: 'बांसुरी',
    subtitle: 'North/South Indian classical bamboo flute',
    category: 'indian',
    description:
      'Keyless transverse bamboo flute revered for sublime, breath-infused tonality. Played via precise finger hole coverage (purna, ardha) enabling microtonal shruti intonation and gentle breath vibrato.',
    color: '#10b981', // Emerald bamboo
    glowColor: 'rgba(16, 185, 129, 0.45)',
    icon: '🪈',
    minMidi: 48,
    maxMidi: 96,
    defaultOctave: 4,
    soundType: 'blown',
    features: ['7 Finger Holes', 'Breath Flow Visualizer', 'Sargam Fingering Guide', 'Microtonal Shrutis'],
  },
  tabla: {
    id: 'tabla',
    name: 'Tabla',
    nativeName: 'तबला',
    subtitle: 'Twin hand drums: Dayan (treble) & Bayan (bass)',
    category: 'percussion',
    description:
      'The foundational Hindustani percussion pair. The wooden Dayan produces bell-like harmonic rings with Syahi center, while the deep brass Bayan delivers expressive modulated bass glissandos.',
    color: '#d97706',
    glowColor: 'rgba(217, 119, 6, 0.45)',
    icon: '🥁',
    minMidi: 36,
    maxMidi: 76,
    defaultOctave: 3,
    soundType: 'percussion',
    features: ['Dayan & Bayan', 'Syahi / Maidan / Kinar Zones', 'Indian Bol Notation', 'Pitch-Modulated Bass'],
  },
  mridangam: {
    id: 'mridangam',
    name: 'Mridangam',
    nativeName: 'मृदङ्गम्',
    subtitle: 'Primary two-headed Carnatic barrel drum',
    category: 'percussion',
    description:
      'The rhythmic backbone of Carnatic concerts. Double-ended jackwood drum featuring the metallic, resonant Valanthalai treble face and the deep damped Thoppi bass face.',
    color: '#b45309',
    glowColor: 'rgba(180, 83, 9, 0.45)',
    icon: '🪘',
    minMidi: 36,
    maxMidi: 74,
    defaultOctave: 3,
    soundType: 'percussion',
    features: ['Dual-Headed Barrel', 'Kappi / Dheem Bass', 'Namam / Vettu Treble', 'Complex Solkattu'],
  },
  ghatam: {
    id: 'ghatam',
    name: 'Ghatam',
    nativeName: 'घटम्',
    subtitle: 'South Indian baked clay resonant pot',
    category: 'percussion',
    description:
      'Ancient earthenware percussion pot made from clay baked with brass and iron filings. Played with fingers, palms, and belly-against-mouth air thuds producing ringing metallic snaps and deep bass resonance.',
    color: '#c2410c',
    glowColor: 'rgba(194, 65, 12, 0.45)',
    icon: '🏺',
    minMidi: 40,
    maxMidi: 72,
    defaultOctave: 3,
    soundType: 'percussion',
    features: ['Clay Pot Body', 'Mouth Bass Thud', 'Rim Metallic Snaps', 'Fast Palm Rolls'],
  },
  santoor: {
    id: 'santoor',
    name: 'Santoor',
    nativeName: 'सन्तूर',
    subtitle: 'Kashmiri 100-string trapezoidal hammered zither',
    category: 'indian',
    description:
      'Trapezoidal wooden soundboard strung with dozens of steel strings, struck with lightweight curved walnut mezrab mallets. Produces shimmering cascaded runs, crystalline arpeggios, and sustained acoustic reverb.',
    color: '#06b6d4', // Cyan
    glowColor: 'rgba(6, 182, 212, 0.45)',
    icon: '🎵',
    minMidi: 48,
    maxMidi: 96,
    defaultOctave: 4,
    soundType: 'plucked',
    features: ['Trapezoid Soundboard', 'Mezrab Mallet Strikes', 'Rapid Tremolo', 'Acoustic Wood Ring'],
  },
  tanpura: {
    id: 'tanpura',
    name: 'Tanpura',
    nativeName: 'तानपुरा',
    subtitle: 'Hypnotic 4-string acoustic overtone drone',
    category: 'indian',
    description:
      'The spiritual acoustic foundation of all Indian classical music. 4 long unfretted strings continuously plucked in a calm cycle (Pa-Sa-Sa-Sa), generating a rich, cascading cloud of harmonic overtones through the curved jivari bridge.',
    color: '#8b5cf6', // Violet
    glowColor: 'rgba(139, 92, 246, 0.45)',
    icon: '✨',
    minMidi: 36,
    maxMidi: 60,
    defaultOctave: 3,
    soundType: 'drone',
    features: ['4-String Drone Loop', 'Cascading Overtones', 'Jivari Bridge Buzz', 'Concurrent Background Mode'],
  },

  // --- Western / Classical Instruments ---
  violin: {
    id: 'violin',
    name: 'Violin',
    subtitle: 'Expressive 4-string bowed acoustic orchestral instrument',
    category: 'western',
    description:
      'The quintessential bowed string instrument. Responsive fingerboard spanning G3-E7 with fluid continuous intonation, vibrato swells, and dynamic bow stroke feedback.',
    color: '#e11d48', // Rose / Ruby
    glowColor: 'rgba(225, 29, 72, 0.45)',
    icon: '🎻',
    minMidi: 55, // G3
    maxMidi: 103, // G7
    defaultOctave: 4,
    soundType: 'bowed',
    features: ['4 Strings (G-D-A-E)', 'Continuous Fingerboard', 'Animated Bow Stroke', 'Formant Vibrato'],
  },
  cello: {
    id: 'cello',
    name: 'Cello',
    subtitle: 'Warm, resonant bowed bass-tenor instrument',
    category: 'western',
    description:
      'Rich, sonorous orchestral cello tuned in fifths (C2-G2-D3-A3). Imparts profound warmth, velvety low end, and soaring singing tenor melodies.',
    color: '#9333ea', // Purple
    glowColor: 'rgba(147, 51, 234, 0.45)',
    icon: '🎼',
    minMidi: 36, // C2
    maxMidi: 84, // C6
    defaultOctave: 2,
    soundType: 'bowed',
    features: ['Deep Tenor Body', '4 Strings (C-G-D-A)', 'Full Bow Gesture', 'Woody Resonance'],
  },
  acoustic_guitar: {
    id: 'acoustic_guitar',
    name: 'Acoustic Guitar',
    subtitle: '6-string dreadnought steel-string acoustic guitar',
    category: 'western',
    description:
      'Warm steel strings over spruce and mahogany soundboard. Full 6-string fretboard with realistic string vibration, chord strumming, and fingerpicking attack.',
    color: '#eab308', // Warm Amber
    glowColor: 'rgba(234, 179, 8, 0.45)',
    icon: '🎸',
    minMidi: 40, // E2
    maxMidi: 88, // E6
    defaultOctave: 3,
    soundType: 'plucked',
    features: ['Standard E-A-D-G-B-E', 'Fretboard Grid', 'Strum & Pluck Zones', 'Natural Sustain'],
  },
  electric_guitar: {
    id: 'electric_guitar',
    name: 'Electric Guitar',
    subtitle: 'Solid-body guitar with driven pickup harmonics',
    category: 'western',
    description:
      'Punchy magnetic pickups with subtle analog drive and cab modeling. Delivers bite, sustained singing leads, and responsive power chords.',
    color: '#3b82f6', // Electric Blue
    glowColor: 'rgba(59, 130, 246, 0.45)',
    icon: '⚡',
    minMidi: 40,
    maxMidi: 88,
    defaultOctave: 3,
    soundType: 'plucked',
    features: ['Overdrive & Crunch', 'Magnetic Pickups', 'Sustain Leads', 'Fretboard Illumination'],
  },
  harp: {
    id: 'harp',
    name: 'Concert Harp',
    subtitle: '47-string pedal harp with crystalline glissandos',
    category: 'western',
    description:
      'Ethereal concert grand harp with cascading crystalline strings. Allows graceful multi-finger glissando sweeps and luminous, bell-like acoustic decay.',
    color: '#0ea5e9', // Sky Cyan
    glowColor: 'rgba(14, 165, 233, 0.45)',
    icon: '🪉',
    minMidi: 36,
    maxMidi: 96,
    defaultOctave: 4,
    soundType: 'plucked',
    features: ['Vertical String Array', 'Glissando Swipes', 'Bell-like Decay', 'Pedal Scale Tuning'],
  },
  grand_piano: {
    id: 'grand_piano',
    name: 'Concert Grand Piano',
    subtitle: 'Majestic 9-foot concert grand acoustic piano',
    category: 'piano',
    description:
      'Rich multi-harmonic acoustic piano with felt hammer strike, wooden soundboard impulse, and full 88-key touch response with physical key depression.',
    color: '#38bdf8', // Pure Cyan
    glowColor: 'rgba(56, 189, 248, 0.45)',
    icon: '🎹',
    minMidi: 21, // A0
    maxMidi: 108, // C8
    defaultOctave: 4,
    soundType: 'piano',
    features: ['88-Key Range', 'Physical Key Depression', 'Velocity Luminescence', 'Sustain Resonance'],
  },

  // --- Piano Collection ---
  concert_grand: {
    id: 'concert_grand',
    name: 'Concert Grand',
    subtitle: 'Magnificent Steinway D-style 9-foot piano',
    category: 'piano',
    description:
      'Flagship acoustic concert grand with immense dynamic headroom, brilliant treble clarity, and thunderous bass sonority.',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    icon: '🎹',
    minMidi: 21,
    maxMidi: 108,
    defaultOctave: 4,
    soundType: 'piano',
    features: ['88 Keys', 'High Dynamic Contrast', 'Concert Hall Reverb', 'Hammer Action Visuals'],
  },
  studio_piano: {
    id: 'studio_piano',
    name: 'Studio Piano',
    subtitle: 'Direct, focused modern studio acoustic piano',
    category: 'piano',
    description:
      'Clean, balanced modern studio acoustic piano with tight low-end and articulate transient attack, perfect for contemporary pop, jazz, and intricate MIDI arrangements.',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    icon: '🎹',
    minMidi: 21,
    maxMidi: 108,
    defaultOctave: 4,
    soundType: 'piano',
    features: ['Tight Attack', 'Direct Mic Character', 'Balanced Frequencies', 'Studio Precision'],
  },
  upright_piano: {
    id: 'upright_piano',
    name: 'Upright Piano',
    subtitle: 'Charming, intimate vertical acoustic piano',
    category: 'piano',
    description:
      'Cozy vertical acoustic piano with authentic wood chamber resonance and warm, nostalgic mechanical key thump.',
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.45)',
    icon: '🎼',
    minMidi: 21,
    maxMidi: 108,
    defaultOctave: 4,
    soundType: 'piano',
    features: ['Vertical Action', 'Warm Midrange', 'Vintage Intimacy', 'Felt Action Visuals'],
  },
  electric_piano: {
    id: 'electric_piano',
    name: 'Electric Piano',
    subtitle: 'Classic 1970s Rhodes & Wurlitzer tine synthesis',
    category: 'piano',
    description:
      'Iconic vintage electro-mechanical keyboard. Features crystalline bell tine attacks, lush warm analog chorus, and dynamic tube-style bark on high velocity.',
    color: '#a855f7', // Purple/Neon
    glowColor: 'rgba(168, 85, 247, 0.45)',
    icon: '⚡',
    minMidi: 28,
    maxMidi: 103,
    defaultOctave: 4,
    soundType: 'piano',
    features: ['Bell Tine Overtones', 'Analog Chorus', 'Dynamic Bark', 'Vintage Glow Keys'],
  },
  soft_piano: {
    id: 'soft_piano',
    name: 'Soft Piano',
    subtitle: 'Intimate felted piano with delicate, cinematic tone',
    category: 'piano',
    description:
      'Cinematic felt piano with dampening cloth between hammers and strings. Delivers an extraordinarily peaceful, gentle, whispered acoustic texture.',
    color: '#14b8a6', // Teal
    glowColor: 'rgba(20, 184, 166, 0.45)',
    icon: '🕊️',
    minMidi: 21,
    maxMidi: 108,
    defaultOctave: 4,
    soundType: 'piano',
    features: ['Felted Hammers', 'Whispered Pianissimo', 'Calm Minimal Aesthetics', 'Ambient Bloom'],
  },
  vintage_piano: {
    id: 'vintage_piano',
    name: 'Vintage Piano',
    subtitle: 'Honky-tonk acoustic piano with warm chorused detune',
    category: 'piano',
    description:
      'Character-rich parlor piano featuring subtle unison detuning and nostalgic, aged wood resonance.',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.45)',
    icon: '🕰️',
    minMidi: 21,
    maxMidi: 108,
    defaultOctave: 4,
    soundType: 'piano',
    features: ['Parlor Character', 'Subtle Unison Detune', 'Wooden Thump', 'Retro Patina'],
  },
  synth_piano: {
    id: 'synth_piano',
    name: 'Synth Piano',
    subtitle: 'Futuristic hybrid keys with glowing waveform filters',
    category: 'piano',
    description:
      'Cutting-edge cyberpunk electronic keys. Combines rich harmonic synthesizer oscillators with dynamic resonant lowpass envelopes and luminous neon visualizers.',
    color: '#ec4899', // Pink / Magenta
    glowColor: 'rgba(236, 72, 153, 0.45)',
    icon: '🌌',
    minMidi: 24,
    maxMidi: 108,
    defaultOctave: 4,
    soundType: 'synth',
    features: ['Neon Waveform Keys', 'Analog Filter Sweep', 'Cyberpunk Aesthetics', 'Particle Trails'],
  },

  // --- Original Expressive Isomorphic Grid ---
  touchpad: {
    id: 'touchpad',
    name: 'TouchPad Expressive',
    subtitle: 'Continuous multi-touch microtonal acoustic surface',
    category: 'expressive',
    description:
      'The original signature 2D expressive touch surface. Continuous pitch bends, polyphonic microtonal glides, dual-axis modulation, and interactive audio visualizers.',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    icon: '✨',
    minMidi: 36,
    maxMidi: 96,
    defaultOctave: 4,
    soundType: 'synth',
    features: ['Isomorphic Note Grid', 'Continuous Glides', 'Y-Axis Modulation', 'Touch Trails'],
  },
};

export const INSTRUMENT_CATEGORIES: { id: InstrumentCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'ALL INSTRUMENTS', icon: '🌟' },
  { id: 'indian', label: 'INDIAN CLASSICAL', icon: '🪕' },
  { id: 'piano', label: 'PIANO COLLECTION', icon: '🎹' },
  { id: 'western', label: 'STRINGS & WINDS', icon: '🎻' },
  { id: 'percussion', label: 'PERCUSSION', icon: '🥁' },
  { id: 'expressive', label: 'EXPRESSIVE PAD', icon: '✨' },
];

/**
 * Intelligent mapper from General MIDI Program (0-127) to supported InstrumentId
 */
export function mapMidiProgramToInstrument(program: number, isDrumChannel: boolean = false): InstrumentId {
  if (isDrumChannel) {
    return 'tabla';
  }
  // Piano (0-7)
  if (program >= 0 && program <= 3) return 'concert_grand';
  if (program === 4 || program === 5) return 'electric_piano';
  if (program === 6 || program === 7) return 'upright_piano';

  // Chromatic Percussion (8-15)
  if (program >= 8 && program <= 15) return 'santoor';

  // Guitar (24-31)
  if (program >= 24 && program <= 25) return 'acoustic_guitar';
  if (program >= 26 && program <= 31) return 'electric_guitar';

  // Strings (40-47)
  if (program === 40 || program === 41) return 'violin';
  if (program === 42 || program === 43) return 'cello';
  if (program === 46) return 'harp';

  // Flute & Pipe (72-79)
  if (program >= 73 && program <= 75) return 'bansuri';

  // Ethnic (104-111)
  if (program === 104) return 'sitar';
  if (program === 105) return 'santoor';
  if (program === 107) return 'bansuri';

  // Synth (80-103)
  if (program >= 80 && program <= 103) return 'synth_piano';

  // Default
  return 'concert_grand';
}

/**
 * Indian Sargam Swara map for notes C through B
 */
export const SARGAM_MAP: Record<number, { swara: string; full: string; shuddha: boolean }> = {
  0: { swara: 'Sa', full: 'Shadja', shuddha: true },
  1: { swara: 're', full: 'Komal Rishabh', shuddha: false },
  2: { swara: 'Re', full: 'Shuddha Rishabh', shuddha: true },
  3: { swara: 'ga', full: 'Komal Gandhar', shuddha: false },
  4: { swara: 'Ga', full: 'Shuddha Gandhar', shuddha: true },
  5: { swara: 'Ma', full: 'Shuddha Madhyam', shuddha: true },
  6: { swara: 'ma’', full: 'Teevra Madhyam', shuddha: false },
  7: { swara: 'Pa', full: 'Pancham', shuddha: true },
  8: { swara: 'dha', full: 'Komal Dhaivat', shuddha: false },
  9: { swara: 'Dha', full: 'Shuddha Dhaivat', shuddha: true },
  10: { swara: 'ni', full: 'Komal Nishad', shuddha: false },
  11: { swara: 'Ni', full: 'Shuddha Nishad', shuddha: true },
};

export function getSargamNote(midiNote: number, rootOffset: number = 0): string {
  const semitone = ((midiNote - rootOffset) % 12 + 12) % 12;
  const sargam = SARGAM_MAP[semitone];
  return sargam ? sargam.swara : 'Sa';
}
