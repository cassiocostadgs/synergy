package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config concentra os parâmetros de execução da API, todos vindos de variáveis
// de ambiente (ver apps/api/.env.example).
type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	JWTTTL         time.Duration
	AllowedOrigins []string
}

// Load lê a configuração do ambiente e valida o que é obrigatório.
func Load() (*Config, error) {
	cfg := &Config{
		Port:           env("API_PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		JWTTTL:         time.Duration(envInt("JWT_TTL_HOURS", 8)) * time.Hour,
		AllowedOrigins: strings.Split(env("CORS_ALLOWED_ORIGINS", "http://localhost:5173"), ","),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL é obrigatória")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET é obrigatória")
	}

	return cfg, nil
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
