import { Table, Attribute, PartitionKey, SortKey, BelongsTo } from '../../core/decorators';
import { Post } from './Post';
import { Tag } from './Tag';

@Table('PostTags')
export class PostTag {
  @PartitionKey()
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
  @BelongsTo<Pick<Tag, 'name' | 'category'>>(
    (tag: Pick<Tag, 'name' | 'category'>) => `${tag.name}#${tag.category}`,
    (composite: string) => {
      const [name, category] = composite.split('#');
      return { name, category };
    },
    'sortKey',
  )
  @Attribute({ type: 'string' })
  tagId: Pick<Tag, 'name' | 'category'>;

  @Attribute({ type: 'date' })
  CreatedAt: Date;
}