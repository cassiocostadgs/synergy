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
