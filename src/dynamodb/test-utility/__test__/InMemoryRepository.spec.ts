import 'reflect-metadata';
import {
  Attribute,
  Index,
  PartitionKey,
  SortOrder,
  SortKey,
  Table,
} from '../../core';
import { InMemoryRepository } from '../InMemoryRepository';

@Table('InMemoryRepoTest')
class TestEntity {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id!: string;

  @SortKey()
  @Attribute({ type: 'number' })
  createdAt!: number;

  @Index({ name: 'CategoryCreatedAtIndex', sortKey: 'createdAt' })
  @Attribute({ type: 'string' })
  category!: string;
}

describe('InMemoryRepository', () => {
  let repo: InMemoryRepository<TestEntity>;

  beforeEach(() => {
    repo = new InMemoryRepository(TestEntity);
    repo.mockedDb.flush();
  });

  it('supports query with sort conditions and pagination', async () => {
    await repo.create({ id: 'user-1', createdAt: 1, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-1', createdAt: 2, category: 'beta' } as TestEntity);
    await repo.create({ id: 'user-2', createdAt: 3, category: 'gamma' } as TestEntity);

    const firstPage = await repo.query('user-1', undefined, { limit: 1 });
    expect(firstPage.count).toBe(2);
    expect(firstPage).toHaveLength(1);
    expect(firstPage[0].createdAt).toBe(1);
    expect(firstPage.lastKey).toBeDefined();

    const secondPage = await repo.query('user-1', undefined, { limit: 1, lastKey: firstPage.lastKey });
    expect(secondPage.count).toBe(2);
    expect(secondPage).toHaveLength(1);
    expect(secondPage[0].createdAt).toBe(2);
    expect(secondPage.lastKey).toBeUndefined();

    const sortedDesc = await repo.query('user-1', { ge: 0 }, { sort: SortOrder.descending });
    expect(sortedDesc.map((i) => i.createdAt)).toEqual([2, 1]);
  });

  it('supports scan with partition and sort filters', async () => {
    await repo.create({ id: 'user-1', createdAt: 1, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-1', createdAt: 5, category: 'beta' } as TestEntity);
    await repo.create({ id: 'user-2', createdAt: 3, category: 'gamma' } as TestEntity);

    const partitionOnly = await repo.scan({ partitionKey: { eq: 'user-2' } });
    expect(partitionOnly.count).toBe(1);
    expect(partitionOnly[0].category).toBe('gamma');

    const bounded = await repo.scan({ partitionKey: { eq: 'user-1' }, sortKey: { between: [2, 6] } });
    expect(bounded.count).toBe(1);
    expect(bounded[0].createdAt).toBe(5);
  });

  it('supports query using a secondary index', async () => {
    await repo.create({ id: 'user-1', createdAt: 1, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-2', createdAt: 3, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-3', createdAt: 2, category: 'beta' } as TestEntity);

    const result = await repo.query('alpha', { ge: 0 }, {
      index: 'CategoryCreatedAtIndex',
      sort: SortOrder.descending,
    });

    expect(result.count).toBe(2);
    expect(result.map((r) => r.id)).toEqual(['user-2', 'user-1']);
  });

  it('supports scan using a secondary index', async () => {
    await repo.create({ id: 'user-1', createdAt: 1, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-2', createdAt: 5, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-3', createdAt: 2, category: 'beta' } as TestEntity);

    const result = await repo.scan(
      { partitionKey: { eq: 'alpha' }, sortKey: { between: [1, 5] } },
      { index: 'CategoryCreatedAtIndex' }
    );

    expect(result.count).toBe(2);
    expect(result.map((r) => r.id).sort()).toEqual(['user-1', 'user-2']);
  });

  it('supports delete for existing items and errors when missing', async () => {
    await repo.create({ id: 'user-1', createdAt: 1, category: 'alpha' } as TestEntity);
    await repo.create({ id: 'user-2', createdAt: 2, category: 'alpha' } as TestEntity);

    await repo.delete('user-1', 1);
    const remaining = await repo.query('user-1');
    expect(remaining.count).toBe(0);
    await expect(repo.delete('user-1', 1)).rejects.toThrow('not found for deletion');
  });
});
