import { Repository } from '../core';
import { 
  PublishChanges, 
  SubscribeToChanges, 
  SubscriptionManager, 
  EntityChangeEvent,
  EntitySignalStore
} from '../core/signals';
import { Table, PartitionKey, Attribute } from '../core/decorators';
import { AwsTestContainer, StartedTestContainer } from '../test-utility/DynamoDbEmulator';

// Test entity with triggers enabled
@Table('TestUsers')
@PublishChanges()
class TestUser {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  email: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'number' })
  age: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}

// Test entity without triggers
@Table('TestPosts')
class TestPost {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  title: string;

  @Attribute({ type: 'date' })
  CreatedAt: Date;
}

// Test service with various trigger subscriptions
class TestUserService {
  public events: EntityChangeEvent<TestUser>[] = [];
  public createCount = 0;
  public updateCount = 0;
  public deleteCount = 0;

  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(TestUser, 'create')
  async onUserCreated(event: EntityChangeEvent<TestUser>) {
    this.events.push(event);
    this.createCount++;
  }

  @SubscribeToChanges(TestUser, 'update')
  async onUserUpdated(event: EntityChangeEvent<TestUser>) {
    this.events.push(event);
    this.updateCount++;
  }

  @SubscribeToChanges(TestUser, 'delete')
  async onUserDeleted(event: EntityChangeEvent<TestUser>) {
    this.events.push(event);
    this.deleteCount++;
  }

  @SubscribeToChanges(TestUser, 'all')
  async onAnyUserChange(_event: EntityChangeEvent<TestUser>) {
    // This should be called for all events
  }

  cleanup() {
    SubscriptionManager.cleanupService(this);
  }
}

// Test service for multiple subscribers
class TestAnalyticsService {
  public events: EntityChangeEvent<TestUser>[] = [];

  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(TestUser, 'create')
  async onUserCreated(event: EntityChangeEvent<TestUser>) {
    this.events.push(event);
  }

  cleanup() {
    SubscriptionManager.cleanupService(this);
  }
}

// Test service with conditional logic
class TestNotificationService {
  public emailChangeNotifications = 0;
  public nameChangeNotifications = 0;

  constructor() {
    SubscriptionManager.initialize(this);
  }

  @SubscribeToChanges(TestUser, 'update')
  async onUserUpdated(event: EntityChangeEvent<TestUser>) {
    if (event.previous?.email !== event.entity.email) {
      this.emailChangeNotifications++;
    }
    
    if (event.previous?.name !== event.entity.name) {
      this.nameChangeNotifications++;
    }
  }

  cleanup() {
    SubscriptionManager.cleanupService(this);
  }
}

describe('Trigger System', () => {
  let emulator: StartedTestContainer;
  let userRepo: Repository<TestUser>;
  let postRepo: Repository<TestPost>;
  let userService: TestUserService;
  let analyticsService: TestAnalyticsService;
  let notificationService: TestNotificationService;

  beforeAll(async () => {
    emulator = await new AwsTestContainer().start();
  });

  afterAll(async () => {
    await emulator.stop();
  });

  beforeEach(async () => {
    // Clean up existing subscriptions first
    SubscriptionManager.cleanupAll();
    EntitySignalStore.clearAll();
    
    userRepo = new Repository(TestUser);
    postRepo = new Repository(TestPost);
    
    // Create fresh services
    userService = new TestUserService();
    analyticsService = new TestAnalyticsService();
    notificationService = new TestNotificationService();
  });

  afterEach(() => {
    userService.cleanup();
    analyticsService.cleanup();
    notificationService.cleanup();
  });

  describe('Basic Trigger Functionality', () => {
    it('should trigger create events', async () => {
      await userRepo.create({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        age: 25
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.createCount).toBe(1);
      expect(userService.events).toHaveLength(1);
      expect(userService.events[0].event).toBe('create');
      expect(userService.events[0].entity.id).toBe('user-1');
      expect(userService.events[0].entity.email).toBe('test@example.com');
      expect(userService.events[0].previous).toBeUndefined();
    });

    it('should trigger update events', async () => {
      const user = await userRepo.create({
        id: 'user-2',
        email: 'test2@example.com',
        name: 'Test User 2',
        age: 30
      });

      // Clear previous events
      userService.events = [];

      await userRepo.update({
        id: 'user-2',
        email: 'updated@example.com',
        name: 'Updated User',
        age: 31,
        CreatedAt: user.CreatedAt
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.updateCount).toBe(1);
      expect(userService.events).toHaveLength(1);
      expect(userService.events[0].event).toBe('update');
      expect(userService.events[0].entity.email).toBe('updated@example.com');
      expect(userService.events[0].previous).toBeDefined();
      expect(userService.events[0].previous?.email).toBe('test2@example.com');
    });

    it('should trigger delete events', async () => {
      await userRepo.create({
        id: 'user-3',
        email: 'test3@example.com',
        name: 'Test User 3',
        age: 35
      });

      // Clear previous events
      userService.events = [];

      await userRepo.delete('user-3');

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.deleteCount).toBe(1);
      expect(userService.events).toHaveLength(1);
      expect(userService.events[0].event).toBe('delete');
      expect(userService.events[0].previous).toBeDefined();
      expect(userService.events[0].previous?.id).toBe('user-3');
    });

    it('should not trigger events for entities without @PublishChanges', async () => {
      await postRepo.create({
        id: 'post-1',
        title: 'Test Post'
      });

      // Wait for potential triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.events).toHaveLength(0);
    });
  });

  describe('Multiple Subscribers', () => {
    it('should call multiple subscribers for the same event', async () => {
      await userRepo.create({
        id: 'user-4',
        email: 'test4@example.com',
        name: 'Test User 4',
        age: 40
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.createCount).toBe(1);
      expect(analyticsService.events).toHaveLength(1);
      expect(analyticsService.events[0].event).toBe('create');
      expect(analyticsService.events[0].entity.id).toBe('user-4');
    });
  });

  describe('Conditional Triggers', () => {
    it('should handle conditional logic in triggers', async () => {
      const user = await userRepo.create({
        id: 'user-5',
        email: 'test5@example.com',
        name: 'Test User 5',
        age: 45
      });

      // Update only name
      await userRepo.update({
        id: 'user-5',
        email: 'test5@example.com',
        name: 'Updated Name',
        age: 45,
        CreatedAt: user.CreatedAt
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(notificationService.nameChangeNotifications).toBe(1);
      expect(notificationService.emailChangeNotifications).toBe(0);

      // Update only email
      await userRepo.update({
        id: 'user-5',
        email: 'newemail@example.com',
        name: 'Updated Name',
        age: 45,
        CreatedAt: user.CreatedAt
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(notificationService.nameChangeNotifications).toBe(1);
      expect(notificationService.emailChangeNotifications).toBe(1);
    });
  });


  describe('Subscription Management', () => {
    it('should provide subscription statistics', () => {
      const stats = SubscriptionManager.getStats();
      
      expect(stats.activeSubscriptions).toBeGreaterThan(0);
      // Check that the subscription keys contain the expected patterns (now with instance-specific suffixes)
      expect(stats.subscriptionKeys.some(key => key.includes('TestUser:create:onUserCreated'))).toBe(true);
      expect(stats.subscriptionKeys.some(key => key.includes('TestUser:update:onUserUpdated'))).toBe(true);
      expect(stats.subscriptionKeys.some(key => key.includes('TestUser:delete:onUserDeleted'))).toBe(true);
    });

    it('should cleanup subscriptions properly', () => {
      const initialStats = SubscriptionManager.getStats();
      
      // Cleanup one service
      SubscriptionManager.cleanupService(analyticsService);
      
      const afterCleanupStats = SubscriptionManager.getStats();
      expect(afterCleanupStats.activeSubscriptions).toBeLessThan(initialStats.activeSubscriptions);
      
      // Cleanup all
      SubscriptionManager.cleanupAll();
      
      const finalStats = SubscriptionManager.getStats();
      expect(finalStats.activeSubscriptions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it.skip('should handle trigger errors gracefully', async () => {
      // Clean up all existing subscriptions first
      SubscriptionManager.cleanupAll();
      
      class ErrorService {
        constructor() {
          SubscriptionManager.initialize(this);
        }

        @SubscribeToChanges(TestUser, 'create')
        async onUserCreated(_event: EntityChangeEvent<TestUser>) {
          throw new Error('Trigger error');
        }

        cleanup() {
          SubscriptionManager.cleanupService(this);
        }
      }

      const errorService = new ErrorService();
      
      // Should not throw even if trigger fails
      await expect(userRepo.create({
        id: 'user-8',
        email: 'test8@example.com',
        name: 'Test User 8',
        age: 60
      })).resolves.toBeDefined();

      errorService.cleanup();
      
      // Clean up all subscriptions and signals to ensure complete reset
      SubscriptionManager.cleanupAll();
      EntitySignalStore.clearAll();
      
      // Reinitialize the normal services after the error service is cleaned up
      SubscriptionManager.initialize(userService);
      SubscriptionManager.initialize(analyticsService);
      SubscriptionManager.initialize(notificationService);
    });
  });

  describe('Event Context', () => {
    it('should provide correct event context', async () => {
      // Ensure clean state before the test
      userService.events = [];
      
      const user = await userRepo.create({
        id: 'user-9',
        email: 'test9@example.com',
        name: 'Test User 9',
        age: 65
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.events.length).toBeGreaterThan(0);
      const createEvent = userService.events[0];
      expect(createEvent.event).toBe('create');
      expect(createEvent.entity).toBeDefined();
      expect(createEvent.previous).toBeUndefined();
      expect(createEvent.timestamp).toBeInstanceOf(Date);
      expect(createEvent.entityClass).toBe('TestUser');

      // Clear events
      userService.events = [];

      // Update user
      await userRepo.update({
        id: 'user-9',
        email: 'updated9@example.com',
        name: 'Updated User 9',
        age: 66,
        CreatedAt: user.CreatedAt
      });

      // Wait for async triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(userService.events.length).toBeGreaterThan(0);
      const updateEvent = userService.events[0];
      expect(updateEvent.event).toBe('update');
      expect(updateEvent.entity).toBeDefined();
      expect(updateEvent.previous).toBeDefined();
      expect(updateEvent.entity.email).toBe('updated9@example.com');
      expect(updateEvent.previous?.email).toBe('test9@example.com');
    });
  });
});