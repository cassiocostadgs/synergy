# syntax=docker/dockerfile:1

# =============================================================================
# Frontend do Synergy — build com Node, entrega com nginx.
#
# O resultado é um punhado de arquivos estáticos: a imagem final não tem Node,
# nem node_modules, nem código-fonte.
# =============================================================================

# ---- estágio de build -------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# `npm ci` (e não `install`) porque ele respeita o package-lock à risca: o build
# da imagem instala exatamente as versões que você testou.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# As variáveis do Vite são resolvidas NO BUILD — ele as substitui por valor
# literal dentro do bundle. Mudá-las no servidor depois não tem efeito nenhum,
# por isso elas chegam como ARG e não como variável de ambiente do container.
#
# VITE_API_URL vazia = mesma origem: o nginx deste container encaminha /api para
# a API, o que dispensa CORS (README, seção 5).
ARG VITE_API_URL=""
ARG VITE_MS_TENANT_ID=""
ARG VITE_MS_CLIENT_ID=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MS_TENANT_ID=$VITE_MS_TENANT_ID \
    VITE_MS_CLIENT_ID=$VITE_MS_CLIENT_ID

RUN npm run build

# ---- estágio de execução ----------------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1/ || exit 1
