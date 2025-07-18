# Contributing to @ivan-lee/typed-ddb

Thank you for your interest in contributing to @ivan-lee/typed-ddb! We welcome contributions from the community to help improve this TypeScript library for DynamoDB data modeling.

## How to Contribute

### Reporting Issues

If you encounter bugs, have feature requests, or need help with the library:

1. Check existing [issues](https://github.com/ivan-zynesis/typed-ddb/issues) to see if it's already reported
2. Create a new issue with:
   - Clear description of the problem or feature request
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Environment details (Node.js version, TypeScript version, etc.)
   - Code samples when applicable

### Pull Requests

We welcome pull requests! Here's how to contribute code:

#### Before You Start

1. **Fork the repository** and create a feature branch from `main`
2. **Check existing issues** to see if someone is already working on it
3. **Create an issue** first for significant changes to discuss the approach

#### Development Setup

```bash
# Clone your fork
git clone https://github.com/ivan-zynesis/typed-ddb.git
cd typed-ddb

# Install dependencies
pnpm install

# Run tests to ensure everything works
pnpm test

# Run linting
pnpm lint
```

#### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following these guidelines:
   - Follow the existing code style and patterns
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass
   - Follow TypeScript best practices

3. **Test your changes**:
   ```bash
   # Run all tests
   pnpm test
   
   # Run linting
   pnpm lint
   
   # Fix linting issues
   pnpm format
   
   # Build the project
   pnpm build
   ```

4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Follow conventional commit format when possible:
     ```
     feat: add support for conditional updates
     fix: resolve issue with pagination lastKey
     docs: update README with new examples
     test: add tests for relationship querying
     ```

#### Pull Request Process

1. **Create a pull request** against the `main` branch
2. **Fill out the PR template** with:
   - Clear description of what the PR does
   - Link to related issues
   - Testing instructions
   - Breaking changes (if any)

3. **Ensure your PR**:
   - Passes all CI checks
   - Includes appropriate tests
   - Updates documentation if needed
   - Follows the project's coding standards

## Code Style and Standards

### TypeScript Guidelines

- Use strict TypeScript configuration
- Provide proper type annotations
- Avoid `any` types when possible
- Use interfaces for object types
- Follow existing naming conventions

### Decorator Patterns

When working with decorators, follow these critical rules:

1. **Decorator Order**: Always place `@PartitionKey()`, `@SortKey()`, and `@Index()` decorators **BEFORE** `@Attribute()`:
   ```typescript
   // ✅ Correct
   @PartitionKey()
   @Attribute({ type: 'string' })
   id: string;
   
   // ❌ Incorrect
   @Attribute({ type: 'string' })
   @PartitionKey()
   id: string;
   ```

2. **Index Usage**: Only apply `@Index()` to partition keys of secondary indexes

### Testing

- Write tests for all new functionality
- Use descriptive test names
- Follow the existing test structure
- Use proper setup/teardown with `beforeAll`/`afterAll`
- Clean up test data to prevent test interference

### Documentation

- Update README.md for new features
- Add inline code comments for complex logic
- Include TypeScript examples in documentation
- Update CLAUDE.md for development-specific information

## Development Commands

- `pnpm build` - Compile TypeScript
- `pnpm test` - Run Jest tests with DynamoDB testcontainers
- `pnpm lint` - Run ESLint on source and test files
- `pnpm format` - Fix linting issues automatically

## Review Process

### What to Expect

- **Pull requests are welcomed** and greatly appreciated
- **Review and merge timing** is subject to maintainer availability
- **Feedback will be provided** on code quality, testing, and documentation
- **Multiple review rounds** may be needed for complex changes

### Review Criteria

PRs will be evaluated based on:

1. **Code Quality**: Clean, readable, and maintainable code
2. **Testing**: Comprehensive test coverage
3. **Documentation**: Proper documentation updates
4. **Compatibility**: No breaking changes without clear justification
5. **Performance**: No significant performance regressions
6. **Style**: Adherence to project coding standards

## Types of Contributions

We're looking for help with:

- **Bug fixes**: Resolve issues and improve stability
- **Feature additions**: New functionality that enhances the library
- **Documentation**: Improvements to README, examples, and code comments
- **Testing**: Additional test coverage and test improvements
- **Performance**: Optimizations and efficiency improvements
- **TypeScript**: Better type definitions and type safety

## Getting Help

If you need help with contributing:

1. Check the [CLAUDE.md](CLAUDE.md) file for development guidance
2. Look at existing code and tests for patterns
3. Create an issue with the "question" label
4. Review closed PRs for examples

## License

By contributing to @ivan-lee/typed-ddb, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming environment for all contributors.

---

Thank you for contributing to @ivan-lee/typed-ddb! Your help makes this library better for everyone.