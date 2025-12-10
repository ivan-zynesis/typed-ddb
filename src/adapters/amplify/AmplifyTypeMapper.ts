export class AmplifyTypeMapper {
  mapAttributeType(
    type: string,
    optional: boolean,
    isPartitionKey: boolean,
    isSortKey: boolean,
    enums?: string[]
  ): string {
    // Keys always use a.id().required()
    if (isPartitionKey || isSortKey) {
      return 'a.id().required()';
    }

    // Get base type
    const baseType = this.getBaseType(type, enums);

    // Enum fields are always mandatory in GraphQL, don't add .required()
    if (type === 'enums') {
      return baseType;
    }

    // Apply required/optional modifier
    return this.applyOptionalModifier(baseType, optional);
  }

  private getBaseType(type: string, enums?: string[]): string {
    switch (type) {
      case 'string':
        return 'a.string()';
      case 'number':
        return 'a.float()';
      case 'boolean':
        return 'a.boolean()';
      case 'date':
        return 'a.float()'; // a timestamp
      case 'date-iso':
        return 'a.string()'; // iso date time string
      case 'object':
        return 'a.json()';
      case 'array':
        return 'a.json()';
      case 'enums': {
        if (!enums || enums.length === 0) {
          throw new Error('Enum type requires enum values');
        }
        const enumValues = enums.map(e => `'${e}'`).join(', ');
        return `a.enum([${enumValues}])`;
      }
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  private applyOptionalModifier(baseType: string, optional: boolean): string {
    return optional ? baseType : `${baseType}.required()`;
  }
}
