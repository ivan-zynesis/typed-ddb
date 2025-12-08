import 'reflect-metadata';

export class AmplifyRelationshipMapper {
  generateBelongsTo(relatedModelClass: new () => any, foreignKeyField: string): string {
    const relatedModelName = relatedModelClass.name;
    return `a.belongsTo('${relatedModelName}', '${foreignKeyField}')`;
  }

  generateHasOne(relatedModelClass: new () => any, currentModelClass: new () => any): string {
    const relatedModelName = relatedModelClass.name;
    const foreignKeyField = this.findForeignKeyInRelatedModel(relatedModelClass, currentModelClass);
    return `a.hasOne('${relatedModelName}', '${foreignKeyField}')`;
  }

  generateHasMany(relatedModelClass: new () => any, currentModelClass: new () => any): string {
    const relatedModelName = relatedModelClass.name;
    const foreignKeyField = this.findForeignKeyInRelatedModel(relatedModelClass, currentModelClass);
    return `a.hasMany('${relatedModelName}', '${foreignKeyField}')`;
  }

  private findForeignKeyInRelatedModel(
    relatedModelClass: new () => any,
    currentModelClass: new () => any
  ): string {
    // Get all keys from related model
    const keys: string[] = Reflect.getMetadata('keys', relatedModelClass.prototype) || [];

    // Find field with @BelongsTo decorator that references the current model
    // Convention: look for field named like "<currentModelName>Id"
    const currentModelName = currentModelClass.name;
    const expectedFieldName = currentModelName.charAt(0).toLowerCase() + currentModelName.slice(1) + 'Id';

    for (const key of keys) {
      const belongsTo = Reflect.getMetadata('belongsTo', relatedModelClass.prototype, key);
      if (belongsTo && key.toLowerCase() === expectedFieldName.toLowerCase()) {
        return key;
      }
    }

    // If convention doesn't work, find any @BelongsTo field
    for (const key of keys) {
      const belongsTo = Reflect.getMetadata('belongsTo', relatedModelClass.prototype, key);
      if (belongsTo) {
        return key;
      }
    }

    throw new Error(`Cannot find @BelongsTo foreign key in ${relatedModelClass.name} referencing ${currentModelName}`);
  }
}
