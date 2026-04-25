# Repository Guidelines

## Project Structure & Module Organization
This repository is split into `backend/` and `frontend/`. The Go API starts at `backend/cmd/server/main.go`, with application code organized under `backend/internal/` by layer: `handler/`, `service/`, `repository/`, `model/`, `dto/`, `middleware/`, and `pkg/`. Seed utilities live in `backend/seed*.{go,js}`. The Next.js app lives in `frontend/src/`, with routes under `src/app/`, shared UI in `src/components/`, API helpers in `src/lib/`, stores in `src/store/`, and types in `src/types/`. Static assets are in `frontend/public/images/`.

## Build, Test, and Development Commands
Run services from their own subdirectories unless noted otherwise.

- `docker compose up -d postgres redis`: start local PostgreSQL and Redis from the repo root.
- `cd backend; go run ./cmd/server`: run the backend on `:8080`.
- `cd backend; go test ./...`: run backend tests and package checks.
- `cd frontend; npm install`: install frontend dependencies.
- `cd frontend; npm run dev`: start the Next.js dev server on `:3000`.
- `cd frontend; npm run build`: create a production build.
- `cd frontend; npm run lint`: run ESLint with the Next.js config.

## Coding Style & Naming Conventions
Follow idiomatic Go formatting with `gofmt` before committing. Keep Go package names lowercase and group new code by existing layers in `internal/`. For the frontend, TypeScript is in strict mode; prefer `PascalCase` for components, `camelCase` for functions, stores, and utilities, and route folders that match URL segments such as `src/app/orders/[id]/page.tsx`. Use the existing `@/*` import alias for frontend internal imports.

## Testing Guidelines
There is no dedicated frontend test runner configured yet, and backend test files are not established. For now, treat `cd backend; go test ./...` and `cd frontend; npm run lint` as the minimum pre-PR quality gate. Add new Go tests as `*_test.go` files beside the package under test. If frontend tests are introduced, keep them near the feature as `*.test.ts(x)`.

## Commit & Pull Request Guidelines
Current history uses Conventional Commit style (`feat: ...`), so continue with prefixes like `feat:`, `fix:`, and `docs:`. Keep commits scoped to one concern. PRs should include a short summary, affected areas (`backend`, `frontend`, or both), manual verification steps, and screenshots for UI changes. Link the related issue or task when available.

## Security & Configuration Tips
Do not commit secrets or production credentials. Treat values in `docker-compose.yml` as local-development defaults only. Keep environment-specific API keys and payment/shipping credentials outside the repository.
