import {
  GenericContainer, StartedTestContainer,
  StopOptions,
  StoppedTestContainer,
} from 'testcontainers';
export { StartedTestContainer } from 'testcontainers';
import * as dynamoose from 'dynamoose';

export class AwsTestContainer extends GenericContainer {
  constructor() {
    super('amazon/dynamodb-local:latest');

    this.withEnvironment({SERVICES: 'dynamodb'});
    this.withExposedPorts(
      {container: 8000, host: 4569},
    );
  }

  override async start(): Promise<StartedTestContainer> {
    const started = await super.start();
    process.env.AWS_ACCESS_KEY_ID = 'dummy';
    process.env.AWS_SECRET_ACCESS_KEY = 'dummy';
    process.env.AWS_REGION = 'us-east-1';
    dynamoose.aws.ddb.local('http://localhost:4569');
    return started;
  }
}
