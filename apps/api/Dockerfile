# syntax=docker/dockerfile:1

# =============================================================================
# API do Synergy — imagem de dois estágios.
#
# O build acontece dentro da imagem, então não depende do Go instalado na
# máquina nem esbarra na restrição de antivírus do Windows descrita no README:
# aqui o binário é Linux e nasce dentro do container.
# =============================================================================

# ---- estágio de build -------------------------------------------------------
FROM golang:1.27-alpine AS build

WORKDIR /src

# Dependências numa camada própria: só refazem o download quando go.mod ou
# go.sum mudam, o que torna quase todo rebuild instantâneo.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO desligado produz binário estático — roda em qualquer base, inclusive numa
# imagem sem libc. `-trimpath` remove o caminho da máquina de build do binário;
# `-s -w` descartam símbolos e DWARF, que não servem em produção.
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /out/api  ./cmd/api && \
    go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# ---- estágio de execução ----------------------------------------------------
FROM alpine:3.21

# ca-certificates é obrigatório, não opcional: a validação do token do SSO baixa
# as chaves públicas do Entra por HTTPS. Sem os certificados, o login com a
# Microsoft falharia com erro de infraestrutura (500), e a causa não seria óbvia.
# tzdata entra porque a imagem base não traz fuso algum — a API trabalha em UTC,
# mas um TZ configurado errado é mais fácil de diagnosticar que um TZ ausente.
#
# curl não é do app, é da plataforma: Render e Coolify conferem a subida
# chamando /health de dentro do container com curl. A base alpine só traz o
# wget do busybox, que não serve para essa checagem — sem curl a plataforma
# entende que o container não respondeu e desfaz o deploy.
RUN apk add --no-cache ca-certificates tzdata curl && \
    adduser --disabled-password --uid 10001 synergy

WORKDIR /app
COPY --from=build /out/api /out/seed ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Sem root: um processo que só escuta HTTP e fala com o banco não precisa dele.
USER synergy

EXPOSE 8080

# O compose usa este healthcheck para só subir o front depois que a API estiver
# de pé — e para reiniciá-la se ela travar. Mesmo comando que as plataformas de
# hospedagem usam, para que os dois healthchecks não possam divergir.
#
# A porta segue a MESMA ordem do config.Load: API_PORT, senão PORT, senão 8080.
# As plataformas de hospedagem escolhem a porta e a injetam em PORT — checar
# 8080 fixo faria o healthcheck bater numa porta onde ninguém escuta.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${API_PORT:-${PORT:-8080}}/health" > /dev/null || exit 1

# As migrations são embutidas no binário e aplicadas na subida (ver README),
# então não há passo de migração no deploy.
#
# O entrypoint roda o seed antes da API. É o que permite hospedar esta imagem
# em plataforma que só executa um container, sem passo manual: sem ele a API
# subiria com o banco vazio e ninguém conseguiria entrar. É idempotente, e sem
# SEED_ADMIN_PASSWORD ele se pula — que é o caso do serviço `api` no compose,
# onde quem cria o Admin é o serviço `seed`.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
