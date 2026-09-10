/// <reference types="vite/client" />

/**
 * Variáveis de ambiente do front, todas resolvidas no build (ver README, seção
 * de deploy). Declaradas aqui para o TypeScript acusar erro de digitação no
 * nome — com a tipagem genérica do Vite, `VITE_MS_TENANTID` compilaria e viraria
 * `undefined` em produção.
 */
interface ImportMetaEnv {
  /** URL base da API. Vazia = mesma origem do front. */
  readonly VITE_API_URL?: string
  /** Directory (tenant) ID do Entra, em GUID. Vazio = SSO desligado. */
  readonly VITE_MS_TENANT_ID?: string
  /** Application (client) ID do app registration, em GUID. */
  readonly VITE_MS_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
