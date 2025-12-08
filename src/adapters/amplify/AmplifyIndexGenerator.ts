import { IndexMetadata } from './types';

export class AmplifyIndexGenerator {
  constructor(private className: string) {}

  generateIndexes(indexes: IndexMetadata[]): string[] {
    return indexes.map(idx => this.generateSingleIndex(idx));
  }

  private generateSingleIndex(index: IndexMetadata): string {
    // Use the queryField from metadata if provided, otherwise generate it
    const queryField = index.queryField ?? this.generateQueryFieldName(index);

    let indexDef: string;
    if (index.sortKeyField) {
      indexDef = `index('${index.indexName}').sortKeys(['${index.sortKeyField}']).name('${index.indexName}').queryField('${queryField}')`;
    } else {
      indexDef = `index('${index.indexName}').name('${index.indexName}').queryField('${queryField}')`;
    }

    return indexDef;
  }

  private generateQueryFieldName(index: IndexMetadata): string {
    const pkPascal = this.toPascalCase(index.fieldName);

    if (index.sortKeyField) {
      const skPascal = this.toPascalCase(index.sortKeyField);
      return `${this.className}By${pkPascal}-${skPascal}`;
    }

    return `${this.className}By${pkPascal}`;
  }

  private toPascalCase(str: string): string {
    // Convert camelCase, snake_case, kebab-case to PascalCase
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
