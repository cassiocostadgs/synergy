# Cria o usuário Admin inicial (bootstrap: só o Admin cadastra usuários).
# Idempotente — se o admin já existir, não faz nada.
#
# Aplica as migrations pendentes antes de semear, então também serve para
# inicializar um banco vazio.
#
# Uso:  .\scripts\seed.ps1
#       .\scripts\seed.ps1 -Email outro@empresa.com -Password 'senha-forte'

param(
    [string]$Email = 'admin@synergy.dev',
    [string]$Password = 'synergy123',
    [string]$Name = 'Admin Synergy'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$apiRoot = Split-Path -Parent $PSScriptRoot

Push-Location $apiRoot
try {
    if (-not $env:DATABASE_URL) {
        $env:DATABASE_URL = 'postgres://synergy:synergy@localhost:5432/synergy?sslmode=disable'
    }
    if (-not $env:JWT_SECRET) { $env:JWT_SECRET = 'dev-secret-synergy-mvp' }

    $env:SEED_ADMIN_EMAIL = $Email
    $env:SEED_ADMIN_PASSWORD = $Password
    $env:SEED_ADMIN_NAME = $Name

    $exe = Join-Path (Get-SynergyBuildDir) 'seed.exe'

    Write-Host 'Compilando o seed...' -ForegroundColor Cyan
    go build -o $exe ./cmd/seed
    if ($LASTEXITCODE -ne 0) { throw 'falha na compilação' }

    exit (Invoke-SynergyBinary -Path $exe)
}
finally {
    Pop-Location
}
