/**
 * Test to ensure Repository works 100% with @AmplifyGsi decorated entities
 */
import { Repository } from '../../dynamodb/core/Repository';
import { User } from './entities/User';
import { Post } from './entities/Post';

describe('Repository with @AmplifyGsi decorated entities', () => {
  describe('User entity with @AmplifyGsi', () => {
    let repo: Repository<User>;

    beforeEach(() => {
      repo = new Repository(User);
    });

    it('should create repository successfully', () => {
      expect(repo).toBeDefined();
      expect(repo.ModelClass).toBe(User);
    });

    it('should get default index name correctly', () => {
      // @AmplifyGsi creates global indexes
      const indexName = repo.getDefaultIndexName('global', 'email');
      expect(indexName).toBe('emailGlobalIndex');
    });
  });

  describe('Post entity with @AmplifyGsi composite index', () => {
    let repo: Repository<Post>;

    beforeEach(() => {
      repo = new Repository(Post);
    });

    it('should create repository successfully', () => {
      expect(repo).toBeDefined();
      expect(repo.ModelClass).toBe(Post);
    });

    it('should generate default composite index name', () => {
      // When using getDefaultIndexName, it generates from field names
      const indexName = repo.getDefaultIndexName('global', 'status', 'publishedAt');
      expect(indexName).toBe('status-publishedAtGlobalIndex');
    });
  });

  describe('Index metadata compatibility', () => {
    it('should have proper index metadata for Repository', () => {
      const prototype = User.prototype;

      // Check that standard @Index metadata exists (created by @AmplifyGsi)
      const indexMeta = Reflect.getMetadata('index', prototype, 'email');
      expect(indexMeta).toBeDefined();
      expect(indexMeta.type).toBe('global');

      // Check that amplifyGsi metadata also exists
      const amplifyMeta = Reflect.getMetadata('amplifyGsi', prototype, 'email');
      expect(amplifyMeta).toBeDefined();
      expect(amplifyMeta.queryField).toBe('usersByEmail');
    });

    it('should have proper composite index metadata', () => {
      const prototype = Post.prototype;

      const indexMeta = Reflect.getMetadata('index', prototype, 'status');
      expect(indexMeta).toBeDefined();
      expect(indexMeta.type).toBe('global');
      expect(indexMeta.sortKey).toBe('publishedAt');

      const amplifyMeta = Reflect.getMetadata('amplifyGsi', prototype, 'status');
      expect(amplifyMeta).toBeDefined();
      expect(amplifyMeta.queryField).toBe('postsByStatus');
      expect(amplifyMeta.sortKey).toBe('publishedAt');
    });
  });
});
