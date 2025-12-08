import 'reflect-metadata';

// Import the utility function for index naming
function constructGSIname(type: 'global' | 'local', hashKey: string, sortKey?: string) {
  return `${hashKey}${sortKey ? '-' : ''}${sortKey ?? ''}${type === 'global' ? 'GlobalIndex' : 'LocalIndex'}`;
}

export interface AmplifyGsiOptions {
  /**
   * Name of the global secondary index
   * If not provided, will follow naming convention: `${fieldName}GlobalIndex`
   */
  name?: string;

  /**
   * Sort key field name for composite index
   * @example 'publishedAt'
   */
  sortKey?: string;

  /**
   * GraphQL query field name for this index
   * REQUIRED for Amplify Gen 2
   * @example 'postsByStatus', 'usersByEmail'
   */
  queryField: string;
}

/**
 * Decorator for defining Amplify Gen 2 compatible Global Secondary Indexes
 *
 * This decorator is a superset of the standard @Index decorator that:
 * - Always creates GLOBAL indexes (not local)
 * - Works with Repository for DynamoDB operations
 * - Stores queryField metadata for Amplify Gen 2 schema generation
 * - Supports optional index naming and sort key specification
 *
 * ⚠️ IMPORTANT: This decorator creates BOTH:
 * 1. Actual DynamoDB index metadata for Repository operations
 * 2. Amplify-specific metadata for schema generation
 *
 * You should NOT use both @Index and @AmplifyGsi on the same field.
 *
 * @example
 * // Simple index (partition key only)
 * @AmplifyGsi({ queryField: 'usersByEmail' })
 * @Attribute({ type: 'string' })
 * email: string;
 *
 * @example
 * // Composite index (partition key + sort key)
 * @AmplifyGsi({
 *   name: 'StatusIndex',
 *   sortKey: 'publishedAt',
 *   queryField: 'postsByStatus'
 * })
 * @Attribute({ type: 'enums', enums: ['draft', 'published'] })
 * status: 'draft' | 'published';
 */
export function AmplifyGsi(options: AmplifyGsiOptions) {
  return (target: any, propertyKey: string) => {
    const type = 'global'; // Always global
    const indexName = options.name ?? constructGSIname(type, propertyKey, options.sortKey);

    // Store standard @Index metadata for Repository operations
    const propertyType = Reflect.getMetadata('type', target, propertyKey);
    Reflect.defineMetadata('index', {
      type,
      name: options.name,
      sortKey: options.sortKey,
    }, target, propertyKey);

    Reflect.defineMetadata(`partitionKey(${indexName})`, { field: propertyKey, type: propertyType }, target, propertyKey);

    if (options.sortKey) {
      const sortKeyPropertyType = Reflect.getMetadata('type', target, options.sortKey);
      Reflect.defineMetadata(`sortKey(${indexName})`, { field: options.sortKey, type: sortKeyPropertyType }, target, options.sortKey);
    }

    // Store Amplify-specific metadata
    Reflect.defineMetadata('amplifyGsi', {
      name: indexName,
      sortKey: options.sortKey,
      queryField: options.queryField,
      type
    }, target, propertyKey);

    // Track all decorated keys with AmplifyGsi
    const keys = Reflect.getMetadata('amplifyGsiKeys', target) || [];
    Reflect.defineMetadata('amplifyGsiKeys', [...keys, propertyKey], target);
  };
}
