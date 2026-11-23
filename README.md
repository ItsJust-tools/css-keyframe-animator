# CSS Keyframe Animator

Create and preview CSS keyframe animations with a visual timeline and export ready-to-use CSS code.

**Live:** [css-keyframe-animator.itsjust.tools](https://css-keyframe-animator.itsjust.tools)

## Features

- Add, edit, duplicate and remove keyframes at percentage offsets (0–100%)
- Edit standard CSS properties per keyframe: `transform`, `opacity`, `color`, `background-color`, `translate`, `scale`, `rotate`
- Visual timeline bar with draggable keyframe markers that update offsets live
- Live animated preview box with play/pause and reset controls
- Adjustable duration (ms), timing function (`ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier`) and iteration count (0 = infinite)
- Generated CSS output in a copyable code block (`@keyframes` plus a utility class)
- Validation warnings for missing 0%/100% keyframes and keyframes with no properties
- JSON import/export and shareable URL state; PNG/JPEG/WebP/PDF export of the canvas
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key     | Action                   |
| ------- | ------------------------ |
| `Space` | Play / pause the preview |
| `C`     | Copy generated CSS       |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t css-keyframe-animator .
docker run -p 3000:3000 css-keyframe-animator
```

## License

MIT
