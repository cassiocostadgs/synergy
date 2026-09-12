package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Config concentra os parâmetros de execução da API, todos vindos de variáveis
// de ambiente (ver apps/api/.env.example).
type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	JWTTTL         time.Duration
	AllowedOrigins []string
	// SSO da Microsoft (Entra ID). Ambos vazios = SSO desligado, e a API
	// funciona só com login por senha. Não são segredo: o front os embute no
	// bundle que o navegador baixa.
	MicrosoftTenantID string
	MicrosoftClientID string
	// StaticDir liga a entrega do frontend pela própria API, no modo de
	// container único. Vazio em desenvolvimento, onde quem serve o front é o Vite.
	StaticDir string
}

// MicrosoftSSOHabilitado indica se o ambiente tem SSO configurado.
func (c *Config) MicrosoftSSOHabilitado() bool {
	return c.MicrosoftTenantID != "" && c.MicrosoftClientID != ""
}

// Load lê a configuração do ambiente e valida o que é obrigatório.
func Load() (*Config, error) {
	cfg := &Config{
		// PORT é a convenção das plataformas de hospedagem, que escolhem a porta
		// e a injetam no container. API_PORT tem precedência para não mudar o
		// comportamento de quem já a define.
		Port:              env("API_PORT", env("PORT", "8080")),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		JWTTTL:            time.Duration(envInt("JWT_TTL_HOURS", 8)) * time.Hour,
		AllowedOrigins:    strings.Split(env("CORS_ALLOWED_ORIGINS", "http://localhost:5173"), ","),
		MicrosoftTenantID: strings.TrimSpace(os.Getenv("MS_TENANT_ID")),
		MicrosoftClientID: strings.TrimSpace(os.Getenv("MS_CLIENT_ID")),
		StaticDir:         strings.TrimSpace(os.Getenv("STATIC_DIR")),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL é obrigatória")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET é obrigatória")
	}
	if err := cfg.validarSSO(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// validarSSO recusa configuração pela metade ou em formato errado.
//
// Falhar na subida é melhor que descobrir depois: preenchida só uma das duas
// variáveis, o SSO ficaria silenciosamente desligado; e com o nome de domínio
// no lugar do GUID a validação do token falharia em produção com mensagem de
// "token inválido", que aponta para o lugar errado.
func (c *Config) validarSSO() error {
	if c.MicrosoftTenantID == "" && c.MicrosoftClientID == "" {
		return nil
	}
	if c.MicrosoftTenantID == "" || c.MicrosoftClientID == "" {
		return fmt.Errorf("MS_TENANT_ID e MS_CLIENT_ID devem ser definidas juntas (ou nenhuma das duas)")
	}
	if _, err := uuid.Parse(c.MicrosoftTenantID); err != nil {
		return fmt.Errorf("MS_TENANT_ID deve ser o Directory (tenant) ID em formato GUID, não o nome do domínio")
	}
	if _, err := uuid.Parse(c.MicrosoftClientID); err != nil {
		return fmt.Errorf("MS_CLIENT_ID deve ser o Application (client) ID em formato GUID")
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			return parsed
		}
	}
	return fallback
}
