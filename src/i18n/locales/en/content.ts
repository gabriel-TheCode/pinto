/**
 * Text Pinto draws on the Play Console page itself: the launcher, the inline
 * entry point and the window bar around the panel. Imported on its own by the
 * content script so the full dictionary never ships into Play Console.
 */
export const content = {
  'content.title': 'Pinto',
  'content.launcher': 'Edit prices',
  'content.launcherLabel': 'Open Pinto to edit prices in bulk (Shift+P)',
  'content.inline': 'Edit these prices in bulk with Pinto',
  'content.inlineCta': 'Open',
  'content.frameTitle': 'Pinto — bulk pricing for Google Play',
  'content.dockLeft': 'Dock to the left',
  'content.dockRight': 'Dock to the right',
  'content.float': 'Floating window',
  'content.collapse': 'Collapse',
  'content.expand': 'Expand',
  'content.close': 'Close (Esc)',
  'content.dragHint': 'Drag to move',
} as const;
