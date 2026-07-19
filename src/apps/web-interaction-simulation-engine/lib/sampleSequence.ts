import type { DemoSequence } from '../types/demoActions'

export function createSampleSequence(): DemoSequence {
  return {
    version: 1,
    id: 'sample-product-demo',
    name: 'Sample product workflow',
    description: 'A local demo sequence that exercises the reusable interaction action schema.',
    defaults: { actionDurationMs: 650, delayAfterMs: 180, typingIntervalMs: 55 },
    actions: [
      { id: 'a1', type: 'highlight', targetId: 'search', label: 'Find the search field', durationMs: 700 },
      { id: 'a2', type: 'move', targetId: 'search', label: 'Move to search' },
      { id: 'a3', type: 'click', targetId: 'search', label: 'Click search' },
      { id: 'a4', type: 'type', targetId: 'search', text: 'Browser automation', clearFirst: true, label: 'Type a query' },
      { id: 'a5', type: 'move', targetId: 'category', label: 'Move to category' },
      { id: 'a6', type: 'select', targetId: 'category', value: 'design', label: 'Choose Design' },
      { id: 'a7', type: 'upload', targetId: 'upload', fileName: 'sample-demo.png', fileType: 'image/png', label: 'Visualize file upload' },
      { id: 'a8', type: 'doubleClick', targetId: 'preview', label: 'Double-click preview' },
      { id: 'a9', type: 'drag', targetId: 'drag-card', toTargetId: 'drop-zone', label: 'Drag card to drop zone' },
      { id: 'a10', type: 'drop', targetId: 'drop-zone', label: 'Drop card' },
      { id: 'a11', type: 'focus', targetId: 'cta', label: 'Focus primary action', durationMs: 800 },
      { id: 'a12', type: 'zoom', targetId: 'cta', scale: 1.18, label: 'Zoom to action', durationMs: 700 },
      { id: 'a13', type: 'click', targetId: 'cta', label: 'Run demo' },
      { id: 'a14', type: 'scroll', y: 180, label: 'Smooth scroll', durationMs: 650 },
      { id: 'a15', type: 'wait', durationMs: 500, label: 'Wait for result' },
    ],
  }
}
