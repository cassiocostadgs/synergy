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
RUN apk add --no-cache ca-certificates tzdata && \
    adduser --disabled-password --uid 10001 synergy

WORKDIR /app
COPY --from=build /out/api /out/seed ./

# Sem root: um processo que só escuta HTTP e fala com o banco não precisa dele.
USER synergy

EXPOSE 8080

# O compose usa este healthcheck para só subir o front depois que a API estiver
# de pé — e para reiniciá-la se ela travar.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --quiet --spider "http://127.0.0.1:${API_PORT:-8080}/health" || exit 1

# As migrations são embutidas no binário e aplicadas na subida (ver README),
# então não há passo de migração no deploy.
ENTRYPOINT ["/app/api"]
