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
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type memberResponse struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
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

func toTeamResponse(team *domain.Team) teamResponse {
	return teamResponse{
		ID:        team.ID.String(),
		Name:      team.Name,
		Status:    string(team.Status),
		CreatedAt: team.CreatedAt,
	}
}

func toTeamResponses(teams []domain.Team) []teamResponse {
	out := make([]teamResponse, 0, len(teams))
	for i := range teams {
		out = append(out, toTeamResponse(&teams[i]))
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
