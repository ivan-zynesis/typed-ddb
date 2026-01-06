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

    const key = this.constructKey(hashKeyValue, sortKeyValue);
    return this.mockedDb.get(key) ?? null;
  }

  async create(item: T): Promise<T> {
    const [hashKeyValue, sortKeyValue] = this.getKey(item);
    const existed = await this.get(hashKeyValue, sortKeyValue);

    if (existed) {throw new Error('Already exist');}

    const key = this.constructKey(hashKeyValue, sortKeyValue);
    this.mockedDb.set(key, item);
    return item;
  }

  async update(item: T): Promise<T> {
    const [hashKeyValue, sortKeyValue] = this.getKey(item);
    const existed = await this.get(hashKeyValue, sortKeyValue);

    if (!existed) {throw new Error('Does not exist');}

    const key = this.constructKey(hashKeyValue, sortKeyValue);
    // just overwrite
    this.mockedDb.set(key, item);
    return item;
  }

  async delete<K extends keyof T>(partitionKeyValue: T[K], sortKeyValue?: T[K]) {
    const existing = await this.get(partitionKeyValue, sortKeyValue);
    if (!existing) {
      throw new Error(`Instance ${partitionKeyValue}${sortKeyValue ? '-' + sortKeyValue : ''} is not found for deletion`);
    }

    const key = this.constructKey(partitionKeyValue, sortKeyValue);
    this.mockedDb.delete(key);
  }

  async query<K extends keyof T>(partitionKeyValue: T[K], sortKeyCondition?: Condition<T[K]>, options?: { index?: string; limit?: number; lastKey?: string; sort?: SortOrder }): Promise<QueryResult<T, string>> {
    const { field: hashKeyField } = this.getPartitionKeyMeta(options?.index);
    const sortKeyMeta = this.getSortKeyMeta(options?.index);

    if (sortKeyCondition && !sortKeyMeta) {
      throw new Error('Sort key condition provided for model without sort key');
    }

    const allItems = this.mockedDb.entries().map(([, value]) => value as T);
    const filtered = allItems.filter((item) => item[hashKeyField] === partitionKeyValue)
      .filter((item) => {
        if (!sortKeyCondition || !sortKeyMeta) {return true;}
        return this.matchesCondition(item[sortKeyMeta.field], sortKeyCondition);
      });

    const sorted = this.sortItems(filtered, sortKeyMeta?.field, options?.sort);

    const paginated = this.applyPagination(sorted, options?.limit, options?.lastKey);
    return paginated;
  }

  async scan<K extends keyof T>(filters: { partitionKey?: Condition<T[K]>; sortKey?: Condition<T[K]> }, options?: { index?: string; limit?: number; lastKey?: string }): Promise<QueryResult<T, string>> {
    const partitionKeyMeta = filters.partitionKey ? this.getPartitionKeyMeta(options?.index) : null;
    const sortKeyMeta = filters.sortKey ? this.getSortKeyMeta(options?.index) : null;

    if (filters.sortKey && !sortKeyMeta) {
      throw new Error('Sort key filter provided for model without sort key');
    }

    const allItems = this.mockedDb.entries().map(([, value]) => value as T);
    const filtered = allItems.filter((item) => {
      const partitionMatch = !filters.partitionKey || (partitionKeyMeta && this.matchesCondition(item[partitionKeyMeta.field], filters.partitionKey));
      const sortMatch = !filters.sortKey || (sortKeyMeta && this.matchesCondition(item[sortKeyMeta.field], filters.sortKey));
      return partitionMatch && sortMatch;
    });

    const paginated = this.applyPagination(filtered, options?.limit, options?.lastKey);
    return paginated;
  }

  private getKey(t: T): [any, any] {
    const { field: hashKeyField } = this.getPartitionKeyMeta();
    const { field: sortKeyField } = this.getSortKeyMeta() ?? {};

    return [
      t[hashKeyField],
      sortKeyField ? t[sortKeyField] : undefined,
    ];
  }

  private constructKey(hashKeyValue: any, sortKeyValue?: any): string {
    let key = JSON.stringify(hashKeyValue);
    if (sortKeyValue) {
      key = `${key}_${JSON.stringify(sortKeyValue)}`;
    }
    return key;
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

  private sortItems(items: T[], sortKey?: keyof T, sortOrder: SortOrder = SortOrder.ascending): T[] {
    if (!sortKey) {return items;}
    const sorted = [...items].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) {return 0;}
      return aValue > bValue ? 1 : -1;
    });
    return sortOrder === 'descending' ? sorted.reverse() : sorted;
  }

  private applyPagination(items: T[], limit = 1000, lastKey?: string): QueryResult<T, string> {
    let startIndex = 0;
    if (lastKey) {
      const parsed = JSON.parse(lastKey) as { hashKeyValue: any; sortKeyValue?: any };
      const index = items.findIndex((item) => {
        const [hashKeyValue, sortKeyValue] = this.getKey(item);
        return this.areKeysEqual(parsed.hashKeyValue, hashKeyValue) && this.areKeysEqual(parsed.sortKeyValue, sortKeyValue);
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
      const [hashKeyValue, sortKeyValue] = this.getKey(sliced[sliced.length - 1]);
      result.lastKey = JSON.stringify({ hashKeyValue, sortKeyValue });
    }

    return result;
  }

  private areKeysEqual(left: any, right: any): boolean {
    if (left === undefined && right === undefined) {return true;}
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
