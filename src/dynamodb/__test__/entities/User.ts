import { Table, Attribute, PartitionKey, Index, HasOne, HasMany } from '../../core/decorators';
import { Profile } from './Profile';
import { Post } from './Post';

@Table('Users')
export class User {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Index()
  @Attribute({ type: 'string' })
  email: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'number' })
  age: number;

  @Attribute({ type: 'boolean' })
  isActive: boolean;

  @Attribute({ type: 'object', optional: true })
  metadata?: Record<string, any>;

  @Attribute({ type: 'array', optional: true })
  tags?: string[];

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;

  @HasOne(() => Profile)
  profile?: Profile;

  @HasMany(() => Post)
  posts?: Post[];
}