#!/bin/sh
# Entrypoint da imagem única.
#
# Roda o seed antes da API porque, num container só, não há onde executar um
# passo separado. Ele é idempotente: se o Admin já existe, não faz nada.
set -e

# Carrega o .env do pacote, quando existir.
#
# O portal de deploy DB1 não tem tela de variáveis e NÃO as injeta no container:
# o .env só viaja dentro do .zip, como arquivo. Next.js e Vite leem .env
# sozinhos, mas um binário Go só enxerga o ambiente do processo — então sem este
# passo a API não recebe JWT_SECRET e recusa subir.
#
# `set -a` exporta tudo o que for definido a seguir. Vem ANTES das checagens
# abaixo de propósito. Quem roda por docker-compose não tem este arquivo na
# imagem e não é afetado: lá as variáveis chegam prontas pelo `environment:`.
if [ -f /app/.env ]; then
  echo "==> carregando /app/.env"
  set -a
  . /app/.env
  set +a
fi

if [ -n "$SEED_ADMIN_PASSWORD" ]; then
  echo "==> criando o Admin inicial (idempotente)"
  # Falha aqui é falha de verdade — banco fora do ar, senha curta demais. Subir
  # a API mesmo assim deixaria um sistema sem nenhum usuário para entrar.
  /app/seed
else
  echo "==> SEED_ADMIN_PASSWORD ausente: pulando a criação do Admin"
fi

echo "==> subindo a API"
# `exec` substitui o shell pelo processo da API: sem isso o PID 1 seria o
# shell, e o container ignoraria o sinal de parada da plataforma.
exec /app/api
