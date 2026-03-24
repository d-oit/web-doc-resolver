# Deployment Guide

This guide covers deployment options for the do-web-doc-resolver project.

## Deployment Targets

### 1. Vercel (Web UI)

The Next.js web UI is deployed via Vercel Git integration — push to `main` and Vercel auto-builds and deploys.

| Setting | Value |
|---------|-------|
| **Production URL** | `https://web-eight-ivory-29.vercel.app/` |
| **Project ID** | `prj_jzHZ0Rc3ilkcmjk7YlHA2NbSJ0lS` |
| **Framework** | Next.js |
| **Deploy trigger** | Push to `main` branch |

#### Local Testing (Vercel CLI)

Vercel CLI is for local development only — **not** used in CI/CD.

```bash
cd web

# One-time setup
vercel link          # Link to existing project
vercel pull --yes    # Pull env vars locally

# Local development
vercel dev           # Local dev server
vercel build --prod  # Verify production build
```

#### Environment Variables

Set in Vercel dashboard:
- `NEXT_PUBLIC_RESOLVER_URL`: Backend resolver URL (default: http://localhost:8000)

### 2. Docker (Backend)

The Python resolver can be containerized.

#### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/ ./scripts/

EXPOSE 8000

CMD ["python", "-m", "scripts.resolve", "--server", "--port", "8000"]
```

#### Build and Run

```bash
# Build
docker build -t do-web-doc-resolver .

# Run
docker run -p 8000:8000 \
  -e EXA_API_KEY=$EXA_API_KEY \
  -e TAVILY_API_KEY=$TAVILY_API_KEY \
  do-web-doc-resolver
```

### 3. Rust Binary Distribution

The Rust CLI can be compiled for multiple platforms.

#### Cross-Platform Builds

```bash
cd cli

# Linux x86_64
cargo build --release --target x86_64-unknown-linux-gnu

# macOS x86_64
cargo build --release --target x86_64-apple-darwin

# macOS ARM64
cargo build --release --target aarch64-apple-darwin

# Windows
cargo build --release --target x86_64-pc-windows-msvc
```

#### Release Process

1. Update version in `Cargo.toml`
2. Build release binaries
3. Create GitHub release with binaries
4. Update documentation

### 4. Systemd Service (Self-hosted)

For self-hosted deployment of the Python resolver.

#### Service File

```ini
# /etc/systemd/system/do-web-doc-resolver.service
[Unit]
Description=Web Documentation Resolver
After=network.target

[Service]
Type=simple
User=resolver
Group=resolver
WorkingDirectory=/opt/do-web-doc-resolver
EnvironmentFile=/etc/do-web-doc-resolver/env
ExecStart=/usr/bin/python3 -m scripts.resolve --server --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Setup

```bash
# Create user
sudo useradd -r -s /bin/false resolver

# Create directory
sudo mkdir -p /opt/do-web-doc-resolver
sudo chown resolver:resolver /opt/do-web-doc-resolver

# Copy files
sudo cp -r . /opt/do-web-doc-resolver/

# Create env file
sudo tee /etc/do-web-doc-resolver/env << EOF
EXA_API_KEY=your_key
TAVILY_API_KEY=your_key
SERPER_API_KEY=your_key
FIRECRAWL_API_KEY=your_key
MISTRAL_API_KEY=your_key
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable do-web-doc-resolver
sudo systemctl start do-web-doc-resolver
```

## Configuration

### Environment Variables

Set environment variables for production:

```bash
# Provider API keys
export EXA_API_KEY="your_exa_key"
export TAVILY_API_KEY="your_tavily_key"
export SERPER_API_KEY="your_serper_key"
export FIRECRAWL_API_KEY="your_firecrawl_key"
export MISTRAL_API_KEY="your_mistral_key"

# Runtime settings
export DO_WDR_LOG_LEVEL=INFO
export DO_WDR_MAX_CHARS=8000
export DO_WDR_OUTPUT_LIMIT=10
```

### Config File

Use `cli/config.toml` for default settings.

## Monitoring

### Health Checks

```bash
# Check service status
systemctl status do-web-doc-resolver

# Check logs
journalctl -u do-web-doc-resolver -f

# Test endpoint
curl http://localhost:8000/health
```

### Metrics

Consider adding:
- Prometheus metrics endpoint
- Grafana dashboards
- Alerting for failures

### Logging

```bash
# View logs
tail -f /var/log/do-web-doc-resolver.log

# Rotate logs
logrotate /etc/logrotate.d/do-web-doc-resolver
```

## Security

### API Key Management

- Use secrets management (Vault, AWS Secrets Manager, etc.)
- Rotate keys regularly
- Monitor usage for anomalies
- Use separate keys for dev/staging/prod

### Network Security

- Use HTTPS in production
- Set up rate limiting
- Configure CORS properly
- Use API keys for authentication

### Container Security

- Use non-root user in containers
- Scan images for vulnerabilities
- Keep base images updated
- Use minimal base images

## Scaling

### Horizontal Scaling

- Deploy multiple instances behind load balancer
- Use Redis for shared rate limit state
- Consider provider rate limits

### Vertical Scaling

- Increase memory for large content processing
- Adjust timeout settings
- Monitor resource usage

## Backup and Recovery

### Data Backup

The resolver is mostly stateless, but consider backing up:
- Configuration files
- API keys
- Logs for debugging

### Recovery

1. Redeploy from backup/config
2. Restore environment variables
3. Test provider connectivity
4. Verify functionality

## Performance Tuning

### Connection Pooling

Adjust based on expected load:
```toml
[network]
max_connections = 100
timeout = 30
```

### Caching

Enable caching for repeated queries:
```toml
[caching]
enabled = true
ttl_seconds = 3600
```

### Rate Limiting

Configure rate limits to avoid provider throttling:
```toml
[providers.exa]
requests_per_minute = 60
```
