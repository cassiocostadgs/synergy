package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

/*
Testes do validador de ID token do Entra ID.

Não há Microsoft envolvida: as chaves são geradas aqui e o JWKS é servido por um
httptest. O que se prova é o comportamento diante de cada forma de token
inválido — inclusive as que um atacante tentaria (assinar com outra chave, trocar
o algoritmo, reusar token de outro app ou de outro tenant).
*/

const (
	tenantDeTeste = "11111111-1111-1111-1111-111111111111"
	clientDeTeste = "22222222-2222-2222-2222-222222222222"
	kidDeTeste    = "chave-1"
)

const issuerDeTeste = "https://login.microsoftonline.com/" + tenantDeTeste + "/v2.0"

// chaveDeTeste é gerada uma única vez: RSA de 2048 bits por teste deixaria a
// suíte lenta sem provar nada a mais.
var chaveDeTeste = gerarChaveRSA()

// chaveIntrusa representa uma chave que não está no JWKS do tenant.
var chaveIntrusa = gerarChaveRSA()

func gerarChaveRSA() *rsa.PrivateKey {
	chave, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic("gerando chave RSA de teste: " + err.Error())
	}
	return chave
}

// jwksDeTeste publica as chaves informadas e conta quantas consultas recebeu —
// o contador é o que permite verificar o cache.
func jwksDeTeste(t *testing.T, chaves map[string]*rsa.PublicKey) (*httptest.Server, *atomic.Int64) {
	t.Helper()

	var chamadas atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		chamadas.Add(1)

		lista := make([]map[string]string, 0, len(chaves))
		for kid, chave := range chaves {
			lista = append(lista, map[string]string{
				"kid": kid,
				"kty": "RSA",
				"use": "sig",
				"n":   base64.RawURLEncoding.EncodeToString(chave.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(chave.E)).Bytes()),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": lista})
	}))
	t.Cleanup(srv.Close)

	return srv, &chamadas
}

// validadorDeTeste monta o validador apontando para um JWKS local. Constrói a
// struct direto porque o construtor público fixa a URL da Microsoft.
func validadorDeTeste(url string, agora func() time.Time) *MicrosoftValidator {
	return &MicrosoftValidator{
		tenantID: tenantDeTeste,
		clientID: clientDeTeste,
		issuer:   issuerDeTeste,
		chaves: &jwksCache{
			url:             url,
			client:          &http.Client{Timeout: 5 * time.Second},
			intervaloMinimo: 5 * time.Minute,
			agora:           agora,
		},
	}
}

// claimsValidas reproduz o que o Entra manda num login bem-sucedido.
func claimsValidas() jwt.MapClaims {
	agora := time.Now()
	return jwt.MapClaims{
		"iss":                issuerDeTeste,
		"aud":                clientDeTeste,
		"tid":                tenantDeTeste,
		"oid":                "oid-da-ana",
		"email":              "ana@db1.com.br",
		"preferred_username": "ana@db1.com.br",
		"name":               "Ana Souza",
		"iat":                jwt.NewNumericDate(agora),
		"nbf":                jwt.NewNumericDate(agora),
		"exp":                jwt.NewNumericDate(agora.Add(time.Hour)),
	}
}

func assinarRS256(t *testing.T, claims jwt.MapClaims, chave *rsa.PrivateKey, kid string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid

	assinado, err := token.SignedString(chave)
	if err != nil {
		t.Fatalf("assinando token de teste: %v", err)
	}
	return assinado
}

// validarComJWKSPadrao é o caminho comum: JWKS com a chave certa e relógio real.
func validarComJWKSPadrao(t *testing.T, token string) (*domain.MicrosoftIdentity, error) {
	t.Helper()
	srv, _ := jwksDeTeste(t, map[string]*rsa.PublicKey{kidDeTeste: &chaveDeTeste.PublicKey})
	return validadorDeTeste(srv.URL, time.Now).Validate(context.Background(), token)
}

func requireNaoAutorizado(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("esperava recusa, o token foi aceito")
	}
	if got := domain.CodeOf(err); got != domain.CodeUnauthorized {
		t.Fatalf("esperava código %s, obtive %q (erro: %v)", domain.CodeUnauthorized, got, err)
	}
}

// ---------------------------------------------------------------------------
// Caminho bom
// ---------------------------------------------------------------------------

func TestValidate_TokenValido(t *testing.T) {
	token := assinarRS256(t, claimsValidas(), chaveDeTeste, kidDeTeste)

	identidade, err := validarComJWKSPadrao(t, token)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if identidade.ObjectID != "oid-da-ana" {
		t.Errorf("esperava o oid do token, obtive %q", identidade.ObjectID)
	}
	if identidade.Email != "ana@db1.com.br" {
		t.Errorf("esperava o e-mail do token, obtive %q", identidade.Email)
	}
}

func TestValidate_UsaPreferredUsernameQuandoNaoHaEmail(t *testing.T) {
	claims := claimsValidas()
	// `email` é claim opcional no Entra: sem configurá-lo, o token chega só com
	// o UPN, que num tenant corporativo é o próprio endereço.
	delete(claims, "email")
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	identidade, err := validarComJWKSPadrao(t, token)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if identidade.Email != "ana@db1.com.br" {
		t.Errorf("esperava o e-mail do preferred_username, obtive %q", identidade.Email)
	}
}

// ---------------------------------------------------------------------------
// Tokens que precisam ser recusados
// ---------------------------------------------------------------------------

func TestValidate_AssinadoComOutraChave(t *testing.T) {
	// Mesmo kid, chave diferente: é a tentativa mais óbvia de forjar.
	token := assinarRS256(t, claimsValidas(), chaveIntrusa, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_AlgoritmoTrocadoParaHMAC(t *testing.T) {
	// Confusão de algoritmo: se o parser aceitasse HS256, a chave pública —
	// que é pública — passaria a servir de segredo para assinar.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsValidas())
	token.Header["kid"] = kidDeTeste
	assinado, err := token.SignedString([]byte("segredo-qualquer"))
	if err != nil {
		t.Fatalf("assinando token HS256: %v", err)
	}

	_, err = validarComJWKSPadrao(t, assinado)
	requireNaoAutorizado(t, err)
}

func TestValidate_AudienceDeOutroApp(t *testing.T) {
	claims := claimsValidas()
	// Token legítimo do mesmo tenant, emitido para outro aplicativo.
	claims["aud"] = "99999999-9999-9999-9999-999999999999"
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_EmissorDeOutroTenant(t *testing.T) {
	claims := claimsValidas()
	claims["iss"] = "https://login.microsoftonline.com/33333333-3333-3333-3333-333333333333/v2.0"
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_TidDeOutroTenant(t *testing.T) {
	claims := claimsValidas()
	// Emissor certo e `tid` de outro tenant não acontece na prática, mas é a
	// checagem que segura conta pessoal da Microsoft — vale provar isolada.
	claims["tid"] = "33333333-3333-3333-3333-333333333333"
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_TokenExpirado(t *testing.T) {
	claims := claimsValidas()
	// Além da folga de relógio, para não depender do valor exato do leeway.
	claims["exp"] = jwt.NewNumericDate(time.Now().Add(-2 * leewayDeRelogio))
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_TokenSemExpiracao(t *testing.T) {
	claims := claimsValidas()
	// Sem `exp` o token valeria para sempre se fosse aceito.
	delete(claims, "exp")
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_SemOid(t *testing.T) {
	claims := claimsValidas()
	delete(claims, "oid")
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_SemEmailUtilizavel(t *testing.T) {
	claims := claimsValidas()
	delete(claims, "email")
	delete(claims, "preferred_username")
	token := assinarRS256(t, claims, chaveDeTeste, kidDeTeste)

	_, err := validarComJWKSPadrao(t, token)
	requireNaoAutorizado(t, err)
}

func TestValidate_TokenVazio(t *testing.T) {
	srv, chamadas := jwksDeTeste(t, map[string]*rsa.PublicKey{kidDeTeste: &chaveDeTeste.PublicKey})

	_, err := validadorDeTeste(srv.URL, time.Now).Validate(context.Background(), "   ")
	if domain.CodeOf(err) != domain.CodeValidation {
		t.Errorf("esperava erro de validação, obtive %v", err)
	}
	if chamadas.Load() != 0 {
		t.Errorf("token vazio não deveria consultar o JWKS, houve %d consulta(s)", chamadas.Load())
	}
}

// ---------------------------------------------------------------------------
// JWKS: cache, rotação e indisponibilidade
// ---------------------------------------------------------------------------

func TestValidate_JWKSForaDoArNaoViraCredencialInvalida(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	token := assinarRS256(t, claimsValidas(), chaveDeTeste, kidDeTeste)
	_, err := validadorDeTeste(srv.URL, time.Now).Validate(context.Background(), token)

	if err == nil {
		t.Fatal("esperava erro quando o JWKS está indisponível")
	}
	// Sem código de domínio, o handler devolve 500 — o certo. Um 401 aqui diria
	// ao usuário que a credencial dele é inválida quando o problema é nosso.
	if code := domain.CodeOf(err); code != "" {
		t.Errorf("esperava falha de infraestrutura sem código de domínio, obtive %q", code)
	}
}

func TestValidate_ChavesSaoReaproveitadasEntreValidacoes(t *testing.T) {
	srv, chamadas := jwksDeTeste(t, map[string]*rsa.PublicKey{kidDeTeste: &chaveDeTeste.PublicKey})
	validador := validadorDeTeste(srv.URL, time.Now)

	for i := 0; i < 3; i++ {
		token := assinarRS256(t, claimsValidas(), chaveDeTeste, kidDeTeste)
		if _, err := validador.Validate(context.Background(), token); err != nil {
			t.Fatalf("validação %d falhou: %v", i+1, err)
		}
	}

	if chamadas.Load() != 1 {
		t.Errorf("esperava 1 consulta ao JWKS para 3 logins, houve %d", chamadas.Load())
	}
}

func TestValidate_KidDesconhecidoNaoViraEnxurradaDeConsultas(t *testing.T) {
	srv, chamadas := jwksDeTeste(t, map[string]*rsa.PublicKey{kidDeTeste: &chaveDeTeste.PublicKey})
	validador := validadorDeTeste(srv.URL, time.Now)

	// Primeiro carrega o cache com um token bom.
	bom := assinarRS256(t, claimsValidas(), chaveDeTeste, kidDeTeste)
	if _, err := validador.Validate(context.Background(), bom); err != nil {
		t.Fatalf("token válido recusado: %v", err)
	}

	// Depois, tokens com kid inventado — o cenário de alguém tentando nos usar
	// como amplificador de requisições para a Microsoft.
	for i := 0; i < 5; i++ {
		forjado := assinarRS256(t, claimsValidas(), chaveIntrusa, "kid-inventado")
		if _, err := validador.Validate(context.Background(), forjado); err == nil {
			t.Fatal("token com kid desconhecido deveria ser recusado")
		}
	}

	if chamadas.Load() != 1 {
		t.Errorf("esperava que o intervalo mínimo evitasse novas consultas, houve %d", chamadas.Load())
	}
}

func TestValidate_RotacaoDeChaveRecarregaOJWKS(t *testing.T) {
	const kidNovo = "chave-2"

	// O servidor publica as duas chaves; o cache é que só conhece a primeira,
	// porque foi carregado antes de a nova entrar em uso.
	srv, chamadas := jwksDeTeste(t, map[string]*rsa.PublicKey{
		kidDeTeste: &chaveDeTeste.PublicKey,
		kidNovo:    &chaveIntrusa.PublicKey,
	})

	// Relógio controlado: avança além do intervalo mínimo entre as validações.
	instante := time.Now()
	validador := validadorDeTeste(srv.URL, func() time.Time { return instante })

	primeiro := assinarRS256(t, claimsValidas(), chaveDeTeste, kidDeTeste)
	if _, err := validador.Validate(context.Background(), primeiro); err != nil {
		t.Fatalf("token válido recusado: %v", err)
	}

	// Simula o cache tendo sido carregado antes da rotação.
	validador.chaves.chaves = map[string]*rsa.PublicKey{kidDeTeste: &chaveDeTeste.PublicKey}
	instante = instante.Add(6 * time.Minute)

	segundo := assinarRS256(t, claimsValidas(), chaveIntrusa, kidNovo)
	if _, err := validador.Validate(context.Background(), segundo); err != nil {
		t.Fatalf("token assinado com a chave nova deveria ser aceito após recarga: %v", err)
	}

	if chamadas.Load() != 2 {
		t.Errorf("esperava 2 consultas (carga inicial + recarga), houve %d", chamadas.Load())
	}
}
