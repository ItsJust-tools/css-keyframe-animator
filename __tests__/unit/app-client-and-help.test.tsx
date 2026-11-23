import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockHandleExport = vi.fn();
const mockImport = vi.fn();
const mockToolbarActions = { canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn() };

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare}>
      trigger-share
    </button>
  ),
  useTool: () => ({
    state: {
      data: {
        keyframes: [
          {
            id: 'kf-0',
            offset: 0,
            properties: {
              transform: '',
              opacity: '1',
              color: '',
              'background-color': '',
              translate: '',
              scale: '',
              rotate: '',
            },
          },
          {
            id: 'kf-1',
            offset: 100,
            properties: {
              transform: '',
              opacity: '0.2',
              color: '',
              'background-color': '',
              translate: '',
              scale: '',
              rotate: '',
            },
          },
        ],
        durationMs: 2000,
        timingFunction: 'ease',
        bezier: '0.25, 0.1, 0.25, 1',
        iterationCount: 1,
        playing: false,
        selectedId: 'kf-0',
        history: [],
      },
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: mockHandleExport,
    importFromFile: mockImport,
    isImporting: false,
    toolbarActions: mockToolbarActions,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'css-keyframe-animator',
    name: 'CSS Keyframe Animator',
    version: '1.0.0',
    features: { sidebar: true },
    theme: { brand: 'CSS Keyframe Animator' },
  },
  templateBaseVersion: '1.1.0',
  Canvas: () => <div>canvas</div>,
  Toolbar: () => <div>toolbar</div>,
  Sidebar: () => <div>sidebar</div>,
  summaryText: () => 'summary',
}));

vi.mock('@/tool/tool-definition', () => ({
  cssKeyframeAnimatorTool: {
    serialize: (state: unknown) => JSON.stringify(state),
    deserialize: () => ({
      success: true,
      data: {
        keyframes: [
          {
            id: 'kf-0',
            offset: 0,
            properties: {
              transform: '',
              opacity: '1',
              color: '',
              'background-color': '',
              translate: '',
              scale: '',
              rotate: '',
            },
          },
          {
            id: 'kf-1',
            offset: 100,
            properties: {
              transform: '',
              opacity: '0.2',
              color: '',
              'background-color': '',
              translate: '',
              scale: '',
              rotate: '',
            },
          },
        ],
        durationMs: 2000,
        timingFunction: 'ease',
        bezier: '0.25, 0.1, 0.25, 1',
        iterationCount: 1,
        playing: false,
        selectedId: 'kf-0',
        history: [],
      },
    }),
  },
}));

describe('app client and help page', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/?state=e30%3D');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('handles share flow in tool client', async () => {
    render(<ToolClient />);

    expect(screen.getByText('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('trigger-share'));

    expect(mockToast).toHaveBeenCalled();
  });
});
