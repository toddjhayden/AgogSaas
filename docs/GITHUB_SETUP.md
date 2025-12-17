# GitHub Repository Setup for CI/CD

This guide walks you through setting up the AgogSaaS GitHub repository for automated CI/CD pipelines.

## Table of Contents

1. [Required GitHub Secrets](#required-github-secrets)
2. [Branch Protection Rules](#branch-protection-rules)
3. [Environment Configuration](#environment-configuration)
4. [GitHub Container Registry](#github-container-registry)
5. [SSH Keys Setup](#ssh-keys-setup)
6. [Optional Integrations](#optional-integrations)

## Required GitHub Secrets

Navigate to: **Settings > Secrets and variables > Actions**

### Production Secrets

| Secret Name | Description | How to Generate |
|-------------|-------------|-----------------|
| `PRODUCTION_SSH_KEY` | SSH private key for production server | `ssh-keygen -t ed25519 -C "github-actions-prod"` |
| `PRODUCTION_HOST` | Production server hostname/IP | Your server IP or hostname |
| `PRODUCTION_USER` | SSH username for production | Usually `ubuntu` or `root` |
| `DB_PASSWORD` | Production database password | Strong random password (32+ chars) |

### Staging Secrets

| Secret Name | Description | How to Generate |
|-------------|-------------|-----------------|
| `STAGING_SSH_KEY` | SSH private key for staging server | `ssh-keygen -t ed25519 -C "github-actions-staging"` |
| `STAGING_HOST` | Staging server hostname/IP | Your staging server IP |
| `STAGING_USER` | SSH username for staging | Usually `ubuntu` or `root` |

### Optional Secrets

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Deployment notifications |
| `CODECOV_TOKEN` | Codecov integration token | Code coverage reports |

## Setting Up GitHub Secrets

### 1. Generate SSH Keys

On your local machine:

```bash
# Production SSH key
ssh-keygen -t ed25519 -C "github-actions-prod" -f ~/.ssh/github_actions_prod
cat ~/.ssh/github_actions_prod  # Copy this to PRODUCTION_SSH_KEY

# Staging SSH key
ssh-keygen -t ed25519 -C "github-actions-staging" -f ~/.ssh/github_actions_staging
cat ~/.ssh/github_actions_staging  # Copy this to STAGING_SSH_KEY
```

### 2. Add Public Keys to Servers

On your production server:

```bash
# Add the public key to authorized_keys
echo "YOUR_PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Repeat for staging server.

### 3. Add Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Add each secret with its name and value

### 4. Generate Database Password

```bash
# Generate a secure random password
openssl rand -base64 32
```

Add this as `DB_PASSWORD` in GitHub secrets.

## Branch Protection Rules

Navigate to: **Settings > Branches > Add branch protection rule**

### For `master` branch:

- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - Required checks:
    - `Security Checks`
    - `Lint & Type Check`
    - `Unit Tests`
    - `Verify Docker Builds`
    - `Smoke Tests`
- ✅ Require conversation resolution before merging
- ✅ Require linear history
- ✅ Include administrators
- ✅ Restrict who can push to matching branches
  - Add: Repository administrators only

### For `develop` branch:

- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
- ✅ Require status checks to pass before merging
  - Required checks:
    - `Security Checks`
    - `Lint & Type Check`
    - `Unit Tests`
- ✅ Require conversation resolution before merging

## Environment Configuration

Navigate to: **Settings > Environments**

### Create Environments

#### 1. `staging` Environment

- **Deployment branches**: `develop` only
- **Protection rules**: None (auto-deploy)
- **Environment secrets**: None (uses repository secrets)

#### 2. `production-blue` Environment

- **Deployment branches**: `master` only
- **Protection rules**:
  - ✅ Required reviewers: Add yourself and key team members
  - ⏱️ Wait timer: 5 minutes (optional)
- **Environment URL**: `https://blue.agogsaas.com`

#### 3. `production-green` Environment

- **Deployment branches**: `master` only
- **Protection rules**:
  - ✅ Required reviewers: Add yourself and key team members
  - ⏱️ Wait timer: 5 minutes (optional)
- **Environment URL**: `https://green.agogsaas.com`

#### 4. `production-approval` Environment

- **Deployment branches**: `master` only
- **Protection rules**:
  - ✅ Required reviewers: Add yourself (final approval before smoke tests)

#### 5. `production-traffic-switch` Environment

- **Deployment branches**: `master` only
- **Protection rules**:
  - ✅ Required reviewers: Add yourself (final approval before traffic switch)
  - ⏱️ Wait timer: 10 minutes (gives time to review deployment)
- **Environment URL**: `https://agogsaas.com`

## GitHub Container Registry

The CI/CD pipeline uses GitHub Container Registry (ghcr.io) which is free for public repositories.

### Enable Package Write Permission

1. Go to **Settings > Actions > General**
2. Scroll to **Workflow permissions**
3. Select: **Read and write permissions**
4. ✅ Check: **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

### Registry Details

Images will be pushed to:
- Backend: `ghcr.io/toddjhayden/agogsaas/backend`
- Frontend: `ghcr.io/toddjhayden/agogsaas/frontend`

### Pull Images

To pull images from the registry:

```bash
# Login to GHCR
echo "$GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
docker pull ghcr.io/toddjhayden/agogsaas/backend:latest
docker pull ghcr.io/toddjhayden/agogsaas/frontend:latest
```

## SSH Keys Setup

### On GitHub Actions (Automated)

The workflows automatically handle SSH authentication using the secrets you configured.

### On Your Servers

Prepare your staging and production servers:

```bash
# Create deployment directory
sudo mkdir -p /opt/agogsaas
sudo chown $USER:$USER /opt/agogsaas

# Create backup directory
sudo mkdir -p /opt/agogsaas-backups
sudo chown $USER:$USER /opt/agogsaas-backups

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Verify SSH Access

Test SSH access from your local machine:

```bash
# Test staging
ssh -i ~/.ssh/github_actions_staging $STAGING_USER@$STAGING_HOST "echo 'SSH works!'"

# Test production
ssh -i ~/.ssh/github_actions_prod $PRODUCTION_USER@$PRODUCTION_HOST "echo 'SSH works!'"
```

## Optional Integrations

### Slack Notifications

1. Create a Slack webhook:
   - Go to https://api.slack.com/apps
   - Create new app > From scratch
   - Enable **Incoming Webhooks**
   - Add new webhook to workspace
   - Copy webhook URL

2. Add to GitHub secrets as `SLACK_WEBHOOK_URL`

### Codecov Integration

1. Sign up at https://codecov.io
2. Connect your GitHub repository
3. Copy the repository token
4. Add to GitHub secrets as `CODECOV_TOKEN`

## Verification Checklist

Before running your first deployment, verify:

- [ ] All required secrets are added to GitHub
- [ ] Branch protection rules are configured
- [ ] All 5 environments are created with proper protection
- [ ] Workflow permissions allow package writes
- [ ] SSH keys are added to servers
- [ ] Servers have Docker and Docker Compose installed
- [ ] Deployment directories exist on servers
- [ ] SSH access works from your machine
- [ ] `DB_PASSWORD` is strong and secure
- [ ] Slack webhook is configured (optional)

## Testing the Setup

### 1. Test CI Pipeline

Create a test branch and push:

```bash
git checkout -b test-ci-pipeline
git commit --allow-empty -m "Test CI pipeline"
git push origin test-ci-pipeline
```

Open a PR and verify all CI checks pass.

### 2. Test Staging Deployment

Merge a PR to `develop` and watch the staging deployment:

1. Go to **Actions** tab
2. Watch "Deploy to Staging" workflow
3. Verify deployment succeeds
4. Check staging URL

### 3. Test Production Deployment

Create a release tag:

```bash
git checkout master
git tag v0.1.0
git push origin v0.1.0
```

Or use manual workflow dispatch:

1. Go to **Actions > Deploy to Production**
2. Click **Run workflow**
3. Select environment: `blue`
4. Run workflow

## Troubleshooting

### Common Issues

**Issue**: "Permission denied (publickey)" during deployment

**Solution**:
- Verify SSH key is added to GitHub secrets correctly
- Ensure public key is in `~/.ssh/authorized_keys` on server
- Check server SSH configuration allows key-based auth

**Issue**: "Cannot connect to Docker daemon"

**Solution**:
- Ensure Docker is installed: `docker --version`
- Add user to docker group: `sudo usermod -aG docker $USER`
- Restart SSH session

**Issue**: Workflow fails with "Resource not accessible by integration"

**Solution**:
- Go to Settings > Actions > General
- Enable "Read and write permissions"

## Next Steps

After setup is complete:

1. Read [CI/CD Pipeline Documentation](./CI_CD_PIPELINE.md)
2. Review [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
3. Familiarize yourself with [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
4. Test a staging deployment
5. Plan your first production deployment

## Support

For issues or questions:
- Check [GitHub Actions Troubleshooting](./GITHUB_ACTIONS_TROUBLESHOOTING.md)
- Review workflow logs in the Actions tab
- Contact the DevOps team

---

Last Updated: 2025-12-17
