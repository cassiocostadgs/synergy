#!/bin/sh
# Entrypoint da imagem única.
#
# Roda o seed antes da API porque, num container só, não há onde executar um
# passo separado. Ele é idempotente: se o Admin já existe, não faz nada.
set -e

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
