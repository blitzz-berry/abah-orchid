# syntax=docker/dockerfile:1

FROM golang:1.25.10-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/orchidmart-api ./cmd/server

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata wget && addgroup -S app && adduser -S app -G app

COPY --from=builder /out/orchidmart-api /app/orchidmart-api

RUN mkdir -p /app/uploads /app/private_uploads && chown -R app:app /app
USER app

ENV APP_PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${APP_PORT}/api/v1/healthz || exit 1

CMD ["/app/orchidmart-api"]
