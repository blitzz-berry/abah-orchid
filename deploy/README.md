# OrchidMart Production Deploy

## Prerequisites
- Docker Engine and Docker Compose plugin.
- Domain pointing to the VPS.
- Real credentials for Midtrans, RajaOngkir, SMTP, and production secrets.

## Setup
1. Copy `.env.production.example` to `.env.production`.
2. Replace every `change-this-*` value.
3. Set `PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`, `CORS_ALLOWED_ORIGINS`, and `FRONTEND_URL` to the real HTTPS domain.
4. Start the stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Health Checks
- API liveness: `https://your-domain/api/v1/healthz`
- API readiness: `https://your-domain/api/v1/readyz`
- Frontend: `https://your-domain/`

## SSL
The included nginx config listens on port 80. Put a TLS terminator in front of it, or extend `deploy/nginx.conf` with Certbot/Let's Encrypt certificates before opening production traffic.

## Payment Expiry
`PAYMENT_EXPIRY_WORKER=true` runs an internal worker every 15 minutes to expire unpaid orders.

## Object Storage
The production compose starts MinIO and configures `STORAGE_DRIVER=s3`. Uploaded product images and payment proofs are stored in the `S3_BUCKET` bucket.
