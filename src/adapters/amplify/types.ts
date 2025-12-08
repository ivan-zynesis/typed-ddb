export interface FieldMetadata {
  name: string;
  type: string;
  optional: boolean;
  isPartitionKey: boolean;
  isSortKey: boolean;
  isIndex: boolean;
  enums?: string[];
  indexConfig?: {
    type: 'global' | 'local';
    name: string;
    sortKey?: string;
    queryField?: string;
  };
  relationship?: {
    type: 'belongsTo' | 'hasOne' | 'hasMany';
    relatedModelClass?: new () => any;
  };
}

export interface EntityMetadata {
  tableName: string;
  className: string;
  fields: FieldMetadata[];
}

export interface IndexMetadata {
  fieldName: string;
  indexName: string;
  sortKeyField?: string;
  type: 'global' | 'local';
  queryField?: string;
}
