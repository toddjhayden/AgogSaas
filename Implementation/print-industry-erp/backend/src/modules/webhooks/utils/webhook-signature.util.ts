/**
 * Webhook Signature Utilities
 * REQ-1767925582664-n6du5
 *
 * Utilities for webhook consumers to verify webhook signatures
 */

import * as crypto from 'crypto';

export class WebhookSignatureUtil {
  /**
   * Verify webhook signature
   *
   * @param payload - The raw request body (as string)
   * @param signature - The signature from the webhook header
   * @param secret - The webhook subscription's secret key
   * @param algorithm - The hash algorithm (sha256, sha512)
   * @returns true if signature is valid
   */
  static verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256'
  ): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, secret, algorithm);
      return this.secureCompare(signature, expectedSignature);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate HMAC signature for payload
   *
   * @param payload - The payload to sign
   * @param secret - The secret key
   * @param algorithm - The hash algorithm
   * @returns The hex-encoded signature
   */
  static generateSignature(
    payload: string,
    secret: string,
    algorithm: string = 'sha256'
  ): string {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   *
   * @param a - First string
   * @param b - Second string
   * @returns true if strings are equal
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  }

  /**
   * Extract signature from request headers
   *
   * @param headers - Request headers object
   * @param signatureHeader - The header name to look for (default: X-Webhook-Signature)
   * @returns The signature value or null
   */
  static extractSignature(
    headers: Record<string, string | string[] | undefined>,
    signatureHeader: string = 'X-Webhook-Signature'
  ): string | null {
    // Header names are case-insensitive in HTTP
    const headerKey = Object.keys(headers).find(
      key => key.toLowerCase() === signatureHeader.toLowerCase()
    );

    if (!headerKey) {
      return null;
    }

    const value = headers[headerKey];

    if (Array.isArray(value)) {
      return value[0] || null;
    }

    return value || null;
  }

  /**
   * Validate webhook timestamp to prevent replay attacks
   *
   * @param timestamp - The timestamp from the webhook payload (ISO 8601 string)
   * @param maxAgeSeconds - Maximum age of webhook in seconds (default: 300 = 5 minutes)
   * @returns true if timestamp is within acceptable range
   */
  static validateTimestamp(
    timestamp: string,
    maxAgeSeconds: number = 300
  ): boolean {
    try {
      const webhookTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const age = (currentTime - webhookTime) / 1000;

      // Webhook should not be too old
      if (age > maxAgeSeconds) {
        return false;
      }

      // Webhook should not be from the future (allow 30 second clock skew)
      if (age < -30) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Complete webhook verification (signature + timestamp)
   *
   * @param payload - The raw request body
   * @param signature - The signature from headers
   * @param secret - The webhook secret
   * @param algorithm - The hash algorithm
   * @param maxAgeSeconds - Maximum webhook age
   * @returns Object with verification result and details
   */
  static verify(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
    maxAgeSeconds: number = 300
  ): { valid: boolean; reason?: string } {
    // Verify signature
    if (!this.verifySignature(payload, signature, secret, algorithm)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    // Extract and validate timestamp from payload
    try {
      const data = JSON.parse(payload);

      if (data.event_timestamp) {
        if (!this.validateTimestamp(data.event_timestamp, maxAgeSeconds)) {
          return { valid: false, reason: 'Webhook timestamp is invalid or too old' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid JSON payload' };
    }
  }
}

/**
 * Example usage for webhook consumers:
 *
 * // In your webhook endpoint handler:
 * import { WebhookSignatureUtil } from './webhook-signature.util';
 *
 * app.post('/webhooks/endpoint', async (req, res) => {
 *   const rawBody = req.body; // Raw string body
 *   const signature = req.headers['x-webhook-signature'];
 *   const secret = 'your-webhook-secret-key';
 *
 *   const verification = WebhookSignatureUtil.verify(
 *     rawBody,
 *     signature,
 *     secret,
 *     'sha256',
 *     300 // 5 minutes
 *   );
 *
 *   if (!verification.valid) {
 *     return res.status(401).json({ error: verification.reason });
 *   }
 *
 *   // Process webhook...
 *   const payload = JSON.parse(rawBody);
 *   // ...
 *
 *   res.status(200).json({ received: true });
 * });
 */
