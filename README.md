# typed-ddb

[![codecov](https://codecov.io/gh/ivan-zynesis/typed-ddb/graph/badge.svg)](https://codecov.io/gh/ivan-zynesis/typed-ddb)
[![Known Vulnerabilities](https://snyk.io/test/github/ivan-zynesis/typed-ddb/badge.svg)](https://snyk.io/test/github/ivan-zynesis/typed-ddb)

A TypeScript library for DynamoDB data modeling with strongly-typed interfaces and decorator-based schema definition. Built on top of **Dynamoose** for robust DynamoDB operations.

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

⚠️ **Important**: This library uses **Dynamoose v4.0.4** under the hood. For compatibility, ensure you install the same version:

```bash
npm install dynamoose@4.0.4
# or
yarn add dynamoose@4.0.4
# or  
pnpm add dynamoose@4.0.4
```

📡 **Trigger System**: The trigger system uses **@preact/signals** for reactive programming. This is automatically installed as a dependency, but if you want to use signals directly in your application:

```bash
npm install @preact/signals
# or
yarn add @preact/signals
# or  
pnpm add @preact/signals
```

## Quick Start

### 0. Initialize Dynamoose Connection

**Before using this library**, you must initialize Dynamoose connection. This library relies on Dynamoose's global configuration. Refer to the [Dynamoose documentation](https://dynamoosejs.com/guide/Getting%20Started#configure) for detailed setup instructions.

```typescript
import * as dynamoose from 'dynamoose';

// For AWS DynamoDB
dynamoose.aws.configure({
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1'
});

// For DynamoDB Local
dynamoose.aws.configure({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1'
});

// Optional: Configure Dynamoose settings
dynamoose.aws.ddb.set({
  // Configure DynamoDB options
  region: 'us-east-1'
});
```

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

## Trigger System (Event-Driven Architecture)

This library includes a powerful signal-based trigger system that enables event-driven architecture patterns. Triggers allow you to react to entity changes (create, update, delete) without coupling business logic to your data models.

### Key Features

- **Clean Separation**: Entities stay pure, business logic stays in services
- **Signal-Based**: Uses @preact/signals for reactive programming
- **Frontend Integration**: Perfect for React useSyncExternalStore patterns
- **Type-Safe**: Full TypeScript support with strong typing
- **No Cyclic Dependencies**: Avoids architectural issues

### Basic Usage

#### 1. Mark Entity for Change Publishing

```typescript
import { Table, PartitionKey, Attribute, PublishChanges } from '@ivan-lee/typed-ddb';

@Table('Users')
@PublishChanges()  // Enable change publishing
class User {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  email: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'date' })
  CreatedAt: Date;
}
```

#### 2. Subscribe to Changes in Service Layer

```typescript
import { SubscribeToChanges, SubscriptionManager, EntityChangeEvent } from '@ivan-lee/typed-ddb';

class UserService {
  constructor() {
    // Initialize subscriptions
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(User, 'create')
  async onUserCreated(event: EntityChangeEvent<User>) {
    console.log('User created:', event.entity.email);
    
    // Send welcome email
    await this.emailService.sendWelcome(event.entity);
    
    // Update analytics
    await this.analyticsService.trackUserRegistration(event.entity);
  }

  @SubscribeToChanges(User, 'update')
  async onUserUpdated(event: EntityChangeEvent<User>) {
    console.log('User updated:', event.entity.email);
    console.log('Previous data:', event.previous);
    
    // Update search index
    await this.searchService.updateIndex(event.entity);
  }

  @SubscribeToChanges(User, 'delete')
  async onUserDeleted(event: EntityChangeEvent<User>) {
    console.log('User deleted:', event.previous?.email);
    
    // Cleanup user data
    await this.cleanupUserData(event.previous!);
  }

  // Subscribe to all events
  @SubscribeToChanges(User, 'all')
  async onAnyUserChange(event: EntityChangeEvent<User>) {
    // Log all changes for audit
    await this.auditService.logChange(event);
  }
}
```

#### 3. Multiple Service Integration

```typescript
class AnalyticsService {
  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(User, 'create')
  async onUserCreated(event: EntityChangeEvent<User>) {
    await this.trackUserRegistration(event.entity);
  }

  @SubscribeToChanges(User, 'update')
  async onUserUpdated(event: EntityChangeEvent<User>) {
    await this.updateUserAnalytics(event.entity);
  }
}
```

### Advanced Usage Examples

#### Event Sourcing Pattern

```typescript
class EventSourcingService {
  private eventStore: any[] = [];

  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(User, 'all')
  async onUserEvent(event: EntityChangeEvent<User>) {
    // Store event for event sourcing
    this.eventStore.push({
      type: `USER_${event.event.toUpperCase()}`,
      entity: event.entity,
      previous: event.previous,
      timestamp: event.timestamp,
      version: this.eventStore.length + 1
    });
  }

  getEventHistory() {
    return this.eventStore;
  }
}
```

#### Real-time Dashboard Updates

```typescript
class DashboardService {
  private userCount = 0;

  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(User, 'create')
  async onUserCreated() {
    this.userCount++;
    await this.updateDashboard();
  }

  @SubscribeToChanges(User, 'delete')
  async onUserDeleted() {
    this.userCount--;
    await this.updateDashboard();
  }

  private async updateDashboard() {
    // Update real-time dashboard
    await this.websocketService.broadcast('user-count', this.userCount);
  }
}
```

#### Conditional Triggers

```typescript
class NotificationService {
  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(User, 'update')
  async onUserUpdated(event: EntityChangeEvent<User>) {
    // Only send notification if email changed
    if (event.previous?.email !== event.entity.email) {
      await this.emailService.sendEmailChangeNotification(event.entity);
    }

    // Only update marketing lists if marketing consent changed
    if (event.previous?.marketingConsent !== event.entity.marketingConsent) {
      await this.marketingService.updateConsent(event.entity);
    }
  }
}
```

### Cleanup and Management

```typescript
class ApplicationService {
  private userService: UserService;
  private notificationService: NotificationService;

  constructor() {
    this.userService = new UserService();
    this.notificationService = new NotificationService();
  }

  async shutdown() {
    // Cleanup subscriptions
    SubscriptionManager.cleanupService(this.userService);
    SubscriptionManager.cleanupService(this.notificationService);
    
    // Or cleanup all subscriptions
    SubscriptionManager.cleanupAll();
  }

  getSubscriptionStats() {
    return SubscriptionManager.getStats();
  }
}
```

### Important Limitations

⚠️ **Database-Level Limitation**: Triggers only work when changes are made through this library's Repository class. Direct database operations (AWS CLI, other applications, etc.) will not trigger events.

⚠️ **In-Memory Only**: Signals are in-memory only. For distributed systems, consider using external message queues (SQS, EventBridge) in your trigger handlers.

⚠️ **Error Handling**: Trigger failures do not roll back database operations. Ensure proper error handling in your trigger handlers.

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

## Amplify Gen 2 Adapter

The library includes an adapter to generate AWS Amplify Gen 2 schema code from your decorator-based entities. This allows you to use the same entity definitions for both DynamoDB operations and Amplify Gen 2 schema generation.

### Installation

The adapter is included in the main package. No additional installation is needed.

### Defining Indexes for Amplify

To generate proper Amplify Gen 2 indexes, use the `@AmplifyGsi` decorator instead of `@Index`. This decorator is specifically designed for Amplify schema generation:

```typescript
import { Table, PartitionKey, Attribute } from '@ivan-lee/typed-ddb';
import { AmplifyGsi } from '@ivan-lee/typed-ddb/adapters';

@Table('Users')
class User {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  // Simple index (partition key only)
  @AmplifyGsi({ queryField: 'usersByEmail' })
  @Attribute({ type: 'string' })
  email: string;

  // Composite index (partition key + sort key)
  @AmplifyGsi({
    name: 'StatusIndex',
    sortKey: 'publishedAt',
    queryField: 'postsByStatus'
  })
  @Attribute({ type: 'enums', enums: ['draft', 'published'] })
  status: 'draft' | 'published';

  @Attribute({ type: 'number' })
  publishedAt: number;
}
```

### Generating Amplify Code

The adapter provides two methods that you compose yourself to create your Amplify schema:

```typescript
import { AmplifyAdapter } from '@ivan-lee/typed-ddb/adapters';
import { a } from '@aws-amplify/backend'; // Your Amplify import
import { User } from './entities';

// Create adapter instance
const adapter = new AmplifyAdapter(User);

// Generate model fields and indexes separately
const fields = adapter.modelFields();
const indexes = adapter.secondaryIndexes();

// Compose your Amplify schema with custom authorization
export const User = a
  .model({
    ...fields  // Spread or use template literals
  })
  ...indexes  // Add secondary indexes if any
  .authorization((allow) => [
    allow.authenticated(),
    // Your custom auth rules here
  ]);

// Or use template literals for code generation:
const code = `
export const User = a
  .model({
    ${fields}
  })${indexes}
  .authorization((allow) => [
    allow.authenticated()
  ]);
`;
```

**Output example:**
```typescript
export const User = a
  .model({
    id: a.id().required(),
    email: a.string().required(),
    name: a.string().required(),
    age: a.float().required(),
    // ... other fields
  })
  .secondaryIndexes((index) => [
    index('emailGlobalIndex').name('emailGlobalIndex').queryField('usersByEmail')
  ])
  .authorization((allow) => [
    allow.authenticated()
  ]);
```

### Writing to Files

```typescript
import { AmplifyAdapter } from '@ivan-lee/typed-ddb/adapters';
import { writeFileSync } from 'fs';
import { User, Post, Profile } from './entities';

// Generate for multiple entities
const entities = [User, Post, Profile];

for (const Entity of entities) {
  const adapter = new AmplifyAdapter(Entity);
  const code = adapter.generate();
  writeFileSync(`amplify/data/${Entity.name}.ts`, code, 'utf-8');
  console.log(`Generated amplify/data/${Entity.name}.ts`);
}
```

### Type Mapping

The adapter automatically maps decorator types to Amplify Gen 2 types:

| Decorator Type | Amplify Type | Notes |
|---------------|--------------|-------|
| `string` | `a.string()` | String type |
| `number` | `a.float()` | Numeric type |
| `boolean` | `a.boolean()` | Boolean type |
| `date` | `a.datetime()` | ISO timestamp |
| `object` | `a.json()` | JSON object |
| `array` | `a.json()` | JSON array |
| `enums` | `a.enum([...])` | Enum with values |
| `@PartitionKey()` | `a.id().required()` | Primary key |
| `@SortKey()` | `a.id().required()` | Sort key |

### Relationships

The adapter supports the same relationships as the main library:

```typescript
// @BelongsTo generates a.belongsTo()
@BelongsTo<Pick<User, 'id'>>(
  (user) => user.id,
  (id) => ({ id })
)
@Attribute({ type: 'string' })
userId: Pick<User, 'id'>;
// Generates: userId: a.string().required(), user: a.belongsTo('User', 'userId')

// @HasOne generates a.hasOne()
@HasOne(() => Profile)
profile?: Profile;
// Generates: profile: a.hasOne('Profile', 'userId')

// @HasMany generates a.hasMany()
@HasMany(() => Post)
posts?: Post[];
// Generates: posts: a.hasMany('Post', 'userId')
```

### @AmplifyGsi is a Superset of @Index

`@AmplifyGsi` is a superset of the standard `@Index` decorator - it does everything `@Index` does PLUS stores Amplify-specific metadata:

```typescript
@Table('Posts')
class Post {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  // Use ONLY @AmplifyGsi - works for both Repository AND Amplify
  @AmplifyGsi({
    name: 'StatusIndex',       // Optional: custom index name
    sortKey: 'publishedAt',    // Optional: for composite indexes
    queryField: 'postsByStatus' // Required: for Amplify GraphQL
  })
  @Attribute({ type: 'enums', enums: ['draft', 'published'] })
  status: 'draft' | 'published';

  @Attribute({ type: 'number' })
  publishedAt: number;
}

// Works with Repository
const repo = new Repository(Post);
await repo.query('published', undefined, { index: 'StatusIndex' });

// AND generates Amplify schema
const adapter = new AmplifyAdapter(Post);
const fields = adapter.modelFields();
const indexes = adapter.secondaryIndexes();
```

**Important**:
- ✅ Use `@AmplifyGsi` if you need Amplify Gen 2 schema generation
- ✅ `@AmplifyGsi` works 100% with Repository operations
- ❌ Don't use both `@Index` and `@AmplifyGsi` on the same field
- ❌ If you only use `@Index`, AmplifyAdapter will NOT generate indexes

### Important Notes

⚠️ **Authorization**: Authorization rules are NOT generated automatically. You must add `.authorization()` manually in your Amplify schema.

⚠️ **Table Names**: Table names from `@Table()` decorator are ignored. Amplify Gen 2 manages table names automatically based on your Amplify configuration.

⚠️ **Auto-Managed Fields**: Unlike typed-ddb's Repository, Amplify does NOT automatically manage `CreatedAt` and `UpdatedAt` fields. You'll need to handle these manually in your Amplify resolvers if needed.

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