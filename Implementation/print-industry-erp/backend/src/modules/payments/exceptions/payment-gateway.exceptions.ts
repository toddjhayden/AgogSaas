/**
 * Payment Gateway Exceptions
 * REQ-STRATEGIC-AUTO-1767084329261
 */

export class PaymentGatewayException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}

export class StripeApiException extends PaymentGatewayException {
  constructor(message: string, public readonly stripeError?: any) {
    super(message);
    this.name = 'StripeApiException';
  }
}

export class PaymentMethodNotFoundException extends PaymentGatewayException {
  constructor(paymentMethodId: string) {
    super(`Payment method not found: ${paymentMethodId}`);
    this.name = 'PaymentMethodNotFoundException';
  }
}

export class BankAccountNotVerifiedException extends PaymentGatewayException {
  constructor(bankAccountId: string) {
    super(`Bank account not verified: ${bankAccountId}`);
    this.name = 'BankAccountNotVerifiedException';
  }
}

export class DuplicatePaymentException extends PaymentGatewayException {
  constructor(idempotencyKey: string) {
    super(`Duplicate payment detected with idempotency key: ${idempotencyKey}`);
    this.name = 'DuplicatePaymentException';
  }
}

export class WebhookSignatureException extends PaymentGatewayException {
  constructor() {
    super('Invalid webhook signature');
    this.name = 'WebhookSignatureException';
  }
}

export class PaymentAmountException extends PaymentGatewayException {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentAmountException';
  }
}

export class CustomerNotFoundException extends PaymentGatewayException {
  constructor(customerId: string) {
    super(`Customer not found: ${customerId}`);
    this.name = 'CustomerNotFoundException';
  }
}
