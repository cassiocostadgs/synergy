package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

/*
Validação do ID token do Microsoft Entra ID (antigo Azure AD).

O front usa MSAL para fazer a dança do OAuth e manda o ID token resultante para
a API, que só aceita a sessão se o token passar por CINCO checagens — todas
necessárias, cada uma cobrindo um furo diferente:

 1. assinatura, contra as chaves públicas do tenant (JWKS);
 2. `iss`, o emissor esperado para o tenant;
 3. `aud`, igual ao nosso client ID — token emitido para outro app não serve;
 4. `tid`, igual ao tenant configurado — sem isso, qualquer conta Microsoft do
    mundo conseguiria um token válido e a existência de cadastro no Synergy
    passaria a ser a única barreira;
 5. validade no tempo (`exp`/`nbf`), com folga pequena para desvio de relógio.

O `nonce` do MSAL não é verificado aqui de propósito: ele fica no cache do
navegador, então quem consegue checá-lo é o próprio MSAL. As checagens de
assinatura + audience já amarram o token ao nosso app.
*/

// leewayDeRelogio tolera desvio de relógio entre o Entra e este servidor.
const leewayDeRelogio = time.Minute

// errJWKSIndisponivel distingue "não consegui falar com a Microsoft" de "token
// inválido". O primeiro é falha de infraestrutura e deve virar 500: dizer
// "credencial inválida" quando o Entra está fora do ar manda o usuário procurar
// problema no lugar errado.
var errJWKSIndisponivel = errors.New("não foi possível obter as chaves públicas da Microsoft")

// MicrosoftValidator valida ID tokens emitidos pelo Entra ID para este app.
type MicrosoftValidator struct {
	tenantID string
	clientID string
	issuer   string
	chaves   *jwksCache
}

// NewMicrosoftValidator monta o validador para um tenant.
//
// tenantID precisa ser o Directory (tenant) ID em formato GUID — é ele que
// aparece no claim `iss` e no `tid`. Nome de domínio não serve; a configuração
// valida o formato antes de chegar aqui.
func NewMicrosoftValidator(tenantID, clientID string) *MicrosoftValidator {
	base := "https://login.microsoftonline.com/" + tenantID
	return &MicrosoftValidator{
		tenantID: tenantID,
		clientID: clientID,
		issuer:   base + "/v2.0",
		chaves: &jwksCache{
			url:             base + "/discovery/v2.0/keys",
			client:          &http.Client{Timeout: 10 * time.Second},
			intervaloMinimo: 5 * time.Minute,
			agora:           time.Now,
		},
	}
}

// Validate confere o token e devolve a identidade que ele afirma.
func (v *MicrosoftValidator) Validate(ctx context.Context, idToken string) (*domain.MicrosoftIdentity, error) {
	if strings.TrimSpace(idToken) == "" {
		return nil, domain.Validation("o token da Microsoft é obrigatório")
	}

	// A falha de infraestrutura é capturada à parte porque a mensagem do
	// jwt.Parse não distingue "chave indisponível" de "assinatura inválida", e
	// os dois casos merecem status HTTP diferentes.
	var falhaDeInfra error

	token, err := jwt.Parse(idToken, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("token sem kid no cabeçalho")
		}
		chave, err := v.chaves.chave(ctx, kid)
		if err != nil {
			if errors.Is(err, errJWKSIndisponivel) {
				falhaDeInfra = err
			}
			return nil, err
		}
		return chave, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.clientID),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(leewayDeRelogio),
	)

	if falhaDeInfra != nil {
		return nil, falhaDeInfra
	}
	if err != nil {
		return nil, domain.Unauthorized("o login com a Microsoft não pôde ser validado")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, domain.Unauthorized("o token da Microsoft tem formato inesperado")
	}
	return v.identidade(claims)
}

// identidade extrai o que o negócio precisa, depois de o token já estar válido.
func (v *MicrosoftValidator) identidade(claims jwt.MapClaims) (*domain.MicrosoftIdentity, error) {
	// `aud` e `iss` já foram conferidos pelo parser; `tid` é a checagem que
	// prende o token ao tenant da organização.
	if tid, _ := claims["tid"].(string); !strings.EqualFold(tid, v.tenantID) {
		return nil, domain.Unauthorized("esta conta Microsoft não pertence à organização configurada")
	}

	oid, _ := claims["oid"].(string)
	if oid == "" {
		return nil, domain.Unauthorized("o token da Microsoft não identifica a conta (claim oid ausente)")
	}

	email, _ := claims["email"].(string)
	if email == "" {
		// `email` é claim opcional no Entra e só vem se estiver configurado ou
		// se o usuário tiver o atributo mail preenchido. O `preferred_username`
		// vem sempre e, num tenant corporativo, é o próprio e-mail (UPN).
		email, _ = claims["preferred_username"].(string)
	}
	if !strings.Contains(email, "@") {
		return nil, domain.Unauthorized("o token da Microsoft não traz um e-mail utilizável")
	}

	// O claim `name` existe no token e não é lido: ver MicrosoftIdentity.
	return &domain.MicrosoftIdentity{ObjectID: oid, Email: email}, nil
}

// --- cache das chaves públicas ---

// jwksCache guarda as chaves públicas do tenant, indexadas por `kid`.
//
// O Entra troca as chaves periodicamente, então o cache recarrega sozinho
// quando aparece um kid desconhecido. intervaloMinimo impede que um token
// forjado com kid aleatório vire uma enxurrada de requisições à Microsoft.
type jwksCache struct {
	url             string
	client          *http.Client
	intervaloMinimo time.Duration
	agora           func() time.Time

	mu          sync.Mutex
	chaves      map[string]*rsa.PublicKey
	carregadoEm time.Time
}

func (c *jwksCache) chave(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	// O lock é mantido durante o download de propósito: em troca de serializar
	// as requisições concorrentes, várias sessões chegando juntas depois de uma
	// rotação de chave fazem UM download, não um por sessão.
	c.mu.Lock()
	defer c.mu.Unlock()

	if chave, ok := c.chaves[kid]; ok {
		return chave, nil
	}

	if !c.carregadoEm.IsZero() && c.agora().Sub(c.carregadoEm) < c.intervaloMinimo {
		return nil, fmt.Errorf("chave %q desconhecida", kid)
	}

	chaves, err := c.baixar(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errJWKSIndisponivel, err)
	}
	c.chaves = chaves
	c.carregadoEm = c.agora()

	chave, ok := chaves[kid]
	if !ok {
		return nil, fmt.Errorf("chave %q desconhecida", kid)
	}
	return chave, nil
}

func (c *jwksCache) baixar(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS respondeu %s", resp.Status)
	}

	var corpo struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&corpo); err != nil {
		return nil, fmt.Errorf("JWKS ilegível: %w", err)
	}

	chaves := make(map[string]*rsa.PublicKey, len(corpo.Keys))
	for _, k := range corpo.Keys {
		// Só RSA interessa: é o que o Entra usa para assinar ID token, e aceitar
		// outros tipos sem saber validá-los seria falsa sensação de suporte.
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		chave, err := chavePublicaRSA(k.N, k.E)
		if err != nil {
			// Uma chave ilegível não invalida as demais.
			continue
		}
		chaves[k.Kid] = chave
	}

	if len(chaves) == 0 {
		return nil, errors.New("JWKS sem chaves RSA utilizáveis")
	}
	return chaves, nil
}

// chavePublicaRSA monta a chave a partir do módulo e do expoente em base64url.
func chavePublicaRSA(nBase64, eBase64 string) (*rsa.PublicKey, error) {
	n, err := decodificarBase64URL(nBase64)
	if err != nil {
		return nil, fmt.Errorf("módulo inválido: %w", err)
	}
	e, err := decodificarBase64URL(eBase64)
	if err != nil {
		return nil, fmt.Errorf("expoente inválido: %w", err)
	}
	if len(n) == 0 || len(e) == 0 {
		return nil, errors.New("módulo ou expoente vazio")
	}

	expoente := new(big.Int).SetBytes(e)
	if !expoente.IsInt64() || expoente.Int64() > int64(^uint32(0)) {
		return nil, errors.New("expoente fora da faixa suportada")
	}

	return &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(expoente.Int64())}, nil
}

// decodificarBase64URL aceita com e sem padding: o JWK usa a forma sem padding,
// mas nada na especificação impede a outra.
func decodificarBase64URL(valor string) ([]byte, error) {
	if bytes, err := base64.RawURLEncoding.DecodeString(valor); err == nil {
		return bytes, nil
	}
	return base64.URLEncoding.DecodeString(valor)
}
