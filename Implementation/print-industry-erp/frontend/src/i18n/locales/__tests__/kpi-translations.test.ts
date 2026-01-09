/**
 * KPI Translations Validation Test
 * REQ-I18N-CHINESE-1766892755202
 *
 * This test validates that all KPI-related translation keys are present
 * in both English and Chinese locale files with proper structure.
 */

import enUS from '../en-US.json';
import zhCN from '../zh-CN.json';

describe('KPI Translations QA - REQ-I18N-CHINESE-1766892755202', () => {
  describe('Translation Key Completeness', () => {
    it('should have kpis section in both locales', () => {
      expect(enUS.kpis).toBeDefined();
      expect(zhCN.kpis).toBeDefined();
    });

    it('should have all main KPI keys in English', () => {
      const requiredKeys = [
        'title',
        'allKPIs',
        'category',
        'search',
        'currentValue',
        'targetValue',
        'trend',
        'formula',
        'totalKPIs',
        'aboveTarget',
        'nearTarget',
        'belowTarget',
        'favorites',
        'favoriteKPIs',
        'showing',
        'noFavorites',
        'noResults'
      ];

      requiredKeys.forEach(key => {
        expect(enUS.kpis[key]).toBeDefined();
        expect(typeof enUS.kpis[key]).toBe('string');
        expect(enUS.kpis[key].length).toBeGreaterThan(0);
      });
    });

    it('should have all main KPI keys in Chinese', () => {
      const requiredKeys = [
        'title',
        'allKPIs',
        'category',
        'search',
        'currentValue',
        'targetValue',
        'trend',
        'formula',
        'totalKPIs',
        'aboveTarget',
        'nearTarget',
        'belowTarget',
        'favorites',
        'favoriteKPIs',
        'showing',
        'noFavorites',
        'noResults'
      ];

      requiredKeys.forEach(key => {
        expect(zhCN.kpis[key]).toBeDefined();
        expect(typeof zhCN.kpis[key]).toBe('string');
        expect(zhCN.kpis[key].length).toBeGreaterThan(0);
      });
    });

    it('should have matching key structure between English and Chinese', () => {
      const enKeys = Object.keys(enUS.kpis).sort();
      const zhKeys = Object.keys(zhCN.kpis).sort();

      expect(zhKeys).toEqual(enKeys);
    });
  });

  describe('Category Translations', () => {
    it('should have categories object in both locales', () => {
      expect(enUS.kpis.categories).toBeDefined();
      expect(zhCN.kpis.categories).toBeDefined();
      expect(typeof enUS.kpis.categories).toBe('object');
      expect(typeof zhCN.kpis.categories).toBe('object');
    });

    it('should have all category keys in English', () => {
      const requiredCategories = [
        'all',
        'operations',
        'quality',
        'finance',
        'deliveryLogistics',
        'maintenance',
        'safety',
        'hrTraining',
        'customerService'
      ];

      requiredCategories.forEach(category => {
        expect(enUS.kpis.categories[category]).toBeDefined();
        expect(typeof enUS.kpis.categories[category]).toBe('string');
        expect(enUS.kpis.categories[category].length).toBeGreaterThan(0);
      });
    });

    it('should have all category keys in Chinese', () => {
      const requiredCategories = [
        'all',
        'operations',
        'quality',
        'finance',
        'deliveryLogistics',
        'maintenance',
        'safety',
        'hrTraining',
        'customerService'
      ];

      requiredCategories.forEach(category => {
        expect(zhCN.kpis.categories[category]).toBeDefined();
        expect(typeof zhCN.kpis.categories[category]).toBe('string');
        expect(zhCN.kpis.categories[category].length).toBeGreaterThan(0);
      });
    });

    it('should have matching category keys between locales', () => {
      const enCategoryKeys = Object.keys(enUS.kpis.categories).sort();
      const zhCategoryKeys = Object.keys(zhCN.kpis.categories).sort();

      expect(zhCategoryKeys).toEqual(enCategoryKeys);
    });
  });

  describe('Card Component Translations', () => {
    it('should have card object in both locales', () => {
      expect(enUS.kpis.card).toBeDefined();
      expect(zhCN.kpis.card).toBeDefined();
    });

    it('should have all card keys in English', () => {
      const requiredKeys = ['target', 'performance', 'formulaLabel'];

      requiredKeys.forEach(key => {
        expect(enUS.kpis.card[key]).toBeDefined();
        expect(typeof enUS.kpis.card[key]).toBe('string');
        expect(enUS.kpis.card[key].length).toBeGreaterThan(0);
      });
    });

    it('should have all card keys in Chinese', () => {
      const requiredKeys = ['target', 'performance', 'formulaLabel'];

      requiredKeys.forEach(key => {
        expect(zhCN.kpis.card[key]).toBeDefined();
        expect(typeof zhCN.kpis.card[key]).toBe('string');
        expect(zhCN.kpis.card[key].length).toBeGreaterThan(0);
      });
    });

    it('should have matching card keys between locales', () => {
      const enCardKeys = Object.keys(enUS.kpis.card).sort();
      const zhCardKeys = Object.keys(zhCN.kpis.card).sort();

      expect(zhCardKeys).toEqual(enCardKeys);
    });
  });

  describe('Tooltip Translations', () => {
    it('should have tooltips object in both locales', () => {
      expect(enUS.kpis.tooltips).toBeDefined();
      expect(zhCN.kpis.tooltips).toBeDefined();
    });

    it('should have all tooltip keys in English', () => {
      const requiredKeys = ['addToFavorites', 'removeFromFavorites'];

      requiredKeys.forEach(key => {
        expect(enUS.kpis.tooltips[key]).toBeDefined();
        expect(typeof enUS.kpis.tooltips[key]).toBe('string');
        expect(enUS.kpis.tooltips[key].length).toBeGreaterThan(0);
      });
    });

    it('should have all tooltip keys in Chinese', () => {
      const requiredKeys = ['addToFavorites', 'removeFromFavorites'];

      requiredKeys.forEach(key => {
        expect(zhCN.kpis.tooltips[key]).toBeDefined();
        expect(typeof zhCN.kpis.tooltips[key]).toBe('string');
        expect(zhCN.kpis.tooltips[key].length).toBeGreaterThan(0);
      });
    });

    it('should have matching tooltip keys between locales', () => {
      const enTooltipKeys = Object.keys(enUS.kpis.tooltips).sort();
      const zhTooltipKeys = Object.keys(zhCN.kpis.tooltips).sort();

      expect(zhTooltipKeys).toEqual(enTooltipKeys);
    });
  });

  describe('Bilingual Support Section', () => {
    it('should have bilingualSupport object in both locales', () => {
      expect(enUS.kpis.bilingualSupport).toBeDefined();
      expect(zhCN.kpis.bilingualSupport).toBeDefined();
    });

    it('should have all bilingualSupport keys in English', () => {
      const requiredKeys = ['title', 'description'];

      requiredKeys.forEach(key => {
        expect(enUS.kpis.bilingualSupport[key]).toBeDefined();
        expect(typeof enUS.kpis.bilingualSupport[key]).toBe('string');
        expect(enUS.kpis.bilingualSupport[key].length).toBeGreaterThan(0);
      });
    });

    it('should have all bilingualSupport keys in Chinese', () => {
      const requiredKeys = ['title', 'description'];

      requiredKeys.forEach(key => {
        expect(zhCN.kpis.bilingualSupport[key]).toBeDefined();
        expect(typeof zhCN.kpis.bilingualSupport[key]).toBe('string');
        expect(zhCN.kpis.bilingualSupport[key].length).toBeGreaterThan(0);
      });
    });

    it('should mention "119 KPIs" in bilingual support description', () => {
      expect(enUS.kpis.bilingualSupport.description).toContain('119');
      expect(zhCN.kpis.bilingualSupport.description).toContain('119');
    });
  });

  describe('Chinese Translation Quality', () => {
    it('should use proper Chinese characters (not English)', () => {
      // Verify key translations are in Chinese
      expect(zhCN.kpis.title).toMatch(/[\u4e00-\u9fa5]/); // Contains Chinese characters
      expect(zhCN.kpis.search).toMatch(/[\u4e00-\u9fa5]/);
      expect(zhCN.kpis.favorites).toMatch(/[\u4e00-\u9fa5]/);
    });

    it('should have appropriate Chinese translations for categories', () => {
      expect(zhCN.kpis.categories.operations).toBe('运营');
      expect(zhCN.kpis.categories.quality).toBe('质量');
      expect(zhCN.kpis.categories.finance).toBe('财务');
      expect(zhCN.kpis.categories.deliveryLogistics).toBe('交付与物流');
      expect(zhCN.kpis.categories.maintenance).toBe('维护');
      expect(zhCN.kpis.categories.safety).toBe('安全');
      expect(zhCN.kpis.categories.hrTraining).toBe('人力资源与培训');
      expect(zhCN.kpis.categories.customerService).toBe('客户服务');
    });

    it('should preserve interpolation placeholders in showing text', () => {
      expect(enUS.kpis.showing).toContain('{{count}}');
      expect(enUS.kpis.showing).toContain('{{total}}');
      expect(zhCN.kpis.showing).toContain('{{count}}');
      expect(zhCN.kpis.showing).toContain('{{total}}');
    });
  });

  describe('Navigation Menu Translation', () => {
    it('should have KPI Explorer in navigation menu (English)', () => {
      expect(enUS.nav.kpis).toBe('KPI Explorer');
    });

    it('should have KPI Explorer in navigation menu (Chinese)', () => {
      expect(zhCN.nav.kpis).toBe('KPI 浏览器');
    });
  });

  describe('Complete Translation Coverage', () => {
    it('should have no missing translations (English as baseline)', () => {
      const getAllKeys = (obj: any, prefix = ''): string[] => {
        let keys: string[] = [];
        for (const key in obj) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getAllKeys(obj[key], fullKey));
          } else {
            keys.push(fullKey);
          }
        }
        return keys;
      };

      const enKpiKeys = getAllKeys(enUS.kpis, 'kpis');
      const zhKpiKeys = getAllKeys(zhCN.kpis, 'kpis');

      enKpiKeys.forEach(key => {
        expect(zhKpiKeys).toContain(key);
      });
    });

    it('should have no extra translations in Chinese', () => {
      const getAllKeys = (obj: any, prefix = ''): string[] => {
        let keys: string[] = [];
        for (const key in obj) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getAllKeys(obj[key], fullKey));
          } else {
            keys.push(fullKey);
          }
        }
        return keys;
      };

      const enKpiKeys = getAllKeys(enUS.kpis, 'kpis');
      const zhKpiKeys = getAllKeys(zhCN.kpis, 'kpis');

      zhKpiKeys.forEach(key => {
        expect(enKpiKeys).toContain(key);
      });
    });
  });

  describe('Translation Length Reasonableness', () => {
    it('should have reasonable Chinese translation lengths', () => {
      // Chinese translations should generally be shorter than English
      // but not by too much (avoid truncated translations)
      const checkLength = (enText: string, zhText: string, key: string) => {
        expect(zhText.length).toBeGreaterThan(0);
        // Chinese should be at least 20% of English length (accounting for character density)
        expect(zhText.length).toBeGreaterThanOrEqual(enText.length * 0.2);
        // But not unreasonably long (max 2x English for most cases)
        expect(zhText.length).toBeLessThanOrEqual(enText.length * 2);
      };

      checkLength(enUS.kpis.title, zhCN.kpis.title, 'title');
      checkLength(enUS.kpis.search, zhCN.kpis.search, 'search');
      checkLength(enUS.kpis.favorites, zhCN.kpis.favorites, 'favorites');
    });
  });
});
