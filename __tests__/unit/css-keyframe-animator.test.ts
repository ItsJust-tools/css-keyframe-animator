import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  ANIMATION_CLASS_NAME,
  clampOffset,
  parseOffset,
  formatOffset,
  sortKeyframes,
  validateKeyframes,
  keyframeBlock,
  generateCss,
  summaryText,
  duplicateKeyframe,
  removeKeyframe,
  addKeyframe,
  moveKeyframe,
  updateKeyframeProperty,
  type Keyframe,
  type ToolState,
} from '@/tool/types';
import {
  serializeState,
  deserializeState,
  withHistory,
  roundTrips,
  cssKeyframeAnimatorTool,
} from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const kf = (id: string, offset: number, props: Partial<Keyframe['properties']> = {}): Keyframe => ({
  id,
  offset,
  properties: {
    transform: '',
    opacity: '',
    color: '',
    'background-color': '',
    translate: '',
    scale: '',
    rotate: '',
    ...props,
  },
});

describe('parseOffset', () => {
  it('parses plain and percent-suffixed offsets', () => {
    expect(parseOffset('42')).toBe(42);
    expect(parseOffset('37.5%')).toBeCloseTo(37.5);
    expect(parseOffset('.5')).toBeCloseTo(0.5);
    expect(parseOffset(' 10 ')).toBe(10);
  });

  it('rejects invalid input', () => {
    expect(parseOffset('')).toBeNull();
    expect(parseOffset('abc')).toBeNull();
    expect(parseOffset('1,5')).toBeNull();
    expect(parseOffset('10%%')).toBeNull();
  });
});

describe('clampOffset and formatOffset', () => {
  it('clamps to 0..100', () => {
    expect(clampOffset(-5)).toBe(0);
    expect(clampOffset(150)).toBe(100);
    expect(clampOffset(50)).toBe(50);
    expect(clampOffset(Number.NaN)).toBe(0);
  });

  it('formats without float noise', () => {
    expect(formatOffset(37.5)).toBe('37.5');
    expect(formatOffset(100)).toBe('100');
    expect(formatOffset(0.30000000004)).toBe('0.3');
  });
});

describe('sortKeyframes', () => {
  it('sorts by offset without mutating the input', () => {
    const list = [kf('b', 100), kf('a', 0), kf('c', 50)];
    const sorted = sortKeyframes(list);
    expect(sorted.map((k) => k.id)).toEqual(['a', 'c', 'b']);
    expect(list.map((k) => k.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('validateKeyframes', () => {
  it('warns when 0% keyframe is missing', () => {
    const result = validateKeyframes([kf('a', 50), kf('b', 100)]);
    expect(result.hasStart).toBe(false);
    expect(result.hasEnd).toBe(true);
    expect(result.warnings.some((w) => w.includes('0%'))).toBe(true);
  });

  it('warns when 100% keyframe is missing', () => {
    const result = validateKeyframes([kf('a', 0), kf('b', 50)]);
    expect(result.hasEnd).toBe(false);
    expect(result.warnings.some((w) => w.includes('100%'))).toBe(true);
  });

  it('does not warn when both endpoints exist with properties', () => {
    const result = validateKeyframes([
      kf('a', 0, { opacity: '1' }),
      kf('b', 100, { opacity: '0' }),
    ]);
    expect(result.hasStart).toBe(true);
    expect(result.hasEnd).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('warns for keyframes with no properties set', () => {
    const result = validateKeyframes([kf('a', 0), kf('b', 100)]);
    expect(result.warnings.some((w) => w.includes('no CSS properties'))).toBe(true);
  });

  it('treats offset 0 as the start keyframe', () => {
    const result = validateKeyframes([
      kf('a', 0, { opacity: '1' }),
      kf('b', 100, { opacity: '0' }),
    ]);
    expect(result.hasStart).toBe(true);
  });
});

describe('keyframeBlock and generateCss', () => {
  it('builds an @keyframes block with sorted, formatted stops', () => {
    const block = keyframeBlock([kf('b', 100, { opacity: '0.2' }), kf('a', 0, { opacity: '1' })]);
    expect(block).toContain('  0% {');
    expect(block).toContain('  100% {');
    expect(block.indexOf('0%')).toBeLessThan(block.indexOf('100%'));
    expect(block).toContain('opacity: 1;');
    expect(block).toContain('opacity: 0.2;');
  });

  it('omits empty properties', () => {
    const block = keyframeBlock([kf('a', 0, { opacity: '1', transform: 'scale(2)' })]);
    expect(block).toContain('transform: scale(2);');
    expect(block).not.toContain('color:');
  });

  it('generates @keyframes plus utility class with animation shorthand', () => {
    const css = generateCss(
      state({
        keyframes: [kf('a', 0, { transform: 'scale(1)' }), kf('b', 100, { transform: 'scale(2)' })],
        durationMs: 2000,
        timingFunction: 'ease-in-out',
        iterationCount: 3,
      })
    );
    expect(css).toContain('@keyframes css-keyframe-animation');
    expect(css).toContain(`.${ANIMATION_CLASS_NAME}`);
    expect(css).toContain('animation: css-keyframe-animation 2s ease-in-out 3 both;');
    expect(css).toContain('transform: scale(1);');
    expect(css).toContain('transform: scale(2);');
  });

  it('emits cubic-bezier timing and infinite iterations', () => {
    const css = generateCss(
      state({
        timingFunction: 'cubic-bezier',
        bezier: '0.1, 0.7, 1, 0.1',
        iterationCount: 0,
      })
    );
    expect(css).toContain('cubic-bezier(0.1, 0.7, 1, 0.1)');
    expect(css).toContain('infinite both;');
  });

  it('converts fractional durations', () => {
    const css = generateCss(state({ durationMs: 1500 }));
    expect(css).toContain('1.5s');
  });
});

describe('duplicate and remove keyframes', () => {
  it('duplicates with properties and keeps sorted order', () => {
    const list = [kf('a', 0, { opacity: '1' }), kf('b', 100, { opacity: '0' })];
    const { keyframes, created } = duplicateKeyframe(list, 'a');
    expect(created).not.toBeNull();
    expect(created?.properties.opacity).toBe('1');
    expect(keyframes.map((k) => k.offset)).toEqual(
      [...keyframes.map((k) => k.offset)].sort((a, b) => a - b)
    );
    expect(keyframes).toHaveLength(3);
    const offsets = keyframes.map((k) => k.offset);
    expect([...offsets].sort((x, y) => x - y)).toEqual(offsets);
  });

  it('handles offset near endpoint after halving', () => {
    const list = [kf('a', 0), kf('b', 98, { opacity: '1' }), kf('c', 100)];
    const { created } = duplicateKeyframe(list, 'b', 5);
    expect((created?.offset ?? 0) <= 100).toBe(true);
    expect((created?.offset ?? 0) > 98).toBe(true);
  });

  it('returns the input unchanged for unknown id', () => {
    const list = [kf('a', 0)];
    const result = duplicateKeyframe(list, 'nope');
    expect(result.created).toBeNull();
    expect(result.keyframes).toBe(list);
  });

  it('removes the keyframe and keeps sorted order', () => {
    const list = [kf('a', 0), kf('b', 50), kf('c', 100)];
    const rest = removeKeyframe(list, 'b');
    expect(rest.map((k) => k.id)).toEqual(['a', 'c']);
  });

  it('addKeyframe clamps the offset and sorts', () => {
    const { keyframes, created } = addKeyframe([kf('a', 0)], 120);
    expect(created.offset).toBe(100);
    expect(keyframes.map((k) => k.offset)).toEqual([0, 100]);
  });

  it('moveKeyframe updates offset and re-sorts', () => {
    const moved = moveKeyframe([kf('a', 0), kf('b', 50)], 'a', 75);
    expect(moved.map((k) => k.id)).toEqual(['b', 'a']);
    expect(moved[moved.length - 1]?.offset).toBe(75);
  });

  it('updateKeyframeProperty only touches the target keyframe', () => {
    const list = [kf('a', 0), kf('b', 100)];
    const next = updateKeyframeProperty(list, 'b', 'color', 'red');
    expect(next[1]?.properties.color).toBe('red');
    expect(next[0]?.properties.color).toBe('');
  });
});

describe('summaryText', () => {
  it('summarizes count, duration, timing and playback state', () => {
    expect(summaryText(state({ playing: true }))).toContain('playing');
    expect(summaryText(state({ iterationCount: 0 }))).toContain('infinite');
    expect(summaryText(state({ keyframes: [kf('a', 0)] }))).toContain('1 keyframe');
  });
});

describe('serialize/deserialize', () => {
  it('round-trips a typical state', () => {
    const sample = state({
      keyframes: [
        kf('a', 0, { opacity: '1', transform: 'translateX(0)' }),
        kf('b', 100, { opacity: '0.2', rotate: '45deg' }),
      ],
      durationMs: 1500,
      timingFunction: 'linear',
      iterationCount: 4,
      history: [{ text: 'edit', createdAt: '2026-11-23T10:00:00.000Z' }],
    });
    expect(roundTrips(sample)).toBe(true);
  });

  it('restores keyframes, settings and history from a payload', () => {
    const payload = JSON.parse(
      serializeState(
        state({
          durationMs: 800,
          timingFunction: 'ease-out',
          iterationCount: 2,
          history: [{ text: 'moved kf', createdAt: '2026-11-23T11:00:00.000Z' }],
        })
      )
    );
    const restored = deserializeState(payload);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.data.durationMs).toBe(800);
    expect(restored.data.timingFunction).toBe('ease-out');
    expect(restored.data.iterationCount).toBe(2);
    expect(restored.data.history).toHaveLength(1);
  });

  it('rejects non-object payloads with an animation state error', () => {
    expect(deserializeState('nope')).toEqual({
      success: false,
      error: 'Invalid data format: expected animation state object',
    });
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2, 3]).success).toBe(false);
  });

  it('falls back to defaults for invalid fields', () => {
    const repaired = deserializeState({
      keyframes: 'garbage',
      durationMs: 'fast',
      timingFunction: 'warp-speed',
      iterationCount: -3,
      history: 'none',
    });
    expect(repaired.success).toBe(true);
    if (!repaired.success) return;
    expect(repaired.data.keyframes).toEqual(DEFAULT_STATE.keyframes);
    expect(repaired.data.durationMs).toBe(DEFAULT_STATE.durationMs);
    expect(repaired.data.timingFunction).toBe(DEFAULT_STATE.timingFunction);
    expect(repaired.data.iterationCount).toBe(0);
    expect(repaired.data.history).toEqual([]);
    expect(repaired.data.playing).toBe(false);
  });

  it('sanitizes keyframe offsets and properties', () => {
    const repaired = deserializeState({
      keyframes: [
        { id: 'y', offset: -20, properties: null },
        { id: 'x', offset: 250, properties: { opacity: '0.5' } },
      ],
    });
    expect(repaired.success).toBe(true);
    if (!repaired.success) return;
    expect(repaired.data.keyframes[0]?.offset).toBe(0);
    expect(repaired.data.keyframes[0]?.properties.opacity).toBe('');
    expect(repaired.data.keyframes[1]?.offset).toBe(100);
    expect(repaired.data.keyframes[1]?.properties.opacity).toBe('0.5');
  });

  it('caps restored history at MAX_HISTORY', () => {
    const entries = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `e${i}`,
      createdAt: `2026-11-23T00:00:${String(i).padStart(2, '0')}.000Z`,
    }));
    const repaired = deserializeState({ keyframes: [], history: entries });
    expect(repaired.success).toBe(true);
    if (!repaired.success) return;
    expect(repaired.data.history).toHaveLength(MAX_HISTORY);
  });
});

describe('withHistory', () => {
  it('prepends entries and caps at MAX_HISTORY', () => {
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      s = withHistory(s, `entry-${i}`, new Date(2026, 10, 23, 12, 0, i));
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.history[0]?.text).toBe(`entry-${MAX_HISTORY + 2}`);
  });
});

describe('tool definition exports', () => {
  it('exposes the css keyframe animator tool', () => {
    expect(cssKeyframeAnimatorTool.id).toBe('css-keyframe-animator');
    expect(cssKeyframeAnimatorTool.name).toBe('CSS Keyframe Animator');
  });

  it('keeps playing state out of serialization', () => {
    const serialized = serializeState(state({ playing: true }));
    expect(serialized).not.toContain('"playing":true');
    const restored = deserializeState(JSON.parse(serialized));
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.playing).toBe(false);
  });
});

describe('ui module exports', () => {
  it('re-exports helpers from ui-shared and index', async () => {
    const shared = await import('@/tool/ui-shared');
    expect(shared.TIMING_FUNCTIONS.length).toBeGreaterThan(0);
    expect(shared.PROPERTY_NAMES).toContain('transform');
    expect(shared.validateKeyframes([]).warnings.length).toBeGreaterThan(0);
    const barrel = await import('@/tool');
    expect(barrel.cssKeyframeAnimatorTool.id).toBe('css-keyframe-animator');
    expect(barrel.generateCss(DEFAULT_STATE)).toContain('@keyframes');
  });
});
