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
#
# curl entra por exigência da plataforma, não do app: o Coolify confere a subida
# do container novo chamando /health de dentro dele, e faz isso com curl. A base
# alpine só traz o wget do busybox, que não serve para essa checagem — sem curl
# a conferência não acontece, a plataforma entende que o container não respondeu
# e desfaz o deploy. São ~5 MB que compram a publicação.
RUN apk add --no-cache ca-certificates tzdata curl && \
    adduser --disabled-password --uid 10001 synergy

WORKDIR /app
COPY --from=api /out/api /out/seed ./
COPY --from=web /web/dist ./web
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# A configuração do portal de deploy. Ele não injeta variável de ambiente no
# container: o .env apenas viaja dentro do .zip, e cabe à imagem carregá-lo
# (quem faz isso é o entrypoint). Sem ele a API recusa subir por falta de
# JWT_SECRET, o healthcheck falha e a plataforma desfaz a publicação.
#
# O curinga é proposital: `COPY .env ./` falharia o build em quem clona o
# repositório sem o arquivo. Como .env.example está sempre na raiz, o padrão
# sempre casa com algo e o build nunca quebra por isso.
COPY --chown=synergy:synergy .env* ./

USER synergy

# STATIC_DIR é o que liga a entrega do frontend pela API. Sem ela, a mesma
# imagem serve só a API.
ENV STATIC_DIR=/app/web \
    API_PORT=8080

EXPOSE 8080

# Mesmo comando que a plataforma usa, para que o healthcheck do Docker e o da
# plataforma não divirjam: se um passa, o outro passa.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${API_PORT:-8080}/health" > /dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
