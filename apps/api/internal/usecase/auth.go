package usecase

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// PasswordHasher abstrai o algoritmo de hash de senha (implementado em internal/auth).
type PasswordHasher interface {
	Hash(plain string) (string, error)
	Compare(hash, plain string) error
}

// TokenIssuer abstrai a emissão do token de sessão (implementado em internal/auth).
type TokenIssuer interface {
	Issue(user *domain.User) (token string, expiresAt time.Time, err error)
}

// TeamLeadershipChecker é a fatia de TeamMemberRepository de que a gestão de
// usuários precisa: saber que vínculos de gestão alguém tem em times ativos
// antes de inativá-lo ou rebaixá-lo.
type TeamLeadershipChecker interface {
	LeadsActiveTeam(ctx context.Context, userID uuid.UUID) (bool, error)
	ManagesActiveTeam(ctx context.Context, userID uuid.UUID) (bool, error)
}

// AuthUseCase cobre autenticação, autogestão e o cadastro de usuários pelo Admin.
type AuthUseCase struct {
	users      domain.UserRepository
	profiles   domain.ProfileRepository
	leadership TeamLeadershipChecker
	hasher     PasswordHasher
	tokens     TokenIssuer
}

func NewAuthUseCase(
	users domain.UserRepository,
	profiles domain.ProfileRepository,
	leadership TeamLeadershipChecker,
	hasher PasswordHasher,
	tokens TokenIssuer,
) *AuthUseCase {
	return &AuthUseCase{
		users:      users,
		profiles:   profiles,
		leadership: leadership,
		hasher:     hasher,
		tokens:     tokens,
	}
}

// LoginOutput é o resultado de uma autenticação bem-sucedida.
type LoginOutput struct {
	Token     string
	ExpiresAt time.Time
	User      *domain.User
}

// Login autentica por e-mail e senha e emite o token de sessão.
func (uc *AuthUseCase) Login(ctx context.Context, email, password string) (*LoginOutput, error) {
	normalized := normalizeEmail(email)
	if normalized == "" || password == "" {
		return nil, domain.Validation("e-mail e senha são obrigatórios")
	}

	user, err := uc.users.FindByEmail(ctx, normalized)
	if err != nil {
		if domain.IsNotFound(err) {
			// Mensagem genérica de propósito: não revela se o e-mail existe.
			return nil, domain.Unauthorized("credenciais inválidas")
		}
		return nil, err
	}

	if err := uc.hasher.Compare(user.PasswordHash, password); err != nil {
		return nil, domain.Unauthorized("credenciais inválidas")
	}

	if !user.IsActive() {
		return nil, domain.Forbidden("este acesso foi inativado; procure um administrador")
	}

	// O papel Auditor existe no schema mas está fora do escopo do MVP (PRD seção 5):
	// sem regras de autorização definidas, não liberamos sessão para ele.
	if !user.Role.ImplementedInMVP() {
		return nil, domain.Forbidden("o papel %s não está habilitado neste MVP", user.Role)
	}

	token, expiresAt, err := uc.tokens.Issue(user)
	if err != nil {
		return nil, err
	}

	return &LoginOutput{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

// MeOutput agrega usuário e perfil (XP/nível) para a tela de perfil.
type MeOutput struct {
	User    *domain.User
	Profile *domain.Profile
}

// Me devolve os dados do próprio usuário autenticado.
func (uc *AuthUseCase) Me(ctx context.Context, actor domain.Actor) (*MeOutput, error) {
	user, err := uc.users.FindByID(ctx, actor.UserID)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil, domain.NotFound("usuário não encontrado")
		}
		return nil, err
	}

	profile, err := uc.profiles.FindByUserID(ctx, actor.UserID)
	if err != nil {
		if domain.IsNotFound(err) {
			// Perfil é criado junto com o usuário; a ausência não deve quebrar a tela.
			return &MeOutput{User: user, Profile: &domain.Profile{UserID: user.ID, Level: 1}}, nil
		}
		return nil, err
	}

	return &MeOutput{User: user, Profile: profile}, nil
}

// Limites de tamanho dos campos que o usuário edita livremente.
const (
	maxNomeRunas  = 120
	maxHobbyRunas = 120
	minSenha      = 8
)

// UpdateMeInput descreve os dados que o próprio usuário pode alterar.
//
// E-mail fica fora de propósito: é a identidade de login, e trocá-lo sem um
// fluxo de confirmação permitiria alguém se mover para um endereço que não
// controla (ou colidir com outro cadastro). Papel e XP também não entram —
// seriam escalada de privilégio e burla da gamificação.
type UpdateMeInput struct {
	Name  string
	Hobby string
}

// UpdateMe altera os dados cadastrais do próprio usuário autenticado.
func (uc *AuthUseCase) UpdateMe(ctx context.Context, actor domain.Actor, input UpdateMeInput) (*MeOutput, error) {
	name := strings.TrimSpace(input.Name)
	hobby := strings.TrimSpace(input.Hobby)

	switch {
	case name == "":
		return nil, domain.Validation("o nome é obrigatório")
	case len([]rune(name)) > maxNomeRunas:
		return nil, domain.Validation("o nome deve ter até %d caracteres", maxNomeRunas)
	case len([]rune(hobby)) > maxHobbyRunas:
		return nil, domain.Validation("o hobby deve ter até %d caracteres", maxHobbyRunas)
	}

	if err := uc.users.UpdateName(ctx, actor.UserID, name); err != nil {
		if domain.IsNotFound(err) {
			return nil, domain.NotFound("usuário não encontrado")
		}
		return nil, err
	}
	if err := uc.profiles.UpdateHobby(ctx, actor.UserID, hobby); err != nil && !domain.IsNotFound(err) {
		// Perfil ausente não impede a alteração do nome, que já foi gravada.
		return nil, err
	}

	return uc.Me(ctx, actor)
}

// ChangePassword troca a senha do próprio usuário, exigindo a senha atual.
//
// Atenção: os tokens já emitidos continuam válidos até expirar. Revogar sessão
// exigiria uma lista de bloqueio ou versionamento de credencial, o que está fora
// do escopo desta entrega.
func (uc *AuthUseCase) ChangePassword(ctx context.Context, actor domain.Actor, senhaAtual, novaSenha string) error {
	switch {
	case senhaAtual == "":
		return domain.Validation("informe a senha atual")
	case len(novaSenha) < minSenha:
		return domain.Validation("a nova senha deve ter ao menos %d caracteres", minSenha)
	case novaSenha == senhaAtual:
		return domain.Validation("a nova senha deve ser diferente da atual")
	}

	user, err := uc.users.FindByID(ctx, actor.UserID)
	if err != nil {
		if domain.IsNotFound(err) {
			return domain.NotFound("usuário não encontrado")
		}
		return err
	}

	if err := uc.hasher.Compare(user.PasswordHash, senhaAtual); err != nil {
		return domain.Unauthorized("a senha atual está incorreta")
	}

	hash, err := uc.hasher.Hash(novaSenha)
	if err != nil {
		return err
	}
	return uc.users.UpdatePassword(ctx, actor.UserID, hash)
}

// CreateUserInput descreve o cadastro de um novo usuário pelo Admin.
type CreateUserInput struct {
	Name     string
	Email    string
	Password string
	Role     domain.Role
	Hobby    string
}

// CreateUser cadastra um usuário. Restrito ao Admin global (PRD seção 2).
func (uc *AuthUseCase) CreateUser(ctx context.Context, actor domain.Actor, input CreateUserInput) (*domain.User, error) {
	if !actor.IsAdmin() {
		return nil, domain.Forbidden("apenas o Admin pode cadastrar usuários")
	}

	name := strings.TrimSpace(input.Name)
	email := normalizeEmail(input.Email)

	switch {
	case name == "":
		return nil, domain.Validation("o nome é obrigatório")
	case !strings.Contains(email, "@"):
		return nil, domain.Validation("e-mail inválido")
	case len(input.Password) < minSenha:
		return nil, domain.Validation("a senha deve ter ao menos %d caracteres", minSenha)
	}

	role := input.Role
	if role == "" {
		role = domain.RoleColaborador
	}
	if !role.ImplementedInMVP() {
		return nil, domain.Validation("papel inválido para este MVP: %q", role)
	}

	if _, err := uc.users.FindByEmail(ctx, email); err == nil {
		return nil, domain.Conflict("já existe um usuário com este e-mail")
	} else if !domain.IsNotFound(err) {
		return nil, err
	}

	hash, err := uc.hasher.Hash(input.Password)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		ID:           uuid.New(),
		Name:         name,
		Email:        email,
		PasswordHash: hash,
		Role:         role,
		Status:       domain.UserStatusActive,
		CreatedAt:    time.Now().UTC(),
	}
	profile := &domain.Profile{
		ID:     uuid.New(),
		UserID: user.ID,
		Hobby:  strings.TrimSpace(input.Hobby),
		XP:     0,
		Level:  1,
	}

	if err := uc.users.Create(ctx, user, profile); err != nil {
		return nil, err
	}
	return user, nil
}

// SetUserStatus ativa ou inativa um usuário. Restrito ao Admin global.
//
// Inativar não exclui: o vínculo com os times permanece, preservando o
// histórico. O que o usuário perde é o acesso — imediatamente, porque
// EnsureActive é consultado em cada requisição autenticada.
func (uc *AuthUseCase) SetUserStatus(
	ctx context.Context,
	actor domain.Actor,
	userID uuid.UUID,
	status domain.UserStatus,
) (*domain.User, error) {
	if !actor.IsAdmin() {
		return nil, domain.Forbidden("apenas o Admin pode ativar ou inativar usuários")
	}
	if !status.Valid() {
		return nil, domain.Validation("status inválido: %q", status)
	}
	// Sem isso o Admin poderia se trancar fora do sistema.
	if actor.UserID == userID && status == domain.UserStatusInactive {
		return nil, domain.Conflict("você não pode inativar o seu próprio acesso")
	}

	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil, domain.NotFound("usuário não encontrado")
		}
		return nil, err
	}
	if user.Status == status {
		return user, nil
	}

	// RN1 de reflexo: um time ativo não pode ficar liderado por quem não tem
	// acesso. A liderança precisa ser transferida antes.
	if status == domain.UserStatusInactive {
		lidera, err := uc.leadership.LeadsActiveTeam(ctx, userID)
		if err != nil {
			return nil, err
		}
		if lidera {
			return nil, domain.Conflict(
				"%s é Gestor Principal de um time ativo; transfira a liderança antes de inativar",
				user.Name,
			)
		}
	}

	if err := uc.users.UpdateStatus(ctx, userID, status); err != nil {
		return nil, err
	}
	user.Status = status
	return user, nil
}

// SetUserRole altera o papel global de um usuário. Restrito ao Admin.
func (uc *AuthUseCase) SetUserRole(
	ctx context.Context,
	actor domain.Actor,
	userID uuid.UUID,
	novoPapel domain.Role,
) (*domain.User, error) {
	if !actor.IsAdmin() {
		return nil, domain.Forbidden("apenas o Admin pode alterar papéis")
	}
	if !novoPapel.ImplementedInMVP() {
		return nil, domain.Validation("papel inválido para este MVP: %q", novoPapel)
	}
	// Rebaixar a si mesmo tiraria o próprio acesso à gestão, possivelmente
	// deixando o sistema sem nenhum Admin.
	if actor.UserID == userID {
		return nil, domain.Conflict("você não pode alterar o seu próprio papel")
	}

	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		if domain.IsNotFound(err) {
			return nil, domain.NotFound("usuário não encontrado")
		}
		return nil, err
	}
	if user.Role == novoPapel {
		return user, nil
	}

	// Papéis de gestão em time exigem Gestor ou Admin global. Rebaixar alguém
	// que gere um time ativo quebraria essa invariante.
	if novoPapel == domain.RoleColaborador {
		gere, err := uc.leadership.ManagesActiveTeam(ctx, userID)
		if err != nil {
			return nil, err
		}
		if gere {
			return nil, domain.Conflict(
				"%s exerce papel de gestão em um time ativo; ajuste o time antes de rebaixá-lo",
				user.Name,
			)
		}
	}

	if err := uc.users.UpdateRole(ctx, userID, novoPapel); err != nil {
		return nil, err
	}
	user.Role = novoPapel
	return user, nil
}

// ResetUserPassword define uma nova senha para outro usuário. Restrito ao Admin.
//
// Existe porque não há recuperação de senha por e-mail: sem isso, quem perde a
// senha só volta com alteração direta no banco.
//
// O Admin não redefine a própria senha por aqui — para isso existe
// ChangePassword, que exige a senha atual. Assim uma sessão de Admin roubada
// não consegue trocar a senha do dono e trancá-lo fora.
func (uc *AuthUseCase) ResetUserPassword(
	ctx context.Context,
	actor domain.Actor,
	userID uuid.UUID,
	novaSenha string,
) error {
	if !actor.IsAdmin() {
		return domain.Forbidden("apenas o Admin pode redefinir a senha de outro usuário")
	}
	if actor.UserID == userID {
		return domain.Conflict("para trocar a sua própria senha, use a opção do seu perfil")
	}
	if len(novaSenha) < minSenha {
		return domain.Validation("a nova senha deve ter ao menos %d caracteres", minSenha)
	}

	if _, err := uc.users.FindByID(ctx, userID); err != nil {
		if domain.IsNotFound(err) {
			return domain.NotFound("usuário não encontrado")
		}
		return err
	}

	hash, err := uc.hasher.Hash(novaSenha)
	if err != nil {
		return err
	}
	return uc.users.UpdatePassword(ctx, userID, hash)
}

// EnsureActive valida que a sessão ainda pertence a um usuário ativo.
//
// É chamado pelo middleware em cada requisição autenticada. Custa uma leitura
// por chave primária, e é o preço de a inativação valer na hora: sem isso, um
// token já emitido continuaria sendo aceito até expirar.
func (uc *AuthUseCase) EnsureActive(ctx context.Context, actor domain.Actor) error {
	user, err := uc.users.FindByID(ctx, actor.UserID)
	if err != nil {
		if domain.IsNotFound(err) {
			return domain.Unauthorized("sessão inválida")
		}
		return err
	}
	if !user.IsActive() {
		return domain.Forbidden("este acesso foi inativado; procure um administrador")
	}
	return nil
}

// ListUsers lista os usuários do sistema. Admin e Gestor têm acesso, pois o
// Gestor precisa buscar pessoas para adicionar ao seu time.
func (uc *AuthUseCase) ListUsers(ctx context.Context, actor domain.Actor) ([]domain.User, error) {
	if !actor.IsAdmin() && actor.Role != domain.RoleGestor {
		return nil, domain.Forbidden("você não tem permissão para listar usuários")
	}
	return uc.users.List(ctx)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
