# Amplify Gen 2 Adapter

The Amplify Gen 2 Adapter translates decorator-based DynamoDB entity definitions into AWS Amplify Gen 2 schema material. This allows you to maintain a single source of truth for your data models and generate both DynamoDB schemas (via Repository) and Amplify Gen 2 schemas.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [API Reference](#api-reference)
- [Decorators](#decorators)
- [Type Mappings](#type-mappings)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

The adapter provides:

1. **Material Generation**: Convert decorated entities to Amplify Gen 2 material (modelFields + secondaryIndexes)
2. **CLI Tool**: Generate material files from entity directories
3. **Type Safety**: Full TypeScript support with proper type mappings
4. **Repository Compatibility**: Works seamlessly with the existing Repository class
5. **Relationship Support**: Maps @BelongsTo, @HasOne, @HasMany to Amplify relationships

## Installation

```bash
npm install @ivan-lee/typed-ddb
# or
pnpm add @ivan-lee/typed-ddb
# or
yarn add @ivan-lee/typed-ddb
```

The package includes all necessary dependencies including `tsx` for TypeScript support and `reflect-metadata` for decorator functionality.

## Quick Start

### 1. Define Your Entity

```typescript
import { Table, PartitionKey, Attribute } from '@ivan-lee/typed-ddb';
import { AmplifyGsi } from '@ivan-lee/typed-ddb/adapters';

@Table('Users')
export class User {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @AmplifyGsi({ queryField: 'usersByEmail' })
  @Attribute({ type: 'string' })
  email: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'number' })
  age: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}
```

### 2. Generate Material Files

```bash
npx typed-ddb amplify -i ./entities -o ./amplify/materials
```

This generates `User.material.ts`:

```typescript
export const UserMaterial = {
  modelFields: {
    id: a.id().required(),
    email: a.string().required(),
    name: a.string().required(),
    age: a.float().required(),
    CreatedAt: a.datetime().required(),
    UpdatedAt: a.datetime()
  },
  secondaryIndexes: (index: any) => [
    index.index('emailGlobalIndex').name('emailGlobalIndex').queryField('usersByEmail')
  ]
};
```

### 3. Use in Amplify Schema

```typescript
import { a } from '@aws-amplify/backend';
import { UserMaterial } from './amplify/materials/User.material';

export const User = a
  .model(UserMaterial.modelFields)
  .authorization((allow) => [
    allow.authenticated()
  ])
  .secondaryIndexes(UserMaterial.secondaryIndexes);
```

## CLI Usage

### Command Syntax

```bash
npx typed-ddb amplify -i <input-path> -o <output-path>
```

### Options

- `-i, --input`: Path to directory containing entity class definitions (TypeScript files)
- `-o, --output`: Path to output directory for generated material files

### Example

```bash
# Generate materials from entities directory
npx typed-ddb amplify -i src/entities -o amplify/data/materials

# Using relative paths
npx typed-ddb amplify -i ./models -o ./generated
```

### Features

- Automatically loads TypeScript files without compilation
- Scans for classes with @Table decorator
- Generates one material file per entity
- Creates output directory if it doesn't exist
- Provides progress feedback during generation

## API Reference

### AmplifyAdapter

Main class for generating Amplify Gen 2 material.

```typescript
class AmplifyAdapter<T> {
  constructor(ModelClass: new () => T);
  modelFields(): string;
  secondaryIndexes(): string[];
}
```

#### Methods

**`modelFields(): string`**

Generates the model fields definition as a formatted string.

Returns:
```typescript
"id: a.id().required(),\n  email: a.string().required(),\n  ..."
```

**`secondaryIndexes(): string[]`**

Generates secondary index definitions as an array of strings.

Returns:
```typescript
[
  "index('emailGlobalIndex').name('emailGlobalIndex').queryField('usersByEmail')",
  "index('StatusIndex').sortKeys(['publishedAt']).name('StatusIndex').queryField('postsByStatus')"
]
```

### Usage Example

```typescript
import { AmplifyAdapter } from '@ivan-lee/typed-ddb/adapters';
import { User } from './entities/User';

const adapter = new AmplifyAdapter(User);
const fields = adapter.modelFields();
const indexes = adapter.secondaryIndexes();

console.log('Model Fields:', fields);
console.log('Secondary Indexes:', indexes);
```

## Decorators

### @AmplifyGsi

Decorator for defining Amplify-compatible Global Secondary Indexes. This is a **superset** of the standard @Index decorator and works with both Amplify and the Repository class.

```typescript
@AmplifyGsi(options?: AmplifyGsiOptions)
```

#### Options

```typescript
interface AmplifyGsiOptions {
  name?: string;          // Custom index name (auto-generated if not provided)
  sortKey?: string;       // Sort key field name for composite indexes
  queryField?: string;    // GraphQL query field name (REQUIRED)
}
```

#### Examples

**Simple GSI (partition key only):**

```typescript
@AmplifyGsi({ queryField: 'usersByEmail' })
@Attribute({ type: 'string' })
email: string;
```

Generates:
```typescript
index('emailGlobalIndex').name('emailGlobalIndex').queryField('usersByEmail')
```

**Composite GSI (partition key + sort key):**

```typescript
@AmplifyGsi({
  name: 'StatusIndex',
  sortKey: 'publishedAt',
  queryField: 'postsByStatus'
})
@Attribute({ type: 'enums', enums: ['draft', 'published', 'archived'] })
status: 'draft' | 'published' | 'archived';

@Attribute({ type: 'number' })
publishedAt: number;
```

Generates:
```typescript
index('StatusIndex').sortKeys(['publishedAt']).name('StatusIndex').queryField('postsByStatus')
```

#### Important Notes

1. **Only decorate the partition key field** of the GSI, not the sort key
2. **queryField is REQUIRED** - this is the GraphQL query name
3. **Works with Repository** - No need to use both @Index and @AmplifyGsi
4. **Always creates global indexes** - Local secondary indexes not supported

## Type Mappings

### Attribute Types to Amplify Types

| Decorator Type | Amplify Type | Notes |
|----------------|--------------|-------|
| `string` | `a.string()` | Basic string type |
| `number` | `a.float()` | Numeric values |
| `boolean` | `a.boolean()` | True/false values |
| `date` | `a.datetime()` | ISO datetime strings |
| `object` | `a.json()` | JSON objects |
| `array` | `a.json()` | JSON arrays |
| `enums` | `a.enum([...])` | Enumerated values |

### Key Types

Partition keys and sort keys are always mapped to `a.id().required()` regardless of the original type.

### Optional Fields

Fields marked with `optional: true` omit the `.required()` modifier:

```typescript
// Optional field
@Attribute({ type: 'string', optional: true })
bio?: string;

// Generates: a.string()
```

```typescript
// Required field
@Attribute({ type: 'string' })
name: string;

// Generates: a.string().required()
```

### Enum Types

```typescript
@Attribute({ type: 'enums', enums: ['draft', 'published', 'archived'] })
status: 'draft' | 'published' | 'archived';

// Generates: a.enum(['draft', 'published', 'archived']).required()
```

## Examples

### Complete Entity with Relationships

```typescript
import { Table, PartitionKey, SortKey, Attribute, BelongsTo, HasMany } from '@ivan-lee/typed-ddb';
import { AmplifyGsi } from '@ivan-lee/typed-ddb/adapters';

@Table('Posts')
export class Post {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  title: string;

  @Attribute({ type: 'string' })
  content: string;

  // Foreign key with BelongsTo relationship
  @BelongsTo<Pick<User, 'id'>>(
    (user: Pick<User, 'id'>) => user.id,
    (userId: string) => ({ id: userId })
  )
  @Attribute({ type: 'string' })
  userId: Pick<User, 'id'>;

  // Composite GSI with sort key
  @AmplifyGsi({
    name: 'StatusIndex',
    sortKey: 'publishedAt',
    queryField: 'postsByStatus'
  })
  @Attribute({ type: 'enums', enums: ['draft', 'published', 'archived'] })
  status: 'draft' | 'published' | 'archived';

  @Attribute({ type: 'number' })
  publishedAt: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;

  // HasMany relationship
  @HasMany(() => Comment)
  comments?: Comment[];
}
```

Generated material:

```typescript
export const PostMaterial = {
  modelFields: {
    id: a.id().required(),
    title: a.string().required(),
    content: a.string().required(),
    userId: a.id().required(),
    user: a.belongsTo('User', 'userId'),
    status: a.enum(['draft', 'published', 'archived']).required(),
    publishedAt: a.float().required(),
    CreatedAt: a.datetime().required(),
    UpdatedAt: a.datetime(),
    comments: a.hasMany('Comment', 'postId')
  },
  secondaryIndexes: (index: any) => [
    index.index('StatusIndex').sortKeys(['publishedAt']).name('StatusIndex').queryField('postsByStatus')
  ]
};
```

### Entity Without Indexes

```typescript
@Table('Profiles')
export class Profile {
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
  settings?: Record<string, any>;

  @Attribute({ type: 'date' })
  CreatedAt: Date;
}
```

Generated material:

```typescript
export const ProfileMaterial = {
  modelFields: {
    userId: a.id().required(),
    user: a.belongsTo('User', 'userId'),
    bio: a.string(),
    settings: a.json(),
    CreatedAt: a.datetime().required()
  },
  secondaryIndexes: () => []
};
```

### Multiple Entities Project Structure

```
project/
├── src/
│   ├── entities/
│   │   ├── User.ts
│   │   ├── Post.ts
│   │   ├── Comment.ts
│   │   └── Profile.ts
│   └── ...
└── amplify/
    ├── data/
    │   ├── materials/          # Generated by CLI
    │   │   ├── User.material.ts
    │   │   ├── Post.material.ts
    │   │   ├── Comment.material.ts
    │   │   └── Profile.material.ts
    │   └── resource.ts         # Your Amplify schema
    └── ...
```

Generate materials:
```bash
npx typed-ddb amplify -i src/entities -o amplify/data/materials
```

Compose in `amplify/data/resource.ts`:
```typescript
import { a, defineData } from '@aws-amplify/backend';
import { UserMaterial } from './materials/User.material';
import { PostMaterial } from './materials/Post.material';
import { CommentMaterial } from './materials/Comment.material';
import { ProfileMaterial } from './materials/Profile.material';

const schema = a.schema({
  User: a
    .model(UserMaterial.modelFields)
    .authorization((allow) => [allow.authenticated()])
    .secondaryIndexes(UserMaterial.secondaryIndexes),

  Post: a
    .model(PostMaterial.modelFields)
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ])
    .secondaryIndexes(PostMaterial.secondaryIndexes),

  Comment: a
    .model(CommentMaterial.modelFields)
    .authorization((allow) => [allow.authenticated()])
    .secondaryIndexes(CommentMaterial.secondaryIndexes),

  Profile: a
    .model(ProfileMaterial.modelFields)
    .authorization((allow) => [allow.owner()])
    .secondaryIndexes(ProfileMaterial.secondaryIndexes),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
```

## Best Practices

### 1. Use @AmplifyGsi Instead of @Index

When building for Amplify, use `@AmplifyGsi` which provides better integration:

```typescript
// Good: Use @AmplifyGsi
@AmplifyGsi({ queryField: 'usersByEmail' })
@Attribute({ type: 'string' })
email: string;

// Avoid: Using @Index for Amplify projects
@Index({ name: 'emailIndex', type: 'global' })
@Attribute({ type: 'string' })
email: string;
```

### 2. Always Provide queryField

The `queryField` option is required and determines the GraphQL query name:

```typescript
// Good: Explicit queryField
@AmplifyGsi({ queryField: 'postsByAuthor' })
@Attribute({ type: 'string' })
authorId: string;
```

### 3. Decorator Order Matters

Always place key decorators before `@Attribute`:

```typescript
// Correct order
@PartitionKey()
@AmplifyGsi({ queryField: 'usersByEmail' })
@Attribute({ type: 'string' })
email: string;

// Wrong order (will fail)
@Attribute({ type: 'string' })
@PartitionKey()  // ❌ Too late
email: string;
```

### 4. Only Decorate GSI Partition Keys

Don't apply `@AmplifyGsi` to both partition and sort keys:

```typescript
// Correct: Only decorate the partition key
@AmplifyGsi({
  name: 'StatusIndex',
  sortKey: 'publishedAt',
  queryField: 'postsByStatus'
})
@Attribute({ type: 'string' })
status: string;

// The sort key field should NOT have @AmplifyGsi
@Attribute({ type: 'number' })
publishedAt: number;
```

### 5. Separate Concerns

Keep your authorization rules in Amplify schema, not in entity definitions:

```typescript
// Entity definition (no auth)
@Table('Users')
export class User {
  // ... fields
}

// Amplify schema (with auth)
export const User = a
  .model(UserMaterial.modelFields)
  .authorization((allow) => [
    allow.authenticated(),
    allow.owner()
  ])
  .secondaryIndexes(UserMaterial.secondaryIndexes);
```

### 6. Auto-Managed Timestamps

The library auto-manages `CreatedAt` and `UpdatedAt`:

```typescript
@Attribute({ type: 'date' })
CreatedAt: Date;  // Set automatically on create

@Attribute({ type: 'date', optional: true })
UpdatedAt?: Date;  // Set automatically on update
```

Don't manually set these values in your application code.

### 7. Regenerate After Schema Changes

Always regenerate material files after changing entity definitions:

```bash
# After modifying entities
npx typed-ddb amplify -i src/entities -o amplify/data/materials

# Then rebuild your Amplify backend
npx ampx sandbox
```

### 8. Version Control

**Do commit:** Generated material files (`.material.ts`)
**Don't commit:** Compiled JavaScript files from dist/

```gitignore
# .gitignore
/dist
/node_modules

# DO commit these:
# /amplify/data/materials/*.material.ts
```

### 9. TypeScript Configuration

Ensure your `tsconfig.json` includes decorator support:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 10. Testing Both Layers

Test your entities work with both Repository and Amplify:

```typescript
// Test with Repository
import { Repository } from '@ivan-lee/typed-ddb';
const repo = new Repository(User);
await repo.create({ email: 'test@example.com', ... });

// Test material generation
import { AmplifyAdapter } from '@ivan-lee/typed-ddb/adapters';
const adapter = new AmplifyAdapter(User);
const fields = adapter.modelFields();
const indexes = adapter.secondaryIndexes();
```

## Architecture

### Component Overview

```
AmplifyAdapter (Main orchestrator)
├── AmplifyTypeMapper (Type conversions)
├── AmplifyIndexGenerator (Index definitions)
└── AmplifyRelationshipMapper (Relationship mapping)
```

### Type Mapper

Converts decorator types to Amplify types:
- Handles primitive types (string, number, boolean, date)
- Converts objects and arrays to JSON
- Maps enums with value lists
- Applies optional/required modifiers

### Index Generator

Creates secondary index definitions:
- Generates deterministic index names
- Handles composite indexes with sort keys
- Creates queryField names for GraphQL
- Formats as Amplify .secondaryIndexes() calls

### Relationship Mapper

Maps decorator relationships to Amplify:
- @BelongsTo → a.belongsTo()
- @HasOne → a.hasOne()
- @HasMany → a.hasMany()
- Infers foreign key fields automatically

## Troubleshooting

### CLI Not Loading TypeScript Files

**Problem:** `Invalid or unexpected token` when loading .ts files

**Solution:** Ensure `tsx` is installed as a dependency (not devDependency):
```bash
npm install tsx
```

### reflect-metadata Errors

**Problem:** `Reflect.getMetadata is not a function`

**Solution:** Import reflect-metadata at the top of your entry file:
```typescript
import 'reflect-metadata';
```

### Missing Index Metadata

**Problem:** Indexes not showing in generated material

**Solution:** Ensure you're using `@AmplifyGsi` and it's placed before `@Attribute`:
```typescript
@AmplifyGsi({ queryField: 'usersByEmail' })
@Attribute({ type: 'string' })
email: string;
```

### Wrong Amplify Type Generated

**Problem:** Field generates wrong Amplify type (e.g., a.string() instead of a.id())

**Solution:** Check if field is marked as partition/sort key:
```typescript
@PartitionKey()  // This makes it generate a.id().required()
@Attribute({ type: 'string' })
id: string;
```

### Repository Not Working with @AmplifyGsi

**Problem:** Repository can't find indexes created with @AmplifyGsi

**Solution:** @AmplifyGsi should work automatically. Verify metadata is stored:
```typescript
const metadata = Reflect.getMetadata('index', User.prototype, 'email');
console.log(metadata); // Should show index metadata
```

## Migration Guide

### From @Index to @AmplifyGsi

If you're currently using `@Index` for Amplify projects:

**Before:**
```typescript
@Index({ name: 'emailIndex', type: 'global' })
@Attribute({ type: 'string' })
email: string;
```

**After:**
```typescript
@AmplifyGsi({
  name: 'emailIndex',
  queryField: 'usersByEmail'  // Add this
})
@Attribute({ type: 'string' })
email: string;
```

Benefits:
- Explicit queryField for GraphQL
- Works with Repository without changes
- Better Amplify Gen 2 integration

## Contributing

Found a bug or want to contribute? Please see the main project repository.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/ivan-zynesis/typed-ddb/issues
- Documentation: See main README.md in project root
