import { AmplifyBaseModel } from '../amplify/AmplifyBaseModel';
import { Table, Attribute, PartitionKey } from '../../dynamodb';
import { TestEntity, LegacyEntity } from './entities/AmplifyModels';

describe('AmplifyBaseModel', () => {
  describe('Class Definition', () => {
    it('should define createdAt with date-iso attribute metadata', () => {
      const isDateIso = Reflect.getMetadata('isDateIso', AmplifyBaseModel.prototype, 'createdAt');
      expect(isDateIso).toBe(true);
    });

    it('should define updatedAt with date-iso attribute metadata', () => {
      const isDateIso = Reflect.getMetadata('isDateIso', AmplifyBaseModel.prototype, 'updatedAt');
      expect(isDateIso).toBe(true);
    });

    it('should mark createdAt as non-optional', () => {
      const optional = Reflect.getMetadata('optional', AmplifyBaseModel.prototype, 'createdAt');
      expect(optional).toBe(false);
    });

    it('should mark updatedAt as non-optional', () => {
      const optional = Reflect.getMetadata('optional', AmplifyBaseModel.prototype, 'updatedAt');
      expect(optional).toBe(false);
    });

    it('should have createdAt in keys metadata', () => {
      const keys: string[] = Reflect.getMetadata('keys', AmplifyBaseModel.prototype) || [];
      expect(keys).toContain('createdAt');
    });

    it('should have updatedAt in keys metadata', () => {
      const keys: string[] = Reflect.getMetadata('keys', AmplifyBaseModel.prototype) || [];
      expect(keys).toContain('updatedAt');
    });
  });

  describe('Inheritance', () => {
    it('should preserve parent metadata in child class', () => {
      const keys: string[] = Reflect.getMetadata('keys', TestEntity.prototype) || [];
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
      expect(keys).toContain('id');
      expect(keys).toContain('name');
    });

    it('should have date-iso metadata for inherited fields', () => {
      const isDateIsoCreated = Reflect.getMetadata('isDateIso', TestEntity.prototype, 'createdAt');
      const isDateIsoUpdated = Reflect.getMetadata('isDateIso', TestEntity.prototype, 'updatedAt');

      expect(isDateIsoCreated).toBe(true);
      expect(isDateIsoUpdated).toBe(true);
    });

    it('should properly chain with child entity fields', () => {
      const keys: string[] = Reflect.getMetadata('keys', TestEntity.prototype) || [];

      // Should have both parent and child fields
      expect(keys.length).toBeGreaterThanOrEqual(4); // createdAt, updatedAt, id, name
      expect(keys).toContain('id');
      expect(keys).toContain('name');
      expect(keys).toContain('count');
    });
  });

  describe('Type Definitions', () => {
    it('should enforce non-optional createdAt type', () => {
      // This is a compile-time test - if it compiles, the type is correct
      const entity: TestEntity = {
        id: 'type-1',
        name: 'Type Test',
        createdAt: new Date(), // Required
        updatedAt: new Date(), // Required
      };

      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();
    });

    it('should enforce non-optional updatedAt type', () => {
      const entity: TestEntity = {
        id: 'type-2',
        name: 'Type Test 2',
        createdAt: new Date(),
        updatedAt: new Date(), // Should be required due to @Attribute config
      };

      expect(entity.updatedAt).toBeDefined();
    });

    it('should use Date type for timestamp fields', () => {
      const entity = new TestEntity();
      entity.createdAt = new Date();
      entity.updatedAt = new Date();

      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow optional fields alongside required timestamps', () => {
      const entityWithCount: TestEntity = {
        id: 'test-1',
        name: 'Test',
        count: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const entityWithoutCount: TestEntity = {
        id: 'test-2',
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entityWithCount.count).toBe(42);
      expect(entityWithoutCount.count).toBeUndefined();
    });
  });

  describe('Comparison with Legacy Pattern', () => {
    it('should use date-iso type vs date type', () => {
      // AmplifyBaseModel uses date-iso
      const isDateIsoCreated = Reflect.getMetadata('isDateIso', TestEntity.prototype, 'createdAt');
      const isDateIsoUpdated = Reflect.getMetadata('isDateIso', TestEntity.prototype, 'updatedAt');
      expect(isDateIsoCreated).toBe(true);
      expect(isDateIsoUpdated).toBe(true);

      // Legacy uses date
      const isDateCreated = Reflect.getMetadata('isDate', LegacyEntity.prototype, 'CreatedAt');
      const isDateUpdated = Reflect.getMetadata('isDate', LegacyEntity.prototype, 'UpdatedAt');
      expect(isDateCreated).toBe(true);
      expect(isDateUpdated).toBe(true);
    });

    it('should have consistent metadata structure', () => {
      const baseKeys: string[] = Reflect.getMetadata('keys', TestEntity.prototype) || [];
      const legacyKeys: string[] = Reflect.getMetadata('keys', LegacyEntity.prototype) || [];

      // Both should have timestamp fields in keys
      expect(baseKeys.filter(k => k.includes('createdAt') || k.includes('updatedAt'))).toHaveLength(2);
      expect(legacyKeys.filter(k => k.includes('CreatedAt') || k.includes('UpdatedAt'))).toHaveLength(2);
    });
  });

  describe('Integration with Repository Pattern', () => {
    it('should work with Repository auto-timestamp management (createdAt/updatedAt)', () => {
      // The Repository class automatically handles both CreatedAt/UpdatedAt (uppercase)
      // and createdAt/updatedAt (lowercase) fields during create/update operations.
      // See Repository.ts:290-301 for create logic and Repository.ts:315-337 for update logic

      const keys: string[] = Reflect.getMetadata('keys', TestEntity.prototype) || [];

      // Verify that createdAt and updatedAt are in the keys metadata
      // so Repository will manage them automatically
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
    });

    it('should be compatible with Repository create signature', () => {
      // Repository.create accepts Omit<T, 'CreatedAt' | 'UpdatedAt' | 'createdAt' | 'updatedAt'>
      // This means users don't need to provide these fields when creating entities

      type CreateInput = Omit<TestEntity, 'CreatedAt' | 'UpdatedAt' | 'createdAt' | 'updatedAt'>;

      const input: CreateInput = {
        id: 'test-1',
        name: 'Test Entity',
        count: 42,
      };

      // Verify that the input type doesn't require timestamp fields
      expect(input).not.toHaveProperty('createdAt');
      expect(input).not.toHaveProperty('updatedAt');
    });

    it('should be compatible with Repository update signature', () => {
      // Repository.update accepts Omit<T, 'UpdatedAt' | 'updatedAt'>
      // This means createdAt is required (to preserve it), but updatedAt is auto-set

      type UpdateInput = Omit<TestEntity, 'UpdatedAt' | 'updatedAt'>;

      const input: UpdateInput = {
        id: 'test-1',
        name: 'Updated Entity',
        count: 100,
        createdAt: new Date(), // Required - preserves original creation time
        // updatedAt is NOT here - will be auto-set by Repository
      };

      // Verify that createdAt is required but updatedAt is not
      expect(input).toHaveProperty('createdAt');
      expect(input).not.toHaveProperty('updatedAt');
    });
  });

  describe('Usage Examples', () => {
    it('should demonstrate typical downstream usage', () => {
      // Downstream users create models by extending AmplifyBaseModel
      @Table(() => 'Products')
      class Product extends AmplifyBaseModel {
        @PartitionKey()
        @Attribute({ type: 'string' })
        id: string;

        @Attribute({ type: 'string' })
        name: string;

        @Attribute({ type: 'number' })
        price: number;
      }

      // Verify metadata is properly set
      const keys: string[] = Reflect.getMetadata('keys', Product.prototype) || [];
      expect(keys).toContain('id');
      expect(keys).toContain('name');
      expect(keys).toContain('price');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
    });

    it('should work with complex entity hierarchies', () => {
      // Base domain model
      @Table(() => 'BaseEntities')
      abstract class BaseEntity extends AmplifyBaseModel {
        @PartitionKey()
        @Attribute({ type: 'string' })
        id: string;
      }

      // Specific entity
      @Table(() => 'Users')
      class User extends BaseEntity {
        @Attribute({ type: 'string' })
        email: string;

        @Attribute({ type: 'string' })
        name: string;
      }

      // Verify all metadata is preserved
      const keys: string[] = Reflect.getMetadata('keys', User.prototype) || [];
      expect(keys).toContain('id');
      expect(keys).toContain('email');
      expect(keys).toContain('name');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
    });
  });

  describe('Field Characteristics', () => {
    it('should use date-iso type for Amplify compatibility', () => {
      // Amplify uses ISO 8601 date strings (e.g., "2024-01-15T10:30:00.000Z")
      // The date-iso type ensures proper serialization for Amplify
      const isDateIso = Reflect.getMetadata('isDateIso', AmplifyBaseModel.prototype, 'createdAt');
      expect(isDateIso).toBe(true);
    });

    it('should mark both fields as non-optional', () => {
      // Both createdAt and updatedAt are non-optional in AmplifyBaseModel
      // This ensures consistency with Amplify's timestamp handling
      const createdOptional = Reflect.getMetadata('optional', AmplifyBaseModel.prototype, 'createdAt');
      const updatedOptional = Reflect.getMetadata('optional', AmplifyBaseModel.prototype, 'updatedAt');

      expect(createdOptional).toBe(false);
      expect(updatedOptional).toBe(false);
    });

    it('should have proper attribute metadata', () => {
      // Verify that @Attribute decorator was applied correctly
      const createdAtType = Reflect.getMetadata('isDateIso', AmplifyBaseModel.prototype, 'createdAt');
      const updatedAtType = Reflect.getMetadata('isDateIso', AmplifyBaseModel.prototype, 'updatedAt');

      expect(createdAtType).toBe(true);
      expect(updatedAtType).toBe(true);
    });
  });
});