package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// diretorioDeTeste monta um "dist" mínimo, como o do Vite.
func diretorioDeTeste(t *testing.T) string {
	t.Helper()

	raiz := t.TempDir()
	if err := os.MkdirAll(filepath.Join(raiz, "assets"), 0o755); err != nil {
		t.Fatalf("criando assets: %v", err)
	}

	arquivos := map[string]string{
		"index.html":              "<!doctype html><title>Synergy</title>",
		"assets/index-abc123.js":  "console.log('bundle')",
		"assets/index-abc123.css": "body{}",
	}
	for nome, conteudo := range arquivos {
		if err := os.WriteFile(filepath.Join(raiz, filepath.FromSlash(nome)), []byte(conteudo), 0o644); err != nil {
			t.Fatalf("criando %s: %v", nome, err)
		}
	}
	return raiz
}

func pedir(t *testing.T, handler http.HandlerFunc, metodo, caminho string) *httptest.ResponseRecorder {
	t.Helper()
	resposta := httptest.NewRecorder()
	handler(resposta, httptest.NewRequest(metodo, caminho, nil))
	return resposta
}

func TestSpaHandler_ServeArquivoQueExiste(t *testing.T) {
	handler := spaHandler(diretorioDeTeste(t))

	resposta := pedir(t, handler, http.MethodGet, "/assets/index-abc123.js")

	if resposta.Code != http.StatusOK {
		t.Fatalf("esperava 200, obtive %d", resposta.Code)
	}
	if !strings.Contains(resposta.Body.String(), "bundle") {
		t.Errorf("esperava o conteúdo do arquivo, obtive %q", resposta.Body.String())
	}
}

func TestSpaHandler_RotaDoAppCaiNoIndex(t *testing.T) {
	handler := spaHandler(diretorioDeTeste(t))

	// /radar e /times/<id> não existem no disco: é o BrowserRouter que as
	// resolve no navegador. Sem o fallback, um F5 nelas devolveria 404.
	for _, caminho := range []string{"/radar", "/times/8f3d", "/perfil"} {
		resposta := pedir(t, handler, http.MethodGet, caminho)

		if resposta.Code != http.StatusOK {
			t.Errorf("%s: esperava 200, obtive %d", caminho, resposta.Code)
		}
		if !strings.Contains(resposta.Body.String(), "<!doctype html>") {
			t.Errorf("%s: esperava o index.html, obtive %q", caminho, resposta.Body.String())
		}
	}
}

func TestSpaHandler_CaminhoDeApiInexistenteDevolveEnvelope(t *testing.T) {
	handler := spaHandler(diretorioDeTeste(t))

	// Um /api/ que chegou até aqui é engano de chamada, não navegação: quem
	// chamou espera JSON. Devolver o HTML do app faria um cliente de API
	// receber "<!doctype html>" e quebrar longe da causa.
	resposta := pedir(t, handler, http.MethodGet, "/api/v1/rota-que-nao-existe")

	if resposta.Code != http.StatusNotFound {
		t.Fatalf("esperava 404, obtive %d", resposta.Code)
	}
	if !strings.Contains(resposta.Body.String(), "NOT_FOUND") {
		t.Errorf("esperava o envelope de erro, obtive %q", resposta.Body.String())
	}
}

func TestSpaHandler_AssetsGanhamCacheLongo(t *testing.T) {
	handler := spaHandler(diretorioDeTeste(t))

	comHash := pedir(t, handler, http.MethodGet, "/assets/index-abc123.css")
	if cache := comHash.Header().Get("Cache-Control"); !strings.Contains(cache, "immutable") {
		t.Errorf("asset com hash deveria ter cache longo, obtive %q", cache)
	}

	// O index não: ele aponta para os assets com hash, e em cache continuaria
	// apontando para o bundle antigo depois de um deploy.
	index := pedir(t, handler, http.MethodGet, "/")
	if cache := index.Header().Get("Cache-Control"); !strings.Contains(cache, "no-cache") {
		t.Errorf("o index não pode ficar em cache, obtive %q", cache)
	}
}

func TestSpaHandler_NaoServeArquivoForaDoDiretorio(t *testing.T) {
	raiz := diretorioDeTeste(t)
	segredo := filepath.Join(filepath.Dir(raiz), "segredo.txt")
	if err := os.WriteFile(segredo, []byte("nao deveria vazar"), 0o644); err != nil {
		t.Fatalf("criando arquivo vizinho: %v", err)
	}

	handler := spaHandler(raiz)
	resposta := pedir(t, handler, http.MethodGet, "/../segredo.txt")

	if strings.Contains(resposta.Body.String(), "nao deveria vazar") {
		t.Fatal("travessia de diretório: o handler serviu arquivo de fora do dist")
	}
}

func TestSpaHandler_MetodoInvalidoNaoVaiParaOIndex(t *testing.T) {
	handler := spaHandler(diretorioDeTeste(t))

	resposta := pedir(t, handler, http.MethodPost, "/radar")

	if resposta.Code != http.StatusMethodNotAllowed {
		t.Fatalf("esperava 405, obtive %d", resposta.Code)
	}
}
