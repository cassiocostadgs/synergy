package domain

import (
	"time"

	"github.com/google/uuid"
)

// TeamStatus é o ciclo de vida do time (PRD seção 4).
type TeamStatus string

const (
	TeamStatusActive   TeamStatus = "ACTIVE"
	TeamStatusArchived TeamStatus = "ARCHIVED"
)

// TeamRole é o papel do usuário dentro de um time específico (PRD seção 4).
type TeamRole string

const (
	TeamRoleGestorPrincipal TeamRole = "GESTOR_PRINCIPAL"
	TeamRoleGestorApoio     TeamRole = "GESTOR_APOIO"
	TeamRoleColaborador     TeamRole = "COLABORADOR"
)

// Valid informa se o papel de time é um valor conhecido do enum.
func (r TeamRole) Valid() bool {
	switch r {
	case TeamRoleGestorPrincipal, TeamRoleGestorApoio, TeamRoleColaborador:
		return true
	default:
		return false
	}
}

// IsManager indica se o papel dá poderes de gestão sobre o time — base da
// Regra de Negócio 2 (somente Gestores do próprio time controlam os membros).
func (r TeamRole) IsManager() bool {
	return r == TeamRoleGestorPrincipal || r == TeamRoleGestorApoio
}

// Team é a entidade de time.
type Team struct {
	ID        uuid.UUID
	Name      string
	Status    TeamStatus
	CreatedAt time.Time
}

// IsArchived indica se o time está arquivado (bloqueia alterações de membros).
func (t Team) IsArchived() bool {
	return t.Status == TeamStatusArchived
}

// TeamMember é o vínculo entre um usuário e um time, com o papel exercido nele.
type TeamMember struct {
	ID     uuid.UUID
	TeamID uuid.UUID
	UserID uuid.UUID
	Role   TeamRole
}

// TeamMemberView é a projeção de leitura de um membro já com os dados do usuário,
// usada pelo painel de membros.
type TeamMemberView struct {
	TeamMember
	UserName  string
	UserEmail string
}
