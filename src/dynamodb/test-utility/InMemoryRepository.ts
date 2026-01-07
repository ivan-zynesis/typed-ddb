import { QueryResult, Repository, SortOrder } from '../core';
import { InMemoryStorage } from './InMemoryStorage';

type Condition<V> =
  | { eq: V }
  | { ge: V }
  | { gt: V }
  | { le: V }
  | { lt: V }
  | { between: [V, V] };

/**
 * This is a testing use library to allows consumer of this package to run test without setting up infrastructure.
 *
 * It is storing data (created by {@link create}) into in-memory KV store and made them accessible through other {@link Repository} API
 * Solely use for prototyping and experimenting this library.
 */
export class InMemoryRepository<T> extends Repository<T> {
  mockedDb: InMemoryStorage<string, any>;

  constructor(ModelClass: new () => T) {
    super(ModelClass);
    this.mockedDb = new InMemoryStorage(`InMemoryRepository_${ModelClass.name}`);
  }

  async get<K extends keyof T, J extends K>(hashKeyValue: T[K], sortKeyValue?: T[K], joins: J[] = []): Promise<T | null> {
    if (joins.length > 0) {
      throw new Error('InMemoryRepository is a mocked DB and does not has join table capability');
    }

    const [partitionKey, sortKey] = this.serializeKeysFromInput(hashKeyValue, sortKeyValue);
    return this.mockedDb.get(partitionKey, sortKey) ?? null;
  }

  async create(item: T): Promise<T> {
    const [hashKeyValue, sortKeyValue] = this.getSerializedKeysFromItem(item);
    const existed = await this.get(hashKeyValue, sortKeyValue);

    if (existed) {throw new Error('Already exist');}

    this.mockedDb.set(hashKeyValue, sortKeyValue, item);
    return item;
  }

  async update(item: T): Promise<T> {
    const [hashKeyValue, sortKeyValue] = this.getSerializedKeysFromItem(item);
    const existed = await this.get(hashKeyValue, sortKeyValue);

    if (!existed) {throw new Error('Does not exist');}

    // just overwrite
    this.mockedDb.set(hashKeyValue, sortKeyValue, item);
    return item;
  }

  async delete<K extends keyof T>(partitionKeyValue: T[K], sortKeyValue?: T[K]) {
    const existing = await this.get(partitionKeyValue, sortKeyValue);
    if (!existing) {
      throw new Error(`Instance ${partitionKeyValue}${sortKeyValue ? '-' + sortKeyValue : ''} is not found for deletion`);
    }

    const [partitionKey, sortKey] = this.serializeKeysFromInput(partitionKeyValue, sortKeyValue);
    this.mockedDb.delete(partitionKey, sortKey);
  }

  async query<K extends keyof T>(partitionKeyValue: T[K], sortKeyCondition?: Condition<T[K]>, options?: { index?: string; limit?: number; lastKey?: string; sort?: SortOrder }): Promise<QueryResult<T, string>> {
    const { field: hashKeyField } = this.getPartitionKeyMeta(options?.index);
    const sortKeyMeta = this.getSortKeyMeta(options?.index);

    if (sortKeyCondition && !sortKeyMeta) {
      throw new Error('Sort key condition provided for model without sort key');
    }

    const serializedPartitionValue = this.serializeFieldValue(hashKeyField, partitionKeyValue);
    const sourceEntries = options?.index
      ? this.mockedDb.entries()
      : this.mockedDb.valuesForPartition(serializedPartitionValue).map((entry) => ({
        partitionKey: serializedPartitionValue,
        sortKey: entry.sortKey,
        value: entry.value as T,
      }));

    const serializedSortCondition = sortKeyCondition && sortKeyMeta
      ? this.serializeCondition(sortKeyCondition, sortKeyMeta.field)
      : undefined;

    const filtered = sourceEntries
      .filter(({ value }) => this.serializeFieldValue(hashKeyField, value[hashKeyField]) === serializedPartitionValue)
      .filter(({ value }) => {
        if (!serializedSortCondition || !sortKeyMeta) {return true;}
        const serializedSortValue = this.serializeFieldValue(sortKeyMeta.field, value[sortKeyMeta.field]);
        return this.matchesCondition(serializedSortValue, serializedSortCondition);
      })
      .map(({ value }) => value);

    const sorted = this.sortItems(filtered, sortKeyMeta?.field, options?.sort);

    const paginated = this.applyPagination(
      sorted,
      options?.limit,
      options?.lastKey,
      (item) => this.getSerializedKeyRecordFromItem(item, options?.index),
    );
    return paginated;
  }

  async scan<K extends keyof T>(filters: { partitionKey?: Condition<T[K]>; sortKey?: Condition<T[K]> }, options?: { index?: string; limit?: number; lastKey?: string }): Promise<QueryResult<T, string>> {
    const partitionKeyMeta = filters.partitionKey ? this.getPartitionKeyMeta(options?.index) : null;
    const sortKeyMeta = filters.sortKey ? this.getSortKeyMeta(options?.index) : null;

    if (filters.sortKey && !sortKeyMeta) {
      throw new Error('Sort key filter provided for model without sort key');
    }

    const serializedPartitionCondition = filters.partitionKey && partitionKeyMeta
      ? this.serializeCondition(filters.partitionKey, partitionKeyMeta.field)
      : undefined;
    const serializedSortCondition = filters.sortKey && sortKeyMeta
      ? this.serializeCondition(filters.sortKey, sortKeyMeta.field)
      : undefined;

    const allEntries = this.mockedDb.entries();
    const filtered = allEntries
      .filter(({ value }) => {
        if (!serializedPartitionCondition || !partitionKeyMeta) {return true;}
        const serializedPartition = this.serializeFieldValue(partitionKeyMeta.field, value[partitionKeyMeta.field]);
        return this.matchesCondition(serializedPartition, serializedPartitionCondition);
      })
      .filter(({ value }) => {
        if (!serializedSortCondition || !sortKeyMeta) {return true;}
        const serializedSort = this.serializeFieldValue(sortKeyMeta.field, value[sortKeyMeta.field]);
        return this.matchesCondition(serializedSort, serializedSortCondition);
      })
      .map(({ value }) => value);

    const paginated = this.applyPagination(
      filtered,
      options?.limit,
      options?.lastKey,
      (item) => this.getSerializedKeyRecordFromItem(item, options?.index),
    );
    return paginated;
  }

  private getSerializedKeysFromItem(t: T, index?: string): [any, any] {
    const { field: hashKeyField } = this.getPartitionKeyMeta(index);
    const { field: sortKeyField } = this.getSortKeyMeta(index) ?? {};

    return [
      this.serializeFieldValue(hashKeyField, t[hashKeyField]),
      sortKeyField ? this.serializeFieldValue(sortKeyField, t[sortKeyField]) : undefined,
    ];
  }

  private serializeKeysFromInput(hashKeyValue: any, sortKeyValue?: any, index?: string): [any, any] {
    const { field: hashKeyField } = this.getPartitionKeyMeta(index);
    const { field: sortKeyField } = this.getSortKeyMeta(index) ?? {};

    return [
      this.serializeFieldValue(hashKeyField, hashKeyValue),
      sortKeyField && sortKeyValue !== undefined ? this.serializeFieldValue(sortKeyField, sortKeyValue) : undefined,
    ];
  }

  private getSerializedKeyRecordFromItem(item: T, index?: string): { partitionKey: any; sortKey?: any } {
    const [partitionKey, sortKey] = this.getSerializedKeysFromItem(item, index);
    return { partitionKey, sortKey };
  }

  private matchesCondition(value: any, condition: Condition<any>): boolean {
    const [[operator, expected]] = Object.entries(condition);
    switch (operator) {
    case 'eq': return value === expected;
    case 'ge': return value >= expected;
    case 'gt': return value > expected;
    case 'le': return value <= expected;
    case 'lt': return value < expected;
    case 'between': {
      const [start, end] = expected as [any, any];
      return value >= start && value <= end;
    }
    default:
      return false;
    }
  }

  private serializeCondition(condition: Condition<any>, field: keyof T): Condition<any> {
    const [[operator, raw]] = Object.entries(condition);
    if (operator === 'between') {
      const [start, end] = raw as [any, any];
      return { between: [this.serializeFieldValue(field, start), this.serializeFieldValue(field, end)] } as Condition<any>;
    }
    return { [operator]: this.serializeFieldValue(field, raw) } as Condition<any>;
  }

  private sortItems(items: T[], sortKey?: keyof T, sortOrder: SortOrder = SortOrder.ascending): T[] {
    if (!sortKey) {return items;}
    const sorted = [...items].sort((a, b) => {
      const aValue = this.serializeFieldValue(sortKey, a[sortKey]);
      const bValue = this.serializeFieldValue(sortKey, b[sortKey]);

      if (aValue === bValue) {return 0;}
      return aValue > bValue ? 1 : -1;
    });
    return sortOrder === 'descending' ? sorted.reverse() : sorted;
  }

  private applyPagination(items: T[], limit = 1000, lastKey?: string, keySelector?: (item: T) => { partitionKey: any; sortKey?: any }): QueryResult<T, string> {
    const getKey = keySelector ?? ((item: T) => {
      const [partitionKey, sortKey] = this.getSerializedKeysFromItem(item);
      return { partitionKey, sortKey };
    });

    let startIndex = 0;
    if (lastKey) {
      const parsed = JSON.parse(lastKey) as { partitionKey: any; sortKey?: any };
      const index = items.findIndex((item) => {
        const { partitionKey, sortKey } = getKey(item);
        return this.areKeysEqual(parsed.partitionKey, partitionKey) && this.areKeysEqual(parsed.sortKey, sortKey);
      });
      if (index >= 0) {
        startIndex = index + 1;
      }
    }

    const sliced = items.slice(startIndex, startIndex + limit);
    const result = sliced as QueryResult<T, string>;
    result.count = items.length;

    const hasMore = startIndex + sliced.length < items.length;
    if (hasMore && sliced.length > 0) {
      const { partitionKey, sortKey } = getKey(sliced[sliced.length - 1]);
      result.lastKey = JSON.stringify({ partitionKey, sortKey });
    }

    return result;
  }

  private areKeysEqual(left: any, right: any): boolean {
    if (left === undefined && right === undefined) {return true;}
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private serializeFieldValue(field: keyof T | undefined, value: any): any {
    if (field === undefined) {return undefined;}
    const serializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, field as string);
    if (!serializer) {return value;}

    const type = Reflect.getMetadata('type', this.ModelClass.prototype, field as string);
    const isPrimitive = ['string', 'number', 'boolean'].includes(typeof value);

    // If already in serialized primitive form, skip serializer to support downstream callers passing serialized keys
    if (isPrimitive && type === 'string') {
      return value;
    }

    return serializer(value);
  }
}
