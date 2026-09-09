// Package auth concentra os detalhes técnicos de autenticação (hash de senha e
// tokens JWT). Os casos de uso dependem apenas das interfaces PasswordHasher e
// TokenIssuer, mantendo a camada de negócio livre destas bibliotecas.
package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// BcryptHasher implementa usecase.PasswordHasher com bcrypt.
type BcryptHasher struct {
	cost int
}

func NewBcryptHasher() BcryptHasher {
	return BcryptHasher{cost: bcrypt.DefaultCost}
}

func (h BcryptHasher) Hash(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), h.cost)
	if err != nil {
		return "", fmt.Errorf("gerando hash de senha: %w", err)
	}
	return string(hash), nil
}

func (h BcryptHasher) Compare(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}

// JWTIssuer emite e valida os tokens de sessão.
type JWTIssuer struct {
	secret []byte
	ttl    time.Duration
}

func NewJWTIssuer(secret string, ttl time.Duration) *JWTIssuer {
	return &JWTIssuer{secret: []byte(secret), ttl: ttl}
}

// Issue gera o token do usuário, carregando o papel global nas claims para que o
// middleware de autorização não precise consultar o banco a cada requisição.
func (j *JWTIssuer) Issue(user *domain.User) (string, time.Time, error) {
	expiresAt := time.Now().Add(j.ttl)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID.String(),
		"role": string(user.Role),
		"name": user.Name,
		"iat":  jwt.NewNumericDate(time.Now()),
		"exp":  jwt.NewNumericDate(expiresAt),
	})

	signed, err := token.SignedString(j.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("assinando token: %w", err)
	}
	return signed, expiresAt, nil
}

// Parse valida o token e devolve o ator autenticado.
func (j *JWTIssuer) Parse(raw string) (domain.Actor, error) {
	token, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de assinatura inesperado: %v", t.Header["alg"])
		}
		return j.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return domain.Actor{}, domain.Unauthorized("token inválido ou expirado")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return domain.Actor{}, domain.Unauthorized("token inválido")
	}

	subject, _ := claims["sub"].(string)
	userID, err := uuid.Parse(subject)
	if err != nil {
		return domain.Actor{}, domain.Unauthorized("token sem usuário válido")
	}

	role, _ := claims["role"].(string)
	actor := domain.Actor{UserID: userID, Role: domain.Role(role)}
	if !actor.Role.Valid() {
		return domain.Actor{}, domain.Unauthorized("token com papel inválido")
	}

	return actor, nil
}
