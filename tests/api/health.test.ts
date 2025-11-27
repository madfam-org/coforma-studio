/**
 * Health endpoint tests for Coforma Studio API
 */

import { describe, it, expect } from 'vitest';

describe('Health Endpoint', () => {
  const API_URL = process.env.API_URL || 'http://localhost:4000';

  it('should return healthy status', async () => {
    const response = await fetch(`${API_URL}/api/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  it('should include service information', async () => {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();

    expect(data).toHaveProperty('service');
    expect(data.service).toBe('coforma-studio');
  });

  it('should include timestamp', async () => {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();

    expect(data).toHaveProperty('timestamp');
  });
});
