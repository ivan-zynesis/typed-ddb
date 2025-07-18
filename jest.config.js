/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testTimeout: 180_000,
    roots: ['<rootDir>/src'],
    testMatch: ['**/__test__/**/*.spec.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                useDefineForClassFields: false,
                target: 'es2017',
                module: 'commonjs',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true
            }
        }]
    },
    moduleFileExtensions: ['ts', 'js'],
    collectCoverageFrom: [
        'src/dynamodb/core/Repository.ts'
    ]
};
