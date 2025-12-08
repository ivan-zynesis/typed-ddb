import {model, Schema} from 'dynamoose';
import {InputKey, SortOrder} from 'dynamoose/dist/General';
import {Query, QueryResponse, Scan, ScanResponse} from 'dynamoose/dist/ItemRetriever';
export {SortOrder} from 'dynamoose/dist/General';
import {Prettify} from './util';
import {SignalTriggerManager} from './signals';

export interface KeyMetadata<T> {
  field: keyof T;
  type: any;
}

export interface QueryResult<D, PaginationKey> extends Array<D> {
  count: number;
  lastKey?: PaginationKey;
}

type EQ<T, K extends keyof T = keyof T> = { eq: T[K] };
type GE<T, K extends keyof T = keyof T> = { ge: T[K] };
type GT<T, K extends keyof T = keyof T> = { gt: T[K] };
type LE<T, K extends keyof T = keyof T> = { le: T[K] };
type LT<T, K extends keyof T = keyof T> = { lt: T[K] };
type BTW<T, K extends keyof T = keyof T> = { between: [T[K], T[K]] };
type Condition<T, K extends keyof T = keyof T> = EQ<T, K> | GE<T, K> | GT<T, K> | LE<T, K> | LT<T, K> | BTW<T, K>;

export type ScanFilter<T, K extends keyof T = keyof T> = Partial<{
  partitionKey?: Condition<T, K>;
  sortKey?: Condition<T, K>;
}>;

export class Repository<T, PaginationKey extends string = string> {
  protected readonly model;
  readonly ModelClass: new () => T;

  constructor(ModelClass: new () => T) {
    this.ModelClass = ModelClass;
    // Generate DynamoDB schema dynamically
    const schemaFields: any = {};

    const tableNameProvider = Reflect.getMetadata('tableName', ModelClass) || ModelClass.name;
    const tableName = typeof tableNameProvider === 'function' ? tableNameProvider() : tableNameProvider;

    // Retrieve all decorated keys
    const keys: string[] = Reflect.getMetadata('keys', ModelClass.prototype) || [];

    // Extract schema fields and metadata
    for (const key of keys) {
      const type = Reflect.getMetadata('type', ModelClass.prototype, key as string);
      const partitionKey = Reflect.getMetadata('partitionKey', ModelClass.prototype, key as string);
      const sortKey = Reflect.getMetadata('sortKey', ModelClass.prototype, key as string);
      const index = Reflect.getMetadata('index', ModelClass.prototype, key as string);
      const optional = Reflect.getMetadata('optional', ModelClass.prototype, key as string);

      let dataType = type;
      if (['enums', 'object', 'array'].includes(type)) {dataType = 'string';}
      if (type === 'date') {dataType = 'number';}

      if (type) {
        schemaFields[key] = {
          type: dataType,
          hashKey: !!partitionKey,
          rangeKey: !!sortKey,
          index: !index ? undefined : {
            type: index.type ?? 'global',
            name: index.name,
            rangeKey: index.sortKey,
          },
          required: !optional,
        };
      }
    }

    // Create Dynamoose schema
    const schema = new Schema(schemaFields);

    // Initialize the Dynamoose model
    this.model = model(tableName, schema);
  }

  // Helper to get the @PartitionKey metadata
  protected getPartitionKeyMeta(secondaryIndexName?: string): KeyMetadata<T> {
    // Retrieve all decorated keys
    const keys: string[] = Reflect.getMetadata('keys', this.ModelClass.prototype) || [];
    const metadataKey = secondaryIndexName ? `partitionKey(${secondaryIndexName})` : 'partitionKey';
    for (const key of keys) {
      const partitionKeyMeta = Reflect.getMetadata(metadataKey, this.ModelClass.prototype, key as string);
      if (partitionKeyMeta) {
        return { field: key as keyof T, type: partitionKeyMeta.type };
      }
    }
    throw new Error('No field annotated with @PartitionKey found.');
  }

  protected getSortKeyMeta(secondaryIndexName?: string): KeyMetadata<T> | undefined {
    // Retrieve all decorated keys
    const keys: string[] = Reflect.getMetadata('keys', this.ModelClass.prototype) || [];
    const metadataKey = secondaryIndexName ? `sortKey(${secondaryIndexName})` : 'sortKey';
    for (const key of keys) {
      const sortKeyMeta = Reflect.getMetadata(metadataKey, this.ModelClass.prototype, key as string);
      if (sortKeyMeta) {
        return { field: key as keyof T, type: sortKeyMeta.type };
      }
    }
  }

  private serializeField(plain?: Record<string, any>): string | undefined {
    if (!plain) {return undefined;}
    return JSON.stringify(plain);
  }

  private deserializeField(serialized?: string): any {
    if (!serialized) {return undefined;}
    return JSON.parse(serialized);
  }

  private serializeDate(plain: Date | undefined): number | undefined {
    if (!plain) {return undefined;}
    return plain.getTime();
  }

  private deserializeDate(serialized?: number): any {
    if (!serialized) {return undefined;}
    return new Date(serialized);
  }

   
  private transform(t: T | null, mode: 'serialize' | 'deserialize'): T | null {
    if (!t) {return null;}

    // Retrieve all decorated keys
    const keys: (keyof T)[] = Reflect.getMetadata('keys', this.ModelClass.prototype) || [];

    for (const key of keys) {
      const isObject = Reflect.getMetadata('isObject', this.ModelClass.prototype, key as string);
      const isArray = Reflect.getMetadata('isArray', this.ModelClass.prototype, key as string);
      const isDate = Reflect.getMetadata('isDate', this.ModelClass.prototype, key as string);

      if (isObject || isArray) {
        t[key] = mode === 'serialize'
          ? this.serializeField(t[key])
          : this.deserializeField(t[key] as string);
      }

      if (isDate) {
        const value: Date | undefined = t[key] as any;
        t[key] = mode === 'serialize'
          ? this.serializeDate(value)
          : this.deserializeDate(t[key] as number);
      }

      const fkTransformer = mode === 'serialize'
        ? Reflect.getMetadata('belongsTo', this.ModelClass.prototype, key as string)
        : Reflect.getMetadata('belongsToRev', this.ModelClass.prototype, key as string);
      if (fkTransformer) {
        const belongsTo = t[key];
        t[key] = fkTransformer(belongsTo);
      }
    }
    return t;
  }

  protected resolveRelatedRepositories<K extends keyof T>(): Record<K, {
    meta: 'hasOne' | 'hasMany';
    repo: Repository<any>;
     
    fkTransformer: (t: T) => string;
  }> {
    const relatedRepositories = {} as Record<K, {
      meta: 'hasOne' | 'hasMany';
      repo: Repository<any>;
       
      fkTransformer: (t: T) => string;
    }>;

    const keys: K[] = Reflect.getMetadata('joinTables', this.ModelClass.prototype) || [];
    for (const key of keys) {
      const hasOneMeta = Reflect.getMetadata('hasOne', this.ModelClass.prototype, key as string);
      const hasManyMeta = Reflect.getMetadata('hasMany', this.ModelClass.prototype, key as string);

      if (hasOneMeta) {
        const modelClass = hasOneMeta();
        const joined = new (this.constructor as any)(modelClass);
        const { field } = joined.getPartitionKeyMeta();
        const fkTransformer = Reflect.getMetadata('belongsTo', modelClass.prototype, field);
        relatedRepositories[key] = {
          meta: 'hasOne',
          repo: joined,
          fkTransformer,
        };
      }
      if (hasManyMeta) {
        const modelClass = hasManyMeta();
        const joined = new (this.constructor as any)(modelClass);
        const { field } = joined.getPartitionKeyMeta();
        const fkTransformer = Reflect.getMetadata('belongsTo', modelClass.prototype, field);
        relatedRepositories[key] = {
          meta: 'hasMany',
          repo: joined,
          fkTransformer,
        };
      }
    }
    return relatedRepositories;
  }

  // CRUD Operations
  async get<K extends keyof T, J extends K>(partitionKeyValue: T[K], sortKeyValue?: T[K], joins: J[] = []): Promise<T | null> {
    const partitionKeyMeta = this.getPartitionKeyMeta();
    const sortKeyMeta = this.getSortKeyMeta();

    // Ensure the input type matches the partitionKey type
    if (partitionKeyMeta.type.name && typeof partitionKeyValue !== partitionKeyMeta.type) {
      throw new Error(
        `Invalid type for partition key. Expected ${partitionKeyMeta.type.name}, received ${typeof partitionKeyValue}`
      );
    }

    // serialize partition key
    const serializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, partitionKeyMeta.field as string);
    const inputKey = { [partitionKeyMeta.field]: serializer ? serializer(partitionKeyValue) : partitionKeyValue };

    // serialize sort key
    if (sortKeyMeta && sortKeyValue) {
      const sortKeySerializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, sortKeyMeta.field as string);
      inputKey[sortKeyMeta.field as string] = sortKeySerializer ? sortKeySerializer(sortKeyValue) : sortKeyValue;
    }

    const result =  this.transform(
      (await this.model.get(inputKey as InputKey)) as T,
      'deserialize',
    );

    if (result && joins.length > 0) {
      const repos = this.resolveRelatedRepositories();

      for (const join of joins) {
        const joinTable = repos[join];
        const joined = await joinTable.repo.query(result);

        if (joinTable.meta === 'hasOne') {
          result[join] = joined[0];
        } else if (joinTable.meta === 'hasMany') {
          const joinResult = joined;
          if (joinResult.lastKey) {
            throw new Error(`Unable to join all rows of ${joinTable.repo.ModelClass.name}`);
          }
          result[join] = joinResult as any;
        }
      }
    }

    return result;
  }

  /**
   * a special GET query
   *
   * this is allowed using get() when the table has redundant composite primary index of partitionkey-sortkey
   * WHERE partitionkey itself is already providing global uniqueness
   *
   * @param hashKeyValue
   */
  async getWithUniqueHashKey<K extends keyof T>(hashKeyValue: T[K]): Promise<T | null> {
    const array = await this.query(hashKeyValue);
    if (array.count > 1) {
      throw new Error('Hash key has more than 1 row');
    }

    if (array.count === 0) {return null;}
    return array[0];
  }

  async create(item: Prettify<Omit<T, 'CreatedAt' | 'UpdatedAt'>>): Promise<T> {
    const keys: string[] = Reflect.getMetadata('keys', this.ModelClass.prototype) || [];
    const createdAt = new Date();
    if (keys.includes('CreatedAt')) {
      // @ts-ignore
      item['CreatedAt'] = createdAt;
    }

    if (keys.includes('UpdatedAt')) {
      // @ts-ignore
      item['UpdatedAt'] = createdAt;
    }

    await this.model.create(
      this.transform(item as T, 'serialize'),
    );
    
    const result = this.transform(item as T, 'deserialize');
    
    // Execute create triggers
    await SignalTriggerManager.executeTriggers(this.ModelClass, 'create', result);
    
    return result;
  }

  async update(item: Omit<T, 'UpdatedAt'>): Promise<T> {
    const keys: string[] = Reflect.getMetadata('keys', this.ModelClass.prototype) || [];

    // Get the original item for trigger context
    const partitionKeyMeta = this.getPartitionKeyMeta();
    const sortKeyMeta = this.getSortKeyMeta();

    const serializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, partitionKeyMeta.field as string);
    const inputKey = { [partitionKeyMeta.field]: serializer ? serializer((item as any)[partitionKeyMeta.field]) : (item as any)[partitionKeyMeta.field] };

    if (sortKeyMeta) {
      const sortKeySerializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, sortKeyMeta.field as string);
      inputKey[sortKeyMeta.field as string] = sortKeySerializer ? sortKeySerializer((item as any)[sortKeyMeta.field]) : (item as any)[sortKeyMeta.field];
    }

    const previousItem = this.transform(
      (await this.model.get(inputKey as InputKey)) as T,
      'deserialize',
    );

    if (keys.includes('UpdatedAt')) {
      (item as any)['UpdatedAt'] = new Date();
    }
    
    await this.model.update(
      this.transform(item as T, 'serialize'),
    );
    
    const result = this.transform(item as T, 'deserialize');
    
    // Execute update triggers
    await SignalTriggerManager.executeTriggers(this.ModelClass, 'update', result, previousItem);
    
    return result;
  }

  async delete<K extends keyof T>(partitionKeyValue: T[K], sortKeyValue?: T[K]) {
    const hashKeyMeta = this.getPartitionKeyMeta();
    const sortKeyMeta = this.getSortKeyMeta();

    // serialize hash key
    const serializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, hashKeyMeta.field as string);
    const inputKey = { [hashKeyMeta.field]: serializer ? serializer(partitionKeyValue) : partitionKeyValue };

    // serialize sort key
    if (sortKeyMeta && sortKeyValue) {
      const sortKeySerializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, sortKeyMeta.field as string);
      inputKey[sortKeyMeta.field as string] = sortKeySerializer ? sortKeySerializer(sortKeyValue) : sortKeyValue;
    }

    const toBeDeleted = await this.model.get(inputKey);

    if (!toBeDeleted) {
      throw new Error(`Instance ${partitionKeyValue}${sortKeyValue ? '-' + sortKeyValue : ''} is not found for deletion`);
    }
    
    // Get the item before deletion for trigger context
    // Create a copy of the object to avoid modifying the original DynamoDB object
    const rawCopy = Object.assign({}, toBeDeleted);
    const previousItem = this.transform(rawCopy as T, 'deserialize');
    
    await toBeDeleted.delete();
    
    // Execute delete triggers with the properly deserialized item
    await SignalTriggerManager.executeTriggers(this.ModelClass, 'delete', previousItem, previousItem);
  }

  async query<K extends keyof T>(partitionKeyValue: T[K], sortKeyCondition?: Condition<T, K>, options?: { index?: string; limit?: number; lastKey?: string; sort?: SortOrder }): Promise<QueryResult<T, PaginationKey>> {
    const hashKeyMeta = this.getPartitionKeyMeta(options?.index);

    const serializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, hashKeyMeta.field as string);
    const serialized = serializer ? serializer(partitionKeyValue) : partitionKeyValue;

    const conditions = {
      [hashKeyMeta.field]: serialized,
    };
    if (sortKeyCondition) {
      const sortKeyMeta = this.getSortKeyMeta(options?.index);
      const sortKeySerializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, sortKeyMeta.field as string);

      const [[operator, serializedSortKeyRawValue]] = Object.entries(sortKeyCondition);
      const serializedSortKeyValue = sortKeySerializer ? sortKeySerializer(serializedSortKeyRawValue) : serializedSortKeyRawValue;

      conditions[sortKeyMeta.field as string] = {
        [operator]:  serializedSortKeyValue,
      };
    }

    const query = this.model.query(conditions) as Query<T>;

    if (options?.index) {
      query.using(options.index);
    }

    if (options?.lastKey) {
      query.startAt(JSON.parse(options.lastKey));
    }

    if (options?.sort) {
      query.sort(options.sort);
    }

    /**
     * this is technically a tech debt, we can ONLY live with this provided
     * - we dont expect to design the entity that scale fast, eg user session
     * - no nested join
     * - join does not apply to listing
     *
     * when join table query has results of more than 1000 rows, it throws error. Then we should consider a more specific partition id
     */
    query.limit(options?.limit ?? 1000);

    const raw = await query.exec();
    return this.postProcess(raw);
  }

  /**
   * @see https://dynamoosejs.com/guide/Schema#index-boolean--object--array
   * we use dynamoose default behavior
   */
  getDefaultIndexName(type: 'global' | 'local', partitionKey: keyof T, sortKey?: keyof T): string {
    return `${partitionKey as string}${sortKey ? '-' : ''}${sortKey ? sortKey as string : ''}${type === 'global' ? 'GlobalIndex' : 'LocalIndex'}`;
  }

  async scan<K extends keyof T>(filters: ScanFilter<T, K>, options?: { index?: string; limit?: number; lastKey?: PaginationKey }): Promise<QueryResult<T, PaginationKey>> {
    const { index, limit, lastKey } = options ?? {};

    const conditions = {} as any;
    const { partitionKey, sortKey } = filters;

    if (partitionKey) {
      const filterKeys = Object.keys(partitionKey) as K[];
      if (filterKeys.length !== 1) {
        throw new Error('Must have only one filter condition for hashKey during scan');
      }

      const partitionKeyMeta = this.getPartitionKeyMeta(options?.index);
      const hashKeySerializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, partitionKeyMeta.field as string);

      const [[operator, serializedHashKeyRawValue]] = Object.entries(partitionKey);
      const serializedHashKeyValue = hashKeySerializer ? hashKeySerializer(serializedHashKeyRawValue) : serializedHashKeyRawValue;

      conditions[partitionKeyMeta.field as string] = {
        [operator]:  serializedHashKeyValue,
      };
    }

    if (sortKey) {
      const filterKeys = Object.keys(sortKey) as K[];
      if (filterKeys.length > 1) {
        throw new Error('Must have maximum one filter condition for sortKey during scan');
      }

      const sortKeyMeta = this.getSortKeyMeta(options?.index);
      const sortKeySerializer = Reflect.getMetadata('belongsTo', this.ModelClass.prototype, sortKeyMeta.field as string);

      const [[operator, serializedSortKeyRawValue]] = Object.entries(sortKey);
      const serializedSortKeyValue = sortKeySerializer ? sortKeySerializer(serializedSortKeyRawValue) : serializedSortKeyRawValue;

      conditions[sortKeyMeta.field as string] = {
        [operator]:  serializedSortKeyValue,
      };
    }

    const scan = this.model.scan(conditions) as Scan<T>;
    if (index) {scan.using(index);}
    if (lastKey) {scan.startAt(JSON.parse(lastKey));}
    scan.limit(limit ?? 1000);

    const raw= await scan.exec();
    return this.postProcess(raw);
  }

  private postProcess(raw: ScanResponse<T> | QueryResponse<T>): QueryResult<T, PaginationKey> {
    const processed: any = raw.map(
      (data) => this.transform(
        data,
        'deserialize',
      ),
    );

    processed.count = raw.count;
    processed.lastKey = JSON.stringify(raw.lastKey);
    return processed;
  }
}
