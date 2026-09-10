package usecase

import (
	"context"
	"testing"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// ordemInvertida devolve os motivadores canônicos de trás para frente — uma
// permutação válida e diferente da inicial.
func ordemInvertida() []domain.Motivator {
	canonicos := domain.MotivatorsCanonicos
	invertida := make([]domain.Motivator, 0, len(canonicos))
	for i := len(canonicos) - 1; i >= 0; i-- {
		invertida = append(invertida, canonicos[i])
	}
	return invertida
}

func TestMotivators_QuemNuncaRespondeuRecebeOrdemCanonica(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	ranking, err := h.motivators.Get(context.Background(), ator)
	requireNoError(t, err)

	if len(ranking.Ordem) != domain.TotalMotivators {
		t.Fatalf("esperava %d motivadores, obtive %d", domain.TotalMotivators, len(ranking.Ordem))
	}
	for i, esperado := range domain.MotivatorsCanonicos {
		if ranking.Ordem[i] != esperado {
			t.Errorf("posição %d: esperava %s, obtive %s", i+1, esperado, ranking.Ordem[i])
		}
	}
	if !ranking.UpdatedAt.IsZero() {
		t.Error("quem nunca respondeu não deveria ter data de atualização")
	}
}

func TestMotivators_SalvaERecuperaNaOrdemEscolhida(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)
	escolhida := ordemInvertida()

	salvo, err := h.motivators.Save(context.Background(), ator, escolhida)
	requireNoError(t, err)
	if salvo.UpdatedAt.IsZero() {
		t.Error("depois de salvar deveria haver data de atualização")
	}

	lido, err := h.motivators.Get(context.Background(), ator)
	requireNoError(t, err)
	for i := range escolhida {
		if lido.Ordem[i] != escolhida[i] {
			t.Errorf("posição %d: esperava %s, obtive %s", i+1, escolhida[i], lido.Ordem[i])
		}
	}
}

func TestMotivators_RegravarSubstituiPorCompleto(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.motivators.Save(context.Background(), ator, ordemInvertida())
	requireNoError(t, err)

	canonica := append([]domain.Motivator{}, domain.MotivatorsCanonicos...)
	_, err = h.motivators.Save(context.Background(), ator, canonica)
	requireNoError(t, err)

	lido, err := h.motivators.Get(context.Background(), ator)
	requireNoError(t, err)
	if lido.Ordem[0] != canonica[0] {
		t.Errorf("esperava a segunda gravação vencer, obtive %s no topo", lido.Ordem[0])
	}
	if len(lido.Ordem) != domain.TotalMotivators {
		t.Errorf("esperava %d itens, obtive %d — regravar não deve acumular", domain.TotalMotivators, len(lido.Ordem))
	}
}

func TestMotivators_RejeitaListaIncompleta(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	// A prática é ordenar todos; lista parcial produziria perfis incomparáveis.
	parcial := domain.MotivatorsCanonicos[:3]
	_, err := h.motivators.Save(context.Background(), ator, parcial)
	requireCode(t, err, domain.CodeValidation)
}

func TestMotivators_RejeitaListaVazia(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	_, err := h.motivators.Save(context.Background(), ator, []domain.Motivator{})
	requireCode(t, err, domain.CodeValidation)
}

func TestMotivators_RejeitaRepetido(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	// Dez itens, mas com um duplicado (e portanto um faltando).
	comRepetido := append([]domain.Motivator{}, domain.MotivatorsCanonicos...)
	comRepetido[9] = comRepetido[0]

	_, err := h.motivators.Save(context.Background(), ator, comRepetido)
	requireCode(t, err, domain.CodeValidation)
}

func TestMotivators_RejeitaDesconhecido(t *testing.T) {
	h := newHarness(t)
	ator := h.newUser("Bruno", domain.RoleColaborador)

	invalido := append([]domain.Motivator{}, domain.MotivatorsCanonicos...)
	invalido[4] = domain.Motivator("PIZZA")

	_, err := h.motivators.Save(context.Background(), ator, invalido)
	requireCode(t, err, domain.CodeValidation)
}

func TestMotivators_RankingEhPorUsuario(t *testing.T) {
	h := newHarness(t)
	bruno := h.newUser("Bruno", domain.RoleColaborador)
	ana := h.newUser("Ana", domain.RoleGestor)

	_, err := h.motivators.Save(context.Background(), bruno, ordemInvertida())
	requireNoError(t, err)

	// A resposta de um não vaza para o outro.
	daAna, err := h.motivators.Get(context.Background(), ana)
	requireNoError(t, err)
	if daAna.Preenchido() {
		t.Error("Ana não respondeu; não deveria herdar o ranking do Bruno")
	}
	if daAna.Ordem[0] != domain.MotivatorsCanonicos[0] {
		t.Errorf("Ana deveria ver a ordem canônica, obtive %s no topo", daAna.Ordem[0])
	}
}

func TestMotivators_TodosOsCanonicosSaoValidos(t *testing.T) {
	if len(domain.MotivatorsCanonicos) != domain.TotalMotivators {
		t.Fatalf("esperava %d motivadores canônicos, há %d", domain.TotalMotivators, len(domain.MotivatorsCanonicos))
	}
	vistos := map[domain.Motivator]bool{}
	for _, motivador := range domain.MotivatorsCanonicos {
		if !motivador.Valid() {
			t.Errorf("%s deveria ser válido", motivador)
		}
		if vistos[motivador] {
			t.Errorf("%s está duplicado na lista canônica", motivador)
		}
		vistos[motivador] = true
	}
}
