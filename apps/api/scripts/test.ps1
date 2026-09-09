# Roda os testes do backend.
#
# `go test ./...` falha nesta máquina porque compila e executa o binário de teste
# imediatamente, e o antivírus bloqueia executáveis recém-criados. Aqui
# compilamos cada pacote de teste e executamos com retry (ver scripts/_common.ps1).
#
# Em máquinas sem essa restrição, `go test ./...` funciona normalmente.
#
# Uso:  .\scripts\test.ps1
#       .\scripts\test.ps1 -Detalhado    # saída teste por teste

param(
    [switch]$Detalhado
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$apiRoot = Split-Path -Parent $PSScriptRoot

Push-Location $apiRoot
try {
    $buildDir = Get-SynergyBuildDir

    # Apenas os pacotes que realmente possuem arquivos de teste.
    $pacotes = go list -f '{{if .TestGoFiles}}{{.ImportPath}}{{end}}' ./... |
        Where-Object { $_ -ne '' }

    if (-not $pacotes) {
        Write-Host 'Nenhum pacote com testes encontrado.' -ForegroundColor Yellow
        exit 0
    }

    $falhas = 0
    $bloqueados = 0
    foreach ($pacote in $pacotes) {
        $nome = ($pacote -split '/')[-1]
        $exe = Join-Path $buildDir "$nome.test.exe"

        Write-Host "`n=== $pacote ===" -ForegroundColor Cyan
        go test -c -o $exe $pacote
        if ($LASTEXITCODE -ne 0) {
            Write-Host "falha ao compilar os testes de $pacote" -ForegroundColor Red
            $falhas++
            continue
        }

        $testArgs = if ($Detalhado) { @('-test.v') } else { @() }
        try {
            $codigo = Invoke-SynergyBinary -Path $exe -Arguments $testArgs
            if ($codigo -ne 0) { $falhas++ }
        }
        catch {
            $bloqueados++
            Write-Host '  binário de teste bloqueado pelo antivírus (não chegou a executar)' -ForegroundColor Yellow
        }
    }

    Write-Host ''
    if ($bloqueados -gt 0) {
        Write-Host "$bloqueados pacote(s) não puderam ser executados nesta máquina." -ForegroundColor Yellow
        Write-Host ''
        Write-Host 'Causa: política corporativa de reputação de executáveis. Binários de teste' -ForegroundColor Yellow
        Write-Host 'recém-compilados são barrados até ganharem idade/prevalência — o mesmo motivo' -ForegroundColor Yellow
        Write-Host 'pelo qual `go test ./...` e `go run` falham com "Acesso negado".' -ForegroundColor Yellow
        Write-Host ''
        Write-Host 'Caminhos para resolver:' -ForegroundColor Yellow
        Write-Host '  1. Pedir ao TI uma exclusão de antivírus para a pasta de build do Go' -ForegroundColor Yellow
        Write-Host "     ($buildDir e %LOCALAPPDATA%\go-build)" -ForegroundColor Yellow
        Write-Host '  2. Rodar os testes na CI (não sofre a restrição)' -ForegroundColor Yellow
        Write-Host '  3. Rodar em WSL/container, onde o binário é Linux' -ForegroundColor Yellow
        exit 1
    }
    if ($falhas -gt 0) {
        Write-Host "$falhas pacote(s) com falha" -ForegroundColor Red
        exit 1
    }
    Write-Host 'Todos os testes passaram.' -ForegroundColor Green
    exit 0
}
finally {
    Pop-Location
}
