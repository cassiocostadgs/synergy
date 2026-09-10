package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// maxBodyBytes limita o tamanho do corpo aceito nas requisições.
const maxBodyBytes = 1 << 20 // 1 MiB

// envelope é o formato único de resposta da API: sucesso em "data", falha em "error".
type envelope struct {
	Data  any        `json:"data,omitempty"`
	Error *errorBody `json:"error,omitempty"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, payload envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// respond escreve uma resposta de sucesso.
func respond(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, envelope{Data: data})
}

// respondError traduz erros de domínio em status HTTP. Erros inesperados viram
// 500 com mensagem genérica, para não expor detalhes de infraestrutura.
func respondError(w http.ResponseWriter, err error) {
	var domainErr *domain.Error
	if errors.As(err, &domainErr) {
		writeJSON(w, statusFor(domainErr.Code), envelope{
			Error: &errorBody{Code: string(domainErr.Code), Message: domainErr.Message},
		})
		return
	}

	writeJSON(w, http.StatusInternalServerError, envelope{
		Error: &errorBody{Code: "INTERNAL", Message: "erro interno inesperado"},
	})
}

func statusFor(code domain.ErrorCode) int {
	switch code {
	case domain.CodeValidation:
		return http.StatusBadRequest
	case domain.CodeUnauthorized:
		return http.StatusUnauthorized
	case domain.CodeForbidden:
		return http.StatusForbidden
	case domain.CodeNotFound:
		return http.StatusNotFound
	case domain.CodeConflict:
		return http.StatusConflict
	case domain.CodeSSOSemCadastro:
		// Autenticou na Microsoft, mas não tem cadastro aqui: o pedido foi
		// entendido e recusado, então 403 — não 401, que convidaria o cliente a
		// tentar autenticar de novo.
		return http.StatusForbidden
	default:
		return http.StatusInternalServerError
	}
}

// decode lê o corpo JSON da requisição, com limite de tamanho e rejeitando
// campos desconhecidos (falha cedo em vez de ignorar erro de contrato).
func decode(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodyBytes)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return domain.Validation("corpo da requisição é obrigatório")
		}
		return domain.Validation("corpo da requisição inválido: %v", err)
	}
	return nil
}

// parseUUID extrai e valida um UUID vindo da rota.
func parseUUID(raw, field string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, domain.Validation("%s inválido", field)
	}
	return id, nil
}
