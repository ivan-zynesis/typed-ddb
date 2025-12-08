import { AmplifyAdapter } from '../amplify/AmplifyAdapter';
import { AmplifyTypeMapper } from '../amplify/AmplifyTypeMapper';
import { AmplifyIndexGenerator } from '../amplify/AmplifyIndexGenerator';
import { User } from './entities/User';
import { Post } from './entities/Post';
import { Profile } from './entities/Profile';

describe('AmplifyTypeMapper', () => {
  let mapper: AmplifyTypeMapper;

  beforeEach(() => {
    mapper = new AmplifyTypeMapper();
  });

  describe('Basic Type Mapping', () => {
    it('should map string type', () => {
      const result = mapper.mapAttributeType('string', false, false, false);
      expect(result).toBe('a.string().required()');
    });

    it('should map number type', () => {
      const result = mapper.mapAttributeType('number', false, false, false);
      expect(result).toBe('a.float().required()');
    });

    it('should map boolean type', () => {
      const result = mapper.mapAttributeType('boolean', false, false, false);
      expect(result).toBe('a.boolean().required()');
    });

    it('should map date type', () => {
      const result = mapper.mapAttributeType('date', false, false, false);
      expect(result).toBe('a.datetime().required()');
    });

    it('should map object type', () => {
      const result = mapper.mapAttributeType('object', false, false, false);
      expect(result).toBe('a.json().required()');
    });

    it('should map array type', () => {
      const result = mapper.mapAttributeType('array', false, false, false);
      expect(result).toBe('a.json().required()');
    });
  });

  describe('Enum Type Mapping', () => {
    it('should map enum type with values', () => {
      const result = mapper.mapAttributeType('enums', false, false, false, ['draft', 'published', 'archived']);
      expect(result).toBe("a.enum(['draft', 'published', 'archived'])");
    });

    it('should throw error for enum without values', () => {
      expect(() => {
        mapper.mapAttributeType('enums', false, false, false);
      }).toThrow('Enum type requires enum values');
    });
  });

  describe('Optional Modifier', () => {
    it('should not add required() for optional fields', () => {
      const result = mapper.mapAttributeType('string', true, false, false);
      expect(result).toBe('a.string()');
    });

    it('should add required() for non-optional fields', () => {
      const result = mapper.mapAttributeType('string', false, false, false);
      expect(result).toBe('a.string().required()');
    });
  });

  describe('Key Type Mapping', () => {
    it('should map partition key to a.id().required()', () => {
      const result = mapper.mapAttributeType('string', false, true, false);
      expect(result).toBe('a.id().required()');
    });

    it('should map sort key to a.id().required()', () => {
      const result = mapper.mapAttributeType('string', false, false, true);
      expect(result).toBe('a.id().required()');
    });
  });
});

describe('AmplifyIndexGenerator', () => {
  let generator: AmplifyIndexGenerator;

  beforeEach(() => {
    generator = new AmplifyIndexGenerator('User');
  });

  describe('Index Generation', () => {
    it('should generate index without sort key', () => {
      const indexes = [{
        fieldName: 'email',
        indexName: 'emailGlobalIndex',
        type: 'global' as const,
        queryField: 'usersByEmail'
      }];
      const result = generator.generateIndexes(indexes);
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("index('email')");
      expect(result[0]).toContain(".name('emailGlobalIndex')");
      expect(result[0]).toContain(".queryField('usersByEmail')");
    });

    it('should generate index with sort key', () => {
      const indexes = [{
        fieldName: 'status',
        indexName: 'StatusIndex',
        sortKeyField: 'publishedAt',
        type: 'global' as const,
        queryField: 'postsByStatus'
      }];
      const result = generator.generateIndexes(indexes);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("index('status')");
      expect(result[0]).toContain(".sortKeys(['publishedAt'])");
      expect(result[0]).toContain(".name('StatusIndex')");
      expect(result[0]).toContain(".queryField('postsByStatus')");
    });

    it('should return empty array for no indexes', () => {
      const result = generator.generateIndexes([]);
      expect(result).toEqual([]);
    });

    it('should handle multiple indexes', () => {
      const indexes = [
        {
          fieldName: 'email',
          indexName: 'emailIndex',
          type: 'global' as const,
          queryField: 'usersByEmail'
        },
        {
          fieldName: 'status',
          indexName: 'statusIndex',
          sortKeyField: 'createdAt',
          type: 'global' as const,
          queryField: 'usersByStatus'
        }
      ];
      const result = generator.generateIndexes(indexes);
      expect(result).toHaveLength(2);
      expect(result[0]).toContain("index('email')");
      expect(result[1]).toContain("index('status')");
    });
  });

  describe('QueryField Name Generation', () => {
    it('should use provided queryField', () => {
      const indexes = [{
        fieldName: 'emailAddress',
        indexName: 'emailAddressIndex',
        type: 'global' as const,
        queryField: 'usersByEmailAddress'
      }];
      const result = generator.generateIndexes(indexes);
      expect(result[0]).toContain('usersByEmailAddress');
    });

    it('should generate queryField if not provided', () => {
      const indexes = [{
        fieldName: 'emailAddress',
        indexName: 'emailAddressIndex',
        type: 'global' as const
      }];
      const result = generator.generateIndexes(indexes);
      expect(result[0]).toContain('UserByEmailAddress');
    });
  });
});

describe('AmplifyAdapter Integration Tests', () => {
  describe('User Entity', () => {
    let adapter: AmplifyAdapter<User>;

    beforeEach(() => {
      adapter = new AmplifyAdapter(User);
    });

    it('should generate modelFields and secondaryIndexes', () => {
      const fields = adapter.modelFields();
      const indexes = adapter.secondaryIndexes();

      expect(fields).toContain('id: a.id().required()');
      expect(fields).toContain('email: a.string().required()');
      expect(fields).toContain('name: a.string().required()');
      expect(fields).toContain('age: a.float().required()');
      expect(fields).toContain('isActive: a.boolean().required()');
      expect(fields).toContain('metadata: a.json()');
      expect(fields).toContain('tags: a.json()');
      expect(fields).toContain('CreatedAt: a.datetime().required()');
      expect(fields).toContain('UpdatedAt: a.datetime()');

      expect(indexes).toBeInstanceOf(Array);
      expect(indexes.length).toBeGreaterThan(0);
      expect(indexes[0]).toContain('usersByEmail');
    });

    it('should generate modelFields correctly', () => {
      const fields = adapter.modelFields();

      expect(fields).toContain('id: a.id().required()');
      expect(fields).toContain('email: a.string().required()');
      expect(fields).toContain('name: a.string().required()');
      expect(fields).toContain('age: a.float().required()');
      expect(fields).toContain('isActive: a.boolean().required()');
      expect(fields).toContain('metadata: a.json()');
      expect(fields).toContain('tags: a.json()');
      expect(fields).toContain('CreatedAt: a.datetime().required()');
      expect(fields).toContain('UpdatedAt: a.datetime()');
    });

    it('should generate secondary indexes', () => {
      const indexes = adapter.secondaryIndexes();

      expect(indexes).toBeInstanceOf(Array);
      expect(indexes.length).toBeGreaterThan(0);
      expect(indexes[0]).toContain('usersByEmail');
    });
  });

  describe('Post Entity', () => {
    let adapter: AmplifyAdapter<Post>;

    beforeEach(() => {
      adapter = new AmplifyAdapter(Post);
    });

    it('should generate modelFields correctly', () => {
      const fields = adapter.modelFields();

      expect(fields).toContain('id: a.id().required()');
      expect(fields).toContain('title: a.string().required()');
      expect(fields).toContain('content: a.string().required()');
      expect(fields).toContain('status: a.enum');
      expect(fields).toContain('publishedAt: a.float().required()');
      expect(fields).toContain('CreatedAt: a.datetime().required()');
      expect(fields).toContain('UpdatedAt: a.datetime()');
    });

    it('should handle enum fields', () => {
      const fields = adapter.modelFields();

      expect(fields).toContain("status: a.enum(['draft', 'published', 'archived'])");
    });

    it('should handle @BelongsTo relationships', () => {
      const fields = adapter.modelFields();

      expect(fields).toContain('userId:');
      expect(fields).toContain("a.belongsTo('User', 'userId')");
    });

    it('should generate index with sort key', () => {
      const indexes = adapter.secondaryIndexes();

      expect(indexes).toBeInstanceOf(Array);
      expect(indexes.length).toBeGreaterThan(0);
      expect(indexes[0]).toContain('StatusIndex');
      expect(indexes[0]).toContain("sortKeys(['publishedAt'])");
      expect(indexes[0]).toContain('postsByStatus');
    });
  });

  describe('Profile Entity', () => {
    let adapter: AmplifyAdapter<Profile>;

    beforeEach(() => {
      adapter = new AmplifyAdapter(Profile);
    });

    it('should generate modelFields for Profile', () => {
      const fields = adapter.modelFields();

      expect(fields).toContain('userId: a.id().required()');
    });

    it('should handle @BelongsTo as partition key', () => {
      const fields = adapter.modelFields();

      expect(fields).toContain('userId: a.id().required()');
    });
  });

  describe('Edge Cases', () => {
    it('should handle table name as function', () => {
      const adapter = new AmplifyAdapter(User);
      const fields = adapter.modelFields();

      // Should generate successfully regardless of table name type
      expect(fields).toContain('id: a.id().required()');
    });

    it('should handle entities without indexes', () => {
      const adapter = new AmplifyAdapter(Profile);
      const indexes = adapter.secondaryIndexes();

      // Profile doesn't have indexes, should return empty array
      expect(indexes).toEqual([]);
    });

    it('should handle optional fields correctly', () => {
      const adapter = new AmplifyAdapter(User);
      const fields = adapter.modelFields();

      // metadata and tags are optional
      expect(fields).toContain('metadata: a.json()');
      expect(fields).toContain('tags: a.json()');
      expect(fields).not.toContain('metadata: a.json().required()');
      expect(fields).not.toContain('tags: a.json().required()');
    });
  });
});
