<#
.SYNOPSIS
    Grava o token de deploy do portal DB1 em ~/.config/apps-db1/token.

.DESCRIPTION
    O token é pedido sem eco: não aparece na tela, não entra no histórico do
    shell e não passa por linha de comando. Isso também elimina o problema de
    aspas — em aspas duplas o PowerShell expandiria um `$` dentro do token e
    gravaria um valor truncado, que o servidor recusa com 401 sem dizer por quê.

    A gravação usa WriteAllText de propósito: Set-Content e `>` acrescentam
    quebra de linha no fim e podem gravar BOM, e qualquer um dos dois corrompe
    o header Authorization.

.EXAMPLE
    .\scripts\set-deploy-token.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$pasta = Join-Path $HOME '.config\apps-db1'
$arquivo = Join-Path $pasta 'token'

if (-not (Test-Path $pasta)) {
    New-Item -ItemType Directory -Path $pasta -Force | Out-Null
}

Write-Host ''
Write-Host 'Cole o token de deploy pessoal (apps.db1group.com).' -ForegroundColor Cyan
Write-Host 'Ele NAO aparece na tela enquanto voce digita — isso e esperado.' -ForegroundColor DarkGray
Write-Host ''

$seguro = Read-Host -Prompt 'Token' -AsSecureString

# Converte o SecureString para texto apenas o tempo necessário para gravar, e
# libera a memória não gerenciada em seguida.
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($seguro)
try {
    $texto = [Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr)
}

# Espaço e quebra de linha colados junto na cópia são a causa mais comum de 401.
$texto = $texto.Trim()

if ([string]::IsNullOrWhiteSpace($texto)) {
    throw 'nenhum token informado — nada foi gravado'
}

[IO.File]::WriteAllText($arquivo, $texto)

# Restringe o acesso ao próprio usuário: por padrão o arquivo herda as permissões
# da pasta, que costumam incluir grupos mais amplos.
try {
    $acl = Get-Acl $arquivo
    $acl.SetAccessRuleProtection($true, $false)
    $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
        $env:USERNAME, 'FullControl', 'Allow')))
    Set-Acl -Path $arquivo -AclObject $acl
    $permissoes = 'restrito ao seu usuario'
}
catch {
    $permissoes = 'AVISO: nao foi possivel restringir as permissoes'
}

$bytes = (Get-Item $arquivo).Length

Write-Host ''
Write-Host "OK  $arquivo" -ForegroundColor Green
Write-Host "    $bytes bytes, $permissoes"
Write-Host ''
Write-Host 'Agora peca ao Claude Code para registrar o MCP.' -ForegroundColor Cyan
