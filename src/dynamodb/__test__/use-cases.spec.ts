import { AwsTestContainer, StartedTestContainer } from '../test-utility/DynamoDbEmulator';
import { Repository } from '../core';
import {
  User,
  Post,
  Profile,
  Tag,
  PostTag
} from './entities';

describe('Demonstration', () => {
  let container: StartedTestContainer;

  beforeAll(async () => {
    container = await new AwsTestContainer().start();
  });

  afterAll(() => container.stop());

  it('one-to-one (A hasOne B, B belongsTo A)', async () => {
    const userRepo = new Repository(User);
    const profileRepo = new Repository(Profile);
    
    const userId = 'one-to-one-user';
    
    // Create user
    await userRepo.create({
      id: userId,
      email: 'onetoone@example.com',
      name: 'One To One User',
      age: 28,
      isActive: true,
    });

    // Create profile that belongs to user
    await profileRepo.create({
      userId: { id: userId },
      bio: 'This is a one-to-one relationship example',
      avatarUrl: 'https://example.com/avatar.jpg',
      settings: {
        theme: 'dark',
        notifications: true,
        privacy: 'public'
      },
    });

    // Test the relationship: User hasOne Profile
    const userWithProfile = await userRepo.get(userId, undefined, ['profile']);
    
    expect(userWithProfile).toBeTruthy();
    expect(userWithProfile!.profile).toBeTruthy();
    expect(userWithProfile!.profile!.bio).toBe('This is a one-to-one relationship example');
    expect(userWithProfile!.profile!.userId).toEqual({ id: userId });
    expect(userWithProfile!.profile!.settings.theme).toBe('dark');

    // Test the reverse: Profile belongsTo User
    const retrievedProfile = await profileRepo.get({ id: userId });
    expect(retrievedProfile).toBeTruthy();
    expect(retrievedProfile!.userId).toEqual({ id: userId });
  });

  it('one-to-many (A hasMany B, B belongsTo A)', async () => {
    const userRepo = new Repository(User);
    const postRepo = new Repository(Post);
    
    const userId = 'one-to-many-user';
    
    // Create user
    await userRepo.create({
      id: userId,
      email: 'onetomany@example.com',
      name: 'One To Many User',
      age: 30,
      isActive: true,
    });

    // Create multiple posts that belong to user
    await postRepo.create({
      userId: { id: userId },
      id: 'post-1',
      title: 'First Post',
      content: 'Content of first post',
      status: 'published',
      publishedAt: Date.now(),
    });

    await postRepo.create({
      userId: { id: userId },
      id: 'post-2',
      title: 'Second Post',
      content: 'Content of second post',
      status: 'draft',
      publishedAt: Date.now(),
    });

    // Test the relationship: User hasMany Posts
    const userWithPosts = await userRepo.get(userId, undefined, ['posts']);
    
    expect(userWithPosts).toBeTruthy();
    expect(userWithPosts!.posts).toBeTruthy();
    expect(userWithPosts!.posts!.length).toBe(2);
    
    const postTitles = userWithPosts!.posts!.map(p => p.title);
    expect(postTitles).toContain('First Post');
    expect(postTitles).toContain('Second Post');

    // Test the reverse: Posts belongTo User
    const retrievedPost = await postRepo.get({ id: userId }, 'post-1');
    expect(retrievedPost).toBeTruthy();
    expect(retrievedPost!.userId).toEqual({ id: userId });
    expect(retrievedPost!.title).toBe('First Post');
  });

  it('junction table (A hasOne AB, B hasOne AB, AB belongsTo A, AB belongs to B)', async () => {
    const userRepo = new Repository(User);
    const postRepo = new Repository(Post);
    const tagRepo = new Repository(Tag);
    const postTagRepo = new Repository(PostTag);
    
    const userId = 'junction-user';
    const postId = 'junction-post';
    const tagName = 'javascript';
    const tagCategory = 'programming';
    
    // Create user
    await userRepo.create({
      id: userId,
      email: 'junction@example.com',
      name: 'Junction User',
      age: 32,
      isActive: true,
    });

    // Create post
    await postRepo.create({
      userId: { id: userId },
      id: postId,
      title: 'Junction Post',
      content: 'Post with tags',
      status: 'published',
      publishedAt: Date.now(),
    });

    // Create tag
    await tagRepo.create({
      name: tagName,
      category: tagCategory,
      description: 'JavaScript programming language',
      usageCount: 100,
    });

    // Create junction table entry (PostTag)
    await postTagRepo.create({
      postId: { userId: { id: userId }, id: postId },
      tagId: { name: tagName, category: tagCategory },
    });

    // Test the junction table relationships
    const retrievedPostTag = await postTagRepo.get(
      { userId: { id: userId }, id: postId },
      { name: tagName, category: tagCategory }
    );
    
    expect(retrievedPostTag).toBeTruthy();
    expect(retrievedPostTag!.postId).toEqual({ userId: { id: userId }, id: postId });
    expect(retrievedPostTag!.tagId).toEqual({ name: tagName, category: tagCategory });

    // Test that we can query all tags for a post
    const postTags = await postTagRepo.query({ userId: { id: userId }, id: postId });
    expect(postTags.length).toBe(1);
    expect(postTags[0].tagId.name).toBe(tagName);
    expect(postTags[0].tagId.category).toBe(tagCategory);

    // Test that we can find the original entities through the junction
    const originalPost = await postRepo.get({ id: userId }, postId);
    const originalTag = await tagRepo.get(tagName, tagCategory);
    
    expect(originalPost).toBeTruthy();
    expect(originalPost!.title).toBe('Junction Post');
    
    expect(originalTag).toBeTruthy();
    expect(originalTag!.description).toBe('JavaScript programming language');
  });
});
