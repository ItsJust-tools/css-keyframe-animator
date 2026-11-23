'use client';

import React from 'react';
import { keyframeSummary, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  const setNumber = (field: 'durationMs' | 'iterationCount') => (raw: string) => {
    const value = Math.max(0, Math.round(Number(raw)));
    onChange({ ...state, [field]: Number.isFinite(value) ? value : state[field] });
  };

  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="anim-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Animation settings</h3>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Duration (ms)
          <input
            type="number"
            min={0}
            value={state.durationMs}
            data-testid="sidebar-duration"
            onChange={(e) => setNumber('durationMs')(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Iterations (0 = infinite)
          <input
            type="number"
            min={0}
            value={state.iterationCount}
            data-testid="sidebar-iterations"
            onChange={(e) => setNumber('iterationCount')(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyframes</h3>
        <p
          className="text-xs text-gray-600 dark:text-gray-300"
          data-testid="sidebar-keyframe-count"
        >
          {state.keyframes.length} keyframe{state.keyframes.length === 1 ? '' : 's'} defined
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {state.keyframes
            .slice()
            .sort((a, b) => a.offset - b.offset)
            .map((kf) => (
              <li key={kf.id}>{keyframeSummary(kf)}</li>
            ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>Space</kbd> — Play / pause the preview
          </li>
          <li>
            <kbd>C</kbd> — Copy generated CSS
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current animation state; open
          it to restore this animation.
        </p>
      </div>
    </div>
  );
};
