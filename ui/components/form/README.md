# Form Layout System

The Form component now uses a field-type-based layout system similar to Frappe framework, eliminating the need for complex `model.ui.sections` configuration.

## Layout Field Types

### 1. Tab Field Type
Creates a new tab in the form. **Important**: Tabs are only displayed when Tab fields are explicitly defined in the model.

```json
{
    "main_tab": {
        "type": "Tab",
        "label": "Main"
    }
}
```

### 2. Section Field Type
Creates a new section within the current tab with configurable columns and collapsible behavior.

```json
{
    "general_section": {
        "type": "Section",
        "label": "General Information",
        "columns": 2,
        "collapsible": true,
        "defaultCollapsed": false
    }
}
```

**Section Properties:**
- `columns`: Number of columns (1-8 supported)
- `collapsible`: Whether the section can be collapsed (defaults to `true`)
- `defaultCollapsed`: Initial collapsed state (defaults to `false`)

**Note**: Sections are collapsible by default for better form organization. The entire section header is clickable to expand/collapse.

### 3. Column Field Type
Specifies column configuration for the current section.

```json
{
    "column_config": {
        "type": "Column",
        "columns": 3
    }
}
```

## Tab Behavior

**With Tab Fields:**
- When Tab fields are defined, the Tabs component is displayed
- Users can navigate between different tabs
- Each tab contains its own set of sections

**Without Tab Fields:**
- No Tabs component is shown
- All sections are displayed in a single view
- Simpler, more compact form layout

## Column System

The form supports flexible column layouts:

- **1 column**: Single column layout
- **2 columns**: Two-column grid (responsive)
- **3 columns**: Three-column grid (responsive)
- **4 columns**: Four-column grid (responsive)
- **6+ columns**: Extended grid with 2xl breakpoint support

## Collapsible Sections

**Default Behavior:**
- All sections are collapsible by default
- The entire section header is clickable
- Hover effects provide visual feedback
- Keyboard navigation support (Enter/Space keys)

**Configuration:**
```json
{
    "advanced_section": {
        "type": "Section",
        "label": "Advanced Settings",
        "columns": 1,
        "collapsible": true,        // Optional: defaults to true
        "defaultCollapsed": true    // Optional: defaults to false
    }
}
```

**Visual Features:**
- Reduced title size (`text-base` instead of `text-lg`)
- Hover background effect on collapsible sections
- Smooth transitions and animations
- Clear chevron indicators (right = collapsed, down = expanded)

## Examples

### Example 1: Form Without Tabs (Single View)
```json
{
    "fields": {
        "general_section": {
            "type": "Section",
            "label": "General Information",
            "columns": 2,
            "collapsible": true
        },
        "name": {
            "type": "Text",
            "label": "Name",
            "required": true
        },
        "file": {
            "type": "File",
            "label": "File",
            "required": true
        }
    }
}
```

**Result**: Single view with collapsible sections, no tab navigation.

### Example 2: Form With Tabs
```json
{
    "fields": {
        "main_tab": {
            "type": "Tab",
            "label": "Main"
        },
        "general_section": {
            "type": "Section",
            "label": "General Information",
            "columns": 2
        },
        "name": {
            "type": "Text",
            "label": "Name"
        },
        "settings_tab": {
            "type": "Tab",
            "label": "Settings"
        },
        "system_section": {
            "type": "Section",
            "label": "System Settings",
            "columns": 1
        }
    }
}
```

**Result**: Tabbed interface with "Main" and "Settings" tabs.

## Complete Example

Here's a complete File model example showing all layout features:

```json
{
    "fields": {
        "main_tab": {
            "type": "Tab",
            "label": "Main"
        },
        "general_section": {
            "type": "Section",
            "label": "General Information",
            "columns": 2,
            "collapsible": true,
            "defaultCollapsed": false
        },
        "name": {
            "type": "Text",
            "label": "Name",
            "required": true
        },
        "file": {
            "type": "File",
            "label": "File",
            "required": true
        },
        "file_info_section": {
            "type": "Section",
            "label": "File Information",
            "columns": 3,
            "collapsible": true,
            "defaultCollapsed": false
        },
        "size": {
            "type": "Integer",
            "label": "Size",
            "readonly": true
        },
        "type": {
            "type": "Text",
            "label": "Type",
            "readonly": true
        },
        "uploaded_at": {
            "type": "Datetime",
            "label": "Uploaded At",
            "readonly": true
        },
        "advanced_section": {
            "type": "Section",
            "label": "Advanced Settings",
            "columns": 1,
            "collapsible": true,
            "defaultCollapsed": true
        },
        "description": {
            "type": "Long Text",
            "label": "Description"
        },
        "tags": {
            "type": "Select",
            "label": "Tags",
            "options": "Document\nImage\nVideo\nAudio"
        }
    }
}
```

## Layout Behavior

1. **Tab Creation**: When a `Tab` field is encountered, a new tab is created
2. **Section Creation**: When a `Section` field is encountered, a new section is created within the current tab
3. **Column Configuration**: The `columns` property in Section fields determines the grid layout
4. **Field Grouping**: Regular fields are automatically grouped within the current section
5. **Layout Field Filtering**: Tab, Section, and Column fields are filtered out from the rendered form
6. **Tab Display**: Tabs are only shown when Tab fields are explicitly defined
7. **Collapsible Sections**: All sections are collapsible by default for better organization

## Benefits

- **Simplified Configuration**: No complex UI configuration objects
- **Field-Driven Layout**: Layout is defined directly in field definitions
- **Responsive Design**: Automatic responsive grid system
- **Collapsible Sections**: Better organization of complex forms
- **Conditional Tabs**: Tabs only appear when needed
- **Improved UX**: Entire section headers are clickable
- **Keyboard Accessible**: Full keyboard navigation support
- **Type Safety**: Maintains TypeScript support
- **Frappe-like**: Familiar to developers coming from Frappe framework

## Migration from Old System

**Before (with model.ui.sections):**
```json
{
    "ui": {
        "sections": {
            "general": {
                "tab": "main",
                "columns": 2
            }
        }
    }
}
```

**After (with field types):**
```json
{
    "general_section": {
        "type": "Section",
        "label": "General",
        "columns": 2
    }
}
```

The new system is more intuitive and easier to maintain, as layout configuration is co-located with field definitions.
