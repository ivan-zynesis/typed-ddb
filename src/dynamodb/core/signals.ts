import { signal, Signal, effect } from '@preact/signals';

// Type augmentation for Symbol.dispose to fix downstream compatibility
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
  }
}

export type TriggerEvent = 'create' | 'update' | 'delete';

export interface EntityChangeEvent<T> {
  entity: T;
  event: TriggerEvent;
  previous?: T;
  timestamp: Date;
  entityClass: string;
}

/**
 * Global signal store for entity changes
 * Each entity class gets its own signal
 */
class EntitySignalStore {
  private static signals: Map<string, Signal<EntityChangeEvent<any> | null>> = new Map();

  static getSignal<T>(entityClass: new () => T): Signal<EntityChangeEvent<T> | null> {
    const key = entityClass.name;
    
    if (!this.signals.has(key)) {
      this.signals.set(key, signal<EntityChangeEvent<T> | null>(null));
    }
    
    return this.signals.get(key)!;
  }

  static emit<T>(
    entityClass: new () => T,
    event: TriggerEvent,
    entity: T,
    previous?: T
  ): void {
    const entitySignal = this.getSignal(entityClass);
    
    entitySignal.value = {
      entity,
      event,
      previous,
      timestamp: new Date(),
      entityClass: entityClass.name
    };
  }

  static clearAll(): void {
    this.signals.forEach(signal => {
      signal.value = null;
    });
    this.signals.clear();
  }
}

/**
 * Entity-side decorator: Registers a publisher
 * Use this on your entity class to publish changes
 * 
 * @example
 * ```typescript
 * @Table('Users')
 * @PublishChanges()
 * class User {
 *   @PartitionKey()
 *   @Attribute({ type: 'string' })
 *   id: string;
 *   // ... other fields
 * }
 * ```
 */
export function PublishChanges<T>() {
  return function (constructor: new () => T) {
    // Mark this class as a publisher
    Reflect.defineMetadata('publishChanges', true, constructor);
  };
}

/**
 * Business logic side decorator: Registers a subscriber
 * Use this in your service classes to subscribe to entity changes
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @SubscribeToChanges(User, 'create')
 *   async onUserCreated(event: EntityChangeEvent<User>) {
 *     await this.sendWelcomeEmail(event.entity);
 *   }
 * 
 *   @SubscribeToChanges(User, 'update')
 *   async onUserUpdated(event: EntityChangeEvent<User>) {
 *     await this.updateSearchIndex(event.entity);
 *   }
 * }
 * ```
 */
export function SubscribeToChanges<T>(
  entityClass: new () => T,
  event: TriggerEvent | 'all' = 'all'
) {
  return function (target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    // Register the subscription when the class is instantiated
    const subscriptionKey = `${entityClass.name}:${event}:${propertyKey}`;
    
    // Store subscription metadata
    if (!Reflect.hasMetadata('subscriptions', target.constructor)) {
      Reflect.defineMetadata('subscriptions', [], target.constructor);
    }
    
    const subscriptions = Reflect.getMetadata('subscriptions', target.constructor);
    subscriptions.push({
      entityClass,
      event,
      method: propertyKey,
      subscriptionKey
    });
    
    Reflect.defineMetadata('subscriptions', subscriptions, target.constructor);
  };
}

/**
 * Utility class to manage subscriptions
 */
export class SubscriptionManager {
  private static activeSubscriptions: Map<string, () => void> = new Map();

  /**
   * Initialize all subscriptions for a service instance
   * Call this in your service constructor or initialization
   */
  static initialize(serviceInstance: any): void {
    const subscriptions = Reflect.getMetadata('subscriptions', serviceInstance.constructor) || [];
    
    // @ts-ignore
    subscriptions.forEach(({ entityClass, event, method, subscriptionKey }) => {
      // Make the subscription key unique per service instance
      const instanceKey = `${subscriptionKey}:${serviceInstance.constructor.name}:${Math.random()}`;
      
      // Clean up existing subscription if any
      this.cleanup(instanceKey);
      
      const entitySignal = EntitySignalStore.getSignal(entityClass);
      
      // Create effect that calls the method when signal changes
      const dispose = effect(() => {
        const changeEvent = entitySignal.value;
        
        if (changeEvent && (event === 'all' || changeEvent.event === event)) {
          try {
            serviceInstance[method](changeEvent);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Subscription handler error in ${instanceKey}:`, error);
          }
        }
      });
      
      this.activeSubscriptions.set(instanceKey, dispose);
      
      // Store the instance key for cleanup
      if (!serviceInstance._subscriptionKeys) {
        serviceInstance._subscriptionKeys = [];
      }
      serviceInstance._subscriptionKeys.push(instanceKey);
    });
  }

  /**
   * Clean up a specific subscription
   */
  static cleanup(subscriptionKey: string): void {
    const dispose = this.activeSubscriptions.get(subscriptionKey);
    if (dispose) {
      dispose();
      this.activeSubscriptions.delete(subscriptionKey);
    }
  }

  /**
   * Clean up all subscriptions for a service instance
   */
  static cleanupService(serviceInstance: any): void {
    // Use the stored instance keys for cleanup
    if (serviceInstance._subscriptionKeys) {
      serviceInstance._subscriptionKeys.forEach((instanceKey: string) => {
        this.cleanup(instanceKey);
      });
      serviceInstance._subscriptionKeys = [];
    }
  }

  /**
   * Clean up all subscriptions
   */
  static cleanupAll(): void {
    this.activeSubscriptions.forEach(dispose => dispose());
    this.activeSubscriptions.clear();
  }

  /**
   * Get subscription statistics
   */
  static getStats(): { activeSubscriptions: number; subscriptionKeys: string[] } {
    return {
      activeSubscriptions: this.activeSubscriptions.size,
      subscriptionKeys: Array.from(this.activeSubscriptions.keys())
    };
  }
}

/**
 * Trigger manager that emits to signals
 */
export class SignalTriggerManager {
  static async executeTriggers<T>(
    ModelClass: new () => T,
    event: TriggerEvent,
    entity: T,
    previous?: T
  ): Promise<void> {
    // Check if this entity class is marked to publish changes
    const shouldPublish = Reflect.getMetadata('publishChanges', ModelClass);
    
    if (shouldPublish) {
      // Emit to signal (synchronous)
      EntitySignalStore.emit(ModelClass, event, entity, previous);
    }
  }
}


export { EntitySignalStore };