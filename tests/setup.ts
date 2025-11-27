/**
 * Coforma Studio Test Setup
 * Global test configuration and utilities
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Test environment setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://coforma:coforma_test@localhost:5432/coforma_test';
  process.env.REDIS_URL = 'redis://localhost:6379/15';
});

afterEach(async () => {
  // Clean up after each test
});

afterAll(async () => {
  // Global cleanup
});

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'member',
  ...overrides,
});

export const createMockBoard = (overrides = {}) => ({
  id: 'test-board-id',
  name: 'Test Advisory Board',
  description: 'A test advisory board',
  organizationId: 'test-org-id',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockFeedback = (overrides = {}) => ({
  id: 'test-feedback-id',
  content: 'Test feedback content',
  rating: 4,
  userId: 'test-user-id',
  boardId: 'test-board-id',
  createdAt: new Date().toISOString(),
  ...overrides,
});
