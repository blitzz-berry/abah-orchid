# OrchidMart Production Deploy

## Prerequisites
- Docker Engine and Docker Compose plugin.
- Domain pointing to the VPS.
- Real credentials for Midtrans, RajaOngkir, SMTP, and production secrets.

## Setup
1. Copy `.env.production.example` to `.env.production`.
2. Replace every `change-this-*` value.
3. Set `PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`, `CORS_ALLOWED_ORIGINS`, and `FRONTEND_URL` to the real HTTPS domain.
4. Optional: set `BACKEND_IMAGE` and `FRONTEND_IMAGE` if you push images to a registry.
5. Start the stack:

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

## File Storage
The production compose uses local Docker volumes by default. Product images are stored in `uploads` and exposed through `/uploads/`. Payment proofs are stored in the private `private_uploads` volume and are only served through authenticated backend endpoints.

Keep both volumes in the regular VPS backup plan. If the container is rebuilt, the files remain in the Docker volumes, but they are still tied to that VPS unless you migrate or back them up.

## Database TLS
`DB_SSLMODE` is required in production. The included compose file uses `disable` only because PostgreSQL runs on the private Docker network. For an external managed PostgreSQL database, use `require`, `verify-ca`, or preferably `verify-full`, and set `DB_SSLROOTCERT` when certificate validation is required.
