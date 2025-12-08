import { Table, Attribute, SortKey, BelongsTo, HasMany } from '../../../dynamodb/core/decorators';
import { AmplifyGsi } from '../../amplify/decorators';
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

  @AmplifyGsi({
    name: 'StatusIndex',
    sortKey: 'publishedAt',
    queryField: 'postsByStatus'
  })
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
