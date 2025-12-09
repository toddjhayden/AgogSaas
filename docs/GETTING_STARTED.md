# Getting Started with AgogSaaS

## Overview

AgogSaaS is a 4-layer AI development platform that automates software development from requirements to deployment.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git
- OpenAI API key (for Layer 4 memory)

## Quick Start (Docker)

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd agogsaas
```

2. **Create environment file**
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY and DB_PASSWORD
```

3. **Start all services**
```bash
docker-compose up -d
```

4. **Access the application**
- Frontend: http://localhost:3000
- Monitoring Dashboard: http://localhost:3000/monitoring
- GraphQL Playground: http://localhost:4000/graphql

## Local Development

### Backend

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env with your configuration
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## What's Next?

- Add your first requirement (see docs/AGENTS.md)
- Explore the monitoring dashboard
- Review the architecture (see docs/ARCHITECTURE.md)

## The 4 Layers

1. **Validation** - Pre-commit hooks ensure quality
2. **Monitoring** - Real-time dashboard at `/monitoring`
3. **Orchestration** - Automated agent workflows
4. **Memory** - Agents learn from past work

## Need Help?

- Check [Architecture Documentation](ARCHITECTURE.md)
- Review [Agent System Guide](AGENTS.md)
- See [Deployment Guide](DEPLOYMENT.md)
