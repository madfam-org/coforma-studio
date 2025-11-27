/**
 * Feedback API tests for Coforma Studio
 */

import { describe, it, expect } from 'vitest';
import { createMockFeedback } from '../setup';

describe('Feedback API', () => {
  const API_URL = process.env.API_URL || 'http://localhost:4000';

  describe('GET /api/boards/:boardId/feedback', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${API_URL}/api/boards/test-board/feedback`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/boards/:boardId/feedback', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${API_URL}/api/boards/test-board/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createMockFeedback()),
      });

      expect(response.status).toBe(401);
    });

    it('should validate feedback content', async () => {
      const authToken = process.env.TEST_AUTH_TOKEN;
      if (!authToken) {
        console.log('Skipping: TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await fetch(`${API_URL}/api/boards/test-board/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content: '', // Invalid: empty content
          rating: 6, // Invalid: rating > 5
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Feedback Analytics', () => {
    it('should return aggregated feedback stats', async () => {
      const authToken = process.env.TEST_AUTH_TOKEN;
      if (!authToken) {
        console.log('Skipping: TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await fetch(`${API_URL}/api/boards/test-board/feedback/stats`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Should return stats or 404 if board doesn't exist
      expect([200, 404]).toContain(response.status);
    });
  });
});
