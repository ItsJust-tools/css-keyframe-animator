export interface HistoryEntry {
  /** Short human readable description of the edit. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

/** Editable CSS properties per keyframe. Empty strings are omitted from output. */
export interface KeyframeProperties {
  transform: string;
  opacity: string;
  color: string;
  'background-color': string;
  translate: string;
  scale: string;
  rotate: string;
}

export type CssPropertyName = keyof KeyframeProperties;

/** A single keyframe in the animation timeline. */
export interface Keyframe {
  id: string;
  /** Offset in percent, 0 to 100. */
  offset: number;
  properties: KeyframeProperties;
}

export type TimingFunction =
  'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';

export const TIMING_FUNCTIONS: { value: TimingFunction; label: string }[] = [
  { value: 'ease', label: 'ease' },
  { value: 'linear', label: 'linear' },
  { value: 'ease-in', label: 'ease-in' },
  { value: 'ease-out', label: 'ease-out' },
  { value: 'ease-in-out', label: 'ease-in-out' },
  { value: 'cubic-bezier', label: 'cubic-bezier' },
];

export const PROPERTY_NAMES: CssPropertyName[] = [
  'transform',
  'opacity',
  'color',
  'background-color',
  'translate',
  'scale',
  'rotate',
];

export interface ToolState {
  /** Keyframes sorted by offset (0–100). */
  keyframes: Keyframe[];
  /** Animation duration in milliseconds. */
  durationMs: number;
  /** Animation timing function name. */
  timingFunction: string;
  /** cubic-bezier control points, e.g. "0.25, 0.1, 0.25, 1". */
  bezier: string;
  /** Iteration count; values <= 0 render as `infinite`. */
  iterationCount: number;
  /** Whether the preview is currently playing. */
  playing: boolean;
  /** Currently selected keyframe id. */
  selectedId: string | null;
  /** Saved edit history, newest first. */
  history: HistoryEntry[];
}

export const MAX_HISTORY = 20;

export const ANIMATION_CLASS_NAME = 'animated-element';

export const DEFAULT_BEZIER = '0.25, 0.1, 0.25, 1';

function emptyProperties(): KeyframeProperties {
  return {
    transform: '',
    opacity: '',
    color: '',
    'background-color': '',
    translate: '',
    scale: '',
    rotate: '',
  };
}

let keyframeCounter = 0;

/** Generate a fresh, unique keyframe id. */
export function nextKeyframeId(): string {
  keyframeCounter += 1;
  return `kf-${Date.now()}-${keyframeCounter}`;
}

export function emptyKeyframe(offset: number): Keyframe {
  return { id: nextKeyframeId(), offset, properties: emptyProperties() };
}

export const DEFAULT_STATE: ToolState = {
  keyframes: [
    { id: 'kf-0', offset: 0, properties: { ...emptyProperties(), opacity: '1' } },
    { id: 'kf-1', offset: 100, properties: { ...emptyProperties(), opacity: '0.2' } },
  ],
  durationMs: 2000,
  timingFunction: 'ease',
  bezier: DEFAULT_BEZIER,
  iterationCount: 1,
  playing: false,
  selectedId: 'kf-0',
  history: [],
};

/**
 * Parse an offset string like "37.5" (a trailing % is tolerated).
 * Returns a finite number or null; values outside 0–100 are clamped by callers.
 */
export function parseOffset(input: string): number | null {
  const trimmed = input.trim().replace(/%$/, '');
  if (!trimmed) return null;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Clamp an offset to the valid 0–100 range. */
export function clampOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(100, Math.max(0, offset));
}

/** Format an offset without trailing float noise. */
export function formatOffset(offset: number): string {
  return String(Number(clampOffset(offset).toFixed(4)));
}

/** Return a new array of keyframes sorted by offset (stable). */
export function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.offset - b.offset);
}

export interface KeyframeValidation {
  hasStart: boolean;
  hasEnd: boolean;
  warnings: string[];
}

/** Validate keyframe coverage and content; returns warnings for the UI. */
export function validateKeyframes(keyframes: Keyframe[]): KeyframeValidation {
  const warnings: string[] = [];
  const sorted = sortKeyframes(keyframes);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const hasStart = Boolean(first) && clampOffset(first!.offset) === 0;
  const hasEnd = Boolean(last) && clampOffset(last!.offset) === 100;
  if (!hasStart) warnings.push('Missing 0% keyframe — add a keyframe at offset 0.');
  if (!hasEnd) warnings.push('Missing 100% keyframe — add a keyframe at offset 100.');
  for (const kf of sorted) {
    const set = PROPERTY_NAMES.filter(
      (name) => (kf.properties[name] ?? '').toString().trim() !== ''
    );
    if (set.length === 0) {
      warnings.push(`Keyframe at ${formatOffset(kf.offset)}% has no CSS properties set.`);
    }
  }
  return { hasStart, hasEnd, warnings };
}

function cssValueLine(name: CssPropertyName, value: string): string | null {
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  return `    ${name}: ${trimmed};`;
}

/** Build the @keyframes body declaration lines for sorted keyframes. */
export function keyframeBlock(keyframes: Keyframe[]): string {
  const sorted = sortKeyframes(keyframes);
  const lines: string[] = [];
  for (const kf of sorted) {
    const props: string[] = [];
    for (const name of PROPERTY_NAMES) {
      const line = cssValueLine(name, kf.properties[name] ?? '');
      if (line) props.push(line);
    }
    lines.push(`  ${formatOffset(kf.offset)}% {`);
    if (props.length === 0) {
      lines.push('    /* no properties set */');
    } else {
      lines.push(...props);
    }
    lines.push('  }');
  }
  return lines.join('\n');
}

function timingCss(state: { timingFunction: string; bezier: string }): string {
  if (state.timingFunction === 'cubic-bezier') {
    return `cubic-bezier(${(state.bezier || DEFAULT_BEZIER).trim()})`;
  }
  return state.timingFunction;
}

function iterationCss(count: number): string {
  return count <= 0 ? 'infinite' : String(count);
}

function formatDuration(seconds: number): string {
  return String(Number(seconds.toFixed(4)));
}

/**
 * Generate ready-to-use CSS: an `@keyframes` block plus a utility class with
 * the `animation` shorthand (name, duration, timing function, iteration count).
 */
export function generateCss(state: ToolState): string {
  const name = 'css-keyframe-animation';
  const duration = Math.max(0, state.durationMs) / 1000;
  const timing = timingCss(state);
  const iters = iterationCss(state.iterationCount);
  return [
    `@keyframes ${name} {`,
    keyframeBlock(state.keyframes),
    '}',
    '',
    `.${ANIMATION_CLASS_NAME} {`,
    `  animation: ${name} ${formatDuration(duration)}s ${timing} ${iters} both;`,
    '}',
  ].join('\n');
}

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  const count = state.keyframes.length;
  const playState = state.playing ? 'playing' : 'paused';
  return `${count} keyframe${count === 1 ? '' : 's'} · ${state.durationMs}ms · ${state.timingFunction} · ${
    state.iterationCount <= 0 ? 'infinite' : state.iterationCount
  }× · ${playState}`;
}

/** Build a history entry text for the current state. */
export function historyText(state: ToolState): string {
  return summaryText(state);
}

/** Serialize a single keyframe to a compact CSS-ish string for history entries. */
export function keyframeSummary(kf: Keyframe): string {
  const values = PROPERTY_NAMES.map((name) => {
    const value = (kf.properties[name] ?? '').toString().trim();
    return value ? `${name} ${value}` : null;
  })
    .filter(Boolean)
    .join(', ');
  return `${formatOffset(kf.offset)}% — ${values || 'empty'}`;
}

/**
 * Duplicate the keyframe with `id` into a new keyframe offset by `delta`
 * percent, clamped 0–100 and halved when it would pass the next keyframe.
 * Returns the full sorted list plus the created keyframe (or null).
 */
export function duplicateKeyframe(
  keyframes: Keyframe[],
  id: string,
  delta = 5
): { keyframes: Keyframe[]; created: Keyframe | null } {
  const source = keyframes.find((k) => k.id === id);
  if (!source) return { keyframes, created: null };
  const offsets = sortKeyframes(keyframes).map((k) => k.offset);
  const index = offsets.indexOf(source.offset);
  const next = index + 1 < offsets.length ? offsets[index + 1] : null;
  let target = clampOffset(source.offset + delta);
  if (typeof next === 'number' && target > next) target = clampOffset((source.offset + next) / 2);
  const created: Keyframe = {
    id: nextKeyframeId(),
    offset: target,
    properties: { ...source.properties },
  };
  return { keyframes: sortKeyframes([...keyframes, created]), created };
}

/** Remove the keyframe with `id`; keeps the list sorted. */
export function removeKeyframe(keyframes: Keyframe[], id: string): Keyframe[] {
  return sortKeyframes(keyframes.filter((k) => k.id !== id));
}

/** Add an empty keyframe at `offset` (clamped 0–100), list kept sorted. */
export function addKeyframe(
  keyframes: Keyframe[],
  offset: number
): { keyframes: Keyframe[]; created: Keyframe } {
  const created: Keyframe = emptyKeyframe(clampOffset(offset));
  return { keyframes: sortKeyframes([...keyframes, created]), created };
}

/** Update one CSS property of a keyframe. */
export function updateKeyframeProperty(
  keyframes: Keyframe[],
  id: string,
  property: CssPropertyName,
  value: string
): Keyframe[] {
  return keyframes.map((kf) =>
    kf.id === id ? { ...kf, properties: { ...kf.properties, [property]: value } } : kf
  );
}

/** Move a keyframe to a new offset (clamped 0–100), list kept sorted. */
export function moveKeyframe(keyframes: Keyframe[], id: string, offset: number): Keyframe[] {
  return sortKeyframes(
    keyframes.map((kf) => (kf.id === id ? { ...kf, offset: clampOffset(offset) } : kf))
  );
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return Array.isArray(v.keyframes) && typeof v.durationMs === 'number';
}
