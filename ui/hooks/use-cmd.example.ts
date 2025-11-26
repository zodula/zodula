// Example usage of the unified use-cmd hook

import { useCmd } from './use-cmd';

// Example 1: Simple form shortcuts
export function useFormShortcuts() {
  const { shortcutHelp } = useCmd({
    commands: {
      'ctrl+s': () => console.log('Save form'),
      'ctrl+n': () => console.log('New form'),
      'escape': () => console.log('Cancel form'),
      'f1': () => console.log('Show help')
    }
  });

  return { shortcutHelp };
}

// Example 2: Document editor shortcuts
export function useDocumentShortcuts() {
  const { shortcutHelp } = useCmd({
    commands: {
      'ctrl+s': () => console.log('Save document'),
      'ctrl+z': () => console.log('Undo'),
      'ctrl+y': () => console.log('Redo'),
      'ctrl+c': () => console.log('Copy'),
      'ctrl+v': () => console.log('Paste'),
      'ctrl+a': () => console.log('Select all'),
      'ctrl+f': () => console.log('Find'),
      'ctrl+h': () => console.log('Replace'),
      'ctrl+p': () => console.log('Print'),
      'f1': () => console.log('Show help')
    }
  });

  return { shortcutHelp };
}

// Example 3: Navigation shortcuts
export function useNavigationShortcuts() {
  const { shortcutHelp } = useCmd({
    commands: {
      'ctrl+1': () => console.log('Go to page 1'),
      'ctrl+2': () => console.log('Go to page 2'),
      'ctrl+3': () => console.log('Go to page 3'),
      'ctrl+left': () => console.log('Previous page'),
      'ctrl+right': () => console.log('Next page'),
      'ctrl+home': () => console.log('Go to start'),
      'ctrl+end': () => console.log('Go to end'),
      'escape': () => console.log('Close modal')
    }
  });

  return { shortcutHelp };
}

// Example 4: Conditional shortcuts
export function useConditionalShortcuts(isDirty: boolean, isLoading: boolean) {
  const { shortcutHelp } = useCmd({
    commands: {
      'ctrl+s': isDirty && !isLoading ? () => console.log('Save changes') : () => {},
      'ctrl+n': !isLoading ? () => console.log('New document') : () => {},
      'ctrl+delete': !isLoading ? () => console.log('Delete document') : () => {},
      'f1': () => console.log('Show help')
    },
    disabled: isLoading
  });

  return { shortcutHelp };
}

// Example 5: Custom key combinations
export function useCustomShortcuts() {
  const { shortcutHelp } = useCmd({
    commands: {
      'ctrl+shift+s': () => console.log('Save as'),
      'ctrl+alt+n': () => console.log('New from template'),
      'ctrl+shift+d': () => console.log('Duplicate'),
      'ctrl+shift+r': () => console.log('Reset form'),
      'alt+left': () => console.log('Go back'),
      'alt+right': () => console.log('Go forward'),
      'space': () => console.log('Play/Pause'),
      'enter': () => console.log('Submit'),
      'delete': () => console.log('Delete selected')
    }
  });

  return { shortcutHelp };
}
