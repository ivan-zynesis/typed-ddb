import { Table, Attribute, PartitionKey } from '../../../dynamodb';
import {AmplifyBaseModel} from "../../amplify/AmplifyBaseModel";

// Test entity that extends AmplifyBaseModel
@Table(() => 'TestEntities')
export class TestEntity extends AmplifyBaseModel {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'number', optional: true })
  count?: number;
}

// Another test entity without extending AmplifyBaseModel (for comparison)
@Table(() => 'LegacyEntities')
export class LegacyEntity {
  @PartitionKey()
  @Attribute({ type: 'string' })
  id: string;

  @Attribute({ type: 'string' })
  name: string;

  @Attribute({ type: 'date' })
  CreatedAt: Date;

  @Attribute({ type: 'date', optional: true })
  UpdatedAt?: Date;
}
