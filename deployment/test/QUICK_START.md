# AgogSaaS Test Environment - Quick Start Card

## 1️⃣ Start Everything (2 minutes)

```bash
cd D:\GitHub\agogsaas\deployment\test
build-and-start.bat
```

Wait for: `✓ Test environment is ready!`

---

## 2️⃣ Test English

**Open:** http://localhost:6080

**Login:**
- Email: `admin@americanprint.com`
- Password: `test123`

**Check:**
- Executive Dashboard loads
- Can see production runs
- KPI Explorer has 119 KPIs
- Language switcher works

---

## 3️⃣ Test Chinese

**Open:** http://localhost:7080

**Login:**
- Email: `admin@shanghai-printing.com`
- Password: `test123`

**Check:**
- UI is in Chinese (中文)
- Executive Dashboard loads (执行仪表板)
- Can see production runs (生产运行)
- KPI Explorer works (KPI浏览器)
- Language switcher works

---

## 4️⃣ Monitor Everything

**Grafana:** http://localhost:3000
- Login: `admin` / `changeme`
- Check dashboards have data

**Prometheus:** http://localhost:9090
- Check targets are UP

---

## 5️⃣ Health Check

```bash
health-check.bat
```

Should see all ✓ green checkmarks.

---

## 🆘 If Something Breaks

### View Logs
```bash
docker-compose -f docker-compose.test.yml logs -f [service-name]
```

### Restart Everything
```bash
docker-compose -f docker-compose.test.yml restart
```

### Full Reset
```bash
docker-compose -f docker-compose.test.yml down -v
build-and-start.bat
```

---

## 📊 What You Get

### Services Running
- 1 Edge Computer (Toronto)
- 2 Regional Clouds (US-EAST, EU-CENTRAL)
- 3 PostgreSQL databases
- 2 Redis instances
- 3 NATS message queues
- Prometheus + Grafana + Alertmanager

### Test Data
- 2 Tenants (English + Chinese)
- 4 Facilities
- 10 Users
- 6 Production Orders
- 4 Active Production Runs

### Features
- 7 Dashboards
- 119 KPIs
- Bilingual (English ↔ Chinese)
- Real-time updates
- GraphQL API
- Monitoring stack

---

## 🎯 Key URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| English UI | http://localhost:6080 | admin@americanprint.com / test123 |
| Chinese UI | http://localhost:7080 | admin@shanghai-printing.com / test123 |
| Grafana | http://localhost:3000 | admin / changeme |
| Prometheus | http://localhost:9090 | - |

---

## 📱 Port Reference

- **5xxx** - Edge
- **6xxx** - Region 1 (English)
- **7xxx** - Region 2 (Chinese)
- **9xxx, 3000** - Monitoring

---

## ✅ Test Checklist

### English Tester
- [ ] Login works
- [ ] Executive Dashboard shows KPIs
- [ ] Operations Dashboard shows production runs
- [ ] Can create production order
- [ ] KPI Explorer shows 119 KPIs
- [ ] Can search KPIs
- [ ] Language switch to Chinese works
- [ ] All 7 dashboards accessible

### Chinese Tester
- [ ] Login works (登录)
- [ ] Executive Dashboard in Chinese (执行仪表板)
- [ ] Operations Dashboard in Chinese (运营仪表板)
- [ ] Can create production order (创建生产订单)
- [ ] KPI Explorer in Chinese (KPI浏览器)
- [ ] Can search KPIs (搜索KPI)
- [ ] Language switch to English works
- [ ] All 7 dashboards accessible

### System Health
- [ ] All containers running
- [ ] Health checks pass
- [ ] Grafana shows metrics
- [ ] Prometheus shows targets UP
- [ ] No errors in logs

---

## 📖 Full Documentation

- **Complete Guide:** TESTING_GUIDE.md (17 test scenarios)
- **Technical Details:** DEPLOYMENT_SUMMARY.md
- **Quick Reference:** README.md

---

## 🚀 Ready in 3 Commands

```bash
cd deployment\test
build-and-start.bat
health-check.bat
```

Then open http://localhost:6080 and http://localhost:7080

**That's it! 🎉**
