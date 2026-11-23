import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  DEFAULT_BEZIER,
  MAX_HISTORY,
  TIMING_FUNCTIONS,
  clampOffset,
  sortKeyframes,
  summaryText,
  type HistoryEntry,
  type Keyframe,
  type ToolState,
} from './types';

const VALID_TIMING = new Set(TIMING_FUNCTIONS.map((t) => t.value as string));

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    keyframes: state.keyframes,
    durationMs: state.durationMs,
    timingFunction: state.timingFunction,
    bezier: state.bezier,
    iterationCount: state.iterationCount,
    selectedId: state.selectedId,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeProperties(value: unknown): Keyframe['properties'] {
  const props: Keyframe['properties'] = {
    transform: '',
    opacity: '',
    color: '',
    'background-color': '',
    translate: '',
    scale: '',
    rotate: '',
  };
  if (typeof value !== 'object' || value === null) return props;
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(props) as (keyof typeof props)[]) {
    props[key] = stringOr(v[key], '');
  }
  return props;
}

function safeKeyframes(value: unknown): Keyframe[] {
  if (!Array.isArray(value)) return [];
  const keyframes: Keyframe[] = value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: stringOr(item.id, 'kf-imported'),
      offset: clampOffset(safeNumber(item.offset, 0)),
      properties: safeProperties(item.properties),
    }));
  return sortKeyframes(keyframes);
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected animation state object',
    };
  }
  const v = data as Record<string, unknown>;
  const timingFunction = VALID_TIMING.has(stringOr(v.timingFunction, ''))
    ? stringOr(v.timingFunction, DEFAULT_STATE.timingFunction)
    : DEFAULT_STATE.timingFunction;
  const keyframes = safeKeyframes(v.keyframes);
  const state: ToolState = {
    keyframes:
      keyframes.length > 0
        ? keyframes
        : [...DEFAULT_STATE.keyframes.map((k) => ({ ...k, properties: { ...k.properties } }))],
    durationMs: Math.max(0, safeNumber(v.durationMs, DEFAULT_STATE.durationMs)),
    timingFunction,
    bezier: stringOr(v.bezier, DEFAULT_BEZIER),
    iterationCount: Math.max(
      0,
      Math.round(safeNumber(v.iterationCount, DEFAULT_STATE.iterationCount))
    ),
    playing: false,
    selectedId: stringOr(v.selectedId, ''),
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when serialize → parse → deserialize → serialize reproduces the payload. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    if (!restored.success) return false;
    return serializeState(restored.data) === serializeState(state);
  } catch {
    return false;
  }
}

export const cssKeyframeAnimatorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { summaryText };
