import { Injectable } from '@nestjs/common';
import {
  CarrierApiError,
  AddressValidationError,
  InvalidCredentialsError,
  ServiceUnavailableError,
  RateLimitExceededError,
  NetworkTimeoutError,
  NetworkError,
  TrackingNotFoundError,
  ShipmentCreationError,
  ManifestError,
  CircuitBreakerOpenError
} from '../errors/carrier-errors';

/**
 * Carrier Error Mapper Service
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 2 - Error handling strategy from Sylvia's critique
 *
 * Maps carrier-specific API errors to domain-specific error types.
 * Provides:
 * - Unified error handling across all carriers
 * - Retry guidance for each error type
 * - User-friendly error messages
 * - Detailed logging for debugging
 *
 * Supported Carriers:
 * - FedEx (400+ error codes)
 * - UPS (200+ error codes)
 * - USPS (inconsistent XML/JSON formats)
 */
@Injectable()
export class CarrierErrorMapperService {
  /**
   * Maps a carrier-specific error response to a domain error
   *
   * @param carrierCode - Carrier identifier (FEDEX, UPS, USPS)
   * @param errorResponse - Raw error response from carrier API
   * @returns Domain-specific CarrierApiError
   */
  mapError(carrierCode: string, errorResponse: any): CarrierApiError {
    // Log raw error for debugging
    console.error(`Carrier API Error from ${carrierCode}:`, JSON.stringify(errorResponse));

    switch (carrierCode.toUpperCase()) {
      case 'FEDEX':
        return this.mapFedExError(errorResponse);
      case 'UPS':
        return this.mapUPSError(errorResponse);
      case 'USPS':
        return this.mapUSPSError(errorResponse);
      default:
        return this.mapGenericError(carrierCode, errorResponse);
    }
  }

  /**
   * Maps FedEx-specific errors
   * FedEx uses numeric error codes with severity levels
   */
  private mapFedExError(errorResponse: any): CarrierApiError {
    const carrierCode = 'FEDEX';
    const error = errorResponse.errors?.[0] || errorResponse;
    const code = error.code || error.errorCode;
    const message = error.message || 'Unknown error';

    // Authentication errors
    if (code === 'AUTHENTICATION.FAILED' || code === 'UNAUTHORIZED') {
      return new InvalidCredentialsError(carrierCode);
    }

    // Rate limiting
    if (code === 'RATE.LIMIT.EXCEEDED' || code === 'TOO.MANY.REQUESTS') {
      const retryAfter = error.retryAfter || 60;
      return new RateLimitExceededError(carrierCode, retryAfter);
    }

    // Service unavailable
    if (code === 'SERVICE.UNAVAILABLE' || code === 'SYSTEM.UNAVAILABLE') {
      return new ServiceUnavailableError(carrierCode);
    }

    // Address validation
    if (code?.startsWith('ADDRESS.')) {
      const invalidFields = this.extractInvalidFields(error);
      return new AddressValidationError(carrierCode, invalidFields);
    }

    // Tracking
    if (code === 'TRACKING.TRACKINGNUMBER.NOTFOUND') {
      return new TrackingNotFoundError(carrierCode, error.trackingNumber);
    }

    // Shipment creation
    if (code?.startsWith('SHIPMENT.')) {
      const retryable = this.isRetryableFedExError(code);
      return new ShipmentCreationError(carrierCode, message, retryable);
    }

    // Manifest
    if (code?.startsWith('MANIFEST.')) {
      return new ManifestError(carrierCode, message);
    }

    // Generic error
    return new CarrierApiError(
      carrierCode,
      code || 'UNKNOWN',
      'ERROR',
      false,
      message,
      errorResponse
    );
  }

  /**
   * Maps UPS-specific errors
   * UPS uses string error codes with severity levels (Error, Warning, Note)
   */
  private mapUPSError(errorResponse: any): CarrierApiError {
    const carrierCode = 'UPS';
    const error = errorResponse.response?.errors?.[0] || errorResponse.Fault || errorResponse;
    const code = error.code || error.errorCode || error.ErrorCode;
    const message = error.message || error.ErrorDescription || 'Unknown error';
    const severity = error.ErrorSeverity || error.severity;

    // Authentication errors
    if (code === '250003' || message.includes('Invalid Access License')) {
      return new InvalidCredentialsError(carrierCode);
    }

    // Rate limiting
    if (code === '250002' || message.includes('rate limit')) {
      return new RateLimitExceededError(carrierCode, 60);
    }

    // Service unavailable
    if (code === '250001' || message.includes('unavailable')) {
      return new ServiceUnavailableError(carrierCode);
    }

    // Address validation
    if (code?.startsWith('11') || message.includes('address')) {
      const invalidFields = this.extractInvalidFields(error);
      return new AddressValidationError(carrierCode, invalidFields);
    }

    // Tracking
    if (code === '151044' || message.includes('not found')) {
      return new TrackingNotFoundError(carrierCode, error.trackingNumber);
    }

    // Determine if retryable based on severity
    const retryable = severity === 'Warning' || severity === 'Hard';

    // Generic error
    return new CarrierApiError(
      carrierCode,
      code || 'UNKNOWN',
      this.mapSeverity(severity),
      retryable,
      message,
      errorResponse
    );
  }

  /**
   * Maps USPS-specific errors
   * USPS has inconsistent error formats (XML vs JSON)
   */
  private mapUSPSError(errorResponse: any): CarrierApiError {
    const carrierCode = 'USPS';

    // Handle XML error format
    if (errorResponse.Error) {
      const error = errorResponse.Error;
      const code = error.Number || error.Code;
      const message = error.Description || error.Message || 'Unknown error';

      // Authentication
      if (code === '-80040B1A' || message.includes('Authorization')) {
        return new InvalidCredentialsError(carrierCode);
      }

      // Address validation
      if (code === '-2147219401' || message.includes('Address')) {
        const invalidFields = this.extractInvalidFields(error);
        return new AddressValidationError(carrierCode, invalidFields);
      }

      // Tracking
      if (code === '-2147219302' || message.includes('not found')) {
        return new TrackingNotFoundError(carrierCode, error.trackingNumber);
      }

      return new CarrierApiError(
        carrierCode,
        code?.toString() || 'UNKNOWN',
        'ERROR',
        false,
        message,
        errorResponse
      );
    }

    // Handle JSON error format
    const error = errorResponse.error || errorResponse;
    const code = error.code;
    const message = error.message || 'Unknown error';

    return new CarrierApiError(
      carrierCode,
      code || 'UNKNOWN',
      'ERROR',
      false,
      message,
      errorResponse
    );
  }

  /**
   * Maps generic HTTP/network errors
   */
  private mapGenericError(carrierCode: string, errorResponse: any): CarrierApiError {
    // Network timeout
    if (errorResponse.code === 'ETIMEDOUT' || errorResponse.code === 'ESOCKETTIMEDOUT') {
      return new NetworkTimeoutError(carrierCode, errorResponse.timeout || 30000);
    }

    // Network error
    if (errorResponse.code === 'ECONNREFUSED' || errorResponse.code === 'ENOTFOUND') {
      return new NetworkError(carrierCode, errorResponse.message || 'Connection failed');
    }

    // HTTP status codes
    if (errorResponse.status || errorResponse.statusCode) {
      const status = errorResponse.status || errorResponse.statusCode;

      if (status === 401 || status === 403) {
        return new InvalidCredentialsError(carrierCode);
      }

      if (status === 429) {
        return new RateLimitExceededError(carrierCode);
      }

      if (status === 503 || status === 504) {
        return new ServiceUnavailableError(carrierCode);
      }
    }

    // Generic error
    return new CarrierApiError(
      carrierCode,
      errorResponse.code || 'UNKNOWN',
      'ERROR',
      false,
      errorResponse.message || 'Unknown error occurred',
      errorResponse
    );
  }

  /**
   * Extracts invalid field names from error response
   */
  private extractInvalidFields(error: any): string[] {
    const fields: string[] = [];

    if (error.parameterList) {
      error.parameterList.forEach((param: any) => {
        if (param.key) fields.push(param.key);
      });
    }

    if (error.fieldName) {
      fields.push(error.fieldName);
    }

    if (error.invalidFields) {
      fields.push(...error.invalidFields);
    }

    return fields.length > 0 ? fields : ['unknown'];
  }

  /**
   * Determines if a FedEx error is retryable
   */
  private isRetryableFedExError(code: string): boolean {
    const retryableCodes = [
      'SHIPMENT.TEMPORARYERROR',
      'SYSTEM.TEMPORARILYUNAVAILABLE',
      'TIMEOUT'
    ];

    return retryableCodes.some(retryCode => code.includes(retryCode));
  }

  /**
   * Maps carrier severity to standard severity
   */
  private mapSeverity(severity: string | undefined): 'ERROR' | 'WARNING' | 'INFO' {
    if (!severity) return 'ERROR';

    const s = severity.toUpperCase();
    if (s === 'WARNING' || s === 'WARN') return 'WARNING';
    if (s === 'INFO' || s === 'NOTE') return 'INFO';
    return 'ERROR';
  }

  /**
   * Determines if an error is retryable
   */
  isRetryable(error: CarrierApiError): boolean {
    return error.retryable;
  }

  /**
   * Gets recommended retry delay based on error type
   */
  getRetryDelay(error: CarrierApiError, attemptNumber: number): number {
    // Rate limit errors have specific retry-after
    if (error instanceof RateLimitExceededError && error.retryAfterSeconds) {
      return error.retryAfterSeconds * 1000;
    }

    // Exponential backoff for retryable errors
    // Formula: min(base * 2^attempt, maxDelay) + jitter
    if (error.retryable) {
      const baseDelay = 1000; // 1 second
      const maxDelay = 60000; // 60 seconds
      const exponential = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
      const jitter = Math.random() * 1000; // 0-1 second jitter
      return exponential + jitter;
    }

    return 0; // Not retryable
  }
}
