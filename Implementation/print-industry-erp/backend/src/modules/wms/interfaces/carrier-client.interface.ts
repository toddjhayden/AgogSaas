/**
 * Carrier Client Interfaces
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 1 - Strategy Pattern implementation from Sylvia's critique
 *
 * Provides a unified interface for all carrier integrations (FedEx, UPS, USPS, DHL, etc.)
 * Enables:
 * - Consistent carrier API interaction
 * - Easy addition of new carriers
 * - Testability through mocking
 * - Carrier-agnostic business logic
 */

// =====================================================
// CORE TYPES
// =====================================================

export interface Address {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  isResidential?: boolean;
}

export interface Package {
  sequenceNumber: number;
  weight: number;
  weightUnit: 'LBS' | 'KG';
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: 'IN' | 'CM';
  insuranceValue?: number;
  insuranceCurrency?: string;
  referenceNumbers?: string[];
}

export interface ShipmentRequest {
  tenantId: string;
  facilityId: string;
  shipmentId: string;
  serviceType: string; // Carrier-specific (GROUND, EXPRESS, etc.)
  shipFrom: Address;
  shipTo: Address;
  packages: Package[];
  billingAccountNumber?: string;
  specialServices?: string[];
  customsInfo?: CustomsInfo;
  shipmentDate?: Date;
}

export interface CustomsInfo {
  contentType: 'MERCHANDISE' | 'DOCUMENTS' | 'SAMPLE' | 'GIFT' | 'RETURN';
  customsValue: number;
  customsCurrency: string;
  dutyPaymentType: 'SENDER' | 'RECIPIENT' | 'THIRD_PARTY';
  commercialInvoiceUrl?: string;
  items: CustomsItem[];
}

export interface CustomsItem {
  description: string;
  quantity: number;
  unitValue: number;
  countryOfOrigin: string;
  harmonizedCode?: string;
  weight: number;
  weightUnit: 'LBS' | 'KG';
}

// =====================================================
// RESPONSE TYPES
// =====================================================

export interface AddressValidationResult {
  isValid: boolean;
  validatedAddress?: Address;
  suggestions?: Address[];
  errors?: AddressValidationError[];
}

export interface AddressValidationError {
  code: string;
  message: string;
  field: string;
}

export interface RateQuote {
  carrierCode?: string; // NEW - REQ-1767925582663-ieqg0
  carrierName?: string; // NEW - REQ-1767925582663-ieqg0
  serviceType: string;
  serviceName: string;
  totalCost: number;
  currency: string;
  transitDays?: number;
  estimatedDeliveryDate?: Date;
  guaranteedDelivery: boolean;
  breakdown?: {
    baseRate?: number;
    fuelSurcharge?: number;
    insurance?: number;
    residential?: number;
    saturday?: number;
    other?: number;
  };
}

export interface ShipmentConfirmation {
  shipmentId: string;
  carrierShipmentId: string;
  trackingNumber: string;
  labelFormat: 'PDF' | 'PNG' | 'ZPL';
  labelData: string; // Base64-encoded label
  labelUrl?: string;
  totalCost: number;
  currency: string;
  packages: PackageConfirmation[];
  manifestId?: string;
}

export interface PackageConfirmation {
  sequenceNumber: number;
  trackingNumber: string;
  labelData?: string;
}

export interface ManifestConfirmation {
  manifestId: string;
  carrierManifestId: string;
  manifestDate: Date;
  shipmentCount: number;
  totalWeight: number;
  documentFormat: 'PDF';
  documentData: string; // Base64-encoded manifest document
  documentUrl?: string;
}

export interface TrackingEvent {
  timestamp: Date;
  status: TrackingStatus;
  statusCode: string;
  statusDescription: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  exceptionCode?: string;
  exceptionDescription?: string;
  signedBy?: string;
}

export enum TrackingStatus {
  LABEL_CREATED = 'LABEL_CREATED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  EXCEPTION = 'EXCEPTION',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED'
}

export interface ConnectionStatus {
  isConnected: boolean;
  apiVersion?: string;
  lastTestTime: Date;
  responseTimeMs?: number;
  error?: string;
}

// =====================================================
// CARRIER CLIENT INTERFACE
// =====================================================

/**
 * ICarrierClient - Unified interface for all shipping carriers
 *
 * All carrier implementations (FedEx, UPS, USPS, etc.) must implement this interface.
 * This enables:
 * - Strategy Pattern for carrier selection
 * - Easy testing through mocks
 * - Carrier failover
 * - Consistent error handling
 */
export interface ICarrierClient {
  /**
   * Gets the carrier code (FEDEX, UPS, USPS, etc.)
   */
  getCarrierCode(): string;

  /**
   * Gets the carrier display name
   */
  getCarrierName(): string;

  // =====================================================
  // ADDRESS VALIDATION
  // =====================================================

  /**
   * Validates and standardizes a shipping address
   * Returns validation status and suggested corrections
   */
  validateAddress(address: Address): Promise<AddressValidationResult>;

  // =====================================================
  // RATE SHOPPING
  // =====================================================

  /**
   * Gets rate quotes for all available services
   * Used for rate shopping across carriers
   */
  getRates(shipment: ShipmentRequest): Promise<RateQuote[]>;

  /**
   * Gets a rate quote for a specific service type
   */
  getRate(shipment: ShipmentRequest, serviceType: string): Promise<RateQuote>;

  // =====================================================
  // SHIPMENT CREATION
  // =====================================================

  /**
   * Creates a shipment and generates shipping label(s)
   * Returns tracking numbers and label data
   */
  createShipment(shipment: ShipmentRequest): Promise<ShipmentConfirmation>;

  /**
   * Voids/cancels a shipment
   * Must be called before end-of-day manifest close
   */
  voidShipment(trackingNumber: string): Promise<void>;

  // =====================================================
  // MANIFESTING (END-OF-DAY CLOSE)
  // =====================================================

  /**
   * Creates a manifest (end-of-day close) for shipments
   * Required for some carriers (FedEx Ground, etc.)
   */
  createManifest(shipmentIds: string[]): Promise<ManifestConfirmation>;

  /**
   * Closes a manifest
   * After closing, shipments cannot be voided
   */
  closeManifest(manifestId: string): Promise<void>;

  // =====================================================
  // TRACKING
  // =====================================================

  /**
   * Gets tracking events for a shipment
   * Returns chronological list of status updates
   */
  getTrackingUpdates(trackingNumber: string): Promise<TrackingEvent[]>;

  /**
   * Gets current tracking status for a shipment
   * Returns latest status only
   */
  getCurrentStatus(trackingNumber: string): Promise<TrackingEvent>;

  // =====================================================
  // HEALTH CHECK
  // =====================================================

  /**
   * Tests connection to carrier API
   * Used for health checks and circuit breaker decisions
   */
  testConnection(): Promise<ConnectionStatus>;
}

// =====================================================
// CARRIER FACTORY
// =====================================================

/**
 * Factory for creating carrier client instances
 * Implements Strategy Pattern for carrier selection
 */
export interface ICarrierClientFactory {
  /**
   * Gets a carrier client by carrier code
   */
  getClient(carrierCode: string): ICarrierClient;

  /**
   * Gets all available carrier clients
   */
  getAllClients(): ICarrierClient[];

  /**
   * Checks if a carrier is supported
   */
  isCarrierSupported(carrierCode: string): boolean;
}
