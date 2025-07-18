import { AwsTestContainer, StartedTestContainer } from './DynamoDbEmulator';
import { Repository } from '../core';
import {
  User,
  Post,
  Comment,
  Profile,
  Tag
} from './entities';

describe('Repository<T>', () => {
  let container: StartedTestContainer;

  beforeAll(async () => {
    container = await new AwsTestContainer().start();
  });

  afterAll(() => container.stop());

  describe('get()', () => {
    describe('with partition key', () => {
      const GET_FIXTURES = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          age: 30,
          isActive: true,
        },
        profile: {
          userId: { id: 'user-456' },
          bio: 'Software developer',
          settings: {
            theme: 'dark' as const,
            notifications: true,
            privacy: 'public' as const
          },
        },
        joinUser: {
          id: 'user-789',
          email: 'join@example.com',
          name: 'Join User',
          age: 25,
          isActive: true,
        },
        joinProfile: {
          userId: { id: 'user-789' },
          bio: 'Test bio',
          settings: {
            theme: 'light' as const,
            notifications: false,
            privacy: 'private' as const
          },
        }
      };

      beforeAll(async () => {
        const userRepo = new Repository(User);
        const profileRepo = new Repository(Profile);

        // Create test fixtures
        await userRepo.create(GET_FIXTURES.user);
        await profileRepo.create(GET_FIXTURES.profile);
        await userRepo.create(GET_FIXTURES.joinUser);
        await profileRepo.create(GET_FIXTURES.joinProfile);
      });

      afterAll(async () => {
        const userRepo = new Repository(User);
        const profileRepo = new Repository(Profile);

        // Cleanup test fixtures
        await userRepo.delete(GET_FIXTURES.user.id);
        await profileRepo.delete(GET_FIXTURES.profile.userId);
        await userRepo.delete(GET_FIXTURES.joinUser.id);
        await profileRepo.delete(GET_FIXTURES.joinProfile.userId);
      });

      it('primitive data type key', async () => {
        const userRepo = new Repository(User);
        const userId = GET_FIXTURES.user.id;

        const retrieved = await userRepo.get(userId);
        
        expect(retrieved).toBeTruthy();
        expect(retrieved!.id).toBe(userId);
        expect(retrieved!.email).toBe('test@example.com');
        expect(retrieved!.name).toBe('Test User');
        expect(retrieved!.age).toBe(30);
        expect(retrieved!.isActive).toBe(true);
      });

      it('object data type key', async () => {
        const profileRepo = new Repository(Profile);
        const userId = GET_FIXTURES.profile.userId;

        const retrieved = await profileRepo.get(userId);
        
        expect(retrieved).toBeTruthy();
        expect(retrieved!.userId).toEqual(userId);
        expect(retrieved!.bio).toBe('Software developer');
        expect(retrieved!.settings.theme).toBe('dark');
      });

      it('join', async () => {
        const userRepo = new Repository(User);
        const userId = GET_FIXTURES.joinUser.id;

        const userWithProfile = await userRepo.get(userId, undefined, ['profile']);
        
        expect(userWithProfile).toBeTruthy();
        expect(userWithProfile!.profile).toBeTruthy();
        expect(userWithProfile!.profile!.bio).toBe('Test bio');
      });
    });

    describe('with partition key and sort key', () => {
      const GET_SORT_KEY_FIXTURES = {
        tag: {
          name: 'javascript',
          category: 'programming',
          description: 'JavaScript programming language',
          usageCount: 100,
        },
        post: {
          userId: { id: 'user-comment-test' },
          id: 'post-123',
          title: 'Test Post',
          content: 'Test content',
          status: 'published' as const,
          publishedAt: 1672531200000, // Fixed timestamp instead of Date.now()
        },
        comment: {
          postId: { userId: { id: 'user-comment-test' }, id: 'post-123' },
          id: 'comment-456',
          authorId: { id: 'author-789' },
          content: 'Great post!',
        },
        reactTag: {
          name: 'react',
          category: 'library',
          usageCount: 50,
        }
      };

      beforeAll(async () => {
        const tagRepo = new Repository(Tag);
        const postRepo = new Repository(Post);
        const commentRepo = new Repository(Comment);

        // Create test fixtures
        await tagRepo.create(GET_SORT_KEY_FIXTURES.tag);
        await postRepo.create(GET_SORT_KEY_FIXTURES.post);
        await commentRepo.create(GET_SORT_KEY_FIXTURES.comment);
        await tagRepo.create(GET_SORT_KEY_FIXTURES.reactTag);
      });

      afterAll(async () => {
        const tagRepo = new Repository(Tag);
        const postRepo = new Repository(Post);
        const commentRepo = new Repository(Comment);

        // Cleanup test fixtures
        await tagRepo.delete(GET_SORT_KEY_FIXTURES.tag.name, GET_SORT_KEY_FIXTURES.tag.category);
        await commentRepo.delete(GET_SORT_KEY_FIXTURES.comment.postId, GET_SORT_KEY_FIXTURES.comment.id);
        await postRepo.delete(GET_SORT_KEY_FIXTURES.post.userId, GET_SORT_KEY_FIXTURES.post.id);
        await tagRepo.delete(GET_SORT_KEY_FIXTURES.reactTag.name, GET_SORT_KEY_FIXTURES.reactTag.category);
      });

      it('primitive data type keys', async () => {
        const tagRepo = new Repository(Tag);
        const tagName = GET_SORT_KEY_FIXTURES.tag.name;
        const category = GET_SORT_KEY_FIXTURES.tag.category;

        const retrieved = await tagRepo.get(tagName, category);
        
        expect(retrieved).toBeTruthy();
        expect(retrieved!.name).toBe(tagName);
        expect(retrieved!.category).toBe(category);
        expect(retrieved!.description).toBe('JavaScript programming language');
        expect(retrieved!.usageCount).toBe(100);
      });

      it('object data type keys', async () => {
        const commentRepo = new Repository(Comment);
        const postId = GET_SORT_KEY_FIXTURES.comment.postId;
        const commentId = GET_SORT_KEY_FIXTURES.comment.id;

        const retrieved = await commentRepo.get(postId, commentId);
        
        expect(retrieved).toBeTruthy();
        expect(retrieved!.postId).toEqual(postId);
        expect(retrieved!.id).toBe(commentId);
        expect(retrieved!.content).toBe('Great post!');
      });

      it('should fail when sort key not provided', async () => {
        const tagRepo = new Repository(Tag);
        const tagName = GET_SORT_KEY_FIXTURES.reactTag.name;

        await expect(tagRepo.get(tagName)).rejects.toThrow('The number of conditions on the keys is invalid');
      });
    });
  });

  describe('update()', () => {
    describe('with partition key', () => {
      it('primitive data type key', async () => {
        const userRepo = new Repository(User);
        const userId = 'user-update-123';
        
        // Create user
        const created = await userRepo.create({
          id: userId,
          email: 'update@example.com',
          name: 'Update User',
          age: 28,
          isActive: true,
        });

        // Update user
        const updatedUser = await userRepo.update({
          id: userId,
          email: 'updated@example.com',
          name: 'Updated User',
          age: 29,
          isActive: false,
          metadata: { role: 'admin' },
          tags: ['admin', 'user'],
          CreatedAt: created.CreatedAt,
        });

        expect(updatedUser.email).toBe('updated@example.com');
        expect(updatedUser.name).toBe('Updated User');
        expect(updatedUser.age).toBe(29);
        expect(updatedUser.isActive).toBe(false);
        expect(updatedUser.metadata).toEqual({ role: 'admin' });
        expect(updatedUser.tags).toEqual(['admin', 'user']);
        expect(updatedUser.UpdatedAt).toBeDefined();
        
        // Cleanup
        await userRepo.delete(userId);
      });

      it('object data type key', async () => {
        const profileRepo = new Repository(Profile);
        const userId = { id: 'user-profile-update' };
        
        // Create profile
        const created = await profileRepo.create({
          userId,
          bio: 'Original bio',
          settings: {
            theme: 'light',
            notifications: true,
            privacy: 'public'
          },
        });

        // Update profile
        const updatedProfile = await profileRepo.update({
          userId,
          bio: 'Updated bio',
          avatarUrl: 'https://example.com/avatar.jpg',
          settings: {
            theme: 'dark',
            notifications: false,
            privacy: 'private'
          },
          CreatedAt: created.CreatedAt,
        });

        expect(updatedProfile.bio).toBe('Updated bio');
        expect(updatedProfile.avatarUrl).toBe('https://example.com/avatar.jpg');
        expect(updatedProfile.settings.theme).toBe('dark');
        expect(updatedProfile.settings.notifications).toBe(false);
        expect(updatedProfile.settings.privacy).toBe('private');
        
        // Cleanup
        await profileRepo.delete(userId);
      });
    });

    describe('with partition key and sort key', () => {
      it('primitive data type keys', async () => {
        const tagRepo = new Repository(Tag);
        const tagName = 'typescript';
        const category = 'language';
        
        // Create tag
        const created = await tagRepo.create({
          name: tagName,
          category,
          description: 'TypeScript language',
          usageCount: 200,
        });

        // Update tag
        const updatedTag = await tagRepo.update({
          name: tagName,
          category,
          description: 'TypeScript programming language',
          usageCount: 250,
          CreatedAt: created.CreatedAt,
        });

        expect(updatedTag.description).toBe('TypeScript programming language');
        expect(updatedTag.usageCount).toBe(250);
        
        // Cleanup
        await tagRepo.delete(tagName, category);
      });

      it('object data type keys', async () => {
        const postRepo = new Repository(Post);
        const commentRepo = new Repository(Comment);
        const userId = { id: 'user-update-comment' };
        const postId = 'post-update-123';
        const commentId = 'comment-update-456';
        
        // Create post and comment
        await postRepo.create({
          userId,
          id: postId,
          title: 'Original Post',
          content: 'Original content',
          status: 'draft',
          publishedAt: Date.now(),
        });

        const created = await commentRepo.create({
          postId: { userId, id: postId },
          id: commentId,
          authorId: { id: 'author-update' },
          content: 'Original comment',
        });

        // Update comment
        const updatedComment = await commentRepo.update({
          postId: { userId, id: postId },
          id: commentId,
          authorId: { id: 'author-update' },
          content: 'Updated comment content',
          CreatedAt: created.CreatedAt,
        });

        expect(updatedComment.content).toBe('Updated comment content');
        expect(updatedComment.UpdatedAt).toBeDefined();
        
        // Cleanup
        await commentRepo.delete({ userId, id: postId }, commentId);
        await postRepo.delete(userId, postId);
      });
    });
  });

  describe('delete()', () => {
    describe('with partition key', () => {
      it('primitive data type key', async () => {
        const userRepo = new Repository(User);
        const userId = 'user-delete-123';
        
        // Create user
        await userRepo.create({
          id: userId,
          email: 'delete@example.com',
          name: 'Delete User',
          age: 30,
          isActive: true,
        });

        // Verify user exists
        const existingUser = await userRepo.get(userId);
        expect(existingUser).toBeTruthy();

        // Delete user
        await userRepo.delete(userId);

        // Verify user is deleted
        const deletedUser = await userRepo.get(userId);
        expect(deletedUser).toBeNull();
      });

      it('object data type key', async () => {
        const profileRepo = new Repository(Profile);
        const userId = { id: 'user-profile-delete' };
        
        // Create profile
        await profileRepo.create({
          userId,
          bio: 'To be deleted',
          settings: {
            theme: 'light',
            notifications: true,
            privacy: 'public'
          },
        });

        // Verify profile exists
        const existingProfile = await profileRepo.get(userId);
        expect(existingProfile).toBeTruthy();

        // Delete profile
        await profileRepo.delete(userId);

        // Verify profile is deleted
        const deletedProfile = await profileRepo.get(userId);
        expect(deletedProfile).toBeNull();
      });
    });

    describe('with partition key and sort key', () => {
      it('primitive data type keys', async () => {
        const tagRepo = new Repository(Tag);
        const tagName = 'vue';
        const category = 'framework';
        
        // Create tag
        await tagRepo.create({
          name: tagName,
          category,
          description: 'Vue.js framework',
          usageCount: 150,
        });

        // Verify tag exists
        const existingTag = await tagRepo.get(tagName, category);
        expect(existingTag).toBeTruthy();

        // Delete tag
        await tagRepo.delete(tagName, category);

        // Verify tag is deleted
        const deletedTag = await tagRepo.get(tagName, category);
        expect(deletedTag).toBeNull();
      });

      it('object data type keys', async () => {
        const postRepo = new Repository(Post);
        const commentRepo = new Repository(Comment);
        const userId = { id: 'user-delete-comment' };
        const postId = 'post-delete-123';
        const commentId = 'comment-delete-456';
        
        // Create post and comment
        await postRepo.create({
          userId,
          id: postId,
          title: 'Delete Test Post',
          content: 'Content to delete',
          status: 'published',
          publishedAt: Date.now(),
        });

        await commentRepo.create({
          postId: { userId, id: postId },
          id: commentId,
          authorId: { id: 'author-delete' },
          content: 'Comment to delete',
        });

        // Verify comment exists
        const existingComment = await commentRepo.get(
          { userId, id: postId },
          commentId
        );
        expect(existingComment).toBeTruthy();

        // Delete comment
        await commentRepo.delete(
          { userId, id: postId },
          commentId
        );

        // Verify comment is deleted
        const deletedComment = await commentRepo.get(
          { userId, id: postId },
          commentId
        );
        expect(deletedComment).toBeNull();
      });

      it('should fail when sort key not provided', async () => {
        const tagRepo = new Repository(Tag);
        
        await expect(async () => {
          await tagRepo.delete('incomplete-tag');
        }).rejects.toThrow('The number of conditions on the keys is invalid');
      });
    });
  });

  describe('query()', () => {
    describe('filter conditions', () => {
      beforeAll(async () => {
        // Set up test data for query tests
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        const posts = [
          {
            userId,
            id: 'post-1',
            title: 'First Post',
            content: 'Content 1',
            status: 'published' as const,
            publishedAt: 1000,
          },
          {
            userId,
            id: 'post-2',
            title: 'Second Post',
            content: 'Content 2',
            status: 'published' as const,
            publishedAt: 2000,
          },
          {
            userId,
            id: 'post-3',
            title: 'Third Post',
            content: 'Content 3',
            status: 'published' as const,
            publishedAt: 3000,
          }
        ];

        for (const post of posts) {
          await postRepo.create(post);
        }
      });

      afterAll(async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        
        await postRepo.delete(userId, 'post-1');
        await postRepo.delete(userId, 'post-2');
        await postRepo.delete(userId, 'post-3');
      });

      it('GT - greater than', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        
        const results = await postRepo.query(userId, { gt: 'post-1' });
        
        expect(results.length).toBe(2);
        expect(results[0].id).toBe('post-2');
        expect(results[1].id).toBe('post-3');
      });

      it('GE - greater than and equals to', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        
        const results = await postRepo.query(userId, { ge: 'post-2' });
        
        expect(results.length).toBe(2);
        expect(results[0].id).toBe('post-2');
        expect(results[1].id).toBe('post-3');
      });

      it('LT - less than', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        
        const results = await postRepo.query(userId, { lt: 'post-3' });
        
        expect(results.length).toBe(2);
        expect(results[0].id).toBe('post-1');
        expect(results[1].id).toBe('post-2');
      });

      it('LE - less than and equals to', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        
        const results = await postRepo.query(userId, { le: 'post-2' });
        
        expect(results.length).toBe(2);
        expect(results[0].id).toBe('post-1');
        expect(results[1].id).toBe('post-2');
      });

      it('BTW - between', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'query-user' };
        
        const results = await postRepo.query(userId, { between: ['post-1', 'post-2'] });
        
        expect(results.length).toBe(2);
        expect(results[0].id).toBe('post-1');
        expect(results[1].id).toBe('post-2');
      });
    });

    describe('specify secondary index', () => {
      const SECONDARY_INDEX_FIXTURES = {
        user: {
          id: 'user-index-1',
          email: 'index-test@example.com',
          name: 'Index User',
          age: 30,
          isActive: true,
        },
        post1: {
          userId: { id: 'user-gsi-1' },
          id: 'post-gsi-1',
          title: 'GSI Post 1',
          content: 'Content 1',
          status: 'archived' as const,
          publishedAt: 1000,
        },
        post2: {
          userId: { id: 'user-gsi-2' },
          id: 'post-gsi-2',
          title: 'GSI Post 2',
          content: 'Content 2',
          status: 'archived' as const,
          publishedAt: 2000,
        }
      };

      beforeAll(async () => {
        const userRepo = new Repository(User);
        const postRepo = new Repository(Post);

        // Create test fixtures
        await userRepo.create(SECONDARY_INDEX_FIXTURES.user);
        await postRepo.create(SECONDARY_INDEX_FIXTURES.post1);
        await postRepo.create(SECONDARY_INDEX_FIXTURES.post2);
      });

      afterAll(async () => {
        const userRepo = new Repository(User);
        const postRepo = new Repository(Post);

        // Cleanup test fixtures
        await userRepo.delete(SECONDARY_INDEX_FIXTURES.user.id);
        await postRepo.delete(SECONDARY_INDEX_FIXTURES.post1.userId, SECONDARY_INDEX_FIXTURES.post1.id);
        await postRepo.delete(SECONDARY_INDEX_FIXTURES.post2.userId, SECONDARY_INDEX_FIXTURES.post2.id);
      });

      it('without secondary index sort key', async () => {
        const userRepo = new Repository(User);
        const email = SECONDARY_INDEX_FIXTURES.user.email;

        // Query by email using secondary index
        const results = await userRepo.query(email, undefined, {
          index: userRepo.getDefaultIndexName('global', 'email')
        });
        
        expect(results.length).toBe(1);
        expect(results[0].email).toBe(email);
      });

      it('with secondary index sort key', async () => {
        const postRepo = new Repository(Post);

        // Query by status using secondary index with sort key condition
        const results = await postRepo.query('archived', { gt: 1500 }, {
          index: 'StatusIndex'
        });
        
        expect(results.length).toBe(1);
        expect(results[0].publishedAt).toBe(2000);
      });
    });

    describe('pagination', () => {
      beforeAll(async () => {
        // Set up pagination test data
        const postRepo = new Repository(Post);
        const userId = { id: 'pagination-user' };
        
        for (let i = 1; i <= 10; i++) {
          await postRepo.create({
            userId,
            id: `page-post-${i.toString().padStart(2, '0')}`,
            title: `Pagination Post ${i}`,
            content: `Content ${i}`,
            status: 'published' as const,
            publishedAt: i * 1000,
          });
        }
      });

      afterAll(async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'pagination-user' };
        
        for (let i = 1; i <= 10; i++) {
          await postRepo.delete(userId, `page-post-${i.toString().padStart(2, '0')}`);
        }
      });

      it('page limit', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'pagination-user' };
        
        const results = await postRepo.query(userId, undefined, { limit: 5 });
        
        expect(results.length).toBe(5);
        expect(results.count).toBe(5);
        expect(results.lastKey).toBeDefined();
      });

      it('retrieve next page using current page response lastKey', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'pagination-user' };
        
        // Get first page
        const firstPage = await postRepo.query(userId, undefined, { limit: 3 });
        expect(firstPage.length).toBe(3);
        expect(firstPage.lastKey).toBeDefined();
        
        // Get second page using lastKey from first page
        const secondPage = await postRepo.query(userId, undefined, { 
          limit: 3, 
          lastKey: firstPage.lastKey 
        });
        expect(secondPage.length).toBe(3);
        expect(secondPage.lastKey).toBeDefined();
        
        // Verify no overlap between pages
        const firstPageIds = firstPage.map(p => p.id);
        const secondPageIds = secondPage.map(p => p.id);
        expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
      });

      it('last page should return undefined lastKey', async () => {
        const postRepo = new Repository(Post);
        const userId = { id: 'pagination-user' };
        
        // Get all results without pagination first to know total count
        const allResults = await postRepo.query(userId);
        const totalCount = allResults.length;
        
        // Get last page
        const lastPage = await postRepo.query(userId, undefined, { 
          limit: totalCount + 1,
        });
        
        expect(lastPage.length).toBe(totalCount);
        expect(lastPage.lastKey).toBeUndefined();
      });
    });
  });

  describe('scan()', () => {
    beforeAll(async () => {
      // Set up scan test data
      const userRepo = new Repository(User);
      const users = [
        {
          id: 'scan-user-1',
          email: 'scan1@example.com',
          name: 'Scan User 1',
          age: 25,
          isActive: true,
        },
        {
          id: 'scan-user-2',
          email: 'scan2@example.com',
          name: 'Scan User 2',
          age: 30,
          isActive: false,
        },
        {
          id: 'scan-user-3',
          email: 'scan3@example.com',
          name: 'Scan User 3',
          age: 35,
          isActive: true,
        }
      ];

      for (const user of users) {
        await userRepo.create(user);
      }
    });

    afterAll(async () => {
      const userRepo = new Repository(User);
      
      await userRepo.delete('scan-user-1');
      await userRepo.delete('scan-user-2');
      await userRepo.delete('scan-user-3');
    });

    it('with partition key only', async () => {
      const userRepo = new Repository(User);
      
      const results = await userRepo.scan({ 
        partitionKey: { eq: 'scan-user-1' } 
      });
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('scan-user-1');
    });

    it('with partition key range condition', async () => {
      const userRepo = new Repository(User);
      
      const results = await userRepo.scan({ 
        partitionKey: { gt: 'scan-user-1' } 
      });
      
      expect(results.length).toBe(2);
      expect(results.map(u => u.id)).toEqual(expect.arrayContaining(['scan-user-2', 'scan-user-3']));
    });

    it('with secondary index', async () => {
      const userRepo = new Repository(User);
      
      const results = await userRepo.scan({ 
        partitionKey: { eq: 'scan2@example.com' } 
      }, { 
        index: userRepo.getDefaultIndexName('global', 'email') 
      });
      
      expect(results.length).toBe(1);
      expect(results[0].email).toBe('scan2@example.com');
    });

    it('with pagination', async () => {
      const userRepo = new Repository(User);
      
      const results = await userRepo.scan({ 
        partitionKey: { ge: 'scan-user-1' } 
      }, { 
        limit: 2 
      });
      
      expect(results.length).toBe(2);
      expect(results.lastKey).toBeDefined();
    });
  });
});
