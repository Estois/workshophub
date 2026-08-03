// Set test database URL before any modules are loaded.
// This file runs via jest.config.js setupFiles before each test suite.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:../database/workshophub.sqlite'
process.env.NODE_ENV = 'test'
