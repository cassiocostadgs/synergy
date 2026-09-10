package domain

import (
	"testing"
	"time"
)

func rankingRespondidoEm(momento time.Time) MotivatorRanking {
	return MotivatorRanking{
		Ordem:     append([]Motivator{}, MotivatorsCanonicos...),
		UpdatedAt: momento,
	}
}

func TestRanking_NuncaRespondido(t *testing.T) {
	agora := time.Now().UTC()
	// Lista completa mas sem data: é o ponto de partida de quem nunca respondeu.
	ranking := MotivatorRanking{Ordem: append([]Motivator{}, MotivatorsCanonicos...)}

	if ranking.Preenchido() {
		t.Error("sem data de resposta, não deveria contar como preenchido")
	}
	if _, respondeu := ranking.DiasDesdeResposta(agora); respondeu {
		t.Error("não deveria haver contagem de dias para quem nunca respondeu")
	}
	if _, respondeu := ranking.DiasParaRevisar(agora); respondeu {
		t.Error("não deveria haver prazo para quem nunca respondeu")
	}
	if !ranking.PrecisaRevisar(agora) {
		t.Error("quem nunca respondeu precisa responder")
	}
}

func TestRanking_ContagemDeDias(t *testing.T) {
	agora := time.Now().UTC()

	casos := []struct {
		diasAtras     int
		esperaDias    int
		esperaFaltam  int
		esperaRevisar bool
		descricao     string
	}{
		{0, 0, PeriodoRevisaoDias, false, "respondido agora"},
		{1, 1, PeriodoRevisaoDias - 1, false, "ontem"},
		{45, 45, 45, false, "metade do período"},
		{89, 89, 1, false, "um dia antes de vencer"},
		{PeriodoRevisaoDias, PeriodoRevisaoDias, 0, true, "exatamente no período"},
		{91, 91, 0, true, "um dia depois de vencer"},
		{365, 365, 0, true, "um ano"},
	}

	for _, caso := range casos {
		ranking := rankingRespondidoEm(agora.AddDate(0, 0, -caso.diasAtras))

		dias, respondeu := ranking.DiasDesdeResposta(agora)
		if !respondeu {
			t.Errorf("%s: deveria contar como respondido", caso.descricao)
			continue
		}
		if dias != caso.esperaDias {
			t.Errorf("%s: esperava %d dias, obtive %d", caso.descricao, caso.esperaDias, dias)
		}

		faltam, _ := ranking.DiasParaRevisar(agora)
		if faltam != caso.esperaFaltam {
			t.Errorf("%s: esperava %d dias restantes, obtive %d", caso.descricao, caso.esperaFaltam, faltam)
		}

		if precisa := ranking.PrecisaRevisar(agora); precisa != caso.esperaRevisar {
			t.Errorf("%s: esperava PrecisaRevisar=%v, obtive %v", caso.descricao, caso.esperaRevisar, precisa)
		}
	}
}

func TestRanking_LimiteDoPeriodoEhInclusivo(t *testing.T) {
	agora := time.Now().UTC()

	// "Após 90 dias deve ser feito novamente": no 90º dia já vence.
	noLimite := rankingRespondidoEm(agora.AddDate(0, 0, -PeriodoRevisaoDias))
	if !noLimite.PrecisaRevisar(agora) {
		t.Errorf("com exatamente %d dias já deve pedir revisão", PeriodoRevisaoDias)
	}

	umDiaAntes := rankingRespondidoEm(agora.AddDate(0, 0, -(PeriodoRevisaoDias - 1)))
	if umDiaAntes.PrecisaRevisar(agora) {
		t.Errorf("com %d dias ainda não deve pedir revisão", PeriodoRevisaoDias-1)
	}
}

func TestRanking_ContagemNaoUsaViradaDeCalendario(t *testing.T) {
	// Respondido há 23 horas: ainda é "hoje" na contagem por períodos de 24h,
	// mesmo que o calendário já tenha virado.
	agora := time.Date(2026, 9, 10, 1, 0, 0, 0, time.UTC)
	ranking := rankingRespondidoEm(time.Date(2026, 9, 9, 2, 0, 0, 0, time.UTC))

	dias, respondeu := ranking.DiasDesdeResposta(agora)
	if !respondeu || dias != 0 {
		t.Errorf("esperava 0 dias para 23h decorridas, obtive %d", dias)
	}
}

func TestRanking_RelogioParaTrasNaoGeraDiasNegativos(t *testing.T) {
	agora := time.Now().UTC()
	// Data futura (relógio do servidor ajustado para trás, por exemplo).
	ranking := rankingRespondidoEm(agora.Add(48 * time.Hour))

	dias, respondeu := ranking.DiasDesdeResposta(agora)
	if !respondeu {
		t.Fatal("deveria contar como respondido")
	}
	if dias != 0 {
		t.Errorf("esperava 0 dias em vez de negativo, obtive %d", dias)
	}
	if ranking.PrecisaRevisar(agora) {
		t.Error("resposta com data futura não deveria pedir revisão")
	}
}
