import { Table, Attribute, PartitionKey } from '../../core/decorators';

@Table('SimpleEntities')
export class SimpleEntity {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'number' })
  value: number;

  @Attribute({ type: 'date' })
  CreatedAt: Date;
}