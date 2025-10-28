import React, { useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';

export type MyEditorProps = {
    value?: string | object | null;
    onChange: (value: string) => void;
    readOnly?: boolean;
    language?: string;
    height?: number | string;
    className?: string;
    theme?: string;
};

export default function MyEditor({
    value,
    onChange,
    readOnly = false,
    language = 'json',
    height = 280,
    className = '',
    theme = 'vs-dark',
}: MyEditorProps) {
    const editorValue = useMemo(() => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            return String(value);
        }
    }, [value]);

    const handleChange = useCallback((v?: string) => {
        onChange(v ?? '');
    }, [onChange]);

    return (
        <div className={`zd:rounded-xl zd:border zd:border-border zd:bg-[#0b1220] zd:overflow-hidden zd:shadow-sm ${className}`}>
            <Editor
                value={editorValue}
                defaultLanguage={language}
                onChange={handleChange}
                theme={theme}
                height={typeof height === 'number' ? `${height}px` : height}
                options={{
                    readOnly,
                    automaticLayout: true,
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    glyphMargin: false,
                    folding: false,
                    smoothScrolling: true,
                    renderWhitespace: 'none',
                    overviewRulerLanes: 0,
                    padding: { top: 12, bottom: 12 },
                    scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        useShadows: false,
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                        alwaysConsumeMouseWheel: false,
                    },
                    tabSize: 2,
                    formatOnType: true,
                    formatOnPaste: true,
                }}
            />
        </div>
    );
} 