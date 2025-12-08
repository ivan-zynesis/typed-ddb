import 'reflect-metadata';
import { AmplifyTypeMapper } from './AmplifyTypeMapper';
import { AmplifyIndexGenerator } from './AmplifyIndexGenerator';
import { AmplifyRelationshipMapper } from './AmplifyRelationshipMapper';
import { EntityMetadata, FieldMetadata, IndexMetadata } from './types';

export class AmplifyAdapter<T> {
  private readonly ModelClass: new () => T;
  private readonly className: string;
  private readonly typeMapper: AmplifyTypeMapper;
  private readonly indexGenerator: AmplifyIndexGenerator;
  private readonly relationshipMapper: AmplifyRelationshipMapper;

  constructor(ModelClass: new () => T) {
    this.ModelClass = ModelClass;
    this.className = ModelClass.name;
    this.typeMapper = new AmplifyTypeMapper();
    this.indexGenerator = new AmplifyIndexGenerator(this.className);
    this.relationshipMapper = new AmplifyRelationshipMapper();
  }

  modelFields(): string {
    const metadata = this.extractMetadata();
    const fieldDefs: string[] = [];

    for (const field of metadata.fields) {
      // Skip virtual relationship fields (@HasOne/@HasMany without actual column)
      if ((field.relationship?.type === 'hasOne' || field.relationship?.type === 'hasMany')
          && field.type === 'relationship') {
        // This is a virtual relationship field, generate only relationship def
        if (field.relationship.relatedModelClass) {
          const relDef = field.relationship.type === 'hasOne'
            ? this.relationshipMapper.generateHasOne(field.relationship.relatedModelClass, this.ModelClass)
            : this.relationshipMapper.generateHasMany(field.relationship.relatedModelClass, this.ModelClass);
          fieldDefs.push(`${field.name}: ${relDef}`);
        }
        continue;
      }

      if (field.relationship?.type === 'belongsTo' && field.relationship.relatedModelClass) {
        // For @BelongsTo: generate the field definition
        const typeDef = this.typeMapper.mapAttributeType(
          field.type,
          field.optional,
          field.isPartitionKey,
          field.isSortKey
        );
        fieldDefs.push(`${field.name}: ${typeDef}`);

        // Add relationship field - infer name by removing 'Id' suffix
        const relationshipFieldName = field.name.replace(/Id$/i, '').toLowerCase() === field.name.toLowerCase()
          ? field.name + 'Relation'  // If no 'Id' suffix, append 'Relation'
          : field.name.replace(/Id$/i, '');  // Remove 'Id' suffix

        const relDef = this.relationshipMapper.generateBelongsTo(
          field.relationship.relatedModelClass,
          field.name
        );
        fieldDefs.push(`${relationshipFieldName}: ${relDef}`);

      } else {
        // Regular attribute
        const typeDef = this.typeMapper.mapAttributeType(
          field.type,
          field.optional,
          field.isPartitionKey,
          field.isSortKey,
          field.enums
        );
        fieldDefs.push(`${field.name}: ${typeDef}`);
      }
    }

    return fieldDefs.join(',\n    ');
  }

  secondaryIndexes(): string[] {
    const metadata = this.extractMetadata();
    const indexes: IndexMetadata[] = [];

    for (const field of metadata.fields) {
      if (field.isIndex && field.indexConfig) {
        indexes.push({
          fieldName: field.name,
          indexName: field.indexConfig.name,
          sortKeyField: field.indexConfig.sortKey,
          type: field.indexConfig.type,
          queryField: field.indexConfig.queryField
        });
      }
    }

    return this.indexGenerator.generateIndexes(indexes);
  }

  private extractMetadata(): EntityMetadata {
    const keys: string[] = Reflect.getMetadata('keys', this.ModelClass.prototype) || [];
    const joinTables: string[] = Reflect.getMetadata('joinTables', this.ModelClass.prototype) || [];

    const fields: FieldMetadata[] = [];

    // Process regular fields
    for (const key of keys) {
      const field = this.extractFieldMetadata(key);
      fields.push(field);
    }

    // Process relationship fields (@HasOne/@HasMany)
    for (const key of joinTables) {
      if (keys.includes(key)) {
        // Already processed
        continue;
      }

      const field = this.extractRelationshipMetadata(key);
      if (field) {
        fields.push(field);
      }
    }

    return {
      tableName: this.getTableName(),
      className: this.className,
      fields
    };
  }

  private extractFieldMetadata(key: string): FieldMetadata {
    const prototype = this.ModelClass.prototype;

    const type = Reflect.getMetadata('type', prototype, key);
    const optional = Reflect.getMetadata('optional', prototype, key) || false;
    const enums = Reflect.getMetadata('enums', prototype, key);

    const partitionKey = Reflect.getMetadata('partitionKey', prototype, key);
    const sortKey = Reflect.getMetadata('sortKey', prototype, key);
    const amplifyGsi = Reflect.getMetadata('amplifyGsi', prototype, key);
    const belongsTo = Reflect.getMetadata('belongsTo', prototype, key);

    return {
      name: key,
      type,
      optional,
      isPartitionKey: !!partitionKey,
      isSortKey: !!sortKey,
      isIndex: !!amplifyGsi,
      enums,
      indexConfig: amplifyGsi ? {
        type: amplifyGsi.type,
        name: amplifyGsi.name,
        sortKey: amplifyGsi.sortKey,
        queryField: amplifyGsi.queryField
      } : undefined,
      relationship: belongsTo ? {
        type: 'belongsTo',
        relatedModelClass: this.inferRelatedModelFromFieldName(key)
      } : undefined
    };
  }

  private extractRelationshipMetadata(key: string): FieldMetadata | null {
    const prototype = this.ModelClass.prototype;

    const hasOne = Reflect.getMetadata('hasOne', prototype, key);
    const hasMany = Reflect.getMetadata('hasMany', prototype, key);

    if (hasOne) {
      return {
        name: key,
        type: 'relationship',
        optional: true,
        isPartitionKey: false,
        isSortKey: false,
        isIndex: false,
        relationship: {
          type: 'hasOne',
          relatedModelClass: hasOne()
        }
      };
    }

    if (hasMany) {
      return {
        name: key,
        type: 'relationship',
        optional: true,
        isPartitionKey: false,
        isSortKey: false,
        isIndex: false,
        relationship: {
          type: 'hasMany',
          relatedModelClass: hasMany()
        }
      };
    }

    return null;
  }

  private inferRelatedModelFromFieldName(fieldName: string): new () => any {
    // For @BelongsTo fields like "userId", infer "User"
    const modelName = fieldName.replace(/Id$/i, '');
    const capitalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

    // Create a mock class with the inferred name
    // This is necessary because we need the name for code generation
    const MockClass = class {};
    Object.defineProperty(MockClass, 'name', { value: capitalizedName });
    return MockClass as new () => any;
  }

  private getTableName(): string {
    const tableNameProvider = Reflect.getMetadata('tableName', this.ModelClass);

    if (typeof tableNameProvider === 'function') {
      // Extract expression from arrow function
      const fnString = tableNameProvider.toString();
      const match = fnString.match(/(?:=>|return)\s*['"]?([^'";\s}]+)['"]?/);
      return match ? match[1].trim() : tableNameProvider();
    }

    return tableNameProvider;
  }
}
