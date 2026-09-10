package handler

import (
	"time"

	"github.com/db1group/synergy/apps/api/internal/domain"
	"github.com/db1group/synergy/apps/api/internal/usecase"
)

// --- Requests ---

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginMicrosoftRequest struct {
	IDToken string `json:"idToken"`
}

type updateMeRequest struct {
	Name  string `json:"name"`
	Hobby string `json:"hobby"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type createUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
	Hobby    string `json:"hobby"`
}

type createTeamRequest struct {
	Name            string `json:"name"`
	PrincipalUserID string `json:"principalUserId"`
}

type updateTeamRequest struct {
	Name string `json:"name"`
}

type addMemberRequest struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
}

type changeMemberRoleRequest struct {
	Role string `json:"role"`
}

type transferPrincipalRequest struct {
	UserID string `json:"userId"`
}

// --- Responses ---

type setUserStatusRequest struct {
	Status string `json:"status"`
}

type setUserRoleRequest struct {
	Role string `json:"role"`
}

type resetPasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

type saveMotivatorsRequest struct {
	// Order traz os dez motivadores, da maior para a menor prioridade.
	Order []string `json:"order"`
}

type userResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type profileResponse struct {
	Hobby string `json:"hobby"`
	XP    int    `json:"xp"`
	Level int    `json:"level"`
}

type meResponse struct {
	User    userResponse    `json:"user"`
	Profile profileResponse `json:"profile"`
}

type loginResponse struct {
	Token     string       `json:"token"`
	ExpiresAt time.Time    `json:"expiresAt"`
	User      userResponse `json:"user"`
}

type teamResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	// MyRole é o papel de quem fez a requisição neste time. Ausente quando não
	// é membro — possível para o Admin, que enxerga todos os times.
	MyRole    string    `json:"myRole,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type memberResponse struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type motivatorRankingResponse struct {
	Order []string `json:"order"`
	// Answered é false para quem nunca respondeu — nesse caso a ordem devolvida
	// é a canônica, apenas como ponto de partida para a tela.
	Answered  bool       `json:"answered"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
	// Contadores da regra de revisão. Calculados aqui, e não no frontend, para
	// que o período de 90 dias tenha uma única fonte da verdade.
	DaysSinceAnswer  *int `json:"daysSinceAnswer,omitempty"`
	DaysUntilReview  *int `json:"daysUntilReview,omitempty"`
	ReviewPeriodDays int  `json:"reviewPeriodDays"`
	NeedsReview      bool `json:"needsReview"`
}

type motivatorScoreResponse struct {
	Motivator string  `json:"motivator"`
	Score     float64 `json:"score"`
	// AveragePosition é a colocação média (1 = topo).
	AveragePosition float64 `json:"averagePosition"`
	// TopCount é quantas pessoas do time colocaram no próprio top 3.
	TopCount int `json:"topCount"`
}

type pendingMemberResponse struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	// Answered false = nunca respondeu; true = respondeu mas venceu a revisão.
	Answered        bool `json:"answered"`
	DaysSinceAnswer int  `json:"daysSinceAnswer,omitempty"`
}

// radarMemberResponse é a linha de uma pessoa no mapa de calor individual.
type radarMemberResponse struct {
	UserID   string `json:"userId"`
	Name     string `json:"name"`
	TeamRole string `json:"teamRole"`
	Answered bool   `json:"answered"`
	// Positions mapeia motivador -> colocação (1 a 10). Vazio se não respondeu.
	Positions       map[string]int `json:"positions,omitempty"`
	DaysSinceAnswer int            `json:"daysSinceAnswer,omitempty"`
	NeedsReview     bool           `json:"needsReview"`
}

type teamMotivatorsResponse struct {
	Team             teamResponse             `json:"team"`
	MembersTotal     int                      `json:"membersTotal"`
	MembersAnswered  int                      `json:"membersAnswered"`
	ReviewPeriodDays int                      `json:"reviewPeriodDays"`
	Scores           []motivatorScoreResponse `json:"scores"`
	Members          []radarMemberResponse    `json:"members"`
	Pending          []pendingMemberResponse  `json:"pending"`
}

// --- Mappers ---

func toUserResponse(user *domain.User) userResponse {
	return userResponse{
		ID:        user.ID.String(),
		Name:      user.Name,
		Email:     user.Email,
		Role:      string(user.Role),
		Status:    string(user.Status),
		CreatedAt: user.CreatedAt,
	}
}

func toUserResponses(users []domain.User) []userResponse {
	out := make([]userResponse, 0, len(users))
	for i := range users {
		out = append(out, toUserResponse(&users[i]))
	}
	return out
}

func toMeResponse(out *usecase.MeOutput) meResponse {
	return meResponse{
		User: toUserResponse(out.User),
		Profile: profileResponse{
			Hobby: out.Profile.Hobby,
			XP:    out.Profile.XP,
			Level: out.Profile.Level,
		},
	}
}

func toMotivatorRankingResponse(
	ranking *domain.MotivatorRanking,
	agora time.Time,
) motivatorRankingResponse {
	ordem := make([]string, 0, len(ranking.Ordem))
	for _, motivador := range ranking.Ordem {
		ordem = append(ordem, string(motivador))
	}

	resposta := motivatorRankingResponse{
		Order:            ordem,
		Answered:         ranking.Preenchido(),
		ReviewPeriodDays: domain.PeriodoRevisaoDias,
		NeedsReview:      ranking.PrecisaRevisar(agora),
	}

	if resposta.Answered {
		atualizado := ranking.UpdatedAt
		resposta.UpdatedAt = &atualizado

		if dias, ok := ranking.DiasDesdeResposta(agora); ok {
			resposta.DaysSinceAnswer = &dias
		}
		if restantes, ok := ranking.DiasParaRevisar(agora); ok {
			resposta.DaysUntilReview = &restantes
		}
	}

	return resposta
}

func toTeamMotivatorsResponse(visao *usecase.MotivatorsDoTime) teamMotivatorsResponse {
	scores := make([]motivatorScoreResponse, 0, len(visao.Placar))
	for _, item := range visao.Placar {
		scores = append(scores, motivatorScoreResponse{
			Motivator:       string(item.Motivator),
			Score:           item.Score,
			AveragePosition: item.AveragePosition,
			TopCount:        item.TopCount,
		})
	}

	pendentes := make([]pendingMemberResponse, 0, len(visao.Pendentes))
	for _, membro := range visao.Pendentes {
		pendentes = append(pendentes, pendingMemberResponse{
			UserID:          membro.UserID.String(),
			Name:            membro.Nome,
			Answered:        membro.Respondeu,
			DaysSinceAnswer: membro.DiasDesdeResposta,
		})
	}

	membros := make([]radarMemberResponse, 0, len(visao.Membros))
	for _, linha := range visao.Membros {
		item := radarMemberResponse{
			UserID:          linha.UserID.String(),
			Name:            linha.Nome,
			TeamRole:        string(linha.PapelNoTime),
			Answered:        linha.Respondeu,
			DaysSinceAnswer: linha.DiasDesdeResposta,
			NeedsReview:     linha.PrecisaRevisar,
		}
		if len(linha.Posicoes) > 0 {
			posicoes := make(map[string]int, len(linha.Posicoes))
			for motivador, posicao := range linha.Posicoes {
				posicoes[string(motivador)] = posicao
			}
			item.Positions = posicoes
		}
		membros = append(membros, item)
	}

	return teamMotivatorsResponse{
		Team:             toTeamResponse(visao.Time),
		MembersTotal:     visao.TotalMembros,
		MembersAnswered:  visao.Responderam,
		ReviewPeriodDays: domain.PeriodoRevisaoDias,
		Scores:           scores,
		Members:          membros,
		Pending:          pendentes,
	}
}

func toTeamResponse(team *domain.Team) teamResponse {
	return teamResponse{
		ID:        team.ID.String(),
		Name:      team.Name,
		Status:    string(team.Status),
		CreatedAt: team.CreatedAt,
	}
}

func toTeamsComPapelResponse(times []usecase.TimeComPapel) []teamResponse {
	out := make([]teamResponse, 0, len(times))
	for i := range times {
		item := toTeamResponse(&times[i].Time)
		item.MyRole = string(times[i].MeuPapel)
		out = append(out, item)
	}
	return out
}

func toMemberResponses(members []domain.TeamMemberView) []memberResponse {
	out := make([]memberResponse, 0, len(members))
	for _, member := range members {
		out = append(out, memberResponse{
			UserID: member.UserID.String(),
			Name:   member.UserName,
			Email:  member.UserEmail,
			Role:   string(member.Role),
		})
	}
	return out
}
