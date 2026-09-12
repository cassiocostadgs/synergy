# syntax=docker/dockerfile:1

# =============================================================================
# Synergy — imagem única, para plataformas que constroem um Dockerfile na raiz
# e rodam um container.
#
# Junta as duas metades do monorepo: o frontend é compilado com Node e a própria
# API em Go o entrega, na mesma porta em que atende /api. Não há nginx aqui —
# um processo só, uma porta só, que é o que essas plataformas esperam.
#
# Para desenvolvimento use `docker-compose.yml`, que separa os serviços e sobe
# o PostgreSQL junto.
# =============================================================================

# ---- frontend ---------------------------------------------------------------
FROM node:24-alpine AS web

WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

COPY apps/web/ ./

# Vazia = mesma origem. Como quem serve o app é a própria API, o front chama
# /api/v1 no mesmo host e não há CORS envolvido.
ARG VITE_API_URL=""
ARG VITE_MS_TENANT_ID=""
ARG VITE_MS_CLIENT_ID=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MS_TENANT_ID=$VITE_MS_TENANT_ID \
    VITE_MS_CLIENT_ID=$VITE_MS_CLIENT_ID

RUN npm run build

# ---- backend ----------------------------------------------------------------
FROM golang:1.27-alpine AS api

WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download

COPY apps/api/ ./

ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /out/api  ./cmd/api && \
    go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# ---- imagem final -----------------------------------------------------------
FROM alpine:3.21

# ca-certificates é obrigatório: a validação do token do SSO baixa as chaves
# públicas do Entra por HTTPS. tzdata porque a base não traz fuso algum.
RUN apk add --no-cache ca-certificates tzdata && \
    adduser --disabled-password --uid 10001 synergy

WORKDIR /app
COPY --from=api /out/api /out/seed ./
COPY --from=web /web/dist ./web
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER synergy

# STATIC_DIR é o que liga a entrega do frontend pela API. Sem ela, a mesma
# imagem serve só a API.
ENV STATIC_DIR=/app/web \
    API_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --quiet --spider "http://127.0.0.1:${API_PORT:-8080}/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
