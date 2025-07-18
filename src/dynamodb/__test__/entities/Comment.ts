import { Table, Attribute, SortKey, BelongsTo } from '../../core/decorators';
import { Post } from './Post';
import { User } from './User';

@Table('Comments')
export class Comment {
  @BelongsTo<Pick<Post, 'userId' | 'id'>>(
    (post: Pick<Post, 'userId' | 'id'>) => `${post.userId.id}#${post.id}`,
    (composite: string) => {
      const [userId, postId] = composite.split('#');
      return { userId: { id: userId }, id: postId };
    }
  )
  @Attribute({ type: 'string' })
  postId: Pick<Post, 'userId' | 'id'>;

  @SortKey()
  @Attribute({ type: 'string' })
  id: string;

  @BelongsTo<Pick<User, 'id'>>(
    (user: Pick<User, 'id'>) => user.id,
    (userId: string) => ({ id: userId }),
    'index',
  )
  @Attribute({ type: 'string' })
  authorId: Pick<User, 'id'>;

  @Attribute({ type: 'string' })
  content: string;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}