import { Repository } from '../core';
import { InMemoryStorage } from './InMemoryStorage';

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
}