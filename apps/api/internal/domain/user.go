package domain

import (
	"time"

	"github.com/google/uuid"
)

// Role é o papel global do usuário no sistema (PRD seção 2 — Matriz de Atores e Permissões).
type Role string

const (
	RoleAdmin       Role = "ADMIN"
	RoleGestor      Role = "GESTOR"
	RoleColaborador Role = "COLABORADOR"
	// RoleAuditor está reservado no modelo de dados (PRD seção 4), porém está
	// FORA DO ESCOPO DO MVP (PRD seção 5): nenhuma regra de autorização o considera.
	RoleAuditor Role = "AUDITOR"
)

// Valid informa se o papel é um valor conhecido do enum.
func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleGestor, RoleColaborador, RoleAuditor:
		return true
	default:
		return false
	}
}

// ImplementedInMVP separa os papéis que possuem regras de autorização nesta
// entrega dos que estão apenas reservados no schema.
func (r Role) ImplementedInMVP() bool {
	switch r {
	case RoleAdmin, RoleGestor, RoleColaborador:
		return true
	default:
		return false
	}
}

// UserStatus controla se o usuário pode usar o sistema. Inativar preserva o
// histórico de participação em times, o que uma exclusão destruiria.
type UserStatus string

const (
	UserStatusActive   UserStatus = "ACTIVE"
	UserStatusInactive UserStatus = "INACTIVE"
)

func (s UserStatus) Valid() bool {
	return s == UserStatusActive || s == UserStatusInactive
}

// User é a entidade de usuário do sistema.
type User struct {
	ID           uuid.UUID
	Name         string
	Email        string
	PasswordHash string
	Role         Role
	Status       UserStatus
	CreatedAt    time.Time
}

// IsActive indica se o usuário pode autenticar e usar o sistema.
func (u User) IsActive() bool {
	return u.Status == UserStatusActive
}

// Profile guarda os dados de perfil e gamificação do usuário (XP e nível).
type Profile struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Hobby  string
	XP     int
	Level  int
}

// Actor representa quem está executando a ação — usado pelos casos de uso para
// aplicar as regras de autorização (RBAC global + escopo de time).
type Actor struct {
	UserID uuid.UUID
	Role   Role
}

// IsAdmin indica se o ator tem permissão global de administrador.
func (a Actor) IsAdmin() bool {
	return a.Role == RoleAdmin
}
