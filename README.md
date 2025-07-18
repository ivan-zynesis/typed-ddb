# typed-ddb

[![codecov](https://codecov.io/gh/ivan-zynesis/typed-ddb/graph/badge.svg)](https://codecov.io/gh/ivan-zynesis/typed-ddb)

A TypeScript library for DynamoDB data modeling with strongly-typed interfaces and decorator-based schema definition.

## Features

- **Type Safety**: Uses TypeScript decorators and reflection to provide compile-time type checking for DynamoDB operations
- **Data Transformation**: Automatic serialization/deserialization of complex types (objects, arrays, dates) for DynamoDB storage
- **Relationships**: Support for HasOne/HasMany relationships with foreign key transformations via @BelongsTo
- **Index Support**: Global and local secondary indexes with type-safe querying
- **Pagination**: Built-in pagination support for query and scan operations
- **Repository Pattern**: Generic repository class providing CRUD operations for DynamoDB entities
- **Test Utilities**: In-memory implementations for testing

## Installation

```bash
npm install @ivan-lee/typed-ddb
# or
yarn add @ivan-lee/typed-ddb
# or
pnpm add @ivan-lee/typed-ddb
```

## Quick Start

### 1. Define Your Entity

```typescript
import { Table, PartitionKey, SortKey, Attribute, Index } from '@ivan-lee/typed-ddb';

@Table('Users')
class User {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  email: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'number' })
  age: number;

  @Attribute({ type: 'boolean' })
  isActive: boolean;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}
```

### 2. Use the Repository

```typescript
import { Repository } from '@ivan-lee/typed-ddb';

const userRepo = new Repository(User);

// Create a user
const user = await userRepo.create({
  id: 'user-123',
  email: 'john@example.com',
  name: 'John Doe',
  age: 30,
  isActive: true
});

// Get a user
const retrieved = await userRepo.get('user-123');

// Query users
const results = await userRepo.query('user-123');

// Update a user
const updated = await userRepo.update({
  id: 'user-123',
  name: 'Jane Doe',
  age: 31,
  CreatedAt: user.CreatedAt // Required for updates
});

// Delete a user
await userRepo.delete('user-123');
```

## Core Components

### Repository Pattern

The `Repository` class provides a generic interface for DynamoDB operations:

```typescript
const repo = new Repository(Entity);
await repo.create(entity);
await repo.get(partitionKey, sortKey);
await repo.query(partitionKey, sortKeyCondition);
await repo.update(entity);
await repo.delete(partitionKey, sortKey);
```

### Decorators

- **@Table(name)**: Define the DynamoDB table name
- **@PartitionKey()**: Mark a field as partition key
- **@SortKey()**: Mark a field as sort key
- **@Attribute(options)**: Define field attributes and types
- **@Index(options)**: Define secondary indexes
- **@BelongsTo()**: Define foreign key relationships
- **@HasOne()/@HasMany()**: Define relationships

## Entity Definition Patterns

### Basic Entity with Composite Key

```typescript
@Table('Posts')
class Post {
  @PartitionKey()
  @Attribute({ type: 'string' })
  userId: string;

  @SortKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  title: string;

  @Attribute({ type: 'string' })
  content: string;

  @Index({ name: 'StatusIndex', sortKey: 'publishedAt' })
  @Attribute({ type: 'enums', enums: ['draft', 'published', 'archived'] })
  status: 'draft' | 'published' | 'archived';

  @Attribute({ type: 'number' })
  publishedAt: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}
```

### Entity with Relationships

```typescript
@Table('Profiles')
class Profile {
  @PartitionKey()
  @BelongsTo<Pick<User, 'id'>>(
    (user: Pick<User, 'id'>) => user.id,
    (userId: string) => ({ id: userId })
  )
  @Attribute({ type: 'string' })
  userId: Pick<User, 'id'>;

  @Attribute({ type: 'string', optional: true })
  bio?: string;

  @Attribute({ type: 'object', optional: true })
  settings?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    privacy: 'public' | 'private';
  };

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}
```

## Important Rules

### � Decorator Order

The `@PartitionKey()`, `@SortKey()`, and `@Index()` decorators **MUST** be placed **BEFORE** the `@Attribute()` decorator:

```typescript
//  Correct
@PartitionKey()
@Attribute({ type: 'string' })
id: string;

// L Incorrect - will cause runtime errors
@Attribute({ type: 'string' })
@PartitionKey()
id: string;
```

### � Index Usage

Only apply `@Index()` to the **partition key** of the secondary index:

```typescript
//  Correct
@Index({ name: 'StatusIndex', sortKey: 'publishedAt' })
@Attribute({ type: 'string' })
status: string;

// The sort key field is NOT decorated with @Index
@Attribute({ type: 'number' })
publishedAt: number;
```

### � Auto-Managed Columns

The library automatically manages `CreatedAt` and `UpdatedAt` columns:

- **CreatedAt**: Automatically set during creation, **required** in update operations
- **UpdatedAt**: Automatically set during updates

```typescript
//  Create - don't include timestamps
await repo.create({ name: 'John' });

//  Update - include original CreatedAt
await repo.update({
  id: 'user-123',
  name: 'Jane',
  CreatedAt: originalUser.CreatedAt
});
```

## Advanced Usage

### Querying with Conditions

```typescript
// Greater than
const posts = await postRepo.query(userId, { gt: 'post-100' });

// Between
const posts = await postRepo.query(userId, { between: ['post-001', 'post-100'] });

// Using secondary index
const posts = await postRepo.query('published', { gt: 1640995200000 }, {
  index: 'StatusIndex'
});
```

### Pagination

```typescript
// First page
const firstPage = await repo.query(partitionKey, undefined, { limit: 10 });

// Next page
const nextPage = await repo.query(partitionKey, undefined, {
  limit: 10,
  lastKey: firstPage.lastKey
});
```

### Scanning

```typescript
// Scan with conditions
const results = await repo.scan({
  partitionKey: { eq: 'user-123' }
});

// Scan with index
const results = await repo.scan({
  partitionKey: { eq: 'active@example.com' }
}, {
  index: repo.getDefaultIndexName('global', 'email')
});
```

## Testing

The library includes test utilities for in-memory testing:

```typescript
import { InMemoryRepository, InMemoryStorage } from '@ivan-lee/typed-ddb/test-utility';

// Use in-memory repository for testing
const repo = new InMemoryRepository(User);
```

## Development

### Prerequisites

- Node.js 16+
- PNPM (recommended)

### Setup

```bash
git clone https://github.com/ivan-zynesis/typed-ddb.git
cd typed-ddb
pnpm install
```

### Commands

- **Build**: `pnpm run build` - Compiles TypeScript
- **Test**: `pnpm run test` - Runs Jest tests with DynamoDB testcontainers
- **Lint**: `pnpm run lint` - Runs ESLint on source and test files
- **Format**: `pnpm run format` - Fixes linting issues automatically

### Testing

The project uses Jest with testcontainers for integration testing. Tests automatically spin up a DynamoDB container for realistic testing.

## Dependencies

- **dynamoose**: DynamoDB ODM for Node.js
- **class-validator**: Validation decorators
- **class-transformer**: Object transformation utilities
- **reflect-metadata**: Required for decorator metadata

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Error Handling

Operations that should fail will **throw errors** rather than returning `null` or `undefined`. Always use proper error handling:

```typescript
try {
  const result = await repo.get(partitionKey);
} catch (error) {
  console.error('Operation failed:', error.message);
}
```

## Architecture

This library follows the Repository pattern and uses TypeScript decorators for schema definition. The main components are:

- **Repository**: Generic CRUD operations
- **Decorators**: Schema definition (@Table, @PartitionKey, @SortKey, @Attribute, @Index)
- **Test Utilities**: In-memory implementations for testing

For more detailed information, see the [CLAUDE.md](CLAUDE.md) file.