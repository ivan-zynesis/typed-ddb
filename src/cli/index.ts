#!/usr/bin/env node

const command = process.argv[2];

if (!command) {
  console.error('Usage: typed-ddb <command> [options]');
  console.error('');
  console.error('Commands:');
  console.error('  amplify    Generate Amplify Gen 2 material from entity definitions');
  console.error('');
  console.error('Run "typed-ddb <command> --help" for more information on a command.');
  process.exit(1);
}

if (command === 'amplify') {
  require('./amplify');
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run "typed-ddb --help" for usage information.');
  process.exit(1);
}
