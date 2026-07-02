/**
 * Action definitions — the contract between raw input and gameplay.
 *
 * Gameplay systems query actions ('moveForward'), never keys ('KeyW').
 * The Keybinds options screen is generated from this table; adding an action
 * here + a default binding in defaultSettings.js is all that's required.
 */
export const ACTIONS = Object.freeze([
  { id: 'moveForward', label: 'Move Forward', category: 'Movement' },
  { id: 'moveBackward', label: 'Move Backward', category: 'Movement' },
  { id: 'turnLeft', label: 'Turn Left', category: 'Movement' },
  { id: 'turnRight', label: 'Turn Right', category: 'Movement' },
  { id: 'run', label: 'Run', category: 'Movement' },
  { id: 'quickTurn', label: 'Quick Turn (180°)', category: 'Movement' },
  { id: 'interact', label: 'Interact / Confirm', category: 'Actions' },
  { id: 'aim', label: 'Ready Weapon (hold)', category: 'Actions' },
  { id: 'attack', label: 'Attack (while ready)', category: 'Actions' },
  { id: 'inventory', label: 'Inventory', category: 'Actions' },
  { id: 'pause', label: 'Pause / Back', category: 'System' },
  { id: 'debugOverlay', label: 'Debug Overlay', category: 'System' },
]);
