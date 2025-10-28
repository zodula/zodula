import { useEffect, useCallback, useRef } from 'react';

interface UseCmdOptions {
    disabled?: boolean;
    preventDefault?: boolean;
}

interface KeyboardShortcut {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    action: () => void;
    description: string;
    disabled?: boolean;
}

// Simple hook for individual keyboard shortcuts
export function useCmd(
    keyCombo: string, 
    handler: () => void | Promise<void>, 
    options: UseCmdOptions = {}
) {
    const isProcessingRef = useRef(false);

    // Parse the key combination
    const parseKeyCombo = useCallback((combo: string) => {
        const parts = combo.toLowerCase().split('+').map(p => p.trim());
        
        let key = parts[parts.length - 1];
        let ctrlKey = false;
        let metaKey = false;
        let shiftKey = false;
        let altKey = false;

        // Detect platform for 'mod' modifier
        const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        // Parse modifiers
        for (let i = 0; i < parts.length - 1; i++) {
            const modifier = parts[i];
            switch (modifier) {
                case 'ctrl':
                    ctrlKey = true;
                    break;
                case 'cmd':
                case 'meta':
                    metaKey = true;
                    break;
                case 'mod':
                    // 'mod' maps to cmd on Mac, ctrl on Windows/Linux
                    if (isMac) {
                        metaKey = true;
                    } else {
                        ctrlKey = true;
                    }
                    break;
                case 'shift':
                    shiftKey = true;
                    break;
                case 'alt':
                    altKey = true;
                    break;
            }
        }

        // Handle special keys
        if (key === 'enter') key = 'Enter';
        if (key === 'escape') key = 'Escape';
        if (key === 'delete') key = 'Delete';
        if (key === 'backspace') key = 'Backspace';
        if (key === 'space') key = ' ';

        return { key, ctrlKey, metaKey, shiftKey, altKey };
    }, []);

    const shortcut = parseKeyCombo(keyCombo);

    // Handle keyboard events
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't process shortcuts if disabled
        if (options.disabled) return;

        // Don't process if we're in an input field (unless it's a global shortcut)
        const target = event.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.contentEditable === 'true';

        // Global shortcuts that work even in input fields
        const globalShortcuts = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
        const isGlobalShortcut = globalShortcuts.includes(event.key) ||
            (event.ctrlKey || event.metaKey) && ['n', 'l'].includes(event.key.toLowerCase());

        if (isInputField && !isGlobalShortcut) return;

        // Check if this shortcut matches
        if (!shortcut.key) return;
        
        const matches = shortcut.key.toLowerCase() === event.key.toLowerCase() &&
            !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey) &&
            !!shortcut.metaKey === event.metaKey &&
            !!shortcut.shiftKey === event.shiftKey &&
            !!shortcut.altKey === event.altKey;

        if (matches) {
            if (options.preventDefault !== false) {
                event.preventDefault();
                event.stopPropagation();
            }

            if (isProcessingRef.current) return;
            isProcessingRef.current = true;
            
            try {
                handler();
            } finally {
                isProcessingRef.current = false;
            }
        }
    }, [shortcut, handler, options.disabled, options.preventDefault]);

    // Register keyboard event listener
    useEffect(() => {
        if (options.disabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown, options.disabled]);

    return {
        isProcessing: isProcessingRef.current
    };
}

// Utility function to format shortcut keys for display
export function formatShortcutKeys(keys: string[]): string {
    return keys.filter(Boolean).join(' + ');
}

// Helper function to create shortcuts array for KeyboardShortcuts component
export function createShortcutsArray(shortcuts: Array<{key: string, description: string}>): Array<{keys: string, description: string}> {
    return shortcuts.map(shortcut => ({
        keys: shortcut.key,
        description: shortcut.description
    }));
}

// Utility function to check if a key combination matches a shortcut
export function matchesShortcut(
    event: KeyboardEvent,
    shortcut: KeyboardShortcut
): boolean {
    return shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey) &&
        !!shortcut.metaKey === event.metaKey &&
        !!shortcut.shiftKey === event.shiftKey &&
        !!shortcut.altKey === event.altKey;
}
