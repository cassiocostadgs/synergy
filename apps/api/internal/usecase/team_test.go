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
	if len(meus) != 1 || meus[0].Name != "Squad A" {
		t.Errorf("Gestor deveria ver apenas o próprio time, obtive %+v", meus)
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

	if visao.TotalMembros != 3 {
		t.Errorf("esperava 3 membros, obtive %d", visao.TotalMembros)
	}
	if visao.Responderam != 1 {
		t.Errorf("esperava 1 resposta, obtive %d", visao.Responderam)
	}
	// Carla e Elis não responderam.
	if len(visao.Pendentes) != 2 {
		t.Errorf("esperava 2 pendentes, obtive %d: %+v", len(visao.Pendentes), visao.Pendentes)
	}
	if len(visao.Placar) != domain.TotalMotivators {
		t.Errorf("o placar deve trazer os %d motivadores, obtive %d", domain.TotalMotivators, len(visao.Placar))
	}
}

func TestMotivatorsOverview_RevisaoVencidaEntraComoPendente(t *testing.T) {
	h := newHarness(t)
	gestor := h.newUser("Carla", domain.RoleGestor)
	team := h.newTeam("Squad Neon", gestor)

	_, err := h.motivators.Save(context.Background(), gestor, domain.MotivatorsCanonicos)
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
