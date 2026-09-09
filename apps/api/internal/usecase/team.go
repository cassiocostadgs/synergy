package usecase

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// TeamUseCase concentra as regras de negócio do Épico 3.1 (Gestão de Times e Membros).
//
// Regra de Negócio 1: todo time possui exatamente 1 Gestor Principal e no máximo
// 1 Gestor de Apoio.
// Regra de Negócio 2: o acesso de novos colaboradores ao time é controlado
// exclusivamente pelos Gestores do próprio time (Admin global também pode agir).
type TeamUseCase struct {
	teams   domain.TeamRepository
	members domain.TeamMemberRepository
	users   domain.UserRepository
}

func NewTeamUseCase(
	teams domain.TeamRepository,
	members domain.TeamMemberRepository,
	users domain.UserRepository,
) *TeamUseCase {
	return &TeamUseCase{teams: teams, members: members, users: users}
}

// CreateTeamInput descreve a criação de um time. PrincipalUserID é opcional para
// um Gestor (assume a si mesmo) e obrigatório para um Admin.
type CreateTeamInput struct {
	Name            string
	PrincipalUserID uuid.UUID
}

// Create cadastra um time já com o seu Gestor Principal (RN1).
func (uc *TeamUseCase) Create(ctx context.Context, actor domain.Actor, input CreateTeamInput) (*domain.Team, error) {
	if !actor.IsAdmin() && actor.Role != domain.RoleGestor {
		return nil, domain.Forbidden("apenas Admin ou Gestor podem criar times")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, domain.Validation("o nome do time é obrigatório")
	}

	principalID := input.PrincipalUserID
	if principalID == uuid.Nil {
		if actor.IsAdmin() {
			return nil, domain.Validation("informe o Gestor Principal do time")
		}
		principalID = actor.UserID
	}

	// Um Gestor só pode criar times liderados por ele mesmo; designar outra pessoa
	// como Gestor Principal é prerrogativa do Admin.
	if !actor.IsAdmin() && principalID != actor.UserID {
		return nil, domain.Forbidden("um Gestor só pode criar times sob sua própria liderança")
	}

	if err := uc.assertCanBePrincipal(ctx, principalID); err != nil {
		return nil, err
	}

	team := &domain.Team{
		ID:     uuid.New(),
		Name:   name,
		Status: domain.TeamStatusActive,
	}
	principal := &domain.TeamMember{
		ID:     uuid.New(),
		TeamID: team.ID,
		UserID: principalID,
		Role:   domain.TeamRoleGestorPrincipal,
	}

	if err := uc.teams.Create(ctx, team, principal); err != nil {
		return nil, err
	}
	return team, nil
}

// Get retorna um time visível para o ator (Admin vê todos; membros veem o próprio).
func (uc *TeamUseCase) Get(ctx context.Context, actor domain.Actor, teamID uuid.UUID) (*domain.Team, error) {
	team, err := uc.loadTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if err := uc.requireTeamAccess(ctx, actor, team.ID); err != nil {
		return nil, err
	}
	return team, nil
}

// List retorna todos os times para o Admin e apenas os times do próprio usuário
// para os demais papéis.
func (uc *TeamUseCase) List(ctx context.Context, actor domain.Actor) ([]domain.Team, error) {
	if actor.IsAdmin() {
		return uc.teams.List(ctx)
	}
	return uc.teams.ListByUser(ctx, actor.UserID)
}

// Update altera os dados cadastrais do time.
func (uc *TeamUseCase) Update(ctx context.Context, actor domain.Actor, teamID uuid.UUID, name string) (*domain.Team, error) {
	team, err := uc.loadActiveTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if err := uc.requireTeamManager(ctx, actor, team.ID); err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, domain.Validation("o nome do time é obrigatório")
	}

	team.Name = trimmed
	if err := uc.teams.Update(ctx, team); err != nil {
		return nil, err
	}
	return team, nil
}

// Archive arquiva o time, bloqueando alterações posteriores de membros.
func (uc *TeamUseCase) Archive(ctx context.Context, actor domain.Actor, teamID uuid.UUID) (*domain.Team, error) {
	team, err := uc.loadTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if err := uc.requireTeamManager(ctx, actor, team.ID); err != nil {
		return nil, err
	}
	if team.IsArchived() {
		return nil, domain.Conflict("o time já está arquivado")
	}

	team.Status = domain.TeamStatusArchived
	if err := uc.teams.Update(ctx, team); err != nil {
		return nil, err
	}
	return team, nil
}

// ListMembers devolve o painel de membros do time.
func (uc *TeamUseCase) ListMembers(ctx context.Context, actor domain.Actor, teamID uuid.UUID) ([]domain.TeamMemberView, error) {
	team, err := uc.loadTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if err := uc.requireTeamAccess(ctx, actor, team.ID); err != nil {
		return nil, err
	}
	return uc.members.ListByTeam(ctx, team.ID)
}

// AddMember adiciona um usuário ao time (RN2) respeitando os limites de gestores (RN1).
func (uc *TeamUseCase) AddMember(
	ctx context.Context,
	actor domain.Actor,
	teamID, userID uuid.UUID,
	role domain.TeamRole,
) (*domain.TeamMember, error) {
	team, err := uc.loadActiveTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if err := uc.requireTeamManager(ctx, actor, team.ID); err != nil {
		return nil, err
	}
	if !role.Valid() {
		return nil, domain.Validation("papel de time inválido: %q", role)
	}
	// RN1: o Gestor Principal é definido na criação do time e só muda por transferência.
	if role == domain.TeamRoleGestorPrincipal {
		return nil, domain.Conflict("o time já possui um Gestor Principal; use a transferência de liderança")
	}
	if role == domain.TeamRoleGestorApoio {
		if err := uc.assertNoSupportManager(ctx, team.ID); err != nil {
			return nil, err
		}
		if err := uc.assertCanBePrincipal(ctx, userID); err != nil {
			return nil, err
		}
	}

	if _, err := uc.loadUser(ctx, userID); err != nil {
		return nil, err
	}

	existing, err := uc.findMember(ctx, team.ID, userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, domain.Conflict("o usuário já é membro deste time")
	}

	member := &domain.TeamMember{
		ID:     uuid.New(),
		TeamID: team.ID,
		UserID: userID,
		Role:   role,
	}
	if err := uc.members.Add(ctx, member); err != nil {
		return nil, err
	}
	return member, nil
}

// ChangeMemberRole altera o papel de um membro dentro do time (RN1 + RN2).
func (uc *TeamUseCase) ChangeMemberRole(
	ctx context.Context,
	actor domain.Actor,
	teamID, userID uuid.UUID,
	newRole domain.TeamRole,
) (*domain.TeamMember, error) {
	team, err := uc.loadActiveTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if err := uc.requireTeamManager(ctx, actor, team.ID); err != nil {
		return nil, err
	}
	if !newRole.Valid() {
		return nil, domain.Validation("papel de time inválido: %q", newRole)
	}

	member, err := uc.findMember(ctx, team.ID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, domain.NotFound("o usuário não é membro deste time")
	}
	if member.Role == newRole {
		return member, nil
	}

	// RN1: promover a Gestor Principal é transferência de liderança, não troca de papel.
	if newRole == domain.TeamRoleGestorPrincipal {
		return nil, domain.Conflict("para definir um novo Gestor Principal use a transferência de liderança")
	}
	// RN1: o time não pode ficar sem Gestor Principal.
	if member.Role == domain.TeamRoleGestorPrincipal {
		return nil, domain.Conflict("não é possível alterar o papel do Gestor Principal: transfira a liderança antes")
	}
	if newRole == domain.TeamRoleGestorApoio {
		if err := uc.assertNoSupportManager(ctx, team.ID); err != nil {
			return nil, err
		}
		if err := uc.assertCanBePrincipal(ctx, userID); err != nil {
			return nil, err
		}
	}

	if err := uc.members.UpdateRole(ctx, team.ID, userID, newRole); err != nil {
		return nil, err
	}
	member.Role = newRole
	return member, nil
}

// RemoveMember desvincula um membro do time (RN2), preservando o Gestor Principal (RN1).
func (uc *TeamUseCase) RemoveMember(ctx context.Context, actor domain.Actor, teamID, userID uuid.UUID) error {
	team, err := uc.loadActiveTeam(ctx, teamID)
	if err != nil {
		return err
	}
	if err := uc.requireTeamManager(ctx, actor, team.ID); err != nil {
		return err
	}

	member, err := uc.findMember(ctx, team.ID, userID)
	if err != nil {
		return err
	}
	if member == nil {
		return domain.NotFound("o usuário não é membro deste time")
	}
	if member.Role == domain.TeamRoleGestorPrincipal {
		return domain.Conflict("não é possível remover o Gestor Principal: transfira a liderança antes")
	}

	return uc.members.Remove(ctx, team.ID, userID)
}

// TransferPrincipal move a liderança do time para outro membro, mantendo sempre
// exatamente um Gestor Principal (RN1). O gestor anterior passa a Colaborador.
func (uc *TeamUseCase) TransferPrincipal(ctx context.Context, actor domain.Actor, teamID, newPrincipalUserID uuid.UUID) error {
	team, err := uc.loadActiveTeam(ctx, teamID)
	if err != nil {
		return err
	}

	current, err := uc.members.FindByTeamAndRole(ctx, team.ID, domain.TeamRoleGestorPrincipal)
	if err != nil {
		if domain.IsNotFound(err) {
			return domain.Conflict("o time está sem Gestor Principal; contate um Admin")
		}
		return err
	}

	// Só o próprio Gestor Principal ou um Admin podem transferir a liderança.
	if !actor.IsAdmin() && actor.UserID != current.UserID {
		return domain.Forbidden("apenas o Gestor Principal atual ou um Admin podem transferir a liderança")
	}
	if current.UserID == newPrincipalUserID {
		return domain.Conflict("o usuário já é o Gestor Principal deste time")
	}

	target, err := uc.findMember(ctx, team.ID, newPrincipalUserID)
	if err != nil {
		return err
	}
	if target == nil {
		return domain.NotFound("o novo Gestor Principal precisa ser membro do time")
	}
	if err := uc.assertCanBePrincipal(ctx, newPrincipalUserID); err != nil {
		return err
	}

	return uc.members.TransferPrincipal(ctx, team.ID, current.UserID, newPrincipalUserID)
}

// --- helpers ---

func (uc *TeamUseCase) loadTeam(ctx context.Context, teamID uuid.UUID) (*domain.Team, error) {
	team, err := uc.teams.FindByID(ctx, teamID)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil, domain.NotFound("time não encontrado")
		}
		return nil, err
	}
	return team, nil
}

func (uc *TeamUseCase) loadActiveTeam(ctx context.Context, teamID uuid.UUID) (*domain.Team, error) {
	team, err := uc.loadTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if team.IsArchived() {
		return nil, domain.Conflict("o time está arquivado e não aceita alterações")
	}
	return team, nil
}

func (uc *TeamUseCase) loadUser(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil, domain.NotFound("usuário não encontrado")
		}
		return nil, err
	}
	return user, nil
}

// findMember devolve (nil, nil) quando o usuário não é membro do time.
func (uc *TeamUseCase) findMember(ctx context.Context, teamID, userID uuid.UUID) (*domain.TeamMember, error) {
	member, err := uc.members.FindByTeamAndUser(ctx, teamID, userID)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return member, nil
}

// requireTeamAccess libera leitura para Admin e para qualquer membro do time.
func (uc *TeamUseCase) requireTeamAccess(ctx context.Context, actor domain.Actor, teamID uuid.UUID) error {
	if actor.IsAdmin() {
		return nil
	}
	member, err := uc.findMember(ctx, teamID, actor.UserID)
	if err != nil {
		return err
	}
	if member == nil {
		return domain.Forbidden("você não é membro deste time")
	}
	return nil
}

// requireTeamManager implementa a Regra de Negócio 2: apenas os Gestores do
// próprio time (ou um Admin global) podem administrar o time e seus membros.
func (uc *TeamUseCase) requireTeamManager(ctx context.Context, actor domain.Actor, teamID uuid.UUID) error {
	if actor.IsAdmin() {
		return nil
	}
	member, err := uc.findMember(ctx, teamID, actor.UserID)
	if err != nil {
		return err
	}
	if member == nil {
		return domain.Forbidden("você não é membro deste time")
	}
	if !member.Role.IsManager() {
		return domain.Forbidden("apenas os Gestores do próprio time podem executar esta ação")
	}
	return nil
}

// assertNoSupportManager garante o limite de 1 Gestor de Apoio por time (RN1).
func (uc *TeamUseCase) assertNoSupportManager(ctx context.Context, teamID uuid.UUID) error {
	_, err := uc.members.FindByTeamAndRole(ctx, teamID, domain.TeamRoleGestorApoio)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil
		}
		return err
	}
	return domain.Conflict("o time já possui um Gestor de Apoio")
}

// assertCanBePrincipal garante que apenas usuários com papel global de Gestor
// (ou Admin) exerçam a gestão de um time.
func (uc *TeamUseCase) assertCanBePrincipal(ctx context.Context, userID uuid.UUID) error {
	user, err := uc.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	if user.Role != domain.RoleGestor && user.Role != domain.RoleAdmin {
		return domain.Validation("apenas usuários com papel global de Gestor ou Admin podem gerir um time")
	}
	return nil
}
