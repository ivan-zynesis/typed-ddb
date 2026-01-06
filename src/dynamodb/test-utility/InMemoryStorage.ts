const GLOBAL_STORE: Record<string, Record<string, Record<string, Primitive | DataClass | Array<DataClass>>>> = {};

type Primitive = number | string | boolean | Array<Primitive>;

// this is to make sure everything is serializable properly but not bloat it with more complex type like JSONObject
interface DataClass {
  [key: number | symbol]: Primitive | DataClass | Array<DataClass>;
}

/**
 * This is an plain in-memory KV store.
 * Serve only as test utility.
 */
export class InMemoryStorage<K extends string = string, V extends DataClass | Primitive | Array<DataClass> = Primitive> {
  private static readonly NO_SORT_KEY = '__NO_SORT_KEY__';

  constructor(
    private readonly topic: string,
  ) {
    if (GLOBAL_STORE[topic] === undefined) {
      GLOBAL_STORE[topic] = {};
    }
  }

  set(partitionKey: K, sortKey: string | undefined, v: V): void {
    const topicStore = GLOBAL_STORE[this.topic];
    if (!topicStore[partitionKey]) {
      topicStore[partitionKey] = {};
    }
    const normalizedSortKey = sortKey ?? InMemoryStorage.NO_SORT_KEY;
    topicStore[partitionKey][normalizedSortKey] = v;
  }

  get(partitionKey: K, sortKey?: string): V | undefined {
    const topicStore = GLOBAL_STORE[this.topic];
    const partition = topicStore[partitionKey];
    if (!partition) {return undefined;}
    const normalizedSortKey = sortKey ?? InMemoryStorage.NO_SORT_KEY;
    return partition[normalizedSortKey] as V;
  }

  entries(): Array<{ partitionKey: K; sortKey?: string; value: V }> {
    const topicStore = GLOBAL_STORE[this.topic] || {};
    const entries: Array<{ partitionKey: K; sortKey?: string; value: V }> = [];

    for (const [pk, sortMap] of Object.entries(topicStore)) {
      for (const [sk, value] of Object.entries(sortMap)) {
        if (value === undefined) {continue;}
        entries.push({
          partitionKey: pk as K,
          sortKey: sk === InMemoryStorage.NO_SORT_KEY ? undefined : sk,
          value: value as V,
        });
      }
    }

    return entries;
  }

  valuesForPartition(partitionKey: K): Array<{ sortKey?: string; value: V }> {
    const topicStore = GLOBAL_STORE[this.topic] || {};
    const partition = topicStore[partitionKey];
    if (!partition) {return [];}

    return Object.entries(partition)
      .filter(([, value]) => value !== undefined)
      .map(([sortKey, value]) => ({
        sortKey: sortKey === InMemoryStorage.NO_SORT_KEY ? undefined : sortKey,
        value: value as V,
      }));
  }

  delete(partitionKey: K, sortKey?: string): void {
    const topicStore = GLOBAL_STORE[this.topic];
    const partition = topicStore[partitionKey];
    if (!partition) {return;}
    const normalizedSortKey = sortKey ?? InMemoryStorage.NO_SORT_KEY;
    delete partition[normalizedSortKey];
  }

  flush() {
    GLOBAL_STORE[this.topic] = {};
  }
}
