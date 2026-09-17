<#
.SYNOPSIS
    Gera o .zip da codebase para publicar no portal interno (Coolify).

.DESCRIPTION
    O .dockerignore NÃO evita um zip gigante: ele filtra o que o Docker lê
    depois do upload, e o upload já aconteceu. Quem decide o tamanho do zip é
    quem o monta — este script.

    O que fica de fora é o que a imagem reconstrói sozinha (node_modules, dist)
    ou o que não tem por que viajar (.git, .env, testes e2e, relatórios).

.EXAMPLE
    .\scripts\pack.ps1
#>

[CmdletBinding()]
param(
    # Onde gravar o pacote. O padrão fica na raiz do repositório.
    [string] $Saida = (Join-Path $PSScriptRoot '..\synergy.zip')
)

$ErrorActionPreference = 'Stop'

$raiz = Resolve-Path (Join-Path $PSScriptRoot '..')
$saidaCompleta = [IO.Path]::GetFullPath($Saida)

# Espelha o .dockerignore, mais o que só existe no disco local.
# São fragmentos de caminho: basta um casar para o arquivo ficar de fora.
$excluir = @(
    '\node_modules\'
    '\dist\'
    '\.git\'
    '\.claude\'
    '\.vscode\'
    '\.idea\'
    '\.pgdata\'
    '\apps\e2e\'
    '\playwright-report\'
    '\test-results\'
    '\apps\api\bin\'
)

Write-Host '==> coletando arquivos' -ForegroundColor Cyan

$arquivos = Get-ChildItem -Path $raiz -Recurse -File -Force | Where-Object {
    $caminho = $_.FullName

    # O zip anterior não entra no zip novo.
    if ($caminho -eq $saidaCompleta) { return $false }
    if ($_.Extension -eq '.zip') { return $false }
    if ($_.Extension -eq '.exe') { return $false }

    # .env carrega segredo; .env.example é só referência e pode ir.
    #
    # Exceção: o .env DA RAIZ precisa viajar. Ele é o único canal de variáveis de
    # ambiente do portal de deploy — não há tela para cadastrá-las, e é dele que
    # a plataforma tira a configuração do container. Sem o arquivo no pacote a
    # API recusa subir, o healthcheck falha e a publicação é desfeita.
    #
    # Os .env de apps/api e apps/web continuam de fora: são de desenvolvimento.
    if ($_.Name -like '.env*' -and $_.Name -ne '.env.example') {
        $ehEnvDaRaiz = ($_.Name -eq '.env') -and
                       ([IO.Path]::GetDirectoryName($caminho) -eq $raiz.Path)
        if (-not $ehEnvDaRaiz) { return $false }
    }

    foreach ($padrao in $excluir) {
        if ($caminho -like "*$padrao*") { return $false }
    }
    return $true
}

if (-not $arquivos) { throw 'nenhum arquivo selecionado — verifique a raiz do repositório' }

Write-Host '==> compactando' -ForegroundColor Cyan

# Escreve o .zip pela API do .NET, entrada por entrada, em vez de usar o
# Compress-Archive.
#
# O motivo é um defeito do Compress-Archive no PowerShell 5.1: ele grava os
# caminhos com barra INVERTIDA (`apps\api\go.mod`). O formato ZIP exige barra
# normal, e quem descompacta no Linux — a plataforma de deploy — não vê pastas:
# vê um arquivo cujo nome tem barras invertidas dentro. O `COPY apps/api/...`
# do Dockerfile então falha, e o build quebra sem mensagem que explique.
#
# Montar as entradas à mão também dispensa a cópia para uma área temporária,
# que antes existia só para o Compress-Archive enxergar a estrutura de pastas.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $saidaCompleta) { Remove-Item $saidaCompleta -Force }

$zip = [IO.Compression.ZipFile]::Open($saidaCompleta, 'Create')
try {
    foreach ($arquivo in $arquivos) {
        $relativo = $arquivo.FullName.Substring($raiz.Path.Length).TrimStart('\')
        $entrada = $relativo -replace '\\', '/'

        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $arquivo.FullName, $entrada,
            [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
}
finally {
    $zip.Dispose()
}

$tamanho = (Get-Item $saidaCompleta).Length / 1MB
Write-Host ''
Write-Host ("OK  {0}" -f $saidaCompleta) -ForegroundColor Green
Write-Host ("    {0} arquivos, {1:N1} MB" -f $arquivos.Count, $tamanho)
