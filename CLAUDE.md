# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `pnpm run build` - Compiles TypeScript using tsconfig.build.json
- **Test**: `pnpm run test` - Runs Jest tests with proper DynamoDB test configuration
- **Lint**: `pnpm run lint` - Runs ESLint on source and test files
- **Format**: `pnpm run format` - Fixes linting issues automatically

## Architecture Overview

This is a TypeScript library for DynamoDB data modeling with strongly-typed interfaces. The main components are:

### Core Components

- **Repository Pattern**: `src/dynamodb/core/Repository.ts` - Generic repository class providing CRUD operations for DynamoDB entities
- **Decorators**: `src/dynamodb/core/decorators.ts` - TypeScript decorators for defining DynamoDB schema (@Table, @PartitionKey, @SortKey, @Attribute, @Index, @BelongsTo, @HasOne, @HasMany)
- **Test Utilities**: `src/dynamodb/test-utility/` - In-memory implementations for testing (InMemoryRepository, InMemoryStorage)

### Key Features

- **Type Safety**: Uses TypeScript decorators and reflection to provide compile-time type checking for DynamoDB operations
- **Data Transformation**: Automatic serialization/deserialization of complex types (objects, arrays, dates) for DynamoDB storage
- **Relationships**: Support for HasOne/HasMany relationships with foreign key transformations via @BelongsTo
- **Index Support**: Global and local secondary indexes with type-safe querying
- **Pagination**: Built-in pagination support for query and scan operations

### Dependencies

- **dynamoose**: DynamoDB ODM for Node.js
- **class-validator**: Validation decorators
- **class-transformer**: Object transformation utilities
- **reflect-metadata**: Required for decorator metadata

### Testing

- Uses Jest with testcontainers for integration testing
- DynamoDB emulator setup in `src/dynamodb/__test__/DynamoDbEmulator.ts`
- Test timeout configured for 180 seconds due to container startup time

### Entity Definition Pattern

Entities are defined using decorators:

```typescript
@Table('TableName')
class Entity {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @SortKey()
  @Attribute({ type: 'string' })
  timestamp: string;

  @Attribute({ type: 'object', optional: true })
  data: Record<string, any>;
}
```

### CRITICAL: Decorator Order Rule

⚠️ **IMPORTANT**: The `@PartitionKey()`, `@SortKey()`, and `@Index()` decorators MUST be placed BEFORE the `@Attribute()` decorator. This is because these decorators rely on the metadata set by the `@Attribute()` decorator.

**Correct order:**
```typescript
@PartitionKey()
@Attribute({ type: 'string' })
id: string;

@SortKey()
@Attribute({ type: 'string' })
sortKey: string;

@Index({ name: 'MyIndex', sortKey: 'sortKeyFieldName' })
@Attribute({ type: 'string' })
partitionKeyField: string;
```

**Incorrect order (will cause runtime errors):**
```typescript
@Attribute({ type: 'string' })
@PartitionKey()  // ❌ This will fail!
id: string;
```

### Decorator Order for Complex Fields

For fields with multiple decorators, follow this order:
1. `@PartitionKey()` / `@SortKey()` / `@Index()`
2. `@BelongsTo()` (for foreign keys)
3. `@Attribute()`

Example:
```typescript
@PartitionKey()
@BelongsTo<Pick<User, 'id'>>(
  (user: Pick<User, 'id'>) => user.id,
  (userId: string) => ({ id: userId })
)
@Attribute({ type: 'string' })
userId: Pick<User, 'id'>;
```

### Index Decorator Usage

⚠️ **IMPORTANT**: The `@Index()` decorator should only be applied to the **partition key** of the secondary index. If you need a sort key for the index, specify it in the `sortKey` option:

**Correct Index Usage:**
```typescript
// Only decorate the partition key field of the secondary index
@Index({ name: 'StatusIndex', sortKey: 'publishedAt' })
@Attribute({ type: 'enums', enums: ['draft', 'published', 'archived'] })
status: 'draft' | 'published' | 'archived';

// The sort key field is NOT decorated with @Index
@Attribute({ type: 'number' })
publishedAt: number;
```

**Incorrect Index Usage (will create duplicate indexes):**
```typescript
@Index({ name: 'StatusIndex' })
@Attribute({ type: 'string' })
status: string;

@Index({ name: 'StatusIndex' })  // ❌ Don't do this!
@Attribute({ type: 'number' })
publishedAt: number;
```

### Error Handling

Operations that should fail (e.g., missing required keys, invalid conditions) will **throw errors** rather than returning `null` or `undefined`. Always use proper error handling:

```typescript
try {
  // This will throw an error if sort key is required but not provided
  const result = await repo.get(partitionKey);
} catch (error) {
  console.error('Operation failed:', error.message);
}
```

### Auto-Managed Columns

⚠️ **IMPORTANT**: The library automatically manages `CreatedAt` and `UpdatedAt` columns:

- **`CreatedAt`**: Automatically set when creating entities, **REQUIRED** in update operations (case-sensitive)
- **`UpdatedAt`**: Automatically set when updating entities (case-sensitive)

**Entity Definition:**
```typescript
@Table('Users')
class User {
  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'date' })
  CreatedAt: Date;  // Auto-managed by library

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date; // Auto-managed by library
}
```

**Usage Patterns:**

**Create Operation:**
```typescript
// ✅ Correct: Don't include CreatedAt/UpdatedAt in create
const created = await repo.create({
  name: 'John Doe'
});
// CreatedAt is auto-populated by library
```

**Update Operation:**
```typescript
// ✅ Correct: Include CreatedAt from original entity, UpdatedAt is auto-managed
await repo.update({
  id: 'user-123',
  name: 'Jane Doe',
  CreatedAt: created.CreatedAt  // Required: preserve original CreatedAt
});
// UpdatedAt is automatically set by library
```

**Incorrect Usage:**
```typescript
// ❌ Incorrect: Don't manually set CreatedAt in create
await repo.create({
  name: 'John Doe',
  CreatedAt: new Date()  // Don't do this!
});

// ❌ Incorrect: Don't manually set UpdatedAt
await repo.update({
  id: 'user-123', 
  name: 'Jane Doe',
  CreatedAt: created.CreatedAt,
  UpdatedAt: new Date()  // Don't do this!
});
```

### Repository Usage

```typescript
const repo = new Repository(Entity);
await repo.create(entity);
await repo.get(partitionKey, sortKey);
await repo.query(partitionKey, sortKeyCondition);
await repo.update(entity);
await repo.delete(partitionKey, sortKey);
```