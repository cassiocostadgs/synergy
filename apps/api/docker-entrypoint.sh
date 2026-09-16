#!/bin/sh
# Entrypoint da imagem da API.
#
# Cria o Admin inicial antes de subir a API. Em plataforma que executa um
# container só (Render, Coolify, Fly) não há onde rodar um passo separado, e
# sem isso a API subiria com o banco vazio — ninguém conseguiria entrar.
#
# É idempotente: se o Admin já existe, o seed não faz nada. Por isso pode rodar
# a cada boot sem ressalva.
set -e

if [ -n "$SEED_ADMIN_PASSWORD" ]; then
  echo "==> criando o Admin inicial (idempotente)"
  # Falha aqui é falha de verdade — banco fora do ar, senha curta demais. Subir
  # a API mesmo assim deixaria um sistema sem nenhum usuário para entrar.
  /app/seed
else
  # Caminho normal no docker-compose: lá quem cria o Admin é o serviço `seed`,
  # e o serviço `api` não recebe a variável de propósito.
  echo "==> SEED_ADMIN_PASSWORD ausente: pulando a criação do Admin"
fi

echo "==> subindo a API"
# `exec` substitui o shell pelo processo da API: sem isso o PID 1 seria o
# shell, e o container ignoraria o sinal de parada da plataforma.
exec /app/api
