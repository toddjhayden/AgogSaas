-- AgogSaaS Test Seed Data
-- Purpose: Bilingual test data for English and Chinese language testing
-- Usage: Loaded automatically by build-and-start script

-- =============================================================================
-- CLEANUP (if re-running)
-- =============================================================================

TRUNCATE TABLE IF EXISTS
  prod_runs,
  production_orders,
  work_centers,
  materials,
  customers,
  products,
  facilities,
  users,
  tenants
CASCADE;

-- =============================================================================
-- TENANTS
-- =============================================================================

-- Tenant 1: American Print Co. (English)
INSERT INTO tenants (id, code, name, primary_language, region, timezone, is_active, settings, created_at, updated_at)
VALUES
  (
    'tenant-us-001',
    'PRINT-US',
    'American Print Co.',
    'en-US',
    'US-EAST',
    'America/New_York',
    true,
    '{"currency": "USD", "date_format": "MM/DD/YYYY", "time_format": "12h", "measurement_system": "imperial"}',
    NOW(),
    NOW()
  );

-- Tenant 2: Shanghai Printing Company (Chinese)
INSERT INTO tenants (id, code, name, primary_language, region, timezone, is_active, settings, created_at, updated_at)
VALUES
  (
    'tenant-cn-001',
    'PRINT-CN',
    '上海印刷公司',
    'zh-CN',
    'APAC',
    'Asia/Shanghai',
    true,
    '{"currency": "CNY", "date_format": "YYYY-MM-DD", "time_format": "24h", "measurement_system": "metric"}',
    NOW(),
    NOW()
  );

-- =============================================================================
-- FACILITIES
-- =============================================================================

-- US Facilities
INSERT INTO facilities (id, tenant_id, code, name, facility_type, address, city, state, country, postal_code, timezone, is_active, settings, created_at, updated_at)
VALUES
  (
    'fac-us-toronto',
    'tenant-us-001',
    'FAC-TOR',
    'Toronto Print Facility',
    'manufacturing',
    '123 Industrial Blvd',
    'Toronto',
    'ON',
    'Canada',
    'M1A 1A1',
    'America/Toronto',
    true,
    '{"area_sqft": 50000, "capacity_shifts": 3, "certifications": ["ISO9001", "FSC"]}',
    NOW(),
    NOW()
  ),
  (
    'fac-us-newyork',
    'tenant-us-001',
    'FAC-NYC',
    'New York Print Center',
    'manufacturing',
    '456 Manhattan Ave',
    'New York',
    'NY',
    'USA',
    '10001',
    'America/New_York',
    true,
    '{"area_sqft": 75000, "capacity_shifts": 3, "certifications": ["ISO9001", "FSC", "G7"]}',
    NOW(),
    NOW()
  );

-- Chinese Facilities
INSERT INTO facilities (id, tenant_id, code, name, facility_type, address, city, state, country, postal_code, timezone, is_active, settings, created_at, updated_at)
VALUES
  (
    'fac-cn-shanghai',
    'tenant-cn-001',
    'FAC-SHA',
    '上海印刷厂',
    'manufacturing',
    '浦东新区工业路888号',
    '上海',
    '上海市',
    'China',
    '200120',
    'Asia/Shanghai',
    true,
    '{"area_sqm": 5000, "capacity_shifts": 3, "certifications": ["ISO9001", "FSC"]}',
    NOW(),
    NOW()
  ),
  (
    'fac-cn-beijing',
    'tenant-cn-001',
    'FAC-BEI',
    '北京印刷中心',
    'manufacturing',
    '朝阳区科技园路666号',
    '北京',
    '北京市',
    'China',
    '100020',
    'Asia/Shanghai',
    true,
    '{"area_sqm": 6000, "capacity_shifts": 2, "certifications": ["ISO9001"]}',
    NOW(),
    NOW()
  );

-- =============================================================================
-- USERS
-- =============================================================================

-- US Users
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, language_preference, timezone, is_active, settings, created_at, updated_at)
VALUES
  (
    'user-us-admin',
    'tenant-us-001',
    'admin@americanprint.com',
    'John',
    'Administrator',
    'admin',
    'en-US',
    'America/New_York',
    true,
    '{"notifications_enabled": true, "dashboard_layout": "executive"}',
    NOW(),
    NOW()
  ),
  (
    'user-us-ops-manager',
    'tenant-us-001',
    'ops.manager@americanprint.com',
    'Sarah',
    'Operations',
    'operations_manager',
    'en-US',
    'America/New_York',
    true,
    '{"notifications_enabled": true, "dashboard_layout": "operations"}',
    NOW(),
    NOW()
  ),
  (
    'user-us-supervisor',
    'tenant-us-001',
    'supervisor@americanprint.com',
    'Mike',
    'Production',
    'supervisor',
    'en-US',
    'America/Toronto',
    true,
    '{"notifications_enabled": true, "dashboard_layout": "production"}',
    NOW(),
    NOW()
  ),
  (
    'user-us-operator1',
    'tenant-us-001',
    'operator1@americanprint.com',
    'Emily',
    'Press',
    'operator',
    'en-US',
    'America/Toronto',
    true,
    '{"notifications_enabled": false, "dashboard_layout": "operator"}',
    NOW(),
    NOW()
  ),
  (
    'user-us-operator2',
    'tenant-us-001',
    'operator2@americanprint.com',
    'David',
    'Finishing',
    'operator',
    'en-US',
    'America/New_York',
    true,
    '{"notifications_enabled": false, "dashboard_layout": "operator"}',
    NOW(),
    NOW()
  );

-- Chinese Users
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, language_preference, timezone, is_active, settings, created_at, updated_at)
VALUES
  (
    'user-cn-admin',
    'tenant-cn-001',
    'admin@shanghai-printing.com',
    '张',
    '经理',
    'admin',
    'zh-CN',
    'Asia/Shanghai',
    true,
    '{"notifications_enabled": true, "dashboard_layout": "executive"}',
    NOW(),
    NOW()
  ),
  (
    'user-cn-ops-manager',
    'tenant-cn-001',
    'ops@shanghai-printing.com',
    '李',
    '运营',
    'operations_manager',
    'zh-CN',
    'Asia/Shanghai',
    true,
    '{"notifications_enabled": true, "dashboard_layout": "operations"}',
    NOW(),
    NOW()
  ),
  (
    'user-cn-supervisor',
    'tenant-cn-001',
    'supervisor@shanghai-printing.com',
    '王',
    '主管',
    'supervisor',
    'zh-CN',
    'Asia/Shanghai',
    true,
    '{"notifications_enabled": true, "dashboard_layout": "production"}',
    NOW(),
    NOW()
  ),
  (
    'user-cn-operator1',
    'tenant-cn-001',
    'operator1@shanghai-printing.com',
    '刘',
    '操作员',
    'operator',
    'zh-CN',
    'Asia/Shanghai',
    true,
    '{"notifications_enabled": false, "dashboard_layout": "operator"}',
    NOW(),
    NOW()
  ),
  (
    'user-cn-operator2',
    'tenant-cn-001',
    'operator2@shanghai-printing.com',
    '陈',
    '技师',
    'operator',
    'zh-CN',
    'Asia/Shanghai',
    true,
    '{"notifications_enabled": false, "dashboard_layout": "operator"}',
    NOW(),
    NOW()
  );

-- =============================================================================
-- CUSTOMERS
-- =============================================================================

-- US Customers
INSERT INTO customers (id, tenant_id, code, name, customer_type, contact_person, email, phone, address, city, state, country, postal_code, credit_limit, payment_terms, is_active, created_at, updated_at)
VALUES
  (
    'cust-us-001',
    'tenant-us-001',
    'CUST-001',
    'Acme Publishing',
    'commercial',
    'Robert Johnson',
    'robert@acmepublishing.com',
    '+1-416-555-0100',
    '789 Publisher Lane',
    'Toronto',
    'ON',
    'Canada',
    'M2B 2B2',
    500000.00,
    'Net 30',
    true,
    NOW(),
    NOW()
  ),
  (
    'cust-us-002',
    'tenant-us-001',
    'CUST-002',
    'Metro Marketing Group',
    'commercial',
    'Lisa Anderson',
    'lisa@metromarketing.com',
    '+1-212-555-0200',
    '321 Madison Ave',
    'New York',
    'NY',
    'USA',
    '10022',
    750000.00,
    'Net 45',
    true,
    NOW(),
    NOW()
  );

-- Chinese Customers
INSERT INTO customers (id, tenant_id, code, name, customer_type, contact_person, email, phone, address, city, state, country, postal_code, credit_limit, payment_terms, is_active, created_at, updated_at)
VALUES
  (
    'cust-cn-001',
    'tenant-cn-001',
    'CUST-001',
    '东方出版社',
    'commercial',
    '赵先生',
    'zhao@dongfangpress.com',
    '+86-21-5555-0100',
    '南京东路123号',
    '上海',
    '上海市',
    'China',
    '200001',
    3000000.00,
    'Net 30',
    true,
    NOW(),
    NOW()
  ),
  (
    'cust-cn-002',
    'tenant-cn-001',
    'CUST-002',
    '华美广告公司',
    'commercial',
    '孙女士',
    'sun@huamei-ad.com',
    '+86-10-6666-0200',
    '建国门外大街88号',
    '北京',
    '北京市',
    'China',
    '100022',
    2000000.00,
    'Net 45',
    true,
    NOW(),
    NOW()
  );

-- =============================================================================
-- MATERIALS
-- =============================================================================

-- US Materials
INSERT INTO materials (id, tenant_id, code, name, category, subcategory, unit_of_measure, unit_cost, reorder_point, reorder_quantity, supplier, is_active, specifications, created_at, updated_at)
VALUES
  (
    'mat-us-001',
    'tenant-us-001',
    'MAT-PAPER-001',
    '80lb Gloss Text',
    'paper',
    'coated',
    'lb',
    0.85,
    5000.0,
    10000.0,
    'International Paper',
    true,
    '{"weight": "80lb", "finish": "gloss", "brightness": 98, "width_inches": 28}',
    NOW(),
    NOW()
  ),
  (
    'mat-us-002',
    'tenant-us-001',
    'MAT-INK-001',
    'Cyan Process Ink',
    'ink',
    'process',
    'lb',
    12.50,
    500.0,
    1000.0,
    'Sun Chemical',
    true,
    '{"color": "cyan", "type": "sheetfed", "viscosity": "medium"}',
    NOW(),
    NOW()
  ),
  (
    'mat-us-003',
    'tenant-us-001',
    'MAT-INK-002',
    'Magenta Process Ink',
    'ink',
    'process',
    'lb',
    12.50,
    500.0,
    1000.0,
    'Sun Chemical',
    true,
    '{"color": "magenta", "type": "sheetfed", "viscosity": "medium"}',
    NOW(),
    NOW()
  );

-- Chinese Materials
INSERT INTO materials (id, tenant_id, code, name, category, subcategory, unit_of_measure, unit_cost, reorder_point, reorder_quantity, supplier, is_active, specifications, created_at, updated_at)
VALUES
  (
    'mat-cn-001',
    'tenant-cn-001',
    'MAT-PAPER-001',
    '157克铜版纸',
    'paper',
    'coated',
    'kg',
    6.80,
    5000.0,
    10000.0,
    '晨鸣纸业',
    true,
    '{"weight": "157gsm", "finish": "gloss", "brightness": 98, "width_mm": 880}',
    NOW(),
    NOW()
  ),
  (
    'mat-cn-002',
    'tenant-cn-001',
    'MAT-INK-001',
    '青色油墨',
    'ink',
    'process',
    'kg',
    85.00,
    200.0,
    500.0,
    '杭华油墨',
    true,
    '{"color": "cyan", "type": "sheetfed", "viscosity": "medium"}',
    NOW(),
    NOW()
  ),
  (
    'mat-cn-003',
    'tenant-cn-001',
    'MAT-INK-002',
    '品红油墨',
    'ink',
    'process',
    'kg',
    85.00,
    200.0,
    500.0,
    '杭华油墨',
    true,
    '{"color": "magenta", "type": "sheetfed", "viscosity": "medium"}',
    NOW(),
    NOW()
  );

-- =============================================================================
-- PRODUCTS
-- =============================================================================

-- US Products
INSERT INTO products (id, tenant_id, code, name, category, description, unit_price, unit_of_measure, is_active, specifications, created_at, updated_at)
VALUES
  (
    'prod-us-001',
    'tenant-us-001',
    'PROD-BR-001',
    '8.5x11 Brochure',
    'brochure',
    'Standard letter-size tri-fold brochure',
    2.50,
    'piece',
    true,
    '{"size": "8.5x11", "pages": 6, "folds": 2, "finish": "gloss"}',
    NOW(),
    NOW()
  ),
  (
    'prod-us-002',
    'tenant-us-001',
    'PROD-BC-001',
    'Business Cards (500)',
    'business_card',
    'Standard business cards, box of 500',
    45.00,
    'box',
    true,
    '{"size": "3.5x2", "quantity": 500, "stock": "14pt", "finish": "matte"}',
    NOW(),
    NOW()
  );

-- Chinese Products
INSERT INTO products (id, tenant_id, code, name, category, description, unit_price, unit_of_measure, is_active, specifications, created_at, updated_at)
VALUES
  (
    'prod-cn-001',
    'tenant-cn-001',
    'PROD-BR-001',
    'A4宣传册',
    'brochure',
    '标准A4三折页宣传册',
    15.00,
    'piece',
    true,
    '{"size": "210x297mm", "pages": 6, "folds": 2, "finish": "gloss"}',
    NOW(),
    NOW()
  ),
  (
    'prod-cn-002',
    'tenant-cn-001',
    'PROD-BC-001',
    '名片(500张)',
    'business_card',
    '标准名片，500张/盒',
    280.00,
    'box',
    true,
    '{"size": "90x54mm", "quantity": 500, "stock": "300gsm", "finish": "matte"}',
    NOW(),
    NOW()
  );

-- =============================================================================
-- WORK CENTERS
-- =============================================================================

-- US Work Centers
INSERT INTO work_centers (id, tenant_id, facility_id, code, name, work_center_type, department, capacity_per_hour, utilization_target, cost_per_hour, is_active, specifications, created_at, updated_at)
VALUES
  (
    'wc-us-001',
    'tenant-us-001',
    'fac-us-toronto',
    'WC-PRESS-01',
    'Heidelberg Press #1',
    'press',
    'pressroom',
    5000.0,
    85.0,
    150.00,
    true,
    '{"make": "Heidelberg", "model": "Speedmaster XL 106", "colors": 6, "max_sheet_size": "29x41"}',
    NOW(),
    NOW()
  ),
  (
    'wc-us-002',
    'tenant-us-001',
    'fac-us-toronto',
    'WC-PRESS-02',
    'Komori Press #1',
    'press',
    'pressroom',
    4500.0,
    85.0,
    140.00,
    true,
    '{"make": "Komori", "model": "Lithrone G40", "colors": 5, "max_sheet_size": "28x40"}',
    NOW(),
    NOW()
  ),
  (
    'wc-us-003',
    'tenant-us-001',
    'fac-us-newyork',
    'WC-FOLD-01',
    'Folder #1',
    'finishing',
    'bindery',
    10000.0,
    90.0,
    75.00,
    true,
    '{"make": "Stahl", "model": "Ti52", "max_sheet_size": "29x41", "folding_patterns": 50}',
    NOW(),
    NOW()
  );

-- Chinese Work Centers
INSERT INTO work_centers (id, tenant_id, facility_id, code, name, work_center_type, department, capacity_per_hour, utilization_target, cost_per_hour, is_active, specifications, created_at, updated_at)
VALUES
  (
    'wc-cn-001',
    'tenant-cn-001',
    'fac-cn-shanghai',
    'WC-PRESS-01',
    '海德堡印刷机#1',
    'press',
    'pressroom',
    5000.0,
    85.0,
    950.00,
    true,
    '{"make": "Heidelberg", "model": "Speedmaster XL 106", "colors": 6, "max_sheet_size": "740x1050mm"}',
    NOW(),
    NOW()
  ),
  (
    'wc-cn-002',
    'tenant-cn-001',
    'fac-cn-shanghai',
    'WC-PRESS-02',
    '小森印刷机#1',
    'press',
    'pressroom',
    4500.0,
    85.0,
    880.00,
    true,
    '{"make": "Komori", "model": "Lithrone G40", "colors": 5, "max_sheet_size": "720x1020mm"}',
    NOW(),
    NOW()
  ),
  (
    'wc-cn-003',
    'tenant-cn-001',
    'fac-cn-beijing',
    'WC-FOLD-01',
    '折页机#1',
    'finishing',
    'bindery',
    10000.0,
    90.0,
    480.00,
    true,
    '{"make": "Stahl", "model": "Ti52", "max_sheet_size": "740x1050mm", "folding_patterns": 50}',
    NOW(),
    NOW()
  );

-- =============================================================================
-- PRODUCTION ORDERS
-- =============================================================================

-- US Production Orders
INSERT INTO production_orders (id, tenant_id, facility_id, customer_id, product_id, order_number, order_date, due_date, quantity_ordered, quantity_completed, priority, status, notes, created_at, updated_at)
VALUES
  (
    'po-us-001',
    'tenant-us-001',
    'fac-us-toronto',
    'cust-us-001',
    'prod-us-001',
    'PO-2025-001',
    '2025-12-10',
    '2025-12-20',
    5000,
    3500,
    'high',
    'in_progress',
    'Rush order for year-end marketing campaign',
    NOW(),
    NOW()
  ),
  (
    'po-us-002',
    'tenant-us-001',
    'fac-us-newyork',
    'cust-us-002',
    'prod-us-002',
    'PO-2025-002',
    '2025-12-12',
    '2025-12-22',
    10000,
    0,
    'normal',
    'scheduled',
    'Business cards for new employees',
    NOW(),
    NOW()
  ),
  (
    'po-us-003',
    'tenant-us-001',
    'fac-us-toronto',
    'cust-us-001',
    'prod-us-001',
    'PO-2025-003',
    '2025-12-15',
    '2025-12-30',
    2500,
    2500,
    'normal',
    'completed',
    'Completed ahead of schedule',
    NOW(),
    NOW()
  );

-- Chinese Production Orders
INSERT INTO production_orders (id, tenant_id, facility_id, customer_id, product_id, order_number, order_date, due_date, quantity_ordered, quantity_completed, priority, status, notes, created_at, updated_at)
VALUES
  (
    'po-cn-001',
    'tenant-cn-001',
    'fac-cn-shanghai',
    'cust-cn-001',
    'prod-cn-001',
    'PO-2025-001',
    '2025-12-10',
    '2025-12-20',
    8000,
    5600,
    'high',
    'in_progress',
    '年终营销活动紧急订单',
    NOW(),
    NOW()
  ),
  (
    'po-cn-002',
    'tenant-cn-001',
    'fac-cn-beijing',
    'cust-cn-002',
    'prod-cn-002',
    'PO-2025-002',
    '2025-12-12',
    '2025-12-22',
    15000,
    0,
    'normal',
    'scheduled',
    '新员工名片',
    NOW(),
    NOW()
  ),
  (
    'po-cn-003',
    'tenant-cn-001',
    'fac-cn-shanghai',
    'cust-cn-001',
    'prod-cn-001',
    'PO-2025-003',
    '2025-12-15',
    '2025-12-30',
    4000,
    4000,
    'normal',
    'completed',
    '提前完成',
    NOW(),
    NOW()
  );

-- =============================================================================
-- PRODUCTION RUNS
-- =============================================================================

-- US Production Runs
INSERT INTO prod_runs (id, tenant_id, facility_id, production_order_id, work_center_id, operator_id, run_number, start_time, end_time, status, quantity_target, quantity_good, quantity_waste, waste_reason, efficiency_percent, notes, created_at, updated_at)
VALUES
  (
    'run-us-001',
    'tenant-us-001',
    'fac-us-toronto',
    'po-us-001',
    'wc-us-001',
    'user-us-operator1',
    'RUN-001-01',
    '2025-12-16 08:00:00',
    '2025-12-16 16:00:00',
    'completed',
    2000,
    1950,
    50,
    'Setup waste and color matching',
    97.5,
    'Good run, minimal waste',
    NOW(),
    NOW()
  ),
  (
    'run-us-002',
    'tenant-us-001',
    'fac-us-toronto',
    'po-us-001',
    'wc-us-001',
    'user-us-operator1',
    'RUN-001-02',
    '2025-12-17 08:00:00',
    NULL,
    'in_progress',
    1500,
    1100,
    30,
    'Setup waste',
    NULL,
    'Currently running',
    NOW(),
    NOW()
  );

-- Chinese Production Runs
INSERT INTO prod_runs (id, tenant_id, facility_id, production_order_id, work_center_id, operator_id, run_number, start_time, end_time, status, quantity_target, quantity_good, quantity_waste, waste_reason, efficiency_percent, notes, created_at, updated_at)
VALUES
  (
    'run-cn-001',
    'tenant-cn-001',
    'fac-cn-shanghai',
    'po-cn-001',
    'wc-cn-001',
    'user-cn-operator1',
    'RUN-001-01',
    '2025-12-16 08:00:00',
    '2025-12-16 16:00:00',
    'completed',
    3000,
    2920,
    80,
    '调试损耗和颜色匹配',
    97.3,
    '运行良好，损耗最小',
    NOW(),
    NOW()
  ),
  (
    'run-cn-002',
    'tenant-cn-001',
    'fac-cn-shanghai',
    'po-cn-001',
    'wc-cn-001',
    'user-cn-operator1',
    'RUN-001-02',
    '2025-12-17 08:00:00',
    NULL,
    'in_progress',
    2600,
    1800,
    45,
    '调试损耗',
    NULL,
    '正在运行中',
    NOW(),
    NOW()
  );

-- =============================================================================
-- KPI DATA (for dashboard testing)
-- =============================================================================

-- Insert sample KPI metrics for the last 30 days
-- This will populate dashboards with realistic data

-- Note: Actual KPI tables depend on your schema
-- Add INSERT statements here based on your monitoring tables structure

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Test seed data loaded successfully';
  RAISE NOTICE '  - 2 Tenants (English + Chinese)';
  RAISE NOTICE '  - 4 Facilities (Toronto, New York, Shanghai, Beijing)';
  RAISE NOTICE '  - 10 Users (5 per tenant)';
  RAISE NOTICE '  - 4 Customers (2 per tenant)';
  RAISE NOTICE '  - 6 Materials (3 per tenant)';
  RAISE NOTICE '  - 4 Products (2 per tenant)';
  RAISE NOTICE '  - 6 Work Centers (3 per tenant)';
  RAISE NOTICE '  - 6 Production Orders (3 per tenant)';
  RAISE NOTICE '  - 4 Production Runs (2 per tenant)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Accounts:';
  RAISE NOTICE '  English: admin@americanprint.com (password: test123)';
  RAISE NOTICE '  Chinese: admin@shanghai-printing.com (password: test123)';
END $$;
