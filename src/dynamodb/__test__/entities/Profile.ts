import { Table, Attribute, PartitionKey, BelongsTo } from '../../core/decorators';
import { User } from './User';

@Table('Profiles')
export class Profile {
  @PartitionKey()
  @BelongsTo<Pick<User, 'id'>>(
    (user: Pick<User, 'id'>) => user.id,
    (userId: string) => ({ id: userId })
  )
  @Attribute({ type: 'string' })
  userId: Pick<User, 'id'>;

  @Attribute({ type: 'string', optional: true })
  bio?: string;

  @Attribute({ type: 'string', optional: true })
  avatarUrl?: string;

  @Attribute({ type: 'object', optional: true })
  settings?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    privacy: 'public' | 'private';
  };

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}