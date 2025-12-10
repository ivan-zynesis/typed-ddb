import { Attribute } from '../../dynamodb';

export class AmplifyBaseModel {
  @Attribute({
    type: 'date-iso',
    optional: false,
  })
  createdAt: Date;

  @Attribute({
    type: 'date-iso',
    optional: false,
  })
  updatedAt: Date;
}
