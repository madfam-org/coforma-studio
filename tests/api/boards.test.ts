/**
 * Advisory Board API tests for Coforma Studio
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBoard, createMockUser } from '../setup';

describe('Advisory Boards API', () => {
  const API_URL = process.env.API_URL || 'http://localhost:4000';

  describe('GET /api/boards', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${API_URL}/api/boards`);
      expect(response.status).toBe(401);
    });

    it('should return boards for authenticated user', async () => {
      // This test requires a valid auth token
      // Skip in CI without proper setup
      const authToken = process.env.TEST_AUTH_TOKEN;
      if (!authToken) {
        console.log('Skipping: TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await fetch(`${API_URL}/api/boards`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.boards || data)).toBe(true);
    });
  });

  describe('POST /api/boards', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${API_URL}/api/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createMockBoard()),
      });

      expect(response.status).toBe(401);
    });

    it('should validate board data', async () => {
      const authToken = process.env.TEST_AUTH_TOKEN;
      if (!authToken) {
        console.log('Skipping: TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await fetch(`${API_URL}/api/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: '', // Invalid: empty name
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});
