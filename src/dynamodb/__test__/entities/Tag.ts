import { Table, Attribute, PartitionKey, SortKey, Index } from '../../core/decorators';

@Table('Tags')
export class Tag {
  @PartitionKey()
  @Attribute({ type: 'string' })
  name: string;

  @SortKey()
  @Attribute({ type: 'string' })
  category: string;

  @Attribute({ type: 'string', optional: true })
  description?: string;

  @Index({ name: 'UsageIndex' })
  @Attribute({ type: 'number' })
  usageCount: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;
}