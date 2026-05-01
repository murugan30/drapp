# DrApp Clinic (Nx Monorepo)

## Apps
- `web` - Next.js (React 19) PWA
- `api` - NestJS API with MongoDB + S3 documents

## Prerequisites
- Node.js 20+
- Docker (optional, for MongoDB + MinIO)

## Quick Start
```bash
cp .env.example .env
npm install

docker compose up -d

npm run dev
```

Web: `http://localhost:4200`
API: `http://localhost:3000/api`

## Docker (separate containers)
```bash
docker compose up --build
```

Web: `http://localhost:4200`
API: `http://localhost:3000/api`

## Environment
Update `.env` with:
- `MONGO_URI`
- `JWT_SECRET`
- `S3_*` credentials
- `NEXT_PUBLIC_API_URL`

## OTP
Default SMS provider is `log` (outputs OTP in server logs). Integrate your preferred SMS provider in `api/src/app/auth/sms.service.ts` and set `SMS_PROVIDER`.

## Troubleshooting
If Nx plugin workers fail in your environment, run with:
```bash
NX_ISOLATE_PLUGINS=false NX_DAEMON=false nx serve web
```
