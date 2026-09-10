package handler

import (
	"net/http"
	"time"

	"github.com/db1group/synergy/apps/api/internal/domain"
	"github.com/db1group/synergy/apps/api/internal/usecase"
)

// MotivatorHandler expõe a dinâmica Moving Motivators do próprio usuário.
type MotivatorHandler struct {
	motivators *usecase.MotivatorUseCase
}

func NewMotivatorHandler(motivators *usecase.MotivatorUseCase) *MotivatorHandler {
	return &MotivatorHandler{motivators: motivators}
}

// Get — GET /api/v1/me/motivators
func (h *MotivatorHandler) Get(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	ranking, err := h.motivators.Get(r.Context(), actor)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toMotivatorRankingResponse(ranking, time.Now().UTC()))
}

// Save — PUT /api/v1/me/motivators
//
// PUT e não PATCH: a ordenação é substituída por completo, nunca mesclada.
func (h *MotivatorHandler) Save(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req saveMotivatorsRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	ordem := make([]domain.Motivator, 0, len(req.Order))
	for _, item := range req.Order {
		ordem = append(ordem, domain.Motivator(item))
	}

	ranking, err := h.motivators.Save(r.Context(), actor, ordem)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toMotivatorRankingResponse(ranking, time.Now().UTC()))
}
