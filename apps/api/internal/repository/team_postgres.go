package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// TeamRepository implementa domain.TeamRepository sobre o PostgreSQL.
type TeamRepository struct {
	pool *pgxpool.Pool
}

func NewTeamRepository(pool *pgxpool.Pool) *TeamRepository {
	return &TeamRepository{pool: pool}
}

// Create grava o time e o seu Gestor Principal na mesma transação, garantindo a
// Regra de Negócio 1 desde o nascimento do time.
func (r *TeamRepository) Create(ctx context.Context, team *domain.Team, principal *domain.TeamMember) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		INSERT INTO teams (id, name, status)
		VALUES ($1, $2, $3::team_status)`,
		team.ID, team.Name, string(team.Status),
	); err != nil {
		return translate(err, "já existe um time com estes dados")
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO team_members (id, team_id, user_id, role)
		VALUES ($1, $2, $3, $4::team_role)`,
		principal.ID, principal.TeamID, principal.UserID, string(principal.Role),
	); err != nil {
		return translate(err, "o time já possui um Gestor Principal")
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// created_at é preenchido pelo banco; devolvemos o valor real ao chamador.
	return r.pool.QueryRow(ctx,
		`SELECT created_at FROM teams WHERE id = $1`, team.ID,
	).Scan(&team.CreatedAt)
}

func (r *TeamRepository) Update(ctx context.Context, team *domain.Team) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE teams
		SET name = $2, status = $3::team_status
		WHERE id = $1`,
		team.ID, team.Name, string(team.Status),
	)
	if err != nil {
		return translate(err, "conflito ao atualizar o time")
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("time não encontrado")
	}
	return nil
}

func (r *TeamRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Team, error) {
	team, err := scanTeam(r.pool.QueryRow(ctx, `
		SELECT id, name, status::text, created_at
		FROM teams
		WHERE id = $1`, id))
	if err != nil {
		return nil, translate(err, "conflito ao consultar o time")
	}
	return team, nil
}

func (r *TeamRepository) List(ctx context.Context) ([]domain.Team, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, status::text, created_at
		FROM teams
		ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectTeams(rows)
}

func (r *TeamRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Team, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.name, t.status::text, t.created_at
		FROM teams t
		JOIN team_members tm ON tm.team_id = t.id
		WHERE tm.user_id = $1
		ORDER BY t.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectTeams(rows)
}

func collectTeams(rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}) ([]domain.Team, error) {
	teams := []domain.Team{}
	for rows.Next() {
		team, err := scanTeam(rows)
		if err != nil {
			return nil, err
		}
		teams = append(teams, *team)
	}
	return teams, rows.Err()
}

func scanTeam(row scanner) (*domain.Team, error) {
	var (
		team   domain.Team
		status string
	)
	if err := row.Scan(&team.ID, &team.Name, &status, &team.CreatedAt); err != nil {
		return nil, err
	}
	team.Status = domain.TeamStatus(status)
	return &team, nil
}

// TeamMemberRepository implementa domain.TeamMemberRepository sobre o PostgreSQL.
type TeamMemberRepository struct {
	pool *pgxpool.Pool
}

func NewTeamMemberRepository(pool *pgxpool.Pool) *TeamMemberRepository {
	return &TeamMemberRepository{pool: pool}
}

func (r *TeamMemberRepository) Add(ctx context.Context, member *domain.TeamMember) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO team_members (id, team_id, user_id, role)
		VALUES ($1, $2, $3, $4::team_role)`,
		member.ID, member.TeamID, member.UserID, string(member.Role),
	)
	// Os índices únicos parciais do banco também barram um 2º Gestor Principal
	// ou um 2º Gestor de Apoio (RN1), caso algo escape do caso de uso.
	return translate(err, "vínculo já existente ou limite de gestores do time atingido")
}

func (r *TeamMemberRepository) FindByTeamAndUser(ctx context.Context, teamID, userID uuid.UUID) (*domain.TeamMember, error) {
	member, err := scanMember(r.pool.QueryRow(ctx, `
		SELECT id, team_id, user_id, role::text
		FROM team_members
		WHERE team_id = $1 AND user_id = $2`, teamID, userID))
	if err != nil {
		return nil, translate(err, "conflito ao consultar o membro")
	}
	return member, nil
}

func (r *TeamMemberRepository) FindByTeamAndRole(ctx context.Context, teamID uuid.UUID, role domain.TeamRole) (*domain.TeamMember, error) {
	member, err := scanMember(r.pool.QueryRow(ctx, `
		SELECT id, team_id, user_id, role::text
		FROM team_members
		WHERE team_id = $1 AND role = $2::team_role`, teamID, string(role)))
	if err != nil {
		return nil, translate(err, "conflito ao consultar o membro")
	}
	return member, nil
}

func (r *TeamMemberRepository) ListByTeam(ctx context.Context, teamID uuid.UUID) ([]domain.TeamMemberView, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT tm.id, tm.team_id, tm.user_id, tm.role::text, u.name, u.email
		FROM team_members tm
		JOIN users u ON u.id = tm.user_id
		WHERE tm.team_id = $1
		ORDER BY
			CASE tm.role
				WHEN 'GESTOR_PRINCIPAL' THEN 0
				WHEN 'GESTOR_APOIO' THEN 1
				ELSE 2
			END,
			u.name`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	views := []domain.TeamMemberView{}
	for rows.Next() {
		var (
			view domain.TeamMemberView
			role string
		)
		if err := rows.Scan(
			&view.ID, &view.TeamID, &view.UserID, &role, &view.UserName, &view.UserEmail,
		); err != nil {
			return nil, err
		}
		view.Role = domain.TeamRole(role)
		views = append(views, view)
	}
	return views, rows.Err()
}

func (r *TeamMemberRepository) UpdateRole(ctx context.Context, teamID, userID uuid.UUID, role domain.TeamRole) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE team_members
		SET role = $3::team_role
		WHERE team_id = $1 AND user_id = $2`,
		teamID, userID, string(role),
	)
	if err != nil {
		return translate(err, "o time já possui um gestor neste papel")
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("membro não encontrado")
	}
	return nil
}

func (r *TeamMemberRepository) Remove(ctx context.Context, teamID, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM team_members
		WHERE team_id = $1 AND user_id = $2`, teamID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("membro não encontrado")
	}
	return nil
}

// TransferPrincipal rebaixa o gestor atual e promove o novo na mesma transação.
// A ordem importa: o rebaixamento vem primeiro para não violar o índice único
// parcial que garante um único Gestor Principal por time.
func (r *TeamMemberRepository) TransferPrincipal(ctx context.Context, teamID, fromUserID, toUserID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	demote, err := tx.Exec(ctx, `
		UPDATE team_members
		SET role = 'COLABORADOR'::team_role
		WHERE team_id = $1 AND user_id = $2`, teamID, fromUserID)
	if err != nil {
		return err
	}
	if demote.RowsAffected() == 0 {
		return domain.NotFound("gestor principal atual não encontrado no time")
	}

	promote, err := tx.Exec(ctx, `
		UPDATE team_members
		SET role = 'GESTOR_PRINCIPAL'::team_role
		WHERE team_id = $1 AND user_id = $2`, teamID, toUserID)
	if err != nil {
		return translate(err, "não foi possível promover o novo Gestor Principal")
	}
	if promote.RowsAffected() == 0 {
		return domain.NotFound("o novo Gestor Principal precisa ser membro do time")
	}

	return tx.Commit(ctx)
}

func (r *TeamMemberRepository) LeadsActiveTeam(ctx context.Context, userID uuid.UUID) (bool, error) {
	var lidera bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM team_members tm
			JOIN teams t ON t.id = tm.team_id
			WHERE tm.user_id = $1
			  AND tm.role = 'GESTOR_PRINCIPAL'::team_role
			  AND t.status = 'ACTIVE'::team_status
		)`, userID,
	).Scan(&lidera)
	if err != nil {
		return false, err
	}
	return lidera, nil
}

func scanMember(row scanner) (*domain.TeamMember, error) {
	var (
		member domain.TeamMember
		role   string
	)
	if err := row.Scan(&member.ID, &member.TeamID, &member.UserID, &role); err != nil {
		return nil, err
	}
	member.Role = domain.TeamRole(role)
	return &member, nil
}
