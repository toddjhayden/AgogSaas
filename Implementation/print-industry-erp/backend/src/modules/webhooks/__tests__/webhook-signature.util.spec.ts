/**
 * Webhook Signature Utility Tests
 * REQ-1767925582664-n6du5
 */

import { WebhookSignatureUtil } from '../utils/webhook-signature.util';
import * as crypto from 'crypto';

describe('WebhookSignatureUtil', () => {
  const testSecret = 'test-secret-key-12345';
  const testPayload = JSON.stringify({
    event_id: 'evt-123',
    event_type: 'invoice.created',
    event_timestamp: new Date().toISOString(),
    data: { invoice_id: 'inv-456', amount: 1000 },
  });

  describe('generateSignature', () => {
    it('should generate a valid HMAC signature', () => {
      const signature = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should generate different signatures for different payloads', () => {
      const signature1 = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      const signature2 = WebhookSignatureUtil.generateSignature(
        testPayload + 'modified',
        testSecret,
        'sha256'
      );

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secrets', () => {
      const signature1 = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      const signature2 = WebhookSignatureUtil.generateSignature(
        testPayload,
        'different-secret',
        'sha256'
      );

      expect(signature1).not.toBe(signature2);
    });

    it('should support SHA512 algorithm', () => {
      const signature = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha512'
      );

      expect(signature).toBeTruthy();
      expect(signature.length).toBe(128); // SHA512 produces 128 hex characters
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature', () => {
      const signature = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      const isValid = WebhookSignatureUtil.verifySignature(
        testPayload,
        signature,
        testSecret,
        'sha256'
      );

      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const isValid = WebhookSignatureUtil.verifySignature(
        testPayload,
        'invalid-signature',
        testSecret,
        'sha256'
      );

      expect(isValid).toBe(false);
    });

    it('should reject a signature with modified payload', () => {
      const signature = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      const isValid = WebhookSignatureUtil.verifySignature(
        testPayload + 'modified',
        signature,
        testSecret,
        'sha256'
      );

      expect(isValid).toBe(false);
    });

    it('should reject a signature with wrong secret', () => {
      const signature = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      const isValid = WebhookSignatureUtil.verifySignature(
        testPayload,
        signature,
        'wrong-secret',
        'sha256'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string-123';
      const result = WebhookSignatureUtil.secureCompare(str, str);

      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = WebhookSignatureUtil.secureCompare(
        'test-string-123',
        'test-string-456'
      );

      expect(result).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const result = WebhookSignatureUtil.secureCompare(
        'short',
        'longer-string'
      );

      expect(result).toBe(false);
    });
  });

  describe('extractSignature', () => {
    it('should extract signature from headers', () => {
      const headers = {
        'x-webhook-signature': 'abc123',
        'content-type': 'application/json',
      };

      const signature = WebhookSignatureUtil.extractSignature(headers);

      expect(signature).toBe('abc123');
    });

    it('should handle case-insensitive header names', () => {
      const headers = {
        'X-WEBHOOK-SIGNATURE': 'abc123',
      };

      const signature = WebhookSignatureUtil.extractSignature(headers);

      expect(signature).toBe('abc123');
    });

    it('should handle custom header names', () => {
      const headers = {
        'x-custom-signature': 'abc123',
      };

      const signature = WebhookSignatureUtil.extractSignature(
        headers,
        'X-Custom-Signature'
      );

      expect(signature).toBe('abc123');
    });

    it('should return null for missing header', () => {
      const headers = {
        'content-type': 'application/json',
      };

      const signature = WebhookSignatureUtil.extractSignature(headers);

      expect(signature).toBeNull();
    });

    it('should handle array header values', () => {
      const headers = {
        'x-webhook-signature': ['abc123', 'xyz789'],
      };

      const signature = WebhookSignatureUtil.extractSignature(headers);

      expect(signature).toBe('abc123');
    });
  });

  describe('validateTimestamp', () => {
    it('should accept a recent timestamp', () => {
      const timestamp = new Date().toISOString();
      const isValid = WebhookSignatureUtil.validateTimestamp(timestamp, 300);

      expect(isValid).toBe(true);
    });

    it('should reject an old timestamp', () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const timestamp = oldDate.toISOString();
      const isValid = WebhookSignatureUtil.validateTimestamp(timestamp, 300);

      expect(isValid).toBe(false);
    });

    it('should reject a future timestamp', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes in future
      const timestamp = futureDate.toISOString();
      const isValid = WebhookSignatureUtil.validateTimestamp(timestamp, 300);

      expect(isValid).toBe(false);
    });

    it('should accept timestamp within clock skew tolerance', () => {
      const nearFutureDate = new Date(Date.now() + 20 * 1000); // 20 seconds in future
      const timestamp = nearFutureDate.toISOString();
      const isValid = WebhookSignatureUtil.validateTimestamp(timestamp, 300);

      expect(isValid).toBe(true);
    });

    it('should reject invalid timestamp format', () => {
      const isValid = WebhookSignatureUtil.validateTimestamp('invalid-date', 300);

      expect(isValid).toBe(false);
    });

    it('should use custom max age', () => {
      const date = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      const timestamp = date.toISOString();

      // Should be valid with 5 minute max age
      expect(WebhookSignatureUtil.validateTimestamp(timestamp, 300)).toBe(true);

      // Should be invalid with 1 minute max age
      expect(WebhookSignatureUtil.validateTimestamp(timestamp, 60)).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify a valid webhook with signature and timestamp', () => {
      const signature = WebhookSignatureUtil.generateSignature(
        testPayload,
        testSecret,
        'sha256'
      );

      const result = WebhookSignatureUtil.verify(
        testPayload,
        signature,
        testSecret,
        'sha256',
        300
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject webhook with invalid signature', () => {
      const result = WebhookSignatureUtil.verify(
        testPayload,
        'invalid-signature',
        testSecret,
        'sha256',
        300
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('should reject webhook with old timestamp', () => {
      const oldPayload = JSON.stringify({
        event_id: 'evt-123',
        event_type: 'invoice.created',
        event_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        data: { invoice_id: 'inv-456' },
      });

      const signature = WebhookSignatureUtil.generateSignature(
        oldPayload,
        testSecret,
        'sha256'
      );

      const result = WebhookSignatureUtil.verify(
        oldPayload,
        signature,
        testSecret,
        'sha256',
        300
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Webhook timestamp is invalid or too old');
    });

    it('should reject webhook with invalid JSON', () => {
      const invalidPayload = 'not-valid-json{';
      const signature = WebhookSignatureUtil.generateSignature(
        invalidPayload,
        testSecret,
        'sha256'
      );

      const result = WebhookSignatureUtil.verify(
        invalidPayload,
        signature,
        testSecret,
        'sha256',
        300
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid JSON payload');
    });

    it('should accept webhook without timestamp field', () => {
      const payloadWithoutTimestamp = JSON.stringify({
        event_id: 'evt-123',
        event_type: 'invoice.created',
        data: { invoice_id: 'inv-456' },
      });

      const signature = WebhookSignatureUtil.generateSignature(
        payloadWithoutTimestamp,
        testSecret,
        'sha256'
      );

      const result = WebhookSignatureUtil.verify(
        payloadWithoutTimestamp,
        signature,
        testSecret,
        'sha256',
        300
      );

      expect(result.valid).toBe(true);
    });
  });
});
