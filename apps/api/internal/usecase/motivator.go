package usecase

import (
	"context"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// MotivatorUseCase cobre a dinâmica Moving Motivators no perfil do usuário
// (PRD seção 3.2.3).
type MotivatorUseCase struct {
	motivators domain.MotivatorRepository
}

func NewMotivatorUseCase(motivators domain.MotivatorRepository) *MotivatorUseCase {
	return &MotivatorUseCase{motivators: motivators}
}

// Get devolve o ranking do próprio usuário. Quem nunca preencheu recebe a
// ordem canônica, marcada como não preenchida — assim a tela já tem uma lista
// para ordenar.
func (uc *MotivatorUseCase) Get(ctx context.Context, actor domain.Actor) (*domain.MotivatorRanking, error) {
	ranking, err := uc.motivators.FindByUserID(ctx, actor.UserID)
	if err != nil {
		return nil, err
	}
	if !ranking.Preenchido() {
		ranking.Ordem = append([]domain.Motivator{}, domain.MotivatorsCanonicos...)
	}
	return ranking, nil
}

// Save grava a ordenação do próprio usuário.
//
// Exige uma permutação completa dos dez motivadores: a prática é ordenar todos,
// não escolher alguns. Aceitar lista parcial produziria perfis incomparáveis
// entre pessoas.
func (uc *MotivatorUseCase) Save(
	ctx context.Context,
	actor domain.Actor,
	ordem []domain.Motivator,
) (*domain.MotivatorRanking, error) {
	if len(ordem) != domain.TotalMotivators {
		return nil, domain.Validation(
			"informe os %d motivadores em ordem (recebi %d)",
			domain.TotalMotivators, len(ordem),
		)
	}

	vistos := make(map[domain.Motivator]bool, len(ordem))
	for _, motivador := range ordem {
		if !motivador.Valid() {
			return nil, domain.Validation("motivador desconhecido: %q", motivador)
		}
		if vistos[motivador] {
			return nil, domain.Validation("motivador repetido: %q", motivador)
		}
		vistos[motivador] = true
	}

	// Com dez itens distintos e válidos, a lista é necessariamente uma
	// permutação completa — nenhum motivador ficou de fora.

	if err := uc.motivators.Replace(ctx, actor.UserID, ordem); err != nil {
		return nil, err
	}

	return uc.Get(ctx, actor)
}
