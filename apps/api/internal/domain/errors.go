package domain

import (
	"errors"
	"fmt"
)

// ErrorCode classifica os erros de negócio para que a camada de handler possa
// traduzi-los em status HTTP sem conhecer as regras internas.
type ErrorCode string

const (
	CodeValidation   ErrorCode = "VALIDATION"
	CodeUnauthorized ErrorCode = "UNAUTHORIZED"
	CodeForbidden    ErrorCode = "FORBIDDEN"
	CodeNotFound     ErrorCode = "NOT_FOUND"
	CodeConflict     ErrorCode = "CONFLICT"
)

// Error é o erro de negócio padrão do domínio.
type Error struct {
	Code    ErrorCode
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func newError(code ErrorCode, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}

func Validation(format string, args ...any) *Error {
	return newError(CodeValidation, format, args...)
}

func Unauthorized(format string, args ...any) *Error {
	return newError(CodeUnauthorized, format, args...)
}

func Forbidden(format string, args ...any) *Error {
	return newError(CodeForbidden, format, args...)
}

func NotFound(format string, args ...any) *Error {
	return newError(CodeNotFound, format, args...)
}

func Conflict(format string, args ...any) *Error {
	return newError(CodeConflict, format, args...)
}

// CodeOf extrai o ErrorCode de um erro de domínio. Retorna string vazia para
// erros que não são de negócio (falha de infraestrutura, por exemplo).
func CodeOf(err error) ErrorCode {
	var domainErr *Error
	if errors.As(err, &domainErr) {
		return domainErr.Code
	}
	return ""
}

// IsNotFound é o predicado usado pelos casos de uso para distinguir "não existe"
// de uma falha real de infraestrutura. Por convenção, todo método Find* dos
// repositórios retorna NotFound quando o registro não é encontrado.
func IsNotFound(err error) bool {
	return CodeOf(err) == CodeNotFound
}
