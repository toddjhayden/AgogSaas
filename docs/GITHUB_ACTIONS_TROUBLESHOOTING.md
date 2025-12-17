# GitHub Actions Troubleshooting Guide

Common issues and solutions for AgogSaaS CI/CD pipelines.

## Table of Contents

1. [Workflow Failures](#workflow-failures)
2. [Build Issues](#build-issues)
3. [Deployment Issues](#deployment-issues)
4. [Test Failures](#test-failures)
5. [Container Registry Issues](#container-registry-issues)
6. [SSH and Connectivity](#ssh-and-connectivity)
7. [Performance Issues](#performance-issues)

## Workflow Failures

### Issue: "Workflow run failed with status 'cancelled'"

**Cause**: Workflow was manually cancelled or timed out

**Solutions**:
1. Check if someone cancelled it manually
2. Check workflow timeout settings
3. Review workflow logs for hanging steps
4. Increase timeout if needed:
   ```yaml
   timeout-minutes: 30  # Increase from default 15
   ```

### Issue: "Resource not accessible by integration"

**Cause**: Insufficient GitHub Actions permissions

**Solutions**:
1. Go to **Settings > Actions > General**
2. Under "Workflow permissions", select: **Read and write permissions**
3. Check: **Allow GitHub Actions to create and approve pull requests**
4. Save changes

### Issue: "Can't find required check"

**Cause**: Branch protection requires checks that don't exist

**Solutions**:
1. Go to **Settings > Branches**
2. Edit branch protection rule
3. Review "Required status checks"
4. Remove or add correct check names
5. Check names must match job names in workflows

## Build Issues

### Issue: npm install fails with "ENOTFOUND" or network errors

**Cause**: Network issues or npm registry down

**Solutions**:
```yaml
# Add retry logic
- name: Install dependencies
  run: |
    npm ci --prefer-offline --no-audit || \
    npm ci --prefer-offline --no-audit || \
    npm ci --prefer-offline --no-audit
```

Or use cache:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: |
      backend/package-lock.json
      frontend/package-lock.json
```

### Issue: "Cannot find module" or import errors

**Cause**: Missing dependencies or build artifacts

**Solutions**:
1. Ensure `npm ci` runs before build:
   ```bash
   npm ci  # Not npm install
   npm run build
   ```

2. Check tsconfig.json paths
3. Verify all dependencies in package.json
4. Clear cache and rebuild:
   ```yaml
   - name: Clear npm cache
     run: npm cache clean --force
   ```

### Issue: TypeScript compilation errors

**Cause**: Type errors in code

**Solutions**:
1. Run locally first: `npm run build`
2. Fix all type errors
3. Ensure same TypeScript version locally and in CI:
   ```json
   "devDependencies": {
     "typescript": "5.3.3"  # Pin exact version
   }
   ```

### Issue: Out of memory during build

**Cause**: Node runs out of heap memory

**Solutions**:
```yaml
- name: Build with increased memory
  run: NODE_OPTIONS="--max-old-space-size=4096" npm run build
  env:
    NODE_ENV: production
```

## Deployment Issues

### Issue: "Permission denied (publickey)" during deployment

**Cause**: SSH key not set up correctly

**Solutions**:
1. Verify SSH key is in GitHub secrets:
   - Go to **Settings > Secrets > Actions**
   - Check `STAGING_SSH_KEY` or `PRODUCTION_SSH_KEY` exists

2. Verify public key on server:
   ```bash
   # On server
   cat ~/.ssh/authorized_keys
   ```

3. Test SSH key locally:
   ```bash
   ssh -i ~/.ssh/test_key user@server
   ```

4. Ensure key format is correct (no extra whitespace):
   ```bash
   # Key should start with:
   -----BEGIN OPENSSH PRIVATE KEY-----
   # And end with:
   -----END OPENSSH PRIVATE KEY-----
   ```

### Issue: "Host key verification failed"

**Cause**: Server host key not in known_hosts

**Solutions**:
```yaml
- name: Setup SSH
  run: |
    mkdir -p ~/.ssh
    ssh-keyscan -H ${{ secrets.STAGING_HOST }} >> ~/.ssh/known_hosts
    echo "${{ secrets.STAGING_SSH_KEY }}" > ~/.ssh/staging_key
    chmod 600 ~/.ssh/staging_key
```

### Issue: Deployment script fails with "command not found"

**Cause**: Required tools not installed on runner

**Solutions**:
```yaml
- name: Install required tools
  run: |
    sudo apt-get update
    sudo apt-get install -y curl wget
```

### Issue: Docker Compose fails on server

**Cause**: Docker Compose not installed or wrong version

**Solutions**:
```bash
# On server, install Docker Compose v2
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

## Test Failures

### Issue: Tests fail in CI but pass locally

**Cause**: Environment differences

**Solutions**:
1. Check environment variables:
   ```yaml
   env:
     NODE_ENV: test
     DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/test_db
   ```

2. Ensure test database is available:
   ```yaml
   services:
     postgres:
       image: pgvector/pgvector:pg16
       env:
         POSTGRES_DB: test_db
         POSTGRES_USER: test_user
         POSTGRES_PASSWORD: test_pass
   ```

3. Check timing issues:
   ```javascript
   // Add waits for async operations
   await waitFor(() => expect(element).toBeInTheDocument(), {
     timeout: 5000
   });
   ```

### Issue: Flaky tests (sometimes pass, sometimes fail)

**Cause**: Race conditions or timing issues

**Solutions**:
1. Increase test timeouts:
   ```javascript
   jest.setTimeout(10000);
   ```

2. Add proper waits:
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 100));
   ```

3. Use test retries:
   ```yaml
   - name: Run tests
     run: npm test -- --maxRetries=2
   ```

### Issue: Coverage reports not uploading

**Cause**: Codecov token missing or path wrong

**Solutions**:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    flags: backend
    fail_ci_if_error: false  # Don't fail CI if upload fails
```

## Container Registry Issues

### Issue: "denied: permission_denied: write_package"

**Cause**: Insufficient permissions to push to GHCR

**Solutions**:
1. Enable package write permissions:
   - **Settings > Actions > General**
   - Select: **Read and write permissions**

2. Verify GITHUB_TOKEN has correct scopes:
   ```yaml
   permissions:
     contents: read
     packages: write
   ```

### Issue: "unauthorized: authentication required"

**Cause**: Not logged in to container registry

**Solutions**:
```yaml
- name: Log in to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

### Issue: Docker build is very slow

**Cause**: No caching, downloading everything

**Solutions**:
```yaml
- name: Build with cache
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
    platforms: linux/amd64
```

### Issue: Image push fails with "413 Request Entity Too Large"

**Cause**: Image is too large

**Solutions**:
1. Optimize Dockerfile:
   ```dockerfile
   # Use multi-stage builds
   FROM node:20-alpine AS builder
   # ... build steps ...

   FROM node:20-alpine
   # Copy only built artifacts
   COPY --from=builder /app/dist ./dist
   ```

2. Add .dockerignore:
   ```
   node_modules
   .git
   *.log
   .env
   coverage
   ```

## SSH and Connectivity

### Issue: "Connection timed out" to deployment server

**Cause**: Firewall blocking GitHub Actions IPs

**Solutions**:
1. Allow GitHub Actions IP ranges in firewall
2. Use GitHub-hosted runner with static IP (paid feature)
3. Use self-hosted runner in your network

### Issue: "Connection refused" to database during tests

**Cause**: Service not ready or port conflict

**Solutions**:
```yaml
services:
  postgres:
    # ... config ...
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Wait for postgres
    run: |
      until pg_isready -h localhost -p 5432; do
        echo "Waiting for postgres..."
        sleep 2
      done
```

### Issue: Cannot connect to service container

**Cause**: Using wrong hostname

**Solutions**:
- Use `localhost` (not container name) when running on runner
- Use service name when running in container:
  ```yaml
  # Correct for runner:
  DATABASE_URL: postgresql://user:pass@localhost:5432/db

  # Correct for container job:
  DATABASE_URL: postgresql://user:pass@postgres:5432/db
  ```

## Performance Issues

### Issue: Workflows taking too long

**Cause**: Sequential jobs, no caching, slow builds

**Solutions**:
1. Run independent jobs in parallel:
   ```yaml
   jobs:
     lint:
       runs-on: ubuntu-latest
       # ...

     test:
       runs-on: ubuntu-latest
       # Runs in parallel with lint
   ```

2. Use caching:
   ```yaml
   - uses: actions/cache@v3
     with:
       path: |
         ~/.npm
         node_modules
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

3. Use latest runner:
   ```yaml
   runs-on: ubuntu-latest  # Not ubuntu-20.04
   ```

### Issue: "Rate limit exceeded" errors

**Cause**: Too many GitHub API calls

**Solutions**:
1. Use GITHUB_TOKEN for authentication:
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

2. Reduce frequency of scheduled workflows
3. Implement retry with backoff:
   ```bash
   for i in {1..3}; do
     command && break || sleep $((i * 10))
   done
   ```

## Common Error Messages

### "Error: Process completed with exit code 1"

**Meaning**: A command in your workflow failed

**Debug**:
1. Find which step failed (check workflow logs)
2. Look at that step's output
3. Run same command locally
4. Add debug output:
   ```yaml
   - name: Debug
     run: |
       echo "Current directory: $(pwd)"
       ls -la
       env | grep -i node
   ```

### "Error: The process '/usr/bin/git' failed with exit code 128"

**Meaning**: Git operation failed

**Common causes**:
- Authentication issues
- Branch doesn't exist
- Shallow clone with operations requiring history

**Solutions**:
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history
    token: ${{ secrets.GITHUB_TOKEN }}
```

### "Error: Unable to resolve action"

**Meaning**: Action not found or inaccessible

**Solutions**:
- Check action name spelling
- Verify action exists: https://github.com/marketplace
- Use specific version:
  ```yaml
  uses: actions/checkout@v4  # Not @latest
  ```

## Debugging Workflows

### Enable Debug Logging

1. Go to **Settings > Secrets > Actions**
2. Add secret: `ACTIONS_STEP_DEBUG` = `true`
3. Add secret: `ACTIONS_RUNNER_DEBUG` = `true`
4. Re-run workflow

### Add Debug Steps

```yaml
- name: Debug Information
  run: |
    echo "Runner OS: ${{ runner.os }}"
    echo "GitHub ref: ${{ github.ref }}"
    echo "Working directory: $(pwd)"
    echo "Environment variables:"
    env | sort
    echo "Disk space:"
    df -h
    echo "Memory:"
    free -h
```

### Test Locally with act

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act push

# Run specific job
act -j test

# With secrets
act -s GITHUB_TOKEN=your_token
```

## Getting Help

### Before Asking for Help

1. ✅ Check workflow logs thoroughly
2. ✅ Try running commands locally
3. ✅ Search this troubleshooting guide
4. ✅ Check GitHub Actions documentation
5. ✅ Search GitHub issues for similar problems

### When Asking for Help

Provide:
- Workflow file (`.github/workflows/*.yml`)
- Full error message and logs
- Link to failed workflow run
- What you've tried already
- Local vs CI behavior differences

### Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Community](https://github.community/c/code-to-cloud/github-actions)
- [Docker Documentation](https://docs.docker.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

Last Updated: 2025-12-17
