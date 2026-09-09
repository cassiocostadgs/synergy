package domain

import (
	"context"

	"github.com/google/uuid"
)

// UserRepository abstrai a persistência de usuários.
type UserRepository interface {
	Create(ctx context.Context, user *User, profile *Profile) error
	FindByID(ctx context.Context, id uuid.UUID) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	List(ctx context.Context) ([]User, error)
}

// ProfileRepository abstrai a persistência do perfil/gamificação.
type ProfileRepository interface {
	FindByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
}

// TeamRepository abstrai a persistência de times.
//
// Create grava o time e o seu Gestor Principal na MESMA transação, garantindo a
// Regra de Negócio 1 (todo time nasce com exatamente 1 Gestor Principal).
type TeamRepository interface {
	Create(ctx context.Context, team *Team, principal *TeamMember) error
	Update(ctx context.Context, team *Team) error
	FindByID(ctx context.Context, id uuid.UUID) (*Team, error)
	List(ctx context.Context) ([]Team, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Team, error)
}

// TeamMemberRepository abstrai a persistência dos vínculos de membros.
type TeamMemberRepository interface {
	Add(ctx context.Context, member *TeamMember) error
	FindByTeamAndUser(ctx context.Context, teamID, userID uuid.UUID) (*TeamMember, error)
	FindByTeamAndRole(ctx context.Context, teamID uuid.UUID, role TeamRole) (*TeamMember, error)
	ListByTeam(ctx context.Context, teamID uuid.UUID) ([]TeamMemberView, error)
	UpdateRole(ctx context.Context, teamID, userID uuid.UUID, role TeamRole) error
	Remove(ctx context.Context, teamID, userID uuid.UUID) error
	// TransferPrincipal rebaixa o Gestor Principal atual para Colaborador e promove
	// o novo membro a Gestor Principal atomicamente, para que o time nunca fique
	// sem Gestor Principal nem com dois ao mesmo tempo (Regra de Negócio 1).
	TransferPrincipal(ctx context.Context, teamID, fromUserID, toUserID uuid.UUID) error
}
