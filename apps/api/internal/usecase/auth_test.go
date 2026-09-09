package usecase

import (
	"context"
	"strings"
	"testing"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

func TestLogin_ComCredenciaisValidas(t *testing.T) {
	h := newHarness(t)
	ator := h.newUserComSenha("Ana", domain.RoleGestor, "senha-forte-1")

	out, err := h.auth.Login(context.Background(), "ana@synergy.dev", "senha-forte-1")
	requireNoError(t, err)

	if out.User.ID != ator.UserID {
		t.Errorf("esperava o usuário Ana, obtive %s", out.User.ID)
	}
	if out.Token == "" {
		t.Error("esperava um token emitido")
	}
}

func TestLogin_NormalizaEmail(t *testing.T) {
	h := newHarness(t)
	h.newUserComSenha("Ana", domain.RoleGestor, "senha-forte-1")

	_, err := h.auth.Login(context.Background(), "  ANA@Synergy.dev  ", "senha-forte-1")
	requireNoError(t, err)
}

// loginErro devolve apenas o erro de um login, para comparar mensagens.
func loginErro(t *testing.T, uc *AuthUseCase, email, senha string) error {
	t.Helper()
	_, err := uc.Login(context.Background(), email, senha)
	return err
}

func TestLogin_SenhaErradaNaoRevelaSeEmailExiste(t *testing.T) {
	h := newHarness(t)
	h.newUserComSenha("Ana", domain.RoleGestor, "senha-forte-1")

	errSenha := loginErro(t, h.auth, "ana@synergy.dev", "errada")
	errEmail := loginErro(t, h.auth, "ninguem@synergy.dev", "errada")

	requireCode(t, errSenha, domain.CodeUnauthorized)
	requireCode(t, errEmail, domain.CodeUnauthorized)
	if errSenha.Error() != errEmail.Error() {
		t.Errorf("as mensagens deveriam ser idênticas para não vazar existência de e-mail:\n  senha: %v\n  email: %v", errSenha, errEmail)
	}
}

func TestLogin_AuditorNaoRecebeSessao(t *testing.T) {
	h := newHarness(t)
	h.newUserComSenha("Auditor", domain.RoleAuditor, "senha-forte-1")

	// O papel existe no schema mas está fora do escopo do MVP (PRD seção 5).
	_, err := h.auth.Login(context.Background(), "auditor@synergy.dev", "senha-forte-1")
	requireCode(t, err, domain.CodeForbidden)
}

func TestLogin_ExigeEmailESenha(t *testing.T) {
	h := newHarness(t)
	_, err := h.auth.Login(context.Background(), "", "")
	requireCode(t, err, domain.CodeValidation)
}

// ---------------------------------------------------------------------------
// Edição dos próprios dados
// ---------------------------------------------------------------------------

func TestUpdateMe_AlteraNomeEHobby(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Ana", domain.RoleGestor)

	out, err := h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{
		Name:  "  Ana Souza  ",
		Hobby: "  Escalada  ",
	})
	requireNoError(t, err)

	if out.User.Name != "Ana Souza" {
		t.Errorf("esperava nome com trim aplicado, obtive %q", out.User.Name)
	}
	if out.Profile.Hobby != "Escalada" {
		t.Errorf("esperava hobby com trim aplicado, obtive %q", out.Profile.Hobby)
	}
}

func TestUpdateMe_RejeitaNomeVazio(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Ana", domain.RoleGestor)

	_, err := h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{Name: "   "})
	requireCode(t, err, domain.CodeValidation)
}

func TestUpdateMe_RejeitaCamposLongos(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Ana", domain.RoleGestor)

	_, err := h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{
		Name: strings.Repeat("a", maxNomeRunas+1),
	})
	requireCode(t, err, domain.CodeValidation)

	_, err = h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{
		Name:  "Ana",
		Hobby: strings.Repeat("b", maxHobbyRunas+1),
	})
	requireCode(t, err, domain.CodeValidation)
}

func TestUpdateMe_HobbyVazioLimpaOCampo(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Ana", domain.RoleGestor)

	_, err := h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{Name: "Ana", Hobby: "Escalada"})
	requireNoError(t, err)

	out, err := h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{Name: "Ana", Hobby: ""})
	requireNoError(t, err)
	if out.Profile.Hobby != "" {
		t.Errorf("esperava hobby limpo, obtive %q", out.Profile.Hobby)
	}
}

func TestUpdateMe_NaoAlteraPapelNemXP(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	out, err := h.auth.UpdateMe(context.Background(), ator, UpdateMeInput{Name: "Bruno Dev"})
	requireNoError(t, err)

	// UpdateMeInput não expõe papel nem XP — este teste trava esse contrato.
	if out.User.Role != domain.RoleColaborador {
		t.Errorf("papel não deveria mudar, obtive %s", out.User.Role)
	}
	if out.Profile.XP != 0 || out.Profile.Level != 1 {
		t.Errorf("gamificação não deveria mudar, obtive %d XP / nível %d", out.Profile.XP, out.Profile.Level)
	}
}

// ---------------------------------------------------------------------------
// Troca da própria senha
// ---------------------------------------------------------------------------

func TestChangePassword_TrocaEPassaAAutenticarComANova(t *testing.T) {
	h := newHarness(t)
	ator := h.newUserComSenha("Ana", domain.RoleGestor, "senha-antiga-1")

	requireNoError(t, h.auth.ChangePassword(context.Background(), ator, "senha-antiga-1", "senha-nova-2"))

	// A nova senha autentica...
	_, err := h.auth.Login(context.Background(), "ana@synergy.dev", "senha-nova-2")
	requireNoError(t, err)

	// ...e a antiga deixa de funcionar.
	_, err = h.auth.Login(context.Background(), "ana@synergy.dev", "senha-antiga-1")
	requireCode(t, err, domain.CodeUnauthorized)
}

func TestChangePassword_RejeitaSenhaAtualIncorreta(t *testing.T) {
	h := newHarness(t)
	ator := h.newUserComSenha("Ana", domain.RoleGestor, "senha-antiga-1")

	err := h.auth.ChangePassword(context.Background(), ator, "chute-errado", "senha-nova-2")
	requireCode(t, err, domain.CodeUnauthorized)

	// A senha original continua valendo.
	_, loginErr := h.auth.Login(context.Background(), "ana@synergy.dev", "senha-antiga-1")
	requireNoError(t, loginErr)
}

func TestChangePassword_ExigeSenhaAtual(t *testing.T) {
	h := newHarness(t)
	ator := h.newUserComSenha("Ana", domain.RoleGestor, "senha-antiga-1")

	err := h.auth.ChangePassword(context.Background(), ator, "", "senha-nova-2")
	requireCode(t, err, domain.CodeValidation)
}

func TestChangePassword_RejeitaNovaSenhaCurta(t *testing.T) {
	h := newHarness(t)
	ator := h.newUserComSenha("Ana", domain.RoleGestor, "senha-antiga-1")

	err := h.auth.ChangePassword(context.Background(), ator, "senha-antiga-1", "1234567")
	requireCode(t, err, domain.CodeValidation)
}

func TestChangePassword_RejeitaNovaIgualAAtual(t *testing.T) {
	h := newHarness(t)
	ator := h.newUserComSenha("Ana", domain.RoleGestor, "senha-antiga-1")

	err := h.auth.ChangePassword(context.Background(), ator, "senha-antiga-1", "senha-antiga-1")
	requireCode(t, err, domain.CodeValidation)
}

// ---------------------------------------------------------------------------
// Inativação de usuários
// ---------------------------------------------------------------------------

func TestSetUserStatus_ApenasAdmin(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	alvo := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.auth.SetUserStatus(context.Background(), gestor, alvo.UserID, domain.UserStatusInactive)
	requireCode(t, err, domain.CodeForbidden)
}

func TestSetUserStatus_InativaEBloqueiaOAcesso(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	alvo := h.newUserComSenha("Bruno", domain.RoleColaborador, "senha-forte-1")

	user, err := h.auth.SetUserStatus(context.Background(), admin, alvo.UserID, domain.UserStatusInactive)
	requireNoError(t, err)
	if user.Status != domain.UserStatusInactive {
		t.Errorf("esperava INACTIVE, obtive %s", user.Status)
	}

	// Não consegue mais autenticar...
	_, err = h.auth.Login(context.Background(), "bruno@synergy.dev", "senha-forte-1")
	requireCode(t, err, domain.CodeForbidden)

	// ...e a sessão que já tinha deixa de valer na próxima requisição.
	requireCode(t, h.auth.EnsureActive(context.Background(), alvo), domain.CodeForbidden)
}

func TestSetUserStatus_ReativaERestauraOAcesso(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	alvo := h.newUserComSenha("Bruno", domain.RoleColaborador, "senha-forte-1")

	_, err := h.auth.SetUserStatus(context.Background(), admin, alvo.UserID, domain.UserStatusInactive)
	requireNoError(t, err)
	_, err = h.auth.SetUserStatus(context.Background(), admin, alvo.UserID, domain.UserStatusActive)
	requireNoError(t, err)

	_, err = h.auth.Login(context.Background(), "bruno@synergy.dev", "senha-forte-1")
	requireNoError(t, err)
	requireNoError(t, h.auth.EnsureActive(context.Background(), alvo))
}

func TestSetUserStatus_AdminNaoInativaASiMesmo(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)

	// Sem esta guarda o Admin se trancaria fora do sistema.
	_, err := h.auth.SetUserStatus(context.Background(), admin, admin.UserID, domain.UserStatusInactive)
	requireCode(t, err, domain.CodeConflict)
}

func TestSetUserStatus_NaoInativaGestorPrincipalDeTimeAtivo(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Carla", domain.RoleGestor)
	h.newTeam("Squad Neon", gestor)

	_, err := h.auth.SetUserStatus(context.Background(), admin, gestor.UserID, domain.UserStatusInactive)
	requireCode(t, err, domain.CodeConflict)
}

func TestSetUserStatus_InativaLiderDeTimeArquivado(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.Archive(context.Background(), gestor, team.ID)
	requireNoError(t, err)

	// Time arquivado não precisa de liderança ativa.
	_, err = h.auth.SetUserStatus(context.Background(), admin, gestor.UserID, domain.UserStatusInactive)
	requireNoError(t, err)
}

func TestSetUserStatus_InativaColaboradorSemMexerNoVinculo(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Carla", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.auth.SetUserStatus(context.Background(), admin, membro.UserID, domain.UserStatusInactive)
	requireNoError(t, err)

	// Inativar preserva o histórico: o vínculo com o time continua existindo.
	if got := h.roleOf(team.ID, membro.UserID); got != domain.TeamRoleColaborador {
		t.Errorf("esperava vínculo preservado, obtive %q", got)
	}
}

func TestSetUserStatus_InativoNaoPodeSerAdicionadoNemLiderar(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Carla", domain.RoleGestor)
	inativo := h.newUser("Bruno", domain.RoleColaborador)
	outroGestor := h.newUser("Diego", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.auth.SetUserStatus(context.Background(), admin, inativo.UserID, domain.UserStatusInactive)
	requireNoError(t, err)
	_, err = h.auth.SetUserStatus(context.Background(), admin, outroGestor.UserID, domain.UserStatusInactive)
	requireNoError(t, err)

	// Contrapartida da inativação: sem acesso, não entra em time nem lidera.
	_, err = h.teams.AddMember(context.Background(), gestor, team.ID, inativo.UserID, domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeConflict)

	_, err = h.teams.AddMember(context.Background(), gestor, team.ID, outroGestor.UserID, domain.TeamRoleGestorApoio)
	requireCode(t, err, domain.CodeConflict)

	_, err = h.teams.Create(context.Background(), admin, CreateTeamInput{
		Name:            "Squad Fantasma",
		PrincipalUserID: outroGestor.UserID,
	})
	requireCode(t, err, domain.CodeConflict)
}

func TestSetUserStatus_RejeitaStatusInvalido(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	alvo := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.auth.SetUserStatus(context.Background(), admin, alvo.UserID, domain.UserStatus("SUMIU"))
	requireCode(t, err, domain.CodeValidation)
}

func TestSetUserStatus_MesmoStatusEhNoOp(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	alvo := h.newUser("Bruno", domain.RoleColaborador)

	user, err := h.auth.SetUserStatus(context.Background(), admin, alvo.UserID, domain.UserStatusActive)
	requireNoError(t, err)
	if user.Status != domain.UserStatusActive {
		t.Errorf("esperava ACTIVE, obtive %s", user.Status)
	}
}

// ---------------------------------------------------------------------------
// Cadastro pelo Admin
// ---------------------------------------------------------------------------

func TestCreateUser_ApenasAdmin(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)

	_, err := h.auth.CreateUser(context.Background(), gestor, CreateUserInput{
		Name: "Novo", Email: "novo@synergy.dev", Password: "senha-forte-1",
	})
	requireCode(t, err, domain.CodeForbidden)
}

func TestCreateUser_RejeitaEmailDuplicado(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	h.newUser("Ana", domain.RoleGestor)

	_, err := h.auth.CreateUser(context.Background(), admin, CreateUserInput{
		Name: "Outra Ana", Email: "ana@synergy.dev", Password: "senha-forte-1",
	})
	requireCode(t, err, domain.CodeConflict)
}

func TestCreateUser_RejeitaPapelForaDoMVP(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)

	_, err := h.auth.CreateUser(context.Background(), admin, CreateUserInput{
		Name: "Auditor", Email: "auditor@synergy.dev", Password: "senha-forte-1",
		Role: domain.RoleAuditor,
	})
	requireCode(t, err, domain.CodeValidation)
}

func TestCreateUser_NasceComPerfilDeGamificacao(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)

	user, err := h.auth.CreateUser(context.Background(), admin, CreateUserInput{
		Name: "Novo", Email: "novo@synergy.dev", Password: "senha-forte-1", Hobby: "Xadrez",
	})
	requireNoError(t, err)

	out, err := h.auth.Me(context.Background(), domain.Actor{UserID: user.ID, Role: user.Role})
	requireNoError(t, err)
	if out.Profile.Level != 1 || out.Profile.XP != 0 {
		t.Errorf("esperava nível 1 e 0 XP, obtive nível %d e %d XP", out.Profile.Level, out.Profile.XP)
	}
	if out.Profile.Hobby != "Xadrez" {
		t.Errorf("esperava hobby gravado, obtive %q", out.Profile.Hobby)
	}
}
