package domain

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
)

// Motivator é um dos 10 motivadores da prática Moving Motivators
// (Management 3.0). O conjunto é fechado: a dinâmica consiste em ordenar
// exatamente estes dez, não em escolher alguns.
type Motivator string

const (
	MotivatorCuriosidade Motivator = "CURIOSIDADE"
	MotivatorLiberdade   Motivator = "LIBERDADE"
	MotivatorProposito   Motivator = "PROPOSITO"
	MotivatorMaestria    Motivator = "MAESTRIA"
	MotivatorRelacoes    Motivator = "RELACOES"
	MotivatorHonra       Motivator = "HONRA"
	MotivatorAceitacao   Motivator = "ACEITACAO"
	MotivatorOrdem       Motivator = "ORDEM"
	MotivatorPoder       Motivator = "PODER"
	MotivatorStatus      Motivator = "STATUS"
)

// MotivatorsCanonicos é a lista completa, na ordem em que a dinâmica é
// apresentada pela primeira vez. Serve de referência para a validação e de
// ordem inicial para quem nunca preencheu.
var MotivatorsCanonicos = []Motivator{
	MotivatorCuriosidade,
	MotivatorLiberdade,
	MotivatorProposito,
	MotivatorMaestria,
	MotivatorRelacoes,
	MotivatorHonra,
	MotivatorAceitacao,
	MotivatorOrdem,
	MotivatorPoder,
	MotivatorStatus,
}

// TotalMotivators é quantos motivadores a dinâmica exige — todos, sempre.
const TotalMotivators = 10

// PeriodoRevisaoDias é o intervalo após o qual a dinâmica deve ser refeita.
// Motivação muda com o tempo: uma resposta antiga descreve outra pessoa.
const PeriodoRevisaoDias = 90

func (m Motivator) Valid() bool {
	for _, conhecido := range MotivatorsCanonicos {
		if m == conhecido {
			return true
		}
	}
	return false
}

// MotivatorRanking é a ordenação de uma pessoa, da maior para a menor
// prioridade. Posição 1 é o primeiro item de Ordem.
type MotivatorRanking struct {
	Ordem     []Motivator
	UpdatedAt time.Time
}

// Preenchido informa se a pessoa já respondeu a dinâmica.
//
// Atenção: quem nunca respondeu também recebe uma lista completa (a ordem
// canônica, como ponto de partida da tela), então o tamanho da lista não
// distingue os dois casos — o que distingue é UpdatedAt.
func (r MotivatorRanking) Preenchido() bool {
	return !r.UpdatedAt.IsZero()
}

// DiasDesdeResposta conta os dias corridos desde o último preenchimento.
// O segundo retorno é false para quem nunca respondeu.
//
// A contagem é por períodos completos de 24h a partir do instante da resposta,
// não por virada de calendário.
func (r MotivatorRanking) DiasDesdeResposta(agora time.Time) (int, bool) {
	if !r.Preenchido() {
		return 0, false
	}
	decorrido := agora.Sub(r.UpdatedAt)
	if decorrido < 0 {
		// Relógio para trás: trata como respondido agora, em vez de dias negativos.
		return 0, true
	}
	return int(decorrido.Hours() / 24), true
}

// PrecisaRevisar indica que a dinâmica deve ser (re)feita: nunca foi respondida
// ou a última resposta já completou o período de revisão.
func (r MotivatorRanking) PrecisaRevisar(agora time.Time) bool {
	dias, respondeu := r.DiasDesdeResposta(agora)
	if !respondeu {
		return true
	}
	return dias >= PeriodoRevisaoDias
}

// DiasParaRevisar informa quantos dias faltam para a próxima revisão. Devolve 0
// quando já está vencida, e false para quem nunca respondeu.
func (r MotivatorRanking) DiasParaRevisar(agora time.Time) (int, bool) {
	dias, respondeu := r.DiasDesdeResposta(agora)
	if !respondeu {
		return 0, false
	}
	restantes := PeriodoRevisaoDias - dias
	if restantes < 0 {
		return 0, true
	}
	return restantes, true
}

// MotivatorTeamScore é o placar de um motivador no time.
type MotivatorTeamScore struct {
	Motivator Motivator
	// Score é a média de pontos entre quem respondeu, de 1 a 10. O 1º lugar de
	// cada pessoa vale 10 pontos e o 10º vale 1 (contagem de Borda), então o
	// número já é comparável entre motivadores e serve de eixo do radar.
	Score float64
	// AveragePosition é a colocação média (1 = topo), mais intuitiva de ler.
	AveragePosition float64
	// TopCount é quantas pessoas colocaram este motivador no próprio top 3.
	TopCount int
}

// TopDoRanking é quantas posições contam como "top" na contagem de destaques.
const TopDoRanking = 3

// AgregarMotivators calcula o placar do time a partir dos rankings individuais.
//
// Usa contagem de Borda: somar posições diretamente daria peso invertido (menor
// é melhor) e produziria um radar de cabeça para baixo. Converter posição em
// pontos deixa "maior é mais importante", que é como um radar se lê.
//
// Rankings incompletos são ignorados: um ranking parcial distorceria a média
// dos motivadores que ele contém.
func AgregarMotivators(rankings []MotivatorRanking) []MotivatorTeamScore {
	pontos := make(map[Motivator]float64, TotalMotivators)
	posicoes := make(map[Motivator]float64, TotalMotivators)
	topCount := make(map[Motivator]int, TotalMotivators)

	considerados := 0
	for _, ranking := range rankings {
		if len(ranking.Ordem) != TotalMotivators {
			continue
		}
		considerados++
		for indice, motivador := range ranking.Ordem {
			posicao := indice + 1
			pontos[motivador] += float64(TotalMotivators + 1 - posicao)
			posicoes[motivador] += float64(posicao)
			if posicao <= TopDoRanking {
				topCount[motivador]++
			}
		}
	}

	placar := make([]MotivatorTeamScore, 0, TotalMotivators)
	for _, motivador := range MotivatorsCanonicos {
		item := MotivatorTeamScore{Motivator: motivador, TopCount: topCount[motivador]}
		if considerados > 0 {
			item.Score = pontos[motivador] / float64(considerados)
			item.AveragePosition = posicoes[motivador] / float64(considerados)
		}
		placar = append(placar, item)
	}

	// Do mais para o menos importante; empate resolvido pela ordem canônica,
	// para a saída ser estável entre chamadas.
	sort.SliceStable(placar, func(i, j int) bool {
		return placar[i].Score > placar[j].Score
	})

	return placar
}

// MotivatorRepository abstrai a persistência do ranking de motivadores.
type MotivatorRepository interface {
	// FindByUserID devolve o ranking do usuário. Quem nunca preencheu recebe
	// um ranking vazio (não é erro).
	FindByUserID(ctx context.Context, userID uuid.UUID) (*MotivatorRanking, error)
	// Replace substitui o ranking inteiro numa única transação. Ordenação
	// parcial não existe: ou grava os dez, ou não grava nada.
	Replace(ctx context.Context, userID uuid.UUID, ordem []Motivator) error
	// FindByUsers devolve os rankings dos usuários informados, indexados por
	// usuário. Quem não respondeu simplesmente não aparece no mapa.
	FindByUsers(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]*MotivatorRanking, error)
}
