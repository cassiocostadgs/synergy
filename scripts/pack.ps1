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
    if ($_.Name -like '.env*' -and $_.Name -ne '.env.example') { return $false }

    foreach ($padrao in $excluir) {
        if ($caminho -like "*$padrao*") { return $false }
    }
    return $true
}

if (-not $arquivos) { throw 'nenhum arquivo selecionado — verifique a raiz do repositório' }

# Monta em área temporária preservando a estrutura de pastas: o Compress-Archive
# achataria tudo num nível só se recebesse a lista de arquivos direto.
$temp = Join-Path ([IO.Path]::GetTempPath()) "synergy-pack-$(Get-Random)"
New-Item -ItemType Directory -Path $temp -Force | Out-Null

try {
    foreach ($arquivo in $arquivos) {
        $relativo = $arquivo.FullName.Substring($raiz.Path.Length).TrimStart('\')
        $destino = Join-Path $temp $relativo
        $pastaDestino = Split-Path $destino -Parent

        if (-not (Test-Path $pastaDestino)) {
            New-Item -ItemType Directory -Path $pastaDestino -Force | Out-Null
        }
        Copy-Item $arquivo.FullName -Destination $destino
    }

    Write-Host '==> compactando' -ForegroundColor Cyan

    if (Test-Path $saidaCompleta) { Remove-Item $saidaCompleta -Force }
    Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $saidaCompleta -CompressionLevel Optimal

    $tamanho = (Get-Item $saidaCompleta).Length / 1MB
    Write-Host ''
    Write-Host ("OK  {0}" -f $saidaCompleta) -ForegroundColor Green
    Write-Host ("    {0} arquivos, {1:N1} MB" -f $arquivos.Count, $tamanho)
}
finally {
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
