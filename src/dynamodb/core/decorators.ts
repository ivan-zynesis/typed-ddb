import 'reflect-metadata';
import {constructGSIname} from './util';

type Primitive = 'string' | 'number' | 'boolean' | 'undefined';

type PrimitiveAttributeOption = {
  type: Primitive; optional?: boolean
}

/**
 * Under the hood still a string column. This is solely purposed to provide a strongly typed interface
 */
type EnumAttributeOption = {
  type: 'enums';
  enums: string[];
}

/**
 * Must be JSON object, compatible with JSON.parse() and JSON.stringify as serialization
 */
type ObjectAttributeOption = {
  type: 'object';
  optional?: boolean
}

/**
 * Must be JSON array, compatible with JSON.parse() and JSON.stringify as serialization
 */
type ArrayAttributeOption = {
  type: 'array';
  optional?: boolean
}

type DateAttributeOption = {
  type: 'date';
  optional?: boolean;
}

type AttributeOptions = PrimitiveAttributeOption | EnumAttributeOption | ObjectAttributeOption | ArrayAttributeOption | DateAttributeOption;
interface SecondaryIndexOptions {
  type?: 'global' | 'local';
  name?: string;
  sortKey?: string;
}

export function Table(name: string) {
  return (constructor: Function) => {
    Reflect.defineMetadata('tableName', name, constructor);
  };
}

export function PartitionKey() {
  return (target: any, propertyKey: string) => {
    const propertyType = Reflect.getMetadata('type', target, propertyKey);
    Reflect.defineMetadata('partitionKey', { field: propertyKey, type: propertyType }, target, propertyKey);
  };
}

export function SortKey() {
  return (target: any, propertyKey: string) => {
    const propertyType = Reflect.getMetadata('type', target, propertyKey);
    Reflect.defineMetadata('sortKey', { field: propertyKey, type: propertyType }, target, propertyKey);
  };
}

/**
 * @WARNING only use this on string and number field (natively on dynamodb, does not matter what it is after transform)
 * dynamodb simply does not work with some primitive type, eg boolean.
 * Object wise is fine as we always serialize them, however it is still not encourage to use such column type as index, the sorting order is simply not meaningful.
 *
 * Decorated attribute will also being used as a Global Secondary index can be queried independent of primary @PartitionKey Attribute
 */
export function Index(gsiOptions?: SecondaryIndexOptions) {
  return (target: any, propertyKey: string) => {
    const propertyType = Reflect.getMetadata('type', target, propertyKey);
    Reflect.defineMetadata('index', {
      type: gsiOptions?.type ?? 'global',
      name: gsiOptions?.name,
      sortKey: gsiOptions?.sortKey,
    }, target, propertyKey);

    const indexName = gsiOptions?.name ?? constructGSIname(gsiOptions?.type ?? 'global', propertyKey, gsiOptions?.sortKey);
    Reflect.defineMetadata(`partitionKey(${indexName})`, { field: propertyKey, type: propertyType }, target, propertyKey);

    if (gsiOptions?.sortKey) {
      const sortKeyPropertyType = Reflect.getMetadata('type', target, gsiOptions.sortKey);
      Reflect.defineMetadata(`sortKey(${indexName})`, { field: gsiOptions.sortKey, type: sortKeyPropertyType }, target, gsiOptions.sortKey);
    }
  };
}

export function Attribute(options: AttributeOptions) {
  const optional = 'optional' in options ? !!options.optional : false;
  return (target: any, propertyKey: string) => {
    Reflect.defineMetadata('type', options.type, target, propertyKey);
    Reflect.defineMetadata('optional', optional, target, propertyKey);
    Reflect.defineMetadata('isObject', options.type === 'object', target, propertyKey);
    Reflect.defineMetadata('isArray', options.type === 'array', target, propertyKey);
    Reflect.defineMetadata('isDate', options.type === 'date', target, propertyKey);

    // Track all decorated keys
    const keys = Reflect.getMetadata('keys', target) || [];
    Reflect.defineMetadata('keys', [...keys, propertyKey], target);
  };
}

/**
 * @WARNING this should not be an actual column
 * @example
 *
 * class Bar {
 *   // see BelongsTo
 *   FooId: Foo
 * }
 *
 * class Foo {
 *   @HasOne(() => Bar)
 *   bar: Bar
 * }
 */
export function HasOne<T>(ModelClassProvider: () => new () => T) {
  return (target: any, propertyKey: string) => {
    Reflect.defineMetadata('hasOne', ModelClassProvider, target, propertyKey);

    // Track all decorated join tables
    const keys = Reflect.getMetadata('joinTables', target) || [];
    Reflect.defineMetadata('joinTables', [...keys, propertyKey], target);
  };
}

/**
 * @WARNING this should not be an actual column
 *
 * @example
 *
 * class Bar {
 *   // see BelongsTo
 *   FooId: Foo
 * }
 *
 * class Foo {
 *   @HasMany(() => Bar)
 *   bar: Bar[]
 * }
 */
export function HasMany<T>(ModelClassProvider: () => new () => T) {
  return (target: any, propertyKey: string) => {
    Reflect.defineMetadata('hasMany', ModelClassProvider, target, propertyKey);

    // Track all decorated join tables
    const keys = Reflect.getMetadata('joinTables', target) || [];
    Reflect.defineMetadata('joinTables', [...keys, propertyKey], target);
  };
}

/**
 * @example
 * class Bar {
 *   // can pick any number of field(s) in associated entity PROVIDED they can form UNIQUE to be used as FK
 *   @BelongsTo(
 *     (foo: Pick<Foo, 'partition-key-column-name', 'sort-key-column-name'>) => `${foo['partition-key-column-name']}:${'sort-key-column-name'}`
 *     (s: string) => {
 *       const [partitionKey, sortKey] = s.split(':');
 *       return {
 *         'partition-key-column-name': partitionKey,
 *         'sort-key-column-name': sortKey,
 *       };
 *     }
 *   )
 *   FooId: Pick<Foo, 'partition-key-column-name', 'sort-key-column-name'>;
 * }
 */
 
export function BelongsTo<T>(serializer: (t: T) => string, deserializer: (s: string) => T, keyType: 'partitionKey' | 'sortKey' | 'index' = 'partitionKey') {
  return (target: any, propertyKey: string) => {
    Reflect.defineMetadata(keyType, { field: propertyKey, type: 'string' }, target, propertyKey);
    Reflect.defineMetadata('belongsTo', serializer, target, propertyKey);
    Reflect.defineMetadata('belongsToRev', deserializer, target, propertyKey);

    if (keyType === 'index') {
      const defaultIndexName = constructGSIname('global', propertyKey);
      Reflect.defineMetadata('index', {
        type: 'global',
        name: defaultIndexName,
      }, target, propertyKey);

      Reflect.defineMetadata(`partitionKey(${defaultIndexName})`, { field: propertyKey, type: 'string' }, target, propertyKey);
    }
  };
}

// Export signal-based trigger system for use in entity definitions and services
export { 
  PublishChanges, 
  SubscribeToChanges, 
  SubscriptionManager, 
  EntityChangeEvent,
  TriggerEvent
} from './signals';
