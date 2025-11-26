# Migrator Tests

This directory contains comprehensive tests for the migrator functionality.

## Test Coverage

The tests cover all major change cases:

### 1. **Table Operations**
- ✅ Table creation (`createTable`)
- ✅ Table removal (`dropTable`)
- ✅ Table structure validation

### 2. **Column Operations**
- ✅ Column addition (`addColumn`)
- ✅ Column removal (`removeColumn`)
- ✅ Column modification (`modifyColumn`)
- ✅ Column type changes
- ✅ Column constraint changes (NOT NULL, UNIQUE, PRIMARY KEY)

### 3. **Index Operations**
- ✅ Index creation (`addIndex`)
- ✅ Index removal (`removeIndex`)
- ✅ Index modification (`modifyIndex`)
- ✅ Unique indexes
- ✅ Composite unique indexes

### 4. **Foreign Key Operations**
- ✅ Foreign key creation (`addForeignKey`)
- ✅ Foreign key removal (`removeForeignKey`)
- ✅ Foreign key modification (`modifyForeignKey`)

### 5. **Composite Unique Constraints**
- ✅ Proper handling of grouped unique constraints
- ✅ Prevention of individual unique indexes when fields are part of a group
- ✅ Correct composite index creation

### 6. **Schema Comparison**
- ✅ Table addition detection
- ✅ Table removal detection
- ✅ Column addition detection
- ✅ Column removal detection
- ✅ Column modification detection

### 7. **Operation Generation**
- ✅ Text generation for all operation types
- ✅ Consistency between apply and generate operations
- ✅ Proper migration file generation

## Running Tests

```bash
# Run all migrator tests
bun test apps/zodula/src/server/migrator/migrator.test.ts

# Run with verbose output
bun test --verbose apps/zodula/src/server/migrator/migrator.test.ts

# Run specific test
bun test --grep "composite unique" apps/zodula/src/server/migrator/migrator.test.ts
```

## Test Database

Tests use in-memory SQLite databases for fast execution and isolation:
- No file system dependencies
- Each test gets a fresh database
- Automatic cleanup after each test

## Mock Data

Tests use mock doctype definitions that cover:
- Basic field types (Text, Int, Check, Reference)
- Primary keys
- Required fields
- Unique constraints (individual and composite)
- Foreign key relationships

## Key Test Scenarios

1. **Complete Migration Flow**: Tests the full flow from schema comparison to migration generation
2. **Operation Execution**: Tests each operation type individually
3. **Text Generation**: Tests that operations can be converted to executable text
4. **Composite Constraints**: Specifically tests the composite unique constraint functionality
5. **Edge Cases**: Tests various edge cases and error conditions

## Assertions

Tests verify:
- Database schema structure matches expectations
- Operations execute successfully
- Generated text is syntactically correct
- Composite unique constraints work as expected
- No individual unique indexes are created for grouped fields
