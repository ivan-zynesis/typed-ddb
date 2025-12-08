#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { AmplifyAdapter } from '../adapters/amplify/AmplifyAdapter';

// Enable TypeScript loading for Node.js
import 'reflect-metadata';

interface CliOptions {
  input: string;
  output: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let input = '';
  let output = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-i' || args[i] === '--input') {
      input = args[i + 1];
      i++;
    } else if (args[i] === '-o' || args[i] === '--output') {
      output = args[i + 1];
      i++;
    }
  }

  if (!input || !output) {
    console.error('Usage: typed-ddb amplify -i <input-path> -o <output-path>');
    console.error('  -i, --input   Path to directory containing entity class definitions');
    console.error('  -o, --output  Path to output directory for generated material files');
    process.exit(1);
  }

  return { input, output };
}

async function loadEntitiesFromDirectory(dirPath: string): Promise<Map<string, new () => any>> {
  const entities = new Map<string, new () => any>();
  const absolutePath = path.resolve(process.cwd(), dirPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Input directory does not exist: ${absolutePath}`);
  }

  // Register tsx/ts-node for TypeScript support
  try {
    require('tsx/cjs/api').register();
  } catch {
    try {
      require('ts-node/register/transpile-only');
    } catch {
      // Neither tsx nor ts-node available, will only support .js files
    }
  }

  const files = fs.readdirSync(absolutePath).filter(f =>
    (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts')
  );

  for (const file of files) {
    const filePath = path.join(absolutePath, file);
    try {
      // Use require for synchronous loading (works with tsx/ts-node registered)
      const module = require(filePath);

      // Find exported classes
      for (const [exportName, exportValue] of Object.entries(module)) {
        if (typeof exportValue === 'function' && exportValue.prototype) {
          // Check if it has @Table decorator metadata
          const tableName = Reflect.getMetadata('tableName', exportValue);
          if (tableName) {
            entities.set(exportName, exportValue as new () => any);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not load ${file}:`, error instanceof Error ? error.message : error);
    }
  }

  return entities;
}

function generateMaterialFile(entityName: string, EntityClass: new () => any): string {
  const adapter = new AmplifyAdapter(EntityClass);
  const modelFields = adapter.modelFields();
  const secondaryIndexes = adapter.secondaryIndexes();

  // Convert modelFields string to object format
  const fieldsArray = modelFields.split(',\n    ').map(field => field.trim());
  const fieldsObject: Record<string, string> = {};

  for (const field of fieldsArray) {
    const [name, ...typeParts] = field.split(':');
    const type = typeParts.join(':').trim();
    fieldsObject[name.trim()] = type;
  }

  return `/**
 * Auto-generated Amplify Gen 2 material for ${entityName}
 * Generated from entity class definitions
 *
 * Usage:
 * import { ${entityName}Material } from './path/to/this/file';
 * import { a } from '@aws-amplify/backend';
 *
 * export const ${entityName} = a
 *   .model(${entityName}Material.modelFields)
 *   .authorization((allow) => [
 *     // Your auth rules here
 *   ])
 *   .secondaryIndexes((index) => ${entityName}Material.secondaryIndexes);
 */

export const ${entityName}Material = {
  modelFields: ${JSON.stringify(fieldsObject, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/"/g, '')},
  secondaryIndexes: ${secondaryIndexes.length > 0
    ? `(index: any) => [\n    ${secondaryIndexes.map(idx => `index.${idx}`).join(',\n    ')}\n  ]`
    : '() => []'}
};
`;
}

async function main() {
  const options = parseArgs();

  console.log('Loading entities from:', options.input);
  const entities = await loadEntitiesFromDirectory(options.input);

  if (entities.size === 0) {
    console.error('No entities with @Table decorator found in:', options.input);
    process.exit(1);
  }

  console.log(`Found ${entities.size} entities:`, Array.from(entities.keys()).join(', '));

  // Create output directory if it doesn't exist
  const outputPath = path.resolve(process.cwd(), options.output);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  // Generate material files for each entity
  for (const [entityName, EntityClass] of entities) {
    const materialCode = generateMaterialFile(entityName, EntityClass);
    const outputFile = path.join(outputPath, `${entityName}.material.ts`);

    fs.writeFileSync(outputFile, materialCode, 'utf-8');
    console.log(`✓ Generated: ${outputFile}`);
  }

  console.log(`\nSuccessfully generated ${entities.size} material files in ${outputPath}`);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
