/**
 * type A = { a: boolean };
 * type B = { b: string };
 *
 * type AB = A & B;
 *
 * When you hover over `AB` in your IDE, it might show:
 * `{ a: boolean; } & { b: string; }`
 *
 * type PrettifiedAB = Prettify<AB>;
 *
 * When you hover over `PrettifiedAB`, it should now show:
 * `{ a: boolean; b: string; }`
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * A quick hand to construct secondary index name using partition key (and optional sort key)
 * The naming is following the default dynamoose@4.0.2 behavior.
 */
export function constructGSIname(type: 'global' | 'local', hashKey: string, sortKey?: string) {
  return `${hashKey}${sortKey ? '-' : ''}${sortKey ?? ''}${type == 'global' ? 'GlobalIndex' : 'LocalIndex'}`;
}
