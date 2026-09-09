# Sobe a API em modo desenvolvimento.
#
# A API lê a configuração de variáveis de ambiente (não há loader de .env), então
# este script define os padrões de desenvolvimento. Variáveis já definidas no
# shell têm precedência.
#
# Sobre o build fora do repositório e o retry na execução, ver scripts/_common.ps1.
#
# Uso:  .\scripts\dev.ps1

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$apiRoot = Split-Path -Parent $PSScriptRoot

Push-Location $apiRoot
try {
    if (-not $env:DATABASE_URL) {
        $env:DATABASE_URL = 'postgres://synergy:synergy@localhost:5432/synergy?sslmode=disable'
    }
    if (-not $env:JWT_SECRET) { $env:JWT_SECRET = 'dev-secret-synergy-mvp' }
    if (-not $env:API_PORT) { $env:API_PORT = '8080' }
    if (-not $env:CORS_ALLOWED_ORIGINS) { $env:CORS_ALLOWED_ORIGINS = 'http://localhost:5173' }

    $exe = Join-Path (Get-SynergyBuildDir) 'api.exe'

    Write-Host 'Compilando a API...' -ForegroundColor Cyan
    go build -o $exe ./cmd/api
    if ($LASTEXITCODE -ne 0) { throw 'falha na compilação' }

    Write-Host "API subindo em http://localhost:$($env:API_PORT)  (Ctrl+C para parar)" -ForegroundColor Green
    exit (Invoke-SynergyBinary -Path $exe)
}
finally {
    Pop-Location
}
