import { Table, Attribute, PartitionKey, SortKey, Index, BelongsTo, HasMany } from '../../core/decorators';
import { User } from './User';
import { Comment } from './Comment';

@Table('Posts')
export class Post {
  @BelongsTo<Pick<User, 'id'>>(
    (user: Pick<User, 'id'>) => user.id,
    (userId: string) => ({ id: userId })
  )
  @Attribute({ type: 'string' })
  userId: Pick<User, 'id'>;

  @SortKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  title: string;

  @Attribute({ type: 'string' })
  content: string;

  @Index({ name: 'StatusIndex', sortKey: 'publishedAt' })
  @Attribute({ type: 'enums', enums: ['draft', 'published', 'archived'] })
  status: 'draft' | 'published' | 'archived';

  @Attribute({ type: 'number' })
  publishedAt: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;

  @HasMany(() => Comment)
  comments?: Comment[];
}