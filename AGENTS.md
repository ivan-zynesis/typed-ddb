# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src`: `dynamodb/core` holds repositories, decorators, and signals; `dynamodb/test-utility` provides DynamoDB Local + in-memory helpers; `adapters/amplify` maps Amplify models and indices; `cli` exposes the `typed-ddb` CLI entry point; `types` centralizes shared type helpers.
- Tests sit alongside code in `src/**/__test__` with entity fixtures under each domain.
- Build artifacts land in `dist`; configs worth skimming include `tsconfig*.json`, `eslint.config.mjs`, and `jest.config.js`.

## Build, Test, and Development Commands
- `pnpm install` (Node >=18, pnpm >=8) to bootstrap dependencies.
- `pnpm build` runs the TypeScript project references build (`tsc -b tsconfig.build.json --force`) and emits `dist`.
- `pnpm lint` checks TypeScript files in `src`, `apps`, `libs`, `test`; `pnpm format` applies ESLint fixes.
- `pnpm test` executes Jest via ts-jest in-band; DynamoDB specs spin up `amazon/dynamodb-local` through testcontainers, so ensure Docker is available and port 4569 is free.

## Coding Style & Naming Conventions
- TypeScript with 2-space indentation, semi-colons omitted; favor named exports.
- ESLint enforces `prefer-const`, `eqeqeq`, `curly`, and strict unused-var checks (prefix unused with `_`); `any` triggers a warning.
- Entity classes use decorators like `@Table`, `@PartitionKey`, and `@Attribute`; keep class names PascalCase, properties camelCase, and index names meaningful (e.g., `EmailGlobalIndex`).
- Avoid console noise in library code (`no-console` is a warn); add concise comments only where behavior is non-obvious.

## Testing Guidelines
- Jest config matches `**/__test__/**/*.spec.ts` under `src`; prefer co-locating tests with implementations.
- DynamoDB integration tests start/stop containers—keep setup/teardown idempotent and clean persisted items.
- Coverage focuses on repository and adapter layers; add specs for new decorators, mappers, and CLI paths to preserve coverage expectations.

## Commit & Pull Request Guidelines
- Commit messages follow a short, imperative style seen in history (`fix test`, `add amplify mapper`); include scope when helpful.
- Pull requests should describe the change, mention linked issues, and note any AWS/DynamoDB configuration needs. Include test evidence (`pnpm test` output), and update README/typed docs when APIs or CLI flags change.
- Keep diffs small and focused; add a brief migration note when schema decorators or index names change to guide downstream users.
