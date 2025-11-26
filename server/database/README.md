# Database Module

This module provides a clean, well-structured interface for database operations in the Zodula application. It has been refactored to improve maintainability, error handling, and code organization.

## Structure

```
database/
├── index.ts           # Main exports
├── builder.ts         # Factory class for creating generators and runners
├── database.ts        # Database connection and configuration
├── sql-generator.ts   # SQL code generation for migrations
├── sql-runner.ts      # SQL execution with error handling
├── types.ts           # Type definitions and interfaces
├── utils.ts           # Utility functions
└── README.md          # This documentation
```

## Key Components

### 1. DatabaseBuilder (Factory)

The main entry point that provides factory methods for creating database components:

```typescript
import { DatabaseBuilder } from './database'

// Create a SQL generator for migration code
const generator = DatabaseBuilder.createGenerator()

// Create a SQL runner for executing operations
const runner = DatabaseBuilder.createRunner(schema, db)

// Create both at once
const { generator, runner } = DatabaseBuilder.create(schema, db)
```

### 2. SQLGenerator

Generates SQL migration code strings that can be used in migration files:

```typescript
const generator = new SQLGenerator()

// Generate migration code
const addColumnCode = generator.addColumn("User", "email", "TEXT")
// Returns: 'await sql.addColumn("User", "email", "TEXT")'

const createTableCode = generator.createTable("User", {
    id: { type: "TEXT", notNull: true },
    name: { type: "TEXT", notNull: true }
})
```

### 3. SQLRunner

Executes SQL operations with proper error handling and validation:

```typescript
const runner = new SQLRunner(schema, db)

// All methods return DatabaseOperationResult
const result = await runner.createTable("User", {
    id: { type: "TEXT", notNull: true },
    name: { type: "TEXT", notNull: true }
})

if (result.success) {
    console.log("Table created successfully")
} else {
    console.error("Error:", result.error)
}
```

### 4. Types

Comprehensive type definitions for all database operations:

```typescript
interface ColumnDefinition {
    type: SQLTypeWithoutNULL
    notNull?: boolean
}

interface DatabaseOperationResult {
    success: boolean
    error?: string
    data?: any
}
```

### 5. Utilities

Helper functions for common database operations:

```typescript
import { normalizeName, escapeIdentifier, generateConstraintName } from './utils'

const normalized = normalizeName('"UserName"') // "username"
const escaped = escapeIdentifier('user-name')  // '"user-name"'
const constraint = generateConstraintName('unique', 'User', ['email']) // "unique_user_email"
```

## Key Improvements

### 1. **Separation of Concerns**
- SQL generation and execution are now in separate classes
- Types are extracted to their own module
- Utilities are organized in a dedicated file

### 2. **Error Handling**
- All SQL operations return `DatabaseOperationResult` with success/error status
- Proper try-catch blocks around all database operations
- Meaningful error messages for debugging

### 3. **Type Safety**
- Comprehensive TypeScript interfaces
- Proper type exports and re-exports
- Generic types for better code reuse

### 4. **Code Quality**
- Removed all commented-out Kysely code
- Added comprehensive JSDoc documentation
- Consistent naming conventions
- Proper async/await usage

### 5. **Maintainability**
- Smaller, focused files
- Clear module boundaries
- Easy to test individual components
- Backward compatibility maintained

## Usage Examples

### Creating a Migration

```typescript
import { DatabaseBuilder } from './database'

const generator = DatabaseBuilder.createGenerator()

// Generate migration code
const migrationCode = `
export default $migration(({sql}) => {
    ${generator.createTable("User", {
        id: { type: "TEXT", notNull: true },
        name: { type: "TEXT", notNull: true },
        email: { type: "TEXT", notNull: true }
    })}
    
    ${generator.addUnique("User", ["email"])}
})
`
```

### Executing Database Operations

```typescript
import { DatabaseBuilder } from './database'

const runner = DatabaseBuilder.createRunner(schema, db)

// Create table with error handling
const result = await runner.createTable("User", {
    id: { type: "TEXT", notNull: true },
    name: { type: "TEXT", notNull: true }
}, {
    unique: [["email"]],
    index: [["name"]]
})

if (!result.success) {
    throw new Error(`Failed to create table: ${result.error}`)
}
```

### Using Utilities

```typescript
import { normalizeName, generateUniqueConstraintName } from './utils'

const tableName = "User"
const columns = ["email", "username"]
const constraintName = generateUniqueConstraintName(tableName, columns)
// Returns: "unique_user_email_username"
```

## Migration from Old Code

The refactored code maintains backward compatibility. You can update imports gradually:

```typescript
// Old way
import { SQLGenerator, SQLRunner } from './builder'

// New way (recommended)
import { DatabaseBuilder } from './database'
const { generator, runner } = DatabaseBuilder.create(schema, db)

// Or still works
import { SQLGenerator, SQLRunner } from './database'
```

## Testing

Each component can be tested independently:

```typescript
// Test SQLGenerator
const generator = new SQLGenerator()
expect(generator.addColumn("User", "email", "TEXT"))
    .toBe('await sql.addColumn("User", "email", "TEXT")')

// Test SQLRunner with mock database
const mockDb = createMockDatabase()
const runner = new SQLRunner("test", mockDb)
const result = await runner.createTable("User", { id: { type: "TEXT", notNull: true } })
expect(result.success).toBe(true)
```

This refactored structure provides a solid foundation for database operations while maintaining clean, maintainable, and well-documented code.
