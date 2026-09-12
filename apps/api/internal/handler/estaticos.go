package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

/*
Entrega do frontend pela própria API.

Existe para o caso de um container único, em que não há nginx na frente: a
plataforma constrói uma imagem e roda um processo, e a mesma porta precisa
atender o app e a API.

Fica desligado por padrão. Em desenvolvimento o Vite serve o front com
hot reload, e a API não deve saber que existe um `dist` em algum lugar.
*/

// spaHandler serve os arquivos estáticos do frontend com fallback para o
// index.html.
//
// O fallback é o que faz `BrowserRouter` funcionar: rotas como /radar e
// /times/<id> não existem no disco, e sem isso um F5 nelas devolveria 404.
func spaHandler(diretorio string) http.HandlerFunc {
	arquivos := http.FileServer(http.Dir(diretorio))
	index := filepath.Join(diretorio, "index.html")

	return func(w http.ResponseWriter, r *http.Request) {
		// Caminho de API que chegou até aqui é rota inexistente, não página: quem
		// chamou espera o envelope de erro, não o HTML do app.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			respondError(w, domain.NotFound("rota não encontrada"))
			return
		}

		// Só GET e HEAD fazem sentido para arquivo estático.
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeJSON(w, http.StatusMethodNotAllowed, envelope{
				Error: &errorBody{
					Code:    "METHOD_NOT_ALLOWED",
					Message: "método não permitido para esta rota",
				},
			})
			return
		}

		if caminho, ok := arquivoExistente(diretorio, r.URL.Path); ok {
			// Os assets têm hash no nome: mudou o conteúdo, mudou a URL. O
			// index.html, não — ele precisa ser revalidado a cada visita, senão o
			// navegador continua pedindo o bundle antigo depois de um deploy.
			if strings.HasPrefix(caminho, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			arquivos.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		http.ServeFile(w, r, index)
	}
}

// arquivoExistente diz se a URL corresponde a um arquivo de verdade dentro do
// diretório, devolvendo o caminho já limpo.
//
// O `path.Clean` implícito do filepath.Join é o que impede `../` de escapar do
// diretório servido.
func arquivoExistente(diretorio, urlPath string) (string, bool) {
	limpo := filepath.Clean("/" + strings.TrimPrefix(urlPath, "/"))
	if limpo == "/" {
		return limpo, false
	}

	info, err := os.Stat(filepath.Join(diretorio, limpo))
	if err != nil || info.IsDir() {
		return limpo, false
	}
	return filepath.ToSlash(limpo), true
}
