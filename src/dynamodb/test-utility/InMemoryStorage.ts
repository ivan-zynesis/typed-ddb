const GLOBAL_STORE: Record<string, Record<string, Primitive | DataClass | Array<DataClass>>> = {};

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
  constructor(
    private readonly topic: string,
  ) {
    if (GLOBAL_STORE[topic] === undefined) {
      GLOBAL_STORE[topic] = {};
    }
  }

  set(k: K, v: V): void {
    GLOBAL_STORE[this.topic][k] = v;
  }

  get(k: K): V | undefined {
    return GLOBAL_STORE[this.topic][k] as V;
  }

  delete(k: K): void {
    GLOBAL_STORE[this.topic][k] = undefined;
  }

  flush() {
    GLOBAL_STORE[this.topic] = {};
  }
}
