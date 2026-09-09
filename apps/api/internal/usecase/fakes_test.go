package usecase

import (
	"context"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// fakeStore é a "base de dados" em memória compartilhada pelos repositórios fake.
// Os Find* seguem a convenção do domínio: devolvem erro NotFound quando não acham.
// Os getters devolvem cópias, para que os casos de uso só consigam persistir
// alterações chamando explicitamente Update/Add/Remove.
type fakeStore struct {
	users    map[uuid.UUID]*domain.User
	profiles map[uuid.UUID]*domain.Profile
	teams    map[uuid.UUID]*domain.Team
	members  []*domain.TeamMember
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		users:    map[uuid.UUID]*domain.User{},
		profiles: map[uuid.UUID]*domain.Profile{},
		teams:    map[uuid.UUID]*domain.Team{},
	}
}

// --- UserRepository ---

type fakeUserRepo struct{ store *fakeStore }

func (r fakeUserRepo) Create(_ context.Context, user *domain.User, profile *domain.Profile) error {
	copyUser := *user
	r.store.users[user.ID] = &copyUser
	if profile != nil {
		copyProfile := *profile
		r.store.profiles[profile.UserID] = &copyProfile
	}
	return nil
}

func (r fakeUserRepo) FindByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	user, ok := r.store.users[id]
	if !ok {
		return nil, domain.NotFound("usuário não encontrado")
	}
	copyUser := *user
	return &copyUser, nil
}

func (r fakeUserRepo) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, user := range r.store.users {
		if strings.EqualFold(user.Email, email) {
			copyUser := *user
			return &copyUser, nil
		}
	}
	return nil, domain.NotFound("usuário não encontrado")
}

func (r fakeUserRepo) List(_ context.Context) ([]domain.User, error) {
	out := make([]domain.User, 0, len(r.store.users))
	for _, user := range r.store.users {
		out = append(out, *user)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// --- ProfileRepository ---

type fakeProfileRepo struct{ store *fakeStore }

func (r fakeProfileRepo) FindByUserID(_ context.Context, userID uuid.UUID) (*domain.Profile, error) {
	profile, ok := r.store.profiles[userID]
	if !ok {
		return nil, domain.NotFound("perfil não encontrado")
	}
	copyProfile := *profile
	return &copyProfile, nil
}

// --- TeamRepository ---

type fakeTeamRepo struct{ store *fakeStore }

// Create grava time + Gestor Principal juntos, como a transação do Postgres faz.
func (r fakeTeamRepo) Create(_ context.Context, team *domain.Team, principal *domain.TeamMember) error {
	copyTeam := *team
	r.store.teams[team.ID] = &copyTeam
	copyMember := *principal
	r.store.members = append(r.store.members, &copyMember)
	return nil
}

func (r fakeTeamRepo) Update(_ context.Context, team *domain.Team) error {
	if _, ok := r.store.teams[team.ID]; !ok {
		return domain.NotFound("time não encontrado")
	}
	copyTeam := *team
	r.store.teams[team.ID] = &copyTeam
	return nil
}

func (r fakeTeamRepo) FindByID(_ context.Context, id uuid.UUID) (*domain.Team, error) {
	team, ok := r.store.teams[id]
	if !ok {
		return nil, domain.NotFound("time não encontrado")
	}
	copyTeam := *team
	return &copyTeam, nil
}

func (r fakeTeamRepo) List(_ context.Context) ([]domain.Team, error) {
	out := make([]domain.Team, 0, len(r.store.teams))
	for _, team := range r.store.teams {
		out = append(out, *team)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (r fakeTeamRepo) ListByUser(_ context.Context, userID uuid.UUID) ([]domain.Team, error) {
	out := []domain.Team{}
	for _, member := range r.store.members {
		if member.UserID != userID {
			continue
		}
		if team, ok := r.store.teams[member.TeamID]; ok {
			out = append(out, *team)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// --- TeamMemberRepository ---

type fakeMemberRepo struct{ store *fakeStore }

func (r fakeMemberRepo) Add(_ context.Context, member *domain.TeamMember) error {
	copyMember := *member
	r.store.members = append(r.store.members, &copyMember)
	return nil
}

func (r fakeMemberRepo) FindByTeamAndUser(_ context.Context, teamID, userID uuid.UUID) (*domain.TeamMember, error) {
	for _, member := range r.store.members {
		if member.TeamID == teamID && member.UserID == userID {
			copyMember := *member
			return &copyMember, nil
		}
	}
	return nil, domain.NotFound("membro não encontrado")
}

func (r fakeMemberRepo) FindByTeamAndRole(_ context.Context, teamID uuid.UUID, role domain.TeamRole) (*domain.TeamMember, error) {
	for _, member := range r.store.members {
		if member.TeamID == teamID && member.Role == role {
			copyMember := *member
			return &copyMember, nil
		}
	}
	return nil, domain.NotFound("membro não encontrado")
}

func (r fakeMemberRepo) ListByTeam(_ context.Context, teamID uuid.UUID) ([]domain.TeamMemberView, error) {
	out := []domain.TeamMemberView{}
	for _, member := range r.store.members {
		if member.TeamID != teamID {
			continue
		}
		view := domain.TeamMemberView{TeamMember: *member}
		if user, ok := r.store.users[member.UserID]; ok {
			view.UserName = user.Name
			view.UserEmail = user.Email
		}
		out = append(out, view)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UserName < out[j].UserName })
	return out, nil
}

func (r fakeMemberRepo) UpdateRole(_ context.Context, teamID, userID uuid.UUID, role domain.TeamRole) error {
	for _, member := range r.store.members {
		if member.TeamID == teamID && member.UserID == userID {
			member.Role = role
			return nil
		}
	}
	return domain.NotFound("membro não encontrado")
}

func (r fakeMemberRepo) Remove(_ context.Context, teamID, userID uuid.UUID) error {
	for i, member := range r.store.members {
		if member.TeamID == teamID && member.UserID == userID {
			r.store.members = append(r.store.members[:i], r.store.members[i+1:]...)
			return nil
		}
	}
	return domain.NotFound("membro não encontrado")
}

func (r fakeMemberRepo) TransferPrincipal(ctx context.Context, teamID, fromUserID, toUserID uuid.UUID) error {
	if err := r.UpdateRole(ctx, teamID, fromUserID, domain.TeamRoleColaborador); err != nil {
		return err
	}
	return r.UpdateRole(ctx, teamID, toUserID, domain.TeamRoleGestorPrincipal)
}

// --- harness de teste ---

type harness struct {
	t       *testing.T
	store   *fakeStore
	teams   *TeamUseCase
	auth    *AuthUseCase
	members fakeMemberRepo
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	store := newFakeStore()
	users := fakeUserRepo{store: store}
	profiles := fakeProfileRepo{store: store}
	teams := fakeTeamRepo{store: store}
	members := fakeMemberRepo{store: store}

	return &harness{
		t:       t,
		store:   store,
		teams:   NewTeamUseCase(teams, members, users),
		auth:    NewAuthUseCase(users, profiles, stubHasher{}, stubTokens{}),
		members: members,
	}
}

// newUser cria um usuário no store e devolve o Actor correspondente.
func (h *harness) newUser(name string, role domain.Role) domain.Actor {
	h.t.Helper()
	id := uuid.New()
	h.store.users[id] = &domain.User{
		ID:    id,
		Name:  name,
		Email: strings.ToLower(name) + "@synergy.dev",
		Role:  role,
	}
	return domain.Actor{UserID: id, Role: role}
}

// newTeam cria um time ativo liderado pelo gestor informado.
func (h *harness) newTeam(name string, principal domain.Actor) *domain.Team {
	h.t.Helper()
	team, err := h.teams.Create(context.Background(), principal, CreateTeamInput{Name: name})
	if err != nil {
		h.t.Fatalf("newTeam(%q): erro inesperado: %v", name, err)
	}
	return team
}

// roleOf devolve o papel do usuário dentro do time (ou string vazia se não for membro).
func (h *harness) roleOf(teamID, userID uuid.UUID) domain.TeamRole {
	h.t.Helper()
	member, err := h.members.FindByTeamAndUser(context.Background(), teamID, userID)
	if err != nil {
		return ""
	}
	return member.Role
}

// countRole conta quantos membros do time têm o papel informado.
func (h *harness) countRole(teamID uuid.UUID, role domain.TeamRole) int {
	h.t.Helper()
	count := 0
	for _, member := range h.store.members {
		if member.TeamID == teamID && member.Role == role {
			count++
		}
	}
	return count
}

type stubHasher struct{}

func (stubHasher) Hash(plain string) (string, error) { return "hash:" + plain, nil }

func (stubHasher) Compare(hash, plain string) error {
	if hash != "hash:"+plain {
		return domain.Unauthorized("senha inválida")
	}
	return nil
}

type stubTokens struct{}

func (stubTokens) Issue(user *domain.User) (string, time.Time, error) {
	return "token:" + user.ID.String(), time.Now().Add(time.Hour), nil
}

// requireCode falha o teste se o erro não for um erro de domínio com o código esperado.
func requireCode(t *testing.T, err error, want domain.ErrorCode) {
	t.Helper()
	if err == nil {
		t.Fatalf("esperava erro com código %s, mas não houve erro", want)
	}
	if got := domain.CodeOf(err); got != want {
		t.Fatalf("esperava código %s, obtive %s (erro: %v)", want, got, err)
	}
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
}
