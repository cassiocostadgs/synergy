package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// ---------------------------------------------------------------------------
// Criação de times
// ---------------------------------------------------------------------------

func TestCreateTeam_GestorBecomesPrincipal(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)

	team, err := h.teams.Create(context.Background(), gestor, CreateTeamInput{Name: "  Squad Neon  "})
	requireNoError(t, err)

	if team.Name != "Squad Neon" {
		t.Errorf("esperava nome com trim aplicado, obtive %q", team.Name)
	}
	if team.Status != domain.TeamStatusActive {
		t.Errorf("esperava time ACTIVE, obtive %s", team.Status)
	}
	// RN1: o time nasce com exatamente 1 Gestor Principal.
	if got := h.roleOf(team.ID, gestor.UserID); got != domain.TeamRoleGestorPrincipal {
		t.Errorf("esperava criador como GESTOR_PRINCIPAL, obtive %q", got)
	}
	if got := h.countRole(team.ID, domain.TeamRoleGestorPrincipal); got != 1 {
		t.Errorf("esperava exatamente 1 Gestor Principal, obtive %d", got)
	}
}

func TestCreateTeam_ColaboradorIsForbidden(t *testing.T) {
	h := newHarness(t)
	colaborador := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.teams.Create(context.Background(), colaborador, CreateTeamInput{Name: "Squad X"})
	requireCode(t, err, domain.CodeForbidden)
}

func TestCreateTeam_EmptyNameIsInvalid(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)

	_, err := h.teams.Create(context.Background(), gestor, CreateTeamInput{Name: "   "})
	requireCode(t, err, domain.CodeValidation)
}

func TestCreateTeam_GestorCannotAppointAnotherPrincipal(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	outro := h.newUser("Carla", domain.RoleGestor)

	_, err := h.teams.Create(context.Background(), gestor, CreateTeamInput{
		Name:            "Squad X",
		PrincipalUserID: outro.UserID,
	})
	requireCode(t, err, domain.CodeForbidden)
}

func TestCreateTeam_AdminMustInformPrincipal(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)

	_, err := h.teams.Create(context.Background(), admin, CreateTeamInput{Name: "Squad X"})
	requireCode(t, err, domain.CodeValidation)
}

func TestCreateTeam_PrincipalMustBeGestorOrAdmin(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	colaborador := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.teams.Create(context.Background(), admin, CreateTeamInput{
		Name:            "Squad X",
		PrincipalUserID: colaborador.UserID,
	})
	requireCode(t, err, domain.CodeValidation)
}

// ---------------------------------------------------------------------------
// RN1 — 1 Gestor Principal e no máximo 1 Gestor de Apoio
// ---------------------------------------------------------------------------

func TestAddMember_RejectsSecondPrincipal(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	outroGestor := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, outroGestor.UserID, domain.TeamRoleGestorPrincipal)
	requireCode(t, err, domain.CodeConflict)

	if got := h.countRole(team.ID, domain.TeamRoleGestorPrincipal); got != 1 {
		t.Errorf("RN1 violada: esperava 1 Gestor Principal, obtive %d", got)
	}
}

func TestAddMember_AllowsOneSupportManagerThenRejectsSecond(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	apoio := h.newUser("Carla", domain.RoleGestor)
	segundoApoio := h.newUser("Diego", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, apoio.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)

	_, err = h.teams.AddMember(context.Background(), gestor, team.ID, segundoApoio.UserID, domain.TeamRoleGestorApoio)
	requireCode(t, err, domain.CodeConflict)

	if got := h.countRole(team.ID, domain.TeamRoleGestorApoio); got != 1 {
		t.Errorf("RN1 violada: esperava no máximo 1 Gestor de Apoio, obtive %d", got)
	}
}

func TestAddMember_SupportManagerMustBeGestorOrAdmin(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	colaborador := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, colaborador.UserID, domain.TeamRoleGestorApoio)
	requireCode(t, err, domain.CodeValidation)
}

func TestChangeMemberRole_RejectsPromotionToPrincipal(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.teams.ChangeMemberRole(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleGestorPrincipal)
	requireCode(t, err, domain.CodeConflict)

	if got := h.countRole(team.ID, domain.TeamRoleGestorPrincipal); got != 1 {
		t.Errorf("RN1 violada: esperava 1 Gestor Principal, obtive %d", got)
	}
}

func TestChangeMemberRole_RejectsDemotingPrincipal(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	// RN1: o time nunca pode ficar sem Gestor Principal.
	_, err := h.teams.ChangeMemberRole(context.Background(), gestor, team.ID, gestor.UserID, domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeConflict)

	if got := h.roleOf(team.ID, gestor.UserID); got != domain.TeamRoleGestorPrincipal {
		t.Errorf("esperava Gestor Principal intacto, obtive %q", got)
	}
}

func TestChangeMemberRole_RejectsSecondSupportManager(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	apoio := h.newUser("Carla", domain.RoleGestor)
	candidato := h.newUser("Diego", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, apoio.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)
	_, err = h.teams.AddMember(context.Background(), gestor, team.ID, candidato.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.teams.ChangeMemberRole(context.Background(), gestor, team.ID, candidato.UserID, domain.TeamRoleGestorApoio)
	requireCode(t, err, domain.CodeConflict)
}

func TestChangeMemberRole_SameRoleIsNoOp(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	member, err := h.teams.ChangeMemberRole(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
	if member.Role != domain.TeamRoleColaborador {
		t.Errorf("esperava papel inalterado, obtive %q", member.Role)
	}
}

func TestRemoveMember_RejectsPrincipal(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	err := h.teams.RemoveMember(context.Background(), gestor, team.ID, gestor.UserID)
	requireCode(t, err, domain.CodeConflict)

	if got := h.countRole(team.ID, domain.TeamRoleGestorPrincipal); got != 1 {
		t.Errorf("RN1 violada: esperava 1 Gestor Principal, obtive %d", got)
	}
}

func TestRemoveMember_AllowsColaborador(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	requireNoError(t, h.teams.RemoveMember(context.Background(), gestor, team.ID, membro.UserID))

	if got := h.roleOf(team.ID, membro.UserID); got != "" {
		t.Errorf("esperava membro removido, ainda encontrei papel %q", got)
	}
}

// ---------------------------------------------------------------------------
// RN2 — somente Gestores do próprio time controlam os membros
// ---------------------------------------------------------------------------

func TestAddMember_ColaboradorOfTeamIsForbidden(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	candidato := h.newUser("Elis", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	// Membro comum do time não pode administrar membros (RN2).
	_, err = h.teams.AddMember(context.Background(), membro, team.ID, candidato.UserID, domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeForbidden)
}

func TestAddMember_GestorOfAnotherTeamIsForbidden(t *testing.T) {
	h := newHarness(t)
	gestorA := h.newUser("Ana", domain.RoleGestor)
	gestorB := h.newUser("Carla", domain.RoleGestor)
	candidato := h.newUser("Elis", domain.RoleColaborador)

	teamA := h.newTeam("Squad A", gestorA)
	h.newTeam("Squad B", gestorB)

	// RN2: o gestor do time B não tem poder sobre o time A.
	_, err := h.teams.AddMember(context.Background(), gestorB, teamA.ID, candidato.UserID, domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeForbidden)
}

func TestAddMember_SupportManagerCanManage(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	apoio := h.newUser("Carla", domain.RoleGestor)
	candidato := h.newUser("Elis", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, apoio.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)

	// O Gestor de Apoio também é gestor do time (RN2).
	_, err = h.teams.AddMember(context.Background(), apoio, team.ID, candidato.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	if got := h.roleOf(team.ID, candidato.UserID); got != domain.TeamRoleColaborador {
		t.Errorf("esperava candidato adicionado como COLABORADOR, obtive %q", got)
	}
}

func TestAddMember_AdminBypassesTeamMembership(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Ana", domain.RoleGestor)
	candidato := h.newUser("Elis", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	// Admin global age sobre qualquer time, mesmo sem ser membro.
	_, err := h.teams.AddMember(context.Background(), admin, team.ID, candidato.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
}

func TestAddMember_RejectsDuplicateMember(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeConflict)
}

func TestAddMember_RejectsUnknownUser(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, uuid.New(), domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeNotFound)
}

func TestAddMember_RejectsInvalidRole(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRole("CHEFE"))
	requireCode(t, err, domain.CodeValidation)
}

// ---------------------------------------------------------------------------
// Arquivamento
// ---------------------------------------------------------------------------

func TestArchivedTeam_RejectsMemberChanges(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	candidato := h.newUser("Elis", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.Archive(context.Background(), gestor, team.ID)
	requireNoError(t, err)

	_, err = h.teams.AddMember(context.Background(), gestor, team.ID, candidato.UserID, domain.TeamRoleColaborador)
	requireCode(t, err, domain.CodeConflict)
}

func TestArchive_IsNotIdempotent(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.Archive(context.Background(), gestor, team.ID)
	requireNoError(t, err)

	_, err = h.teams.Archive(context.Background(), gestor, team.ID)
	requireCode(t, err, domain.CodeConflict)
}

// ---------------------------------------------------------------------------
// Transferência de liderança
// ---------------------------------------------------------------------------

func TestTransferPrincipal_MovesLeadership(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	sucessor := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, sucessor.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)

	requireNoError(t, h.teams.TransferPrincipal(context.Background(), gestor, team.ID, sucessor.UserID))

	if got := h.roleOf(team.ID, sucessor.UserID); got != domain.TeamRoleGestorPrincipal {
		t.Errorf("esperava sucessor como GESTOR_PRINCIPAL, obtive %q", got)
	}
	if got := h.roleOf(team.ID, gestor.UserID); got != domain.TeamRoleColaborador {
		t.Errorf("esperava gestor anterior como COLABORADOR, obtive %q", got)
	}
	// RN1 preservada após a transferência.
	if got := h.countRole(team.ID, domain.TeamRoleGestorPrincipal); got != 1 {
		t.Errorf("RN1 violada: esperava 1 Gestor Principal, obtive %d", got)
	}
}

func TestTransferPrincipal_TargetMustBeMember(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	forasteiro := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	err := h.teams.TransferPrincipal(context.Background(), gestor, team.ID, forasteiro.UserID)
	requireCode(t, err, domain.CodeNotFound)
}

func TestTransferPrincipal_OnlyCurrentPrincipalOrAdmin(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	apoio := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, apoio.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)

	// O Gestor de Apoio não pode se autopromover.
	err = h.teams.TransferPrincipal(context.Background(), apoio, team.ID, apoio.UserID)
	requireCode(t, err, domain.CodeForbidden)
}

func TestTransferPrincipal_TargetMustBeGestorOrAdmin(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	err = h.teams.TransferPrincipal(context.Background(), gestor, team.ID, membro.UserID)
	requireCode(t, err, domain.CodeValidation)
}

// ---------------------------------------------------------------------------
// Escopo de leitura
// ---------------------------------------------------------------------------

func TestList_ScopesToUserTeams(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestorA := h.newUser("Ana", domain.RoleGestor)
	gestorB := h.newUser("Carla", domain.RoleGestor)

	h.newTeam("Squad A", gestorA)
	h.newTeam("Squad B", gestorB)

	todos, err := h.teams.List(context.Background(), admin)
	requireNoError(t, err)
	if len(todos) != 2 {
		t.Errorf("Admin deveria ver 2 times, obtive %d", len(todos))
	}

	meus, err := h.teams.List(context.Background(), gestorA)
	requireNoError(t, err)
	if len(meus) != 1 || meus[0].Time.Name != "Squad A" {
		t.Errorf("Gestor deveria ver apenas o próprio time, obtive %+v", meus)
	}
	// A listagem informa o papel do ator em cada time, para a interface saber o
	// que ele pode fazer ali sem consultar os membros.
	if meus[0].MeuPapel != domain.TeamRoleGestorPrincipal {
		t.Errorf("esperava o papel na listagem, obtive %q", meus[0].MeuPapel)
	}
	// O Admin vê times de que não é membro: nesses, o papel vem vazio.
	for _, item := range todos {
		if item.MeuPapel != "" {
			t.Errorf("Admin não é membro de %s; esperava papel vazio, obtive %q", item.Time.Name, item.MeuPapel)
		}
	}
}

func TestList_PapelReflateOTimeCorreto(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	outroGestor := h.newUser("Diego", domain.RoleGestor)

	// Gestora principal em um time e simples colaboradora em outro.
	proprio := h.newTeam("Squad Proprio", gestor)
	alheio := h.newTeam("Squad Alheio", outroGestor)
	_, err := h.teams.AddMember(context.Background(), outroGestor, alheio.ID, gestor.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	times, err := h.teams.List(context.Background(), gestor)
	requireNoError(t, err)
	if len(times) != 2 {
		t.Fatalf("esperava 2 times, obtive %d", len(times))
	}

	porID := map[string]domain.TeamRole{}
	for _, item := range times {
		porID[item.Time.ID.String()] = item.MeuPapel
	}
	if porID[proprio.ID.String()] != domain.TeamRoleGestorPrincipal {
		t.Errorf("no time próprio esperava GESTOR_PRINCIPAL, obtive %q", porID[proprio.ID.String()])
	}
	if porID[alheio.ID.String()] != domain.TeamRoleColaborador {
		t.Errorf("no time alheio esperava COLABORADOR, obtive %q", porID[alheio.ID.String()])
	}
}

func TestGet_NonMemberIsForbidden(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	estranho := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.Get(context.Background(), estranho, team.ID)
	requireCode(t, err, domain.CodeForbidden)
}

func TestGet_UnknownTeamIsNotFound(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)

	_, err := h.teams.Get(context.Background(), gestor, uuid.New())
	requireCode(t, err, domain.CodeNotFound)
}

// ---------------------------------------------------------------------------
// Radar do time (motivadores agregados)
// ---------------------------------------------------------------------------

func TestMotivatorsOverview_ColaboradorNaoTemAcesso(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.teams.MotivatorsOverview(context.Background(), membro, team.ID, time.Now())
	requireCode(t, err, domain.CodeForbidden)
}

func TestMotivatorsOverview_GestorDeOutroTimeNaoTemAcesso(t *testing.T) {
	h := newHarness(t)
	gestorA := h.newUser("Carla", domain.RoleGestor)
	gestorB := h.newUser("Diego", domain.RoleGestor)
	teamA := h.newTeam("Squad A", gestorA)
	h.newTeam("Squad B", gestorB)

	_, err := h.teams.MotivatorsOverview(context.Background(), gestorB, teamA.ID, time.Now())
	requireCode(t, err, domain.CodeForbidden)
}

func TestMotivatorsOverview_GestorDoTimeEAdminTemAcesso(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.MotivatorsOverview(context.Background(), gestor, team.ID, time.Now())
	requireNoError(t, err)

	_, err = h.teams.MotivatorsOverview(context.Background(), admin, team.ID, time.Now())
	requireNoError(t, err)
}

func TestMotivatorsOverview_ContabilizaRespostasEPendentes(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	respondeu := h.newUser("Bruno", domain.RoleColaborador)
	naoRespondeu := h.newUser("Elis", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	for _, membro := range []domain.Actor{respondeu, naoRespondeu} {
		_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
		requireNoError(t, err)
	}

	_, err := h.motivators.Save(context.Background(), respondeu, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverview(context.Background(), gestor, team.ID, time.Now())
	requireNoError(t, err)

	// O time tem 3 pessoas, mas a gestora Carla fica fora da conta.
	if visao.TotalMembros != 2 {
		t.Errorf("esperava 2 colaboradores, obtive %d", visao.TotalMembros)
	}
	if visao.Responderam != 1 {
		t.Errorf("esperava 1 resposta, obtive %d", visao.Responderam)
	}
	// Só Elis não respondeu; a gestora não entra em pendentes.
	if len(visao.Pendentes) != 1 {
		t.Errorf("esperava 1 pendente, obtive %d: %+v", len(visao.Pendentes), visao.Pendentes)
	}
	if len(visao.Placar) != domain.TotalMotivators {
		t.Errorf("o placar deve trazer os %d motivadores, obtive %d", domain.TotalMotivators, len(visao.Placar))
	}
}

func TestMotivatorsOverview_GestoresFicamForaDeTudo(t *testing.T) {
	h := newHarness(t)
	principal := h.newUser("Carla", domain.RoleGestor)
	apoio := h.newUser("Diego", domain.RoleGestor)
	colaborador := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", principal)

	_, err := h.teams.AddMember(context.Background(), principal, team.ID, apoio.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)
	_, err = h.teams.AddMember(context.Background(), principal, team.ID, colaborador.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	// Os dois gestores respondem; o colaborador não.
	_, err = h.motivators.Save(context.Background(), principal, domain.MotivatorsCanonicos)
	requireNoError(t, err)
	_, err = h.motivators.Save(context.Background(), apoio, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverview(context.Background(), principal, team.ID, time.Now())
	requireNoError(t, err)

	// O time tem 3 pessoas, mas o Radar retrata apenas o colaborador.
	if visao.TotalMembros != 1 {
		t.Errorf("esperava 1 membro (só colaboradores), obtive %d", visao.TotalMembros)
	}
	if visao.Responderam != 0 {
		t.Errorf("as respostas dos gestores não devem contar, esperava 0, obtive %d", visao.Responderam)
	}
	if len(visao.Membros) != 1 || visao.Membros[0].Nome != "Bruno" {
		t.Errorf("esperava apenas Bruno na matriz, obtive %+v", visao.Membros)
	}
	// Sem respostas de colaborador, o placar fica zerado.
	for _, item := range visao.Placar {
		if item.Score != 0 {
			t.Errorf("%s: placar deveria estar zerado, obtive %v", item.Motivator, item.Score)
			break
		}
	}
	// E o gestor não entra na lista de pendentes.
	for _, pendente := range visao.Pendentes {
		if pendente.Nome == "Carla" || pendente.Nome == "Diego" {
			t.Errorf("gestor não deveria aparecer em pendentes: %s", pendente.Nome)
		}
	}
}

func TestMotivatorsOverview_TimeSoComGestores(t *testing.T) {
	h := newHarness(t)
	principal := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Novo", principal)

	// Time recém-criado só tem o Gestor Principal: situação normal, não erro.
	visao, err := h.teams.MotivatorsOverview(context.Background(), principal, team.ID, time.Now())
	requireNoError(t, err)

	if visao.TotalMembros != 0 {
		t.Errorf("esperava 0 colaboradores, obtive %d", visao.TotalMembros)
	}
	if len(visao.Membros) != 0 {
		t.Errorf("esperava matriz vazia, obtive %d linhas", len(visao.Membros))
	}
}

func TestMotivatorsOverview_MapaDeCalorTrazTodosDoTime(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	respondeu := h.newUser("Bruno", domain.RoleColaborador)
	naoRespondeu := h.newUser("Elis", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	for _, membro := range []domain.Actor{respondeu, naoRespondeu} {
		_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
		requireNoError(t, err)
	}

	_, err := h.motivators.Save(context.Background(), respondeu, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverview(context.Background(), gestor, team.ID, time.Now())
	requireNoError(t, err)

	// Todo colaborador aparece, inclusive quem não respondeu — a linha vazia
	// mostra quem falta. A gestora Carla fica fora.
	if len(visao.Membros) != 2 {
		t.Fatalf("esperava 2 linhas no mapa de calor, obtive %d", len(visao.Membros))
	}

	porNome := map[string]MembroDoRadar{}
	for _, linha := range visao.Membros {
		porNome[linha.Nome] = linha
	}

	bruno := porNome["Bruno"]
	if !bruno.Respondeu {
		t.Error("Bruno respondeu e deveria constar como tal")
	}
	if len(bruno.Posicoes) != domain.TotalMotivators {
		t.Errorf("esperava %d posições para Bruno, obtive %d", domain.TotalMotivators, len(bruno.Posicoes))
	}
	// Salvou na ordem canônica: o primeiro motivador está na posição 1.
	if bruno.Posicoes[domain.MotivatorsCanonicos[0]] != 1 {
		t.Errorf("esperava posição 1 para %s, obtive %d",
			domain.MotivatorsCanonicos[0], bruno.Posicoes[domain.MotivatorsCanonicos[0]])
	}
	if bruno.Posicoes[domain.MotivatorsCanonicos[domain.TotalMotivators-1]] != domain.TotalMotivators {
		t.Error("o último motivador da ordem deveria estar na última posição")
	}

	elis := porNome["Elis"]
	if elis.Respondeu {
		t.Error("Elis não respondeu")
	}
	if len(elis.Posicoes) != 0 {
		t.Errorf("quem não respondeu não deve ter posições, obtive %d", len(elis.Posicoes))
	}

	if _, apareceu := porNome["Carla"]; apareceu {
		t.Error("a gestora do time não deveria aparecer na matriz")
	}
	if bruno.PapelNoTime != domain.TeamRoleColaborador {
		t.Errorf("esperava o papel no time na linha, obtive %q", bruno.PapelNoTime)
	}
}

func TestMotivatorsOverview_RevisaoVencidaEntraComoPendente(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	// A resposta precisa ser de um colaborador: a do gestor fica fora do Radar.
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
	_, err = h.motivators.Save(context.Background(), membro, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	// Agora está em dia...
	visao, err := h.teams.MotivatorsOverview(context.Background(), gestor, team.ID, time.Now())
	requireNoError(t, err)
	if len(visao.Pendentes) != 0 {
		t.Errorf("recém-respondido não deveria estar pendente, obtive %+v", visao.Pendentes)
	}

	// ...mas passado o período de revisão, aparece como pendente sem deixar de
	// contar no placar.
	futuro := time.Now().AddDate(0, 0, domain.PeriodoRevisaoDias+5)
	visao, err = h.teams.MotivatorsOverview(context.Background(), gestor, team.ID, futuro)
	requireNoError(t, err)
	if len(visao.Pendentes) != 1 {
		t.Fatalf("esperava 1 pendente por revisão vencida, obtive %d", len(visao.Pendentes))
	}
	if !visao.Pendentes[0].Respondeu {
		t.Error("quem venceu a revisão deve constar como já tendo respondido")
	}
	if visao.Responderam != 1 {
		t.Errorf("a resposta vencida ainda conta no placar, esperava 1, obtive %d", visao.Responderam)
	}
}

func TestListMembers_ReturnsUserData(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Ana", domain.RoleGestor)
	membro := h.newUser("Bruno", domain.RoleColaborador)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, membro.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	members, err := h.teams.ListMembers(context.Background(), gestor, team.ID)
	requireNoError(t, err)
	if len(members) != 2 {
		t.Fatalf("esperava 2 membros, obtive %d", len(members))
	}
	for _, m := range members {
		if m.UserName == "" || m.UserEmail == "" {
			t.Errorf("esperava projeção com dados do usuário, obtive %+v", m)
		}
	}
}

// ---------------------------------------------------------------------------
// Radar consolidado — todos os times que a pessoa gere
// ---------------------------------------------------------------------------

func TestMotivatorsOverviewGeral_SomaOsTimesQueOGestorGere(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	ana := h.newUser("Ana", domain.RoleColaborador)
	bruno := h.newUser("Bruno", domain.RoleColaborador)

	primeiro := h.newTeam("Squad Neon", gestor)
	segundo := h.newTeam("Squad Aurora", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, primeiro.ID, ana.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
	_, err = h.teams.AddMember(context.Background(), gestor, segundo.ID, bruno.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.motivators.Save(context.Background(), ana, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), gestor, time.Now())
	requireNoError(t, err)

	if len(visao.Times) != 2 {
		t.Errorf("esperava os 2 times na conta, obtive %d", len(visao.Times))
	}
	if visao.TotalMembros != 2 {
		t.Errorf("esperava Ana e Bruno, obtive %d membros", visao.TotalMembros)
	}
	if visao.Responderam != 1 {
		t.Errorf("esperava 1 resposta, obtive %d", visao.Responderam)
	}
}

func TestMotivatorsOverviewGeral_CadaPessoaContaUmaVez(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	repetida := h.newUser("Ana", domain.RoleColaborador)

	primeiro := h.newTeam("Squad Neon", gestor)
	segundo := h.newTeam("Squad Aurora", gestor)

	// A mesma pessoa nos dois times.
	_, err := h.teams.AddMember(context.Background(), gestor, primeiro.ID, repetida.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
	_, err = h.teams.AddMember(context.Background(), gestor, segundo.ID, repetida.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.motivators.Save(context.Background(), repetida, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), gestor, time.Now())
	requireNoError(t, err)

	// Contar a mesma pessoa duas vezes faria a resposta dela pesar o dobro da
	// de um colega, e o placar deixaria de descrever o conjunto de pessoas.
	if visao.TotalMembros != 1 {
		t.Errorf("esperava 1 pessoa, obtive %d", visao.TotalMembros)
	}
	if visao.Responderam != 1 {
		t.Errorf("esperava 1 resposta, obtive %d", visao.Responderam)
	}
	if len(visao.Membros) != 1 {
		t.Errorf("esperava 1 linha no mapa de calor, obtive %d", len(visao.Membros))
	}
}

func TestMotivatorsOverviewGeral_QuemGereUmTimeFicaForaMesmoSendoColaboradorNoOutro(t *testing.T) {
	h := newHarness(t)
	carla := h.newUser("Carla", domain.RoleGestor)
	diego := h.newUser("Diego", domain.RoleGestor)

	daCarla := h.newTeam("Squad Neon", carla)
	doDiego := h.newTeam("Squad Aurora", diego)

	// Carla também gere o time do Diego (como apoio), e o Diego é colaborador
	// no time dela.
	_, err := h.teams.AddMember(context.Background(), diego, doDiego.ID, carla.UserID, domain.TeamRoleGestorApoio)
	requireNoError(t, err)
	_, err = h.teams.AddMember(context.Background(), carla, daCarla.ID, diego.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	_, err = h.motivators.Save(context.Background(), diego, domain.MotivatorsCanonicos)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), carla, time.Now())
	requireNoError(t, err)

	// Diego gere um dos times somados: entrar pela porta do outro quebraria a
	// separação entre quem observa e quem é observado.
	if visao.TotalMembros != 0 {
		t.Errorf("esperava nenhum observado, obtive %d: %+v", visao.TotalMembros, visao.Membros)
	}
	if visao.Responderam != 0 {
		t.Errorf("a resposta de quem gere não pode contar, obtive %d", visao.Responderam)
	}
}

func TestMotivatorsOverviewGeral_IgnoraTimeEmQueApenasParticipa(t *testing.T) {
	h := newHarness(t)
	carla := h.newUser("Carla", domain.RoleGestor)
	outro := h.newUser("Diego", domain.RoleGestor)
	bruno := h.newUser("Bruno", domain.RoleColaborador)

	daCarla := h.newTeam("Squad Neon", carla)
	doDiego := h.newTeam("Squad Aurora", outro)

	// Carla é só colaboradora no time do Diego.
	_, err := h.teams.AddMember(context.Background(), outro, doDiego.ID, carla.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
	_, err = h.teams.AddMember(context.Background(), outro, doDiego.ID, bruno.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), carla, time.Now())
	requireNoError(t, err)

	if len(visao.Times) != 1 || visao.Times[0].ID != daCarla.ID {
		t.Errorf("esperava só o time que ela gere, obtive %+v", visao.Times)
	}
	// Bruno está no time do Diego: não pode aparecer no consolidado da Carla.
	for _, membro := range visao.Membros {
		if membro.UserID == bruno.UserID {
			t.Error("membro de time alheio entrou no consolidado")
		}
	}
}

func TestMotivatorsOverviewGeral_IgnoraTimeArquivado(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	bruno := h.newUser("Bruno", domain.RoleColaborador)

	ativo := h.newTeam("Squad Neon", gestor)
	arquivado := h.newTeam("Squad Antigo", gestor)

	_, err := h.teams.AddMember(context.Background(), gestor, arquivado.ID, bruno.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)
	_, err = h.teams.Archive(context.Background(), gestor, arquivado.ID)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), gestor, time.Now())
	requireNoError(t, err)

	if len(visao.Times) != 1 || visao.Times[0].ID != ativo.ID {
		t.Errorf("time arquivado não deveria entrar, obtive %+v", visao.Times)
	}
	if visao.TotalMembros != 0 {
		t.Errorf("esperava nenhum membro, obtive %d", visao.TotalMembros)
	}
}

func TestMotivatorsOverviewGeral_MarcaOTimeDeCadaPessoa(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	ana := h.newUser("Ana", domain.RoleColaborador)

	time1 := h.newTeam("Squad Neon", gestor)
	_, err := h.teams.AddMember(context.Background(), gestor, time1.ID, ana.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), gestor, time.Now())
	requireNoError(t, err)

	// Sem o nome do time, a matriz consolidada não diz de onde cada pessoa veio.
	if len(visao.Membros) != 1 || visao.Membros[0].NomeDoTime != "Squad Neon" {
		t.Errorf("esperava a linha marcada com o time, obtive %+v", visao.Membros)
	}
}

func TestMotivatorsOverviewGeral_AdminVeTodosOsTimesAtivos(t *testing.T) {
	h := newHarness(t)
	admin := h.newUser("Admin", domain.RoleAdmin)
	gestor := h.newUser("Carla", domain.RoleGestor)
	bruno := h.newUser("Bruno", domain.RoleColaborador)

	team := h.newTeam("Squad Neon", gestor)
	_, err := h.teams.AddMember(context.Background(), gestor, team.ID, bruno.UserID, domain.TeamRoleColaborador)
	requireNoError(t, err)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), admin, time.Now())
	requireNoError(t, err)

	if len(visao.Times) != 1 {
		t.Errorf("o Admin deveria ver o time mesmo sem participar, obtive %d", len(visao.Times))
	}
	if visao.TotalMembros != 1 {
		t.Errorf("esperava Bruno na conta, obtive %d", visao.TotalMembros)
	}
}

func TestMotivatorsOverviewGeral_ColaboradorNaoTemAcesso(t *testing.T) {
	h := newHarness(t)
	colaborador := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.teams.MotivatorsOverviewGeral(context.Background(), colaborador, time.Now())
	requireCode(t, err, domain.CodeForbidden)
}

func TestMotivatorsOverviewGeral_GestorSemTimeRecebeVisaoVazia(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)

	visao, err := h.teams.MotivatorsOverviewGeral(context.Background(), gestor, time.Now())
	requireNoError(t, err)

	// Vazio não é erro: a tela mostra um estado explicando, como já faz quando
	// o gestor não gere nenhum time.
	if len(visao.Times) != 0 || visao.TotalMembros != 0 {
		t.Errorf("esperava visão vazia, obtive %+v", visao)
	}
}
