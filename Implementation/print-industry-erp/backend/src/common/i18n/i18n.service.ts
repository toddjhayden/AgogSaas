import { Injectable } from '@nestjs/common';

/**
 * Simple i18n service for backend localization
 * Currently supports English (en-US) and Chinese (zh-CN)
 */
@Injectable()
export class I18nService {
  private translations: Record<string, Record<string, string>> = {
    'en-US': {
      // Error messages
      'errors.invalidPurchaseOrder': 'Invalid purchase order ID',
      'errors.unauthorized': 'Unauthorized access',
      'errors.notFound': 'Resource not found',
      'errors.validationFailed': 'Validation failed',
      'errors.internalError': 'Internal server error',

      // Purchase order statuses
      'po.status.DRAFT': 'Draft',
      'po.status.PENDING_APPROVAL': 'Pending Approval',
      'po.status.APPROVED': 'Approved',
      'po.status.REJECTED': 'Rejected',
      'po.status.ISSUED': 'Issued',
      'po.status.RECEIVED': 'Received',
      'po.status.CLOSED': 'Closed',
      'po.status.CANCELLED': 'Cancelled',

      // Vendor tiers
      'vendor.tier.STRATEGIC': 'Strategic',
      'vendor.tier.PREFERRED': 'Preferred',
      'vendor.tier.TRANSACTIONAL': 'Transactional',

      // Email templates
      'email.approvalRequired.subject': 'Purchase Order Approval Required',
      'email.approvalRequired.body': 'Please approve Purchase Order {poNumber}',
      'email.approved.subject': 'Purchase Order Approved',
      'email.rejected.subject': 'Purchase Order Rejected',
    },
    'zh-CN': {
      // Error messages
      'errors.invalidPurchaseOrder': '无效的采购订单ID',
      'errors.unauthorized': '未经授权的访问',
      'errors.notFound': '未找到资源',
      'errors.validationFailed': '验证失败',
      'errors.internalError': '内部服务器错误',

      // Purchase order statuses
      'po.status.DRAFT': '草稿',
      'po.status.PENDING_APPROVAL': '待审批',
      'po.status.APPROVED': '已批准',
      'po.status.REJECTED': '已拒绝',
      'po.status.ISSUED': '已发布',
      'po.status.RECEIVED': '已接收',
      'po.status.CLOSED': '已关闭',
      'po.status.CANCELLED': '已取消',

      // Vendor tiers
      'vendor.tier.STRATEGIC': '战略',
      'vendor.tier.PREFERRED': '优选',
      'vendor.tier.TRANSACTIONAL': '交易',

      // Email templates
      'email.approvalRequired.subject': '需要批准采购订单',
      'email.approvalRequired.body': '请批准采购订单 {poNumber}',
      'email.approved.subject': '采购订单已批准',
      'email.rejected.subject': '采购订单已拒绝',
    },
  };

  /**
   * Translate a key to the specified language
   * @param key Translation key (e.g., 'errors.invalidPurchaseOrder')
   * @param locale Language code (e.g., 'en-US', 'zh-CN')
   * @param params Optional parameters for interpolation
   * @returns Translated string or the key itself if translation not found
   */
  translate(key: string, locale: string = 'en-US', params?: Record<string, any>): string {
    const languageTranslations = this.translations[locale] || this.translations['en-US'];
    let translation = languageTranslations[key] || this.translations['en-US'][key] || key;

    // Simple interpolation: replace {paramName} with param values
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        translation = translation.replace(`{${paramKey}}`, params[paramKey]);
      });
    }

    return translation;
  }

  /**
   * Get user's preferred language from context
   * Priority: user preference > Accept-Language header > tenant default > en-US
   */
  getUserLanguage(context: any): string {
    if (context.user?.preferredLanguage) {
      return context.user.preferredLanguage;
    }

    if (context.req?.headers['accept-language']) {
      const acceptLang = context.req.headers['accept-language'];
      // Parse Accept-Language header (e.g., "en-US,en;q=0.9,zh-CN;q=0.8")
      const primaryLang = acceptLang.split(',')[0].trim();
      if (primaryLang.includes('zh')) return 'zh-CN';
      if (primaryLang.includes('en')) return 'en-US';
    }

    if (context.tenant?.defaultLanguage) {
      return context.tenant.defaultLanguage;
    }

    return 'en-US';
  }

  /**
   * Add new translation keys dynamically
   */
  addTranslations(locale: string, translations: Record<string, string>): void {
    if (!this.translations[locale]) {
      this.translations[locale] = {};
    }
    Object.assign(this.translations[locale], translations);
  }
}
