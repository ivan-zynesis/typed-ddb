```ts
import { Table, PartitionKey, Attribute, BelongsTo, HasOne } from '@ivan-lee/typed-ddb';
import { AmplifyGsi } from '@ivan-lee/typed-ddb/dist/adapters';
import { File } from './File';

@Table(() => process.env.DB_WORKFLOW_TABLE_NAME!)
export class Workflow {
  @PartitionKey()
  @Attribute({ type: 'string' })
  workflowId!: string;

  @Attribute({
    type: 'enums',
    enums: [
      'PENDING_UPLOAD',
      'UPLOADED',
      'PENDING_VERIFICATION',
      'ACCEPTED',
      'CORRECTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'READY_TO_POST',
      'COMPLETED',
    ],
  })
  status!: 'PENDING_UPLOAD' | 'UPLOADED' | 'PENDING_VERIFICATION' | 'ACCEPTED' | 'CORRECTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'READY_TO_POST' | 'COMPLETED';

  @AmplifyGsi({ queryField: 'workflowsByCreator' })
  @Attribute({ type: 'string' })
  createdBy!: string;

  @Attribute({ type: 'date' })
  CreatedAt!: Date;

  @HasOne(() => File)
  document?: File;

  // belongsTo workflow manifest
  // hasOne AgenticOps
}
```

```ts
import { Table, PartitionKey, Attribute, BelongsTo, SortKey } from '@ivan-lee/typed-ddb';
import { AmplifyGsi } from '@ivan-lee/typed-ddb/dist/adapters';
import { type Workflow } from './Workflow';

@Table(() => process.env.DB_FILE_TABLE_NAME!)
export class File {
  @PartitionKey()
  @Attribute({ type: 'string' })
  fileId!: string;

  @Attribute({ type: 'string' })
  s3Key!: string;

  @Attribute({ type: 'string' })
  s3Bucket!: string;

  @Attribute({ type: 'string' })
  fileName!: string;

  @Attribute({ type: 'number' })
  fileSize!: number;

  @Attribute({ type: 'string' })
  contentType!: string;

  @Attribute({ type: 'enums', enums: ['PENDING', 'UPLOADED'] })
  status!: 'PENDING' | 'UPLOADED';

  @Attribute({ type: 'date' })
  CreatedAt!: Date;

  @BelongsTo(
    (workflow: Pick<Workflow, 'workflowId'>) => workflow.workflowId,
    (workflowId: string) => ({ workflowId }),
    'index'
  )
  workflowId?: Workflow['workflowId'];

  // belongsTo AgenticOps as attachments
}
```

getting error: Error: Cannot find @BelongsTo foreign key in File referencing Workflow
when running the cli to generate amplify schema