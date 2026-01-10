/**
 * SDLC API Version Configuration
 * Pattern follows migration versioning: V{major}.{minor}.{patch}
 *
 * Update this file when deploying new versions
 */

export const API_VERSION = 'V0.1.0';
export const API_COMMIT = 'aeb6351';
export const API_BUILD_DATE = '2026-01-10';

// Database migration version (should match latest migration file)
export const DB_VERSION = 'V0.0.30';

// Combined revision code for display
export const API_REVISION = `${API_VERSION}-${API_COMMIT}`;
