package domain

import "testing"

// rankingCom monta um ranking completo começando pelos motivadores informados;
// os demais entram na ordem canônica.
func rankingCom(topo ...Motivator) MotivatorRanking {
	ordem := append([]Motivator{}, topo...)
	presente := map[Motivator]bool{}
	for _, m := range topo {
		presente[m] = true
	}
	for _, m := range MotivatorsCanonicos {
		if !presente[m] {
			ordem = append(ordem, m)
		}
	}
	return MotivatorRanking{Ordem: ordem}
}

func placarDe(placar []MotivatorTeamScore, motivador Motivator) MotivatorTeamScore {
	for _, item := range placar {
		if item.Motivator == motivador {
			return item
		}
	}
	return MotivatorTeamScore{}
}

func TestAgregar_SemRespostas(t *testing.T) {
	placar := AgregarMotivators(nil)

	if len(placar) != TotalMotivators {
		t.Fatalf("esperava os %d motivadores mesmo sem respostas, obtive %d", TotalMotivators, len(placar))
	}
	for _, item := range placar {
		if item.Score != 0 || item.AveragePosition != 0 || item.TopCount != 0 {
			t.Errorf("%s: esperava tudo zerado, obtive %+v", item.Motivator, item)
		}
	}
}

func TestAgregar_UmaResposta(t *testing.T) {
	placar := AgregarMotivators([]MotivatorRanking{rankingCom(MotivatorPoder)})

	// Poder em 1º: 10 pontos, posição média 1.
	poder := placarDe(placar, MotivatorPoder)
	if poder.Score != 10 {
		t.Errorf("1º lugar deveria valer 10 pontos, obtive %v", poder.Score)
	}
	if poder.AveragePosition != 1 {
		t.Errorf("posição média deveria ser 1, obtive %v", poder.AveragePosition)
	}
	if poder.TopCount != 1 {
		t.Errorf("deveria contar 1 aparição no top 3, obtive %d", poder.TopCount)
	}

	// O último da lista vale 1 ponto.
	if ultimo := placar[len(placar)-1]; ultimo.Score != 1 {
		t.Errorf("último lugar deveria valer 1 ponto, obtive %v", ultimo.Score)
	}

	// A ordenação é do maior para o menor.
	if placar[0].Motivator != MotivatorPoder {
		t.Errorf("esperava Poder no topo do placar, obtive %s", placar[0].Motivator)
	}
}

func TestAgregar_MediaEntreVariasRespostas(t *testing.T) {
	// Duas pessoas: uma põe Ordem em 1º (10 pts), outra em 3º (8 pts).
	// Média = 9; posição média = 2.
	respostas := []MotivatorRanking{
		rankingCom(MotivatorOrdem),
		rankingCom(MotivatorPoder, MotivatorStatus, MotivatorOrdem),
	}

	ordem := placarDe(AgregarMotivators(respostas), MotivatorOrdem)
	if ordem.Score != 9 {
		t.Errorf("esperava média 9, obtive %v", ordem.Score)
	}
	if ordem.AveragePosition != 2 {
		t.Errorf("esperava posição média 2, obtive %v", ordem.AveragePosition)
	}
	if ordem.TopCount != 2 {
		t.Errorf("ambos colocaram no top 3, esperava 2, obtive %d", ordem.TopCount)
	}
}

func TestAgregar_TopCountContaSomenteAsTresPrimeiras(t *testing.T) {
	// Maestria em 4º: fora do top 3.
	resposta := rankingCom(MotivatorPoder, MotivatorStatus, MotivatorOrdem, MotivatorMaestria)
	placar := AgregarMotivators([]MotivatorRanking{resposta})

	if maestria := placarDe(placar, MotivatorMaestria); maestria.TopCount != 0 {
		t.Errorf("4º lugar não deveria contar no top 3, obtive %d", maestria.TopCount)
	}
	if ordem := placarDe(placar, MotivatorOrdem); ordem.TopCount != 1 {
		t.Errorf("3º lugar deveria contar no top 3, obtive %d", ordem.TopCount)
	}
}

func TestAgregar_IgnoraRankingIncompleto(t *testing.T) {
	completo := rankingCom(MotivatorPoder)
	parcial := MotivatorRanking{Ordem: []Motivator{MotivatorOrdem, MotivatorStatus}}

	placar := AgregarMotivators([]MotivatorRanking{completo, parcial})

	// Se o parcial entrasse na conta, a média seria diluída pelo divisor 2.
	if poder := placarDe(placar, MotivatorPoder); poder.Score != 10 {
		t.Errorf("ranking parcial deveria ser ignorado; esperava 10, obtive %v", poder.Score)
	}
}

func TestAgregar_SomaDePontosEhConstante(t *testing.T) {
	// Propriedade da contagem de Borda: qualquer permutação distribui a mesma
	// soma total de pontos. Serve de rede contra erro na fórmula.
	esperado := 0.0
	for posicao := 1; posicao <= TotalMotivators; posicao++ {
		esperado += float64(TotalMotivators + 1 - posicao)
	}

	casos := [][]MotivatorRanking{
		{rankingCom(MotivatorPoder)},
		{rankingCom(MotivatorHonra), rankingCom(MotivatorStatus)},
		{rankingCom(MotivatorOrdem), rankingCom(MotivatorOrdem), rankingCom(MotivatorLiberdade)},
	}

	for i, respostas := range casos {
		total := 0.0
		for _, item := range AgregarMotivators(respostas) {
			total += item.Score
		}
		if total < esperado-0.0001 || total > esperado+0.0001 {
			t.Errorf("caso %d: soma dos scores deveria ser %v, obtive %v", i, esperado, total)
		}
	}
}

func TestAgregar_OrdenacaoEstavelEmEmpate(t *testing.T) {
	// Duas respostas espelhadas: vários motivadores empatam.
	invertida := make([]Motivator, 0, TotalMotivators)
	for i := len(MotivatorsCanonicos) - 1; i >= 0; i-- {
		invertida = append(invertida, MotivatorsCanonicos[i])
	}
	respostas := []MotivatorRanking{
		{Ordem: append([]Motivator{}, MotivatorsCanonicos...)},
		{Ordem: invertida},
	}

	primeiro := AgregarMotivators(respostas)
	segundo := AgregarMotivators(respostas)

	for i := range primeiro {
		if primeiro[i].Motivator != segundo[i].Motivator {
			t.Errorf("posição %d instável entre chamadas: %s vs %s", i, primeiro[i].Motivator, segundo[i].Motivator)
		}
	}
}
