'use client';

import React from 'react';
import {
  PROPERTY_NAMES,
  TIMING_FUNCTIONS,
  clampOffset,
  formatOffset,
  generateCss,
  parseOffset,
  validateKeyframes,
  keyframeSummary,
  type CssPropertyName,
  type Keyframe,
  type ToolState,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({
  value,
  testid,
  label = 'Copy',
}: {
  value: string;
  testid?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={label}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

function Timeline({ state, onChange }: { state: ToolState; onChange: (next: ToolState) => void }) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const offsetFromEvent = React.useCallback((clientX: number): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    return clampOffset(Math.round(ratio * 100));
  }, []);

  const handleMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId) return;
      const offset = offsetFromEvent(e.clientX);
      const keyframes = state.keyframes.map((kf) =>
        kf.id === draggingId ? { ...kf, offset } : kf
      );
      onChange({ ...state, keyframes });
    },
    [draggingId, offsetFromEvent, onChange, state]
  );

  const stopDrag = React.useCallback(() => setDraggingId(null), []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Timeline
      </h3>
      <div
        ref={barRef}
        data-testid="timeline"
        role="slider"
        aria-label="Animation timeline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.keyframes.length}
        onMouseMove={handleMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        className="relative h-10 w-full cursor-pointer rounded-md bg-gradient-to-r from-violet-100 to-violet-50 dark:from-violet-950 dark:to-violet-900"
      >
        {state.keyframes.map((kf) => (
          <button
            key={kf.id}
            type="button"
            data-testid={`keyframe-marker-${kf.id}`}
            aria-label={`Keyframe at ${formatOffset(kf.offset)}%`}
            onMouseDown={(e) => {
              e.preventDefault();
              setDraggingId(kf.id);
              onChange({ ...state, selectedId: kf.id });
            }}
            onClick={() => onChange({ ...state, selectedId: kf.id })}
            style={{ left: `${clampOffset(kf.offset)}%` }}
            className={`absolute top-0 h-full -translate-x-1/2 px-1 text-[10px] font-mono leading-[2.5rem] ${
              state.selectedId === kf.id
                ? 'text-violet-700 dark:text-violet-200'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span
              className={`block h-2 w-px ${state.selectedId === kf.id ? 'bg-violet-600 dark:bg-violet-300' : 'bg-gray-400 dark:bg-gray-600'}`}
            />
            {formatOffset(kf.offset)}%
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Drag a marker to change its offset (0–100%). Click to select.
      </p>
    </div>
  );
}

function KeyframeEditor({
  keyframe,
  isSelected,
  onSelect,
  onOffsetChange,
  onPropertyChange,
  onDuplicate,
  onRemove,
}: {
  keyframe: Keyframe;
  isSelected: boolean;
  onSelect: () => void;
  onOffsetChange: (value: string) => void;
  onPropertyChange: (property: CssPropertyName, value: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const parsed = parseOffset(String(keyframe.offset)) ?? keyframe.offset;
  const [offsetDraft, setOffsetDraft] = React.useState<string>(formatOffset(keyframe.offset));
  const [lastCommitted, setLastCommitted] = React.useState<number>(keyframe.offset);
  if (keyframe.offset !== lastCommitted) {
    setLastCommitted(keyframe.offset);
    setOffsetDraft(formatOffset(keyframe.offset));
  }

  const commitOffset = () => {
    const parsedInput = parseOffset(offsetDraft);
    if (parsedInput === null) {
      setOffsetDraft(formatOffset(parsed));
      return;
    }
    onOffsetChange(formatOffset(parsedInput));
  };

  return (
    <div
      data-testid={`keyframe-editor-${keyframe.id}`}
      className={`rounded-lg border p-3 ${
        isSelected
          ? 'border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/30'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
        >
          {formatOffset(keyframe.offset)}% keyframe
        </button>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={offsetDraft}
            aria-label="Keyframe offset percent"
            data-testid={`keyframe-offset-${keyframe.id}`}
            onChange={(e) => setOffsetDraft(e.target.value)}
            onBlur={commitOffset}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOffset();
            }}
            className="w-16 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-xs text-gray-500">%</span>
          <button
            type="button"
            onClick={onDuplicate}
            data-testid={`keyframe-duplicate-${keyframe.id}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onRemove}
            data-testid={`keyframe-remove-${keyframe.id}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-gray-700 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROPERTY_NAMES.map((property) => (
          <label
            key={property}
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {property}
            <input
              type="text"
              value={keyframe.properties[property]}
              data-testid={`keyframe-prop-${keyframe.id}-${property}`}
              placeholder="not set"
              onChange={(e) => onPropertyChange(property, e.target.value)}
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const validation = validateKeyframes(state.keyframes);
  const css = generateCss(state);
  const selected = state.keyframes.find((kf) => kf.id === state.selectedId) ?? null;

  const animationCss = `animation-duration: ${Math.max(0, state.durationMs)}ms; animation-timing-function: ${
    state.timingFunction === 'cubic-bezier' ? `cubic-bezier(${state.bezier})` : state.timingFunction
  }; animation-iteration-count: ${state.iterationCount <= 0 ? 'infinite' : state.iterationCount};`;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="anim-canvas">
      {/* Animation settings */}
      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="animation-settings"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Duration (ms)
            <input
              type="number"
              min={0}
              value={state.durationMs}
              data-testid="input-duration"
              onChange={(e) => update({ durationMs: Math.max(0, Number(e.target.value) || 0) })}
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Timing function
            <select
              value={state.timingFunction}
              data-testid="input-timing"
              onChange={(e) => update({ timingFunction: e.target.value })}
              className={inputClass}
            >
              {TIMING_FUNCTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {state.timingFunction === 'cubic-bezier' ? (
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              cubic-bezier points
              <input
                type="text"
                value={state.bezier}
                data-testid="input-bezier"
                onChange={(e) => update({ bezier: e.target.value })}
                className={inputClass}
              />
            </label>
          ) : (
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Iterations (0 = infinite)
              <input
                type="number"
                min={0}
                value={state.iterationCount}
                data-testid="input-iterations"
                onChange={(e) =>
                  update({ iterationCount: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
                className={inputClass}
              />
            </label>
          )}
          {state.timingFunction === 'cubic-bezier' ? (
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Iterations (0 = infinite)
              <input
                type="number"
                min={0}
                value={state.iterationCount}
                data-testid="input-iterations"
                onChange={(e) =>
                  update({ iterationCount: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
                className={inputClass}
              />
            </label>
          ) : null}
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Preview
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="btn-play-toggle"
              onClick={() => update({ playing: !state.playing })}
              className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
            >
              {state.playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              data-testid="btn-reset-preview"
              onClick={() => update({ playing: false })}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="flex h-32 items-center justify-center rounded-md bg-white dark:bg-gray-800">
          <div
            data-testid="preview-box"
            className="preview-animated-box h-16 w-16 rounded-lg bg-violet-500"
            style={
              state.playing
                ? {
                    animation: `css-keyframe-animation ${Math.max(0, state.durationMs)}ms ${
                      state.timingFunction === 'cubic-bezier'
                        ? `cubic-bezier(${state.bezier})`
                        : state.timingFunction
                    } ${state.iterationCount <= 0 ? 'infinite' : state.iterationCount} both`,
                  }
                : undefined
            }
          />
        </div>
        <p
          className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400"
          data-testid="animation-summary"
        >
          {animationCss}
        </p>
      </div>

      {/* Timeline */}
      <Timeline state={state} onChange={(next) => onChange?.(next)} />

      {/* Keyframes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Keyframes ({state.keyframes.length})
          </h3>
          <button
            type="button"
            data-testid="btn-add-keyframe"
            onClick={() => {
              const maxOffset = Math.max(0, ...state.keyframes.map((kf) => kf.offset));
              const offset = clampOffset(maxOffset >= 100 ? 0 : maxOffset + 10);
              const id = `kf-add-${Date.now()}`;
              const created = {
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
                },
              };
              update({
                keyframes: [...state.keyframes, created].sort((a, b) => a.offset - b.offset),
                selectedId: id,
              });
            }}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Add keyframe
          </button>
        </div>
        {state.keyframes
          .slice()
          .sort((a, b) => a.offset - b.offset)
          .map((kf) => (
            <KeyframeEditor
              key={kf.id}
              keyframe={kf}
              isSelected={state.selectedId === kf.id}
              onSelect={() => update({ selectedId: kf.id })}
              onOffsetChange={(value) => {
                const parsedOffset = parseOffset(value);
                const offset = parsedOffset === null ? kf.offset : clampOffset(parsedOffset);
                update({
                  keyframes: state.keyframes
                    .map((k) => (k.id === kf.id ? { ...k, offset } : k))
                    .sort((a, b) => a.offset - b.offset),
                });
              }}
              onPropertyChange={(property, value) =>
                update({
                  keyframes: state.keyframes.map((k) =>
                    k.id === kf.id
                      ? { ...k, properties: { ...k.properties, [property]: value } }
                      : k
                  ),
                })
              }
              onDuplicate={() => {
                const source = kf;
                const sorted = state.keyframes.slice().sort((a, b) => a.offset - b.offset);
                const offsets = sorted.map((k) => k.offset);
                const index = offsets.indexOf(source.offset);
                const nextOffset = index + 1 < offsets.length ? offsets[index + 1] : null;
                let target = clampOffset(source.offset + 5);
                if (typeof nextOffset === 'number' && target > nextOffset) {
                  target = clampOffset((source.offset + nextOffset) / 2);
                }
                const created: Keyframe = {
                  id: `kf-dup-${Date.now()}-${source.id}`,
                  offset: target,
                  properties: { ...source.properties },
                };
                update({
                  keyframes: [...state.keyframes, created].sort((a, b) => a.offset - b.offset),
                  selectedId: created.id,
                });
              }}
              onRemove={() => {
                const rest = state.keyframes
                  .filter((k) => k.id !== kf.id)
                  .sort((a, b) => a.offset - b.offset);
                update({
                  keyframes: rest,
                  selectedId: state.selectedId === kf.id ? (rest[0]?.id ?? null) : state.selectedId,
                });
              }}
            />
          ))}
        {selected ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="selected-summary">
            Selected: {keyframeSummary(selected)}
          </p>
        ) : null}
      </div>

      {/* Validation warnings */}
      {validation.warnings.length > 0 ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/30"
          data-testid="validation-warnings"
          role="alert"
        >
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Warnings
          </h3>
          <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-200">
            {validation.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Generated CSS */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Generated CSS
          </h3>
          <CopyButton value={css} testid="btn-copy-css" label="Copy CSS" />
        </div>
        <pre
          data-testid="css-code"
          className="overflow-x-auto rounded-md bg-gray-950 p-3 text-xs text-green-300"
        >
          <code>{css}</code>
        </pre>
      </div>

      {/* History */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved edits yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="text-gray-700 dark:text-gray-300">{entry.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All editing runs locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
