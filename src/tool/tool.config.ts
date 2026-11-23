const toolConfig = {
  id: 'css-keyframe-animator',
  name: 'CSS Keyframe Animator',
  category: 'Design',
  description:
    'Create and preview CSS keyframe animations with a visual timeline and export ready-to-use CSS code.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf', 'json'] as (
    'png' | 'jpeg' | 'webp' | 'pdf' | 'json'
  )[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    brand: 'CSS Keyframe Animator',
  },
};

export default toolConfig;
