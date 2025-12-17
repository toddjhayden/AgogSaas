# AgogSaaS Test Environment - Testing Guide

## Overview

This guide provides comprehensive test scenarios for both **English** and **Chinese** language testers to validate the AgogSaaS Print Industry ERP system.

## Test Environment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEST ENVIRONMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EDGE (Toronto Facility)                                        │
│    - Backend: http://localhost:5001/graphql                     │
│    - Database: postgres-edge:5432                               │
│    - NATS: nats-edge:5222                                       │
│                                                                  │
│  REGION 1 (US-EAST - English Testing)                          │
│    - Frontend: http://localhost:6080                            │
│    - Backend: http://localhost:6001/graphql                     │
│    - Database: postgres-region1:6432                            │
│    - Redis: redis-region1:6379                                  │
│    - NATS: nats-region1:6222                                    │
│                                                                  │
│  REGION 2 (EU-CENTRAL - Chinese Testing)                       │
│    - Frontend: http://localhost:7080                            │
│    - Backend: http://localhost:7001/graphql                     │
│    - Database: postgres-region2:7432                            │
│    - Redis: redis-region2:7379                                  │
│    - NATS: nats-region2:7222                                    │
│                                                                  │
│  MONITORING (Shared)                                            │
│    - Prometheus: http://localhost:9090                          │
│    - Grafana: http://localhost:3000 (admin/changeme)           │
│    - Alertmanager: http://localhost:9093                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

### 1. Start the Test Environment

**Windows:**
```batch
cd deployment\test
build-and-start.bat
```

**Linux/Mac:**
```bash
cd deployment/test
./build-and-start.sh
```

Wait 1-2 minutes for all services to initialize.

### 2. Verify Services are Running

```bash
./health-check.sh  # Linux/Mac
health-check.bat   # Windows
```

### 3. Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend (English) | http://localhost:6080 | admin@americanprint.com / test123 |
| Frontend (Chinese) | http://localhost:7080 | admin@shanghai-printing.com / test123 |
| GraphQL Playground (Region 1) | http://localhost:6001/graphql | - |
| GraphQL Playground (Region 2) | http://localhost:7001/graphql | - |
| Grafana | http://localhost:3000 | admin / changeme |

---

## English Testing Scenarios (American Print Co.)

### Test Account
- **Email:** admin@americanprint.com
- **Password:** test123
- **Tenant:** American Print Co. (PRINT-US)
- **Language:** English (en-US)
- **Region:** US-EAST
- **Facilities:** Toronto, New York

### Scenario 1: Login and Navigation

**Objective:** Verify login and basic navigation

**Steps:**
1. Open http://localhost:6080 in your browser
2. Enter credentials:
   - Email: `admin@americanprint.com`
   - Password: `test123`
3. Click "Sign In"
4. Verify you land on the Executive Dashboard
5. Check that all navigation menu items are visible:
   - Executive Dashboard
   - Operations Dashboard
   - Production Dashboard
   - WMS Dashboard
   - Finance Dashboard
   - Sales Dashboard
   - KPI Explorer

**Expected Results:**
- Login successful
- User name "John Administrator" displayed in header
- Tenant name "American Print Co." visible
- All menu items in English
- No console errors

---

### Scenario 2: Executive Dashboard - KPI Overview

**Objective:** Verify Executive Dashboard displays key metrics

**Steps:**
1. Navigate to "Executive Dashboard" (if not already there)
2. Verify the following sections are visible:
   - Revenue metrics (Today, This Month, This Quarter)
   - Top 5 KPI cards
   - Revenue trend chart
   - Production efficiency chart
   - KPI categories grid
3. Check that all numbers display correctly with $ currency
4. Verify charts render without errors

**Expected Results:**
- All KPI cards display numeric values
- Currency formatted as USD ($)
- Charts render and are interactive
- Date formats show as MM/DD/YYYY
- Time displays in 12-hour format (AM/PM)

**Screenshot Required:** Yes

---

### Scenario 3: Operations Dashboard - Production Monitoring

**Objective:** Monitor active production runs and work centers

**Steps:**
1. Navigate to "Operations Dashboard"
2. Select facility: "Toronto Print Facility" from dropdown
3. Verify sections:
   - Active Production Runs table
   - Work Center Status cards
   - Material Inventory levels
   - Alerts/Notifications panel
4. Click on an active production run to view details
5. Check "Heidelberg Press #1" work center status

**Expected Results:**
- Production runs show real-time data:
  - Run number: RUN-001-02
  - Status: "In Progress"
  - Operator: Emily Press
  - Target: 1,500
  - Good: 1,100
  - Waste: 30
- Work center cards show utilization percentage
- Material inventory shows stock levels in imperial units (lb, sheets)
- All text in English

**Screenshot Required:** Yes

---

### Scenario 4: KPI Explorer - Search and Filter

**Objective:** Search and explore 119 KPIs with filtering

**Steps:**
1. Navigate to "KPI Explorer"
2. Verify the KPI count badge shows "119 KPIs"
3. Use search box to search: "Material Utilization"
4. Verify search results appear
5. Filter by category: "Operations"
6. Filter by subcategory: "Production"
7. Click on a KPI tile to view details:
   - KPI name
   - Current value
   - Target
   - Trend chart
   - Historical data
8. Click "Add to Dashboard" button

**Expected Results:**
- Search returns relevant KPIs instantly
- Filters work correctly
- KPI detail modal displays:
  - Name in English
  - Unit of measure
  - Current value
  - Target value
  - 7-day trend chart
  - Threshold indicators (red/yellow/green)
- "Add to Dashboard" shows success message

**Screenshot Required:** Yes (KPI detail modal)

---

### Scenario 5: Production Dashboard - Create Production Order

**Objective:** Create a new production order

**Steps:**
1. Navigate to "Production Dashboard"
2. Click "Create Production Order" button
3. Fill in form:
   - Customer: Acme Publishing
   - Product: 8.5x11 Brochure
   - Quantity: 3000
   - Due Date: [Select date 10 days from now]
   - Priority: High
   - Facility: Toronto Print Facility
   - Notes: "Test order for QA"
4. Click "Create Order"
5. Verify order appears in production orders table

**Expected Results:**
- Form validation works (required fields)
- Date picker shows MM/DD/YYYY format
- Dropdowns populate with correct data
- Order created successfully
- New order shows in table with status "Scheduled"
- Order number auto-generated (e.g., PO-2025-004)
- Success notification appears

**Screenshot Required:** Yes (created order in table)

---

### Scenario 6: WMS Dashboard - Inventory Management

**Objective:** View and manage warehouse inventory

**Steps:**
1. Navigate to "WMS Dashboard"
2. Select facility: "Toronto Print Facility"
3. Verify sections:
   - Material Inventory table
   - Low Stock Alerts
   - Receiving Queue
   - Shipping Queue
4. Find material: "80lb Gloss Text"
5. Check current stock level
6. Verify reorder point indicator
7. Click "Receive Material" button to simulate receiving

**Expected Results:**
- Inventory table shows:
  - Material code: MAT-PAPER-001
  - Material name: 80lb Gloss Text
  - Current stock in imperial units (lb)
  - Reorder point
  - Status indicator (green/yellow/red)
- Low stock alerts highlight materials below reorder point
- Receive material form works correctly

**Screenshot Required:** Yes

---

### Scenario 7: Finance Dashboard - Financial Overview

**Objective:** View financial metrics and reports

**Steps:**
1. Navigate to "Finance Dashboard"
2. Verify sections:
   - Revenue summary (MTD, QTD, YTD)
   - Accounts Receivable aging
   - Top customers by revenue
   - Profitability chart
3. Check currency format (USD $)
4. Verify all numbers display correctly
5. Click on "View Detailed Report" link

**Expected Results:**
- All currency values show as USD ($)
- Large numbers formatted with commas (e.g., $123,456.78)
- Charts render correctly
- Date range selector works
- Aging buckets show: 0-30, 31-60, 61-90, 90+ days
- Export button present

**Screenshot Required:** Yes

---

### Scenario 8: Language Switcher - Toggle to Chinese

**Objective:** Verify language switching works

**Steps:**
1. From any dashboard, click language selector in header
2. Select "中文 (Chinese)" from dropdown
3. Verify page reloads with Chinese interface
4. Navigate through 2-3 dashboards
5. Switch back to English

**Expected Results:**
- Language switches immediately
- All UI text translates to Chinese
- Numbers and dates remain formatted correctly
- Charts and graphs maintain labels
- Switch back to English works smoothly
- User preference persists on page refresh

**Screenshot Required:** Yes (Chinese interface)

---

### Scenario 9: Facility Switching

**Objective:** Switch between facilities and verify data updates

**Steps:**
1. Navigate to Operations Dashboard
2. Current facility: "Toronto Print Facility"
3. Click facility selector in header
4. Select "New York Print Center"
5. Verify dashboard updates with New York data
6. Check that production runs and work centers update
7. Switch back to Toronto

**Expected Results:**
- Facility dropdown shows both facilities:
  - Toronto Print Facility (FAC-TOR)
  - New York Print Center (FAC-NYC)
- Data refreshes when facility changes
- Production runs filter to selected facility
- Work centers show only those in selected facility
- Breadcrumb/header shows current facility

---

### Scenario 10: Real-Time Updates (WebSocket)

**Objective:** Verify real-time data updates

**Steps:**
1. Open Operations Dashboard in Chrome
2. Open same Operations Dashboard in Firefox (same account)
3. In Chrome: Start a production run or update quantity
4. Watch Firefox dashboard for automatic update
5. Verify notification appears
6. Check that charts update without refresh

**Expected Results:**
- Firefox dashboard updates automatically (within 2-3 seconds)
- No page refresh required
- Notification badge shows new activity
- Charts and tables update in real-time
- WebSocket connection indicator shows "Connected" (green dot)

---

## Chinese Testing Scenarios (上海印刷公司)

### 测试账户 / Test Account
- **电子邮件 / Email:** admin@shanghai-printing.com
- **密码 / Password:** test123
- **租户 / Tenant:** 上海印刷公司 (PRINT-CN)
- **语言 / Language:** 中文 (zh-CN)
- **区域 / Region:** APAC
- **设施 / Facilities:** 上海, 北京

---

### 场景 1: 登录和导航 / Scenario 1: Login and Navigation

**目标 / Objective:** 验证登录和基本导航功能

**步骤 / Steps:**
1. 在浏览器中打开 http://localhost:7080
2. 输入凭据:
   - 电子邮件: `admin@shanghai-printing.com`
   - 密码: `test123`
3. 点击"登录"
4. 验证进入执行仪表板
5. 检查所有导航菜单项均可见:
   - 执行仪表板
   - 运营仪表板
   - 生产仪表板
   - 仓储仪表板
   - 财务仪表板
   - 销售仪表板
   - KPI浏览器

**预期结果 / Expected Results:**
- 登录成功
- 用户名"张 经理"显示在标题中
- 租户名称"上海印刷公司"可见
- 所有菜单项均为中文
- 控制台无错误

**需要截图 / Screenshot Required:** 是

---

### 场景 2: 执行仪表板 - KPI概览 / Scenario 2: Executive Dashboard - KPI Overview

**目标 / Objective:** 验证执行仪表板显示关键指标

**步骤 / Steps:**
1. 导航至"执行仪表板"（如果尚未进入）
2. 验证以下部分可见:
   - 收入指标（今日、本月、本季度）
   - 前5个KPI卡片
   - 收入趋势图
   - 生产效率图
   - KPI类别网格
3. 检查所有数字是否以¥货币正确显示
4. 验证图表渲染无误

**预期结果 / Expected Results:**
- 所有KPI卡片显示数值
- 货币格式为人民币 (¥)
- 图表渲染且可交互
- 日期格式显示为YYYY-MM-DD
- 时间以24小时制显示
- 所有文本为中文

**需要截图 / Screenshot Required:** 是

---

### 场景 3: 运营仪表板 - 生产监控 / Scenario 3: Operations Dashboard - Production Monitoring

**目标 / Objective:** 监控活动生产运行和工作中心

**步骤 / Steps:**
1. 导航至"运营仪表板"
2. 从下拉列表选择设施: "上海印刷厂"
3. 验证部分:
   - 活动生产运行表
   - 工作中心状态卡
   - 材料库存水平
   - 警报/通知面板
4. 点击活动生产运行查看详情
5. 查看"海德堡印刷机#1"工作中心状态

**预期结果 / Expected Results:**
- 生产运行显示实时数据:
  - 运行编号: RUN-001-02
  - 状态: "进行中"
  - 操作员: 刘 操作员
  - 目标: 2,600
  - 良品: 1,800
  - 废品: 45
- 工作中心卡显示利用率百分比
- 材料库存显示公制单位库存水平 (kg, 张)
- 所有文本为中文

**需要截图 / Screenshot Required:** 是

---

### 场景 4: KPI浏览器 - 搜索和过滤 / Scenario 4: KPI Explorer - Search and Filter

**目标 / Objective:** 使用过滤功能搜索和探索119个KPI

**步骤 / Steps:**
1. 导航至"KPI浏览器"
2. 验证KPI计数徽章显示"119个KPI"
3. 使用搜索框搜索: "材料利用率"
4. 验证搜索结果出现
5. 按类别过滤: "运营"
6. 按子类别过滤: "生产"
7. 点击KPI磁贴查看详情:
   - KPI名称
   - 当前值
   - 目标
   - 趋势图
   - 历史数据
8. 点击"添加到仪表板"按钮

**预期结果 / Expected Results:**
- 搜索立即返回相关KPI
- 过滤器正常工作
- KPI详细模态框显示:
  - 中文名称
  - 计量单位
  - 当前值
  - 目标值
  - 7天趋势图
  - 阈值指示器（红/黄/绿）
- "添加到仪表板"显示成功消息
- 所有UI元素为中文

**需要截图 / Screenshot Required:** 是（KPI详细模态框）

---

### 场景 5: 生产仪表板 - 创建生产订单 / Scenario 5: Production Dashboard - Create Production Order

**目标 / Objective:** 创建新的生产订单

**步骤 / Steps:**
1. 导航至"生产仪表板"
2. 点击"创建生产订单"按钮
3. 填写表单:
   - 客户: 东方出版社
   - 产品: A4宣传册
   - 数量: 5000
   - 截止日期: [选择距今10天的日期]
   - 优先级: 高
   - 设施: 上海印刷厂
   - 备注: "测试订单"
4. 点击"创建订单"
5. 验证订单出现在生产订单表中

**预期结果 / Expected Results:**
- 表单验证工作（必填字段）
- 日期选择器显示YYYY-MM-DD格式
- 下拉列表填充正确数据
- 订单创建成功
- 新订单在表中显示，状态为"已计划"
- 订单号自动生成（例如，PO-2025-004）
- 出现成功通知
- 所有表单标签为中文

**需要截图 / Screenshot Required:** 是（表中创建的订单）

---

### 场景 6: 仓储仪表板 - 库存管理 / Scenario 6: WMS Dashboard - Inventory Management

**目标 / Objective:** 查看和管理仓库库存

**步骤 / Steps:**
1. 导航至"仓储仪表板"
2. 选择设施: "上海印刷厂"
3. 验证部分:
   - 材料库存表
   - 低库存警报
   - 接收队列
   - 发货队列
4. 查找材料: "157克铜版纸"
5. 检查当前库存水平
6. 验证再订购点指示器
7. 点击"接收材料"按钮模拟接收

**预期结果 / Expected Results:**
- 库存表显示:
  - 材料代码: MAT-PAPER-001
  - 材料名称: 157克铜版纸
  - 当前库存（公制单位：kg）
  - 再订购点
  - 状态指示器（绿/黄/红）
- 低库存警报突出显示低于再订购点的材料
- 接收材料表单正常工作
- 所有文本为中文

**需要截图 / Screenshot Required:** 是

---

### 场景 7: 财务仪表板 - 财务概览 / Scenario 7: Finance Dashboard - Financial Overview

**目标 / Objective:** 查看财务指标和报告

**步骤 / Steps:**
1. 导航至"财务仪表板"
2. 验证部分:
   - 收入摘要（月初至今、季度初至今、年初至今）
   - 应收账款账龄
   - 按收入排名的客户
   - 盈利能力图表
3. 检查货币格式（人民币¥）
4. 验证所有数字正确显示
5. 点击"查看详细报告"链接

**预期结果 / Expected Results:**
- 所有货币值显示为人民币 (¥)
- 大数字用逗号格式化（例如，¥123,456.78）
- 图表正确渲染
- 日期范围选择器工作
- 账龄桶显示: 0-30、31-60、61-90、90+天
- 导出按钮存在
- 所有标签为中文

**需要截图 / Screenshot Required:** 是

---

### 场景 8: 语言切换器 - 切换到英语 / Scenario 8: Language Switcher - Toggle to English

**目标 / Objective:** 验证语言切换功能

**步骤 / Steps:**
1. 从任何仪表板，点击标题中的语言选择器
2. 从下拉列表选择"English"
3. 验证页面以英语界面重新加载
4. 浏览2-3个仪表板
5. 切换回中文

**预期结果 / Expected Results:**
- 语言立即切换
- 所有UI文本翻译为英语
- 数字和日期格式保持正确
- 图表和图形保持标签
- 切换回中文顺利工作
- 页面刷新时用户偏好保持

**需要截图 / Screenshot Required:** 是（英语界面）

---

### 场景 9: 设施切换 / Scenario 9: Facility Switching

**目标 / Objective:** 在设施之间切换并验证数据更新

**步骤 / Steps:**
1. 导航至运营仪表板
2. 当前设施: "上海印刷厂"
3. 点击标题中的设施选择器
4. 选择"北京印刷中心"
5. 验证仪表板使用北京数据更新
6. 检查生产运行和工作中心是否更新
7. 切换回上海

**预期结果 / Expected Results:**
- 设施下拉列表显示两个设施:
  - 上海印刷厂 (FAC-SHA)
  - 北京印刷中心 (FAC-BEI)
- 设施更改时数据刷新
- 生产运行过滤到所选设施
- 工作中心仅显示所选设施中的工作中心
- 面包屑/标题显示当前设施
- 所有文本为中文

---

### 场景 10: 实时更新 (WebSocket) / Scenario 10: Real-Time Updates

**目标 / Objective:** 验证实时数据更新

**步骤 / Steps:**
1. 在Chrome中打开运营仪表板
2. 在Firefox中打开相同的运营仪表板（相同账户）
3. 在Chrome中: 启动生产运行或更新数量
4. 观察Firefox仪表板是否自动更新
5. 验证通知出现
6. 检查图表是否在不刷新的情况下更新

**预期结果 / Expected Results:**
- Firefox仪表板自动更新（2-3秒内）
- 无需页面刷新
- 通知徽章显示新活动
- 图表和表格实时更新
- WebSocket连接指示器显示"已连接"（绿点）
- 所有通知为中文

---

## Cross-Region Testing Scenarios

### Scenario 11: Edge to Regional Sync

**Objective:** Verify edge computer syncs data to regional cloud

**Steps:**
1. Access Edge backend GraphQL: http://localhost:5001/graphql
2. Create a production run mutation at edge
3. Wait 30-60 seconds for sync
4. Check Region 1 backend: http://localhost:6001/graphql
5. Query for the same production run
6. Verify data appears in Region 1

**Expected Results:**
- Data created at edge appears in regional cloud
- Sync happens automatically within 60 seconds
- Data integrity maintained (no corruption)
- Sync status visible in monitoring dashboard

---

### Scenario 12: Multi-Region Data Consistency

**Objective:** Verify data consistency across regions

**Steps:**
1. Login to Region 1 frontend (English)
2. Create a customer: "Test Customer ABC"
3. Wait 30 seconds
4. Login to Region 2 frontend (Chinese)
5. Search for customer "Test Customer ABC"
6. Verify customer appears in Region 2

**Expected Results:**
- Customer syncs across regions
- Data appears consistently
- No data loss or corruption
- Sync latency < 60 seconds

---

## Monitoring and Observability Testing

### Scenario 13: Grafana Dashboards

**Objective:** Verify monitoring dashboards work

**Steps:**
1. Access Grafana: http://localhost:3000
2. Login: admin / changeme
3. Navigate to dashboards:
   - AgogSaaS Overview
   - AgogSaaS API
   - AgogSaaS Database
   - AgogSaaS Edge
   - AgogSaaS Business
4. Verify each dashboard shows data
5. Check time range selector works
6. Verify drill-down functionality

**Expected Results:**
- All dashboards load successfully
- Metrics display real data (not N/A)
- Graphs render correctly
- Time range changes update graphs
- Drill-down links work
- No error panels

**Screenshot Required:** Yes (each dashboard)

---

### Scenario 14: Prometheus Metrics

**Objective:** Verify Prometheus is collecting metrics

**Steps:**
1. Access Prometheus: http://localhost:9090
2. Query: `up{job="backend"}`
3. Verify all backend instances show "1" (up)
4. Query: `postgres_up`
5. Verify all PostgreSQL instances are up
6. Query: `http_requests_total`
7. Verify request counts are increasing
8. Check Targets page (Status > Targets)
9. Verify all targets are "UP"

**Expected Results:**
- All backend services show as "up"
- All database services show as "up"
- Metrics are being collected
- No targets in "DOWN" state
- Query results update in real-time

---

## Performance Testing

### Scenario 15: Load Testing

**Objective:** Verify system handles concurrent users

**Steps:**
1. Open 5 browser tabs
2. Login to Region 1 in all tabs (same or different users)
3. Navigate to different dashboards in each tab
4. Perform actions simultaneously:
   - Create production order
   - Search KPIs
   - View production runs
   - Update inventory
   - Generate reports
5. Monitor system response time
6. Check Grafana for CPU/memory usage

**Expected Results:**
- All actions complete successfully
- Response time < 3 seconds for most operations
- No errors or timeouts
- CPU usage stays < 80%
- Memory usage stays < 4GB per backend
- Database connections don't exhaust

---

## Error Handling and Edge Cases

### Scenario 16: Offline Edge Operation

**Objective:** Verify edge continues working when regional cloud is offline

**Steps:**
1. Stop regional backend:
   ```bash
   docker stop test-backend-region1
   ```
2. Access Edge backend: http://localhost:5001/graphql
3. Create production runs, update inventory, etc.
4. Verify edge operates normally
5. Restart regional backend:
   ```bash
   docker start test-backend-region1
   ```
6. Wait 60 seconds
7. Verify edge syncs queued data to regional

**Expected Results:**
- Edge continues operating when regional is offline
- No data loss
- Operations queue for sync
- When regional comes back online, sync resumes
- All queued data syncs successfully

---

### Scenario 17: Invalid Input Handling

**Objective:** Verify proper error handling for invalid inputs

**Steps:**
1. Try to create production order with invalid data:
   - Negative quantity
   - Past due date
   - Missing required fields
2. Try to update production run with invalid data:
   - Waste > quantity produced
   - End time before start time
3. Try to create customer with duplicate email
4. Try to delete material that's in use

**Expected Results:**
- Form validation prevents submission
- Clear error messages displayed
- Error messages in appropriate language
- No system crashes
- Database constraints enforced
- GraphQL returns proper error responses

---

## Reporting Test Results

### Test Result Template

For each scenario, record:

```markdown
## Scenario X: [Scenario Name]

**Tester:** [Your Name]
**Date:** [Test Date]
**Environment:** [Region 1 / Region 2 / Edge]
**Browser:** [Chrome / Firefox / Safari / Edge]
**OS:** [Windows / Mac / Linux]

**Result:** [PASS / FAIL / BLOCKED]

**Actual Results:**
[Describe what happened]

**Screenshots:**
[Attach screenshots]

**Issues Found:**
1. [Description of issue]
   - Severity: [Critical / High / Medium / Low]
   - Steps to reproduce
   - Expected vs Actual

**Notes:**
[Any additional observations]
```

### Severity Definitions

- **Critical:** System crash, data loss, security vulnerability, blocks testing
- **High:** Major functionality broken, no workaround
- **Medium:** Functionality impaired, workaround exists
- **Low:** Cosmetic issue, minor inconvenience

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker info

# View service logs
docker-compose -f docker-compose.test.yml logs [service-name]

# Restart specific service
docker-compose -f docker-compose.test.yml restart [service-name]

# Full restart
docker-compose -f docker-compose.test.yml down
docker-compose -f docker-compose.test.yml up -d
```

### Can't Access Frontend

1. Check if container is running:
   ```bash
   docker ps | grep frontend
   ```

2. Check container logs:
   ```bash
   docker logs test-frontend-region1
   ```

3. Verify port not in use:
   ```bash
   netstat -ano | findstr :6080  # Windows
   lsof -i :6080                  # Mac/Linux
   ```

### Database Connection Issues

1. Check PostgreSQL is healthy:
   ```bash
   docker exec test-postgres-region1 pg_isready
   ```

2. Check migrations ran:
   ```bash
   docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -c "\dt"
   ```

3. Manually run migrations:
   ```bash
   docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/V1.0.0__enable_extensions.sql
   ```

### Seed Data Not Loading

Manually load seed data:

```bash
# Region 1
docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql

# Region 2
docker exec test-postgres-region2 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql
```

Or via host:

```bash
# Region 1
PGPASSWORD=region1_password_test psql -h localhost -p 6432 -U agogsaas_user -d agogsaas -f Implementation/print-industry-erp/backend/seeds/test-data.sql

# Region 2
PGPASSWORD=region2_password_test psql -h localhost -p 7432 -U agogsaas_user -d agogsaas -f Implementation/print-industry-erp/backend/seeds/test-data.sql
```

---

## Cleanup

### Stop Environment (Keep Data)

```bash
docker-compose -f docker-compose.test.yml down
```

### Stop and Remove All Data (Fresh Start)

```bash
docker-compose -f docker-compose.test.yml down -v
```

### Remove Docker Images

```bash
docker rmi agogsaas/backend:test agogsaas/frontend:test
```

---

## Contact

For issues or questions:
- **Email:** todd@agogsaas.com
- **Slack:** #agogsaas-testing
- **GitHub Issues:** https://github.com/agogsaas/agogsaas/issues

---

**Version:** 1.0.0
**Last Updated:** 2025-12-17
**Author:** Containerization Specialist
