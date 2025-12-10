import {AwsTestContainer, StartedTestContainer} from '../../dynamodb/test-utility/DynamoDbEmulator';
import {Repository} from '../../dynamodb';
import {TestEntity} from './entities/AmplifyModels';

let container: StartedTestContainer;

describe('Repository<AmplifyBaseModel>', () => {
  let repo: Repository<TestEntity>;

  beforeAll(async () => {
    container = await new AwsTestContainer().start();
    repo = new Repository(TestEntity);
  });

  afterAll(() => container.stop());

  it('create', async () => {
    const created = await repo.create({
      id: 'amplify-model-repo-integration',
      name: 'amplify-model-repo-integration',
      count: 1,
    });
    expect(created.createdAt).toBeDefined();
    expect(created.updatedAt).toBeDefined();
  });

  it('update', async () => {
    const data = await repo.get('amplify-model-repo-integration');
    const updated = await repo.update({
      ...data,
      count: 2,
    });

    expect(updated.createdAt).toBeDefined();
    expect(updated.createdAt.getTime()).toStrictEqual(data.createdAt.getTime());
    expect(updated.updatedAt).toBeDefined();
    expect(updated.updatedAt.getTime()).toBeGreaterThan(data.updatedAt.getTime());
  });
});
