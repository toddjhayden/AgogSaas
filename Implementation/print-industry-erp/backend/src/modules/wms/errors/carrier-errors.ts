/**
 * Carrier API Error Classes
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 2 - Domain-specific error hierarchy from Sylvia's critique
 *
 * Provides structured error handling for carrier API failures with:
 * - Specific error types for different failure scenarios
 * - Retry guidance for transient vs permanent failures
 * - User-friendly error messages
 * - Technical details for debugging
 * - Carrier-specific error code mapping
 */

// =====================================================
// BASE ERROR CLASS
// =====================================================

export class CarrierApiError extends Error {
  constructor(
    public readonly carrierCode: string,
    public readonly errorCode: string,
    public readonly severity: 'ERROR' | 'WARNING' | 'INFO',
    public readonly retryable: boolean,
    public readonly userMessage: string,
    public readonly technicalDetails?: any
  ) {
    super(userMessage);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts error to JSON for logging/API responses
   */
  toJSON() {
    return {
      type: this.name,
      carrierCode: this.carrierCode,
      errorCode: this.errorCode,
      severity: this.severity,
      retryable: this.retryable,
      message: this.userMessage,
      technicalDetails: this.technicalDetails
    };
  }
}

// =====================================================
// ADDRESS VALIDATION ERRORS
// =====================================================

export class AddressValidationError extends CarrierApiError {
  constructor(
    carrierCode: string,
    public readonly invalidFields: string[],
    public readonly suggestions?: any[]
  ) {
    super(
      carrierCode,
      'INVALID_ADDRESS',
      'ERROR',
      false, // Not retryable - requires user correction
      `Address validation failed. Invalid fields: ${invalidFields.join(', ')}`,
      { invalidFields, suggestions }
    );
  }
}

export class AddressAmbiguousError extends CarrierApiError {
  constructor(
    carrierCode: string,
    public readonly suggestions: any[]
  ) {
    super(
      carrierCode,
      'ADDRESS_AMBIGUOUS',
      'WARNING',
      false,
      'Multiple addresses match the provided information. Please select one.',
      { suggestions }
    );
  }
}

// =====================================================
// AUTHENTICATION ERRORS
// =====================================================

export class InvalidCredentialsError extends CarrierApiError {
  constructor(carrierCode: string) {
    super(
      carrierCode,
      'INVALID_CREDENTIALS',
      'ERROR',
      false,
      `Authentication failed for ${carrierCode}. Please check your API credentials.`,
      { action: 'Verify carrier account credentials in settings' }
    );
  }
}

export class ExpiredTokenError extends CarrierApiError {
  constructor(carrierCode: string) {
    super(
      carrierCode,
      'EXPIRED_TOKEN',
      'ERROR',
      true, // Retryable after token refresh
      `Access token expired for ${carrierCode}. Refreshing...`,
      { action: 'Token will be automatically refreshed' }
    );
  }
}

// =====================================================
// SERVICE AVAILABILITY ERRORS
// =====================================================

export class ServiceUnavailableError extends CarrierApiError {
  constructor(
    carrierCode: string,
    public readonly estimatedRecovery?: Date
  ) {
    const recoveryMessage = estimatedRecovery
      ? ` Estimated recovery: ${estimatedRecovery.toLocaleString()}`
      : '';

    super(
      carrierCode,
      'SERVICE_UNAVAILABLE',
      'ERROR',
      true, // Retryable
      `${carrierCode} API is temporarily unavailable.${recoveryMessage}`,
      { estimatedRecovery }
    );
  }
}

export class ServiceNotSupportedError extends CarrierApiError {
  constructor(
    carrierCode: string,
    serviceType: string,
    destination: string
  ) {
    super(
      carrierCode,
      'SERVICE_NOT_SUPPORTED',
      'ERROR',
      false,
      `${serviceType} service is not available from ${carrierCode} to ${destination}`,
      { serviceType, destination }
    );
  }
}

// =====================================================
// RATE ERRORS
// =====================================================

export class RateNotAvailableError extends CarrierApiError {
  constructor(
    carrierCode: string,
    reason: string
  ) {
    super(
      carrierCode,
      'RATE_NOT_AVAILABLE',
      'ERROR',
      false,
      `Rate quote not available from ${carrierCode}: ${reason}`,
      { reason }
    );
  }
}

// =====================================================
// SHIPMENT CREATION ERRORS
// =====================================================

export class ShipmentCreationError extends CarrierApiError {
  constructor(
    carrierCode: string,
    reason: string,
    retryable: boolean = false
  ) {
    super(
      carrierCode,
      'SHIPMENT_CREATION_FAILED',
      'ERROR',
      retryable,
      `Failed to create shipment with ${carrierCode}: ${reason}`,
      { reason }
    );
  }
}

export class InvalidPackageDimensionsError extends CarrierApiError {
  constructor(
    carrierCode: string,
    public readonly packageIndex: number,
    public readonly reason: string
  ) {
    super(
      carrierCode,
      'INVALID_PACKAGE_DIMENSIONS',
      'ERROR',
      false,
      `Package #${packageIndex + 1} dimensions are invalid: ${reason}`,
      { packageIndex, reason }
    );
  }
}

export class WeightLimitExceededError extends CarrierApiError {
  constructor(
    carrierCode: string,
    actualWeight: number,
    maxWeight: number,
    weightUnit: string
  ) {
    super(
      carrierCode,
      'WEIGHT_LIMIT_EXCEEDED',
      'ERROR',
      false,
      `Package weight (${actualWeight} ${weightUnit}) exceeds carrier maximum (${maxWeight} ${weightUnit})`,
      { actualWeight, maxWeight, weightUnit }
    );
  }
}

// =====================================================
// TRACKING ERRORS
// =====================================================

export class TrackingNotFoundError extends CarrierApiError {
  constructor(
    carrierCode: string,
    trackingNumber: string
  ) {
    super(
      carrierCode,
      'TRACKING_NOT_FOUND',
      'ERROR',
      true, // May be retryable if shipment was just created
      `Tracking number ${trackingNumber} not found in ${carrierCode} system`,
      { trackingNumber }
    );
  }
}

// =====================================================
// MANIFEST ERRORS
// =====================================================

export class ManifestError extends CarrierApiError {
  constructor(
    carrierCode: string,
    reason: string
  ) {
    super(
      carrierCode,
      'MANIFEST_FAILED',
      'ERROR',
      false,
      `Failed to create manifest for ${carrierCode}: ${reason}`,
      { reason }
    );
  }
}

export class ShipmentAlreadyManifestError extends CarrierApiError {
  constructor(
    carrierCode: string,
    trackingNumber: string
  ) {
    super(
      carrierCode,
      'SHIPMENT_ALREADY_MANIFEST',
      'ERROR',
      false,
      `Shipment ${trackingNumber} has already been manifested and cannot be modified`,
      { trackingNumber }
    );
  }
}

// =====================================================
// NETWORK ERRORS
// =====================================================

export class NetworkTimeoutError extends CarrierApiError {
  constructor(carrierCode: string, timeoutMs: number) {
    super(
      carrierCode,
      'NETWORK_TIMEOUT',
      'ERROR',
      true, // Retryable
      `Request to ${carrierCode} API timed out after ${timeoutMs}ms`,
      { timeoutMs }
    );
  }
}

export class NetworkError extends CarrierApiError {
  constructor(
    carrierCode: string,
    reason: string
  ) {
    super(
      carrierCode,
      'NETWORK_ERROR',
      'ERROR',
      true, // Retryable
      `Network error communicating with ${carrierCode}: ${reason}`,
      { reason }
    );
  }
}

// =====================================================
// RATE LIMITING ERRORS
// =====================================================

export class RateLimitExceededError extends CarrierApiError {
  constructor(
    carrierCode: string,
    public readonly retryAfterSeconds?: number
  ) {
    const retryMessage = retryAfterSeconds
      ? ` Retry after ${retryAfterSeconds} seconds.`
      : '';

    super(
      carrierCode,
      'RATE_LIMIT_EXCEEDED',
      'ERROR',
      true, // Retryable after delay
      `Rate limit exceeded for ${carrierCode} API.${retryMessage}`,
      { retryAfterSeconds }
    );
  }
}

// =====================================================
// CUSTOMS ERRORS
// =====================================================

export class CustomsError extends CarrierApiError {
  constructor(
    carrierCode: string,
    reason: string
  ) {
    super(
      carrierCode,
      'CUSTOMS_ERROR',
      'ERROR',
      false,
      `Customs documentation error: ${reason}`,
      { reason }
    );
  }
}

export class HarmonizedCodeError extends CarrierApiError {
  constructor(
    carrierCode: string,
    invalidCode: string
  ) {
    super(
      carrierCode,
      'INVALID_HARMONIZED_CODE',
      'ERROR',
      false,
      `Invalid harmonized tariff code: ${invalidCode}`,
      { invalidCode }
    );
  }
}

// =====================================================
// CIRCUIT BREAKER ERROR
// =====================================================

export class CircuitBreakerOpenError extends CarrierApiError {
  constructor(
    carrierCode: string,
    public readonly estimatedRecovery?: Date
  ) {
    super(
      carrierCode,
      'CIRCUIT_BREAKER_OPEN',
      'ERROR',
      false, // Not immediately retryable
      `${carrierCode} API is temporarily disabled due to repeated failures. Please try again later.`,
      { estimatedRecovery }
    );
  }
}
