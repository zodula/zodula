# use-dnd Hook

A comprehensive React hook for implementing drag and drop functionality with workspace items.

## Features

- **Drag and Drop**: Full HTML5 drag and drop API support
- **Visual Feedback**: Drag handles, drop indicators, and drag previews
- **Plugin Support**: Works seamlessly with workspace item plugins
- **Accessibility**: Proper ARIA attributes and keyboard support
- **TypeScript**: Full type safety and IntelliSense support

## Basic Usage

```tsx
import { useDnd, useDragHandle, useDropIndicator } from './use-dnd'

const MyComponent = () => {
  const items = [
    { id: '1', type: 'text', value: 'Hello' },
    { id: '2', type: 'link', value: 'https://example.com' }
  ]

  const {
    getDropZoneProps,
    getDragProps,
    draggedItem,
    dragOverIndex,
    isDragging
  } = useDnd({
    items,
    onReorder: (fromId, toId, type) => {
      console.log(`Moving ${fromId} ${type} ${toId}`)
    }
  })

  return (
    <div>
      {items.map((item, index) => (
        <div key={item.id} {...getDropZoneProps(index, item)}>
          <div {...getDragProps(item, index)}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}
```

## Advanced Usage with Workspace Items

```tsx
const WorkspaceView = () => {
  const { selectedWorkspace } = useWorkspace()
  const { reorderWorkspaceItems } = useWorkspaceEdit()
  
  const {
    getDropZoneProps,
    getDragProps,
    draggedItem,
    isDragging
  } = useDnd({
    items: selectedWorkspace?.items || [],
    onReorder: reorderWorkspaceItems,
    disabled: !isEditing
  })

  return (
    <div className="grid grid-cols-4 gap-4">
      {selectedWorkspace?.items.map((item, index) => {
        const plugin = workspaceItemPlugins[item.type]
        return (
          <div key={item.id} {...getDropZoneProps(index, item)}>
            <div {...getDragProps(item, index)}>
              {isEditing && (
                <div {...useDragHandle()}>
                  <GripVertical />
                </div>
              )}
              {plugin?.render({ value: item.value, item })}
            </div>
            {dragOverIndex === index && (
              <div {...useDropIndicator(true)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

## API Reference

### useDnd(options)

#### Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `WorkspaceItem[]` | - | Array of items to make draggable |
| `onReorder` | `(fromId: string, toId: string, type: 'before' \| 'after') => void` | - | Callback when items are reordered |
| `onMove` | `(fromId: string, toId: string, type: 'before' \| 'after') => void` | - | Alternative callback for moving items |
| `disabled` | `boolean` | `false` | Disable drag and drop |
| `dragHandleSelector` | `string` | `'[data-drag-handle]'` | CSS selector for drag handles |
| `dropZoneClass` | `string` | `'zd:relative'` | CSS class for drop zones |
| `dragPreviewClass` | `string` | `'zd:opacity-50 zd:rotate-2 zd:scale-105'` | CSS class for drag preview |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `getDropZoneProps` | `(index: number, item: WorkspaceItem) => DropZoneProps` | Props for drop zones |
| `getDragProps` | `(item: WorkspaceItem, index: number) => DragProps` | Props for draggable items |
| `draggedItem` | `DragItem \| null` | Currently dragged item |
| `dragOverIndex` | `number \| null` | Index of item being hovered over |
| `isDragging` | `boolean` | Whether any item is being dragged |

### useDragHandle(onDragStart?)

Creates props for drag handles.

### useDropIndicator(isActive, position?)

Creates props for drop indicators.

## Styling

The hook uses Tailwind CSS classes with the `zd:` prefix. You can customize the appearance by:

1. Overriding the default classes in the options
2. Using CSS custom properties
3. Extending the Tailwind configuration

## Accessibility

- Proper ARIA attributes for screen readers
- Keyboard navigation support
- Focus management during drag operations
- High contrast mode support

## Browser Support

- Chrome 4+
- Firefox 3.5+
- Safari 3.1+
- Edge 12+

## Performance

- Optimized for large lists (1000+ items)
- Minimal re-renders during drag operations
- Efficient event handling
- Memory leak prevention
