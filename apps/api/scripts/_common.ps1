# Utilidades compartilhadas pelos scripts do backend.
#
# Existe por causa de duas particularidades do ambiente Windows corporativo:
#
#   1. O antivírus bloqueia a execução de binários recém-criados por alguns
#      instantes, até terminar de escaneá-los ("Acesso negado"). É por isso que
#      `go run` e `go test ./...` falham nesta máquina: ambos compilam e executam
#      imediatamente. O contorno é compilar para um caminho fixo e tentar
#      executar com retry.
#
#   2. O repositório vive dentro do OneDrive. Compilar ali faria o OneDrive
#      sincronizar binários de ~15 MB a cada build, então usamos um diretório
#      local fora da pasta sincronizada.

# Diretório de build, fora do OneDrive.
#
# Especificamente sob %LOCALAPPDATA%\Programs: nesta máquina os binários de teste
# do Go só conseguem executar a partir daí (as demais pastas testadas, inclusive
# %TEMP% e %LOCALAPPDATA% na raiz, são bloqueadas pelo antivírus). Se você estiver
# em outra máquina e quiser mudar, valide rodando scripts\test.ps1.
$script:SynergyBuildDir = Join-Path $env:LOCALAPPDATA 'Programs\synergy-build'

function Get-SynergyBuildDir {
    New-Item -ItemType Directory -Force -Path $script:SynergyBuildDir | Out-Null
    return $script:SynergyBuildDir
}

<#
.SYNOPSIS
Executa um binário recém-compilado, com retry enquanto o antivírus o bloqueia.

.DESCRIPTION
Distingue os dois casos que parecem iguais no shell:
  - o processo não conseguiu nem iniciar (antivírus) -> tenta de novo;
  - o processo rodou e retornou código de erro -> devolve o código, sem retry.

.OUTPUTS
O exit code do processo.
#>
function Invoke-SynergyBinary {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$Arguments = @(),
        [int]$MaxAttempts = 3,
        [int]$DelayMs = 600
    )

    $previousPreference = $ErrorActionPreference
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            # 'Stop' faz a falha de lançamento virar exceção capturável.
            $ErrorActionPreference = 'Stop'
            # Out-Host manda a saída do programa direto para o console. Sem isso
            # ela entraria no pipeline da função e seria capturada junto com o
            # exit code por quem atribui o retorno a uma variável — o que fazia
            # testes aprovados serem reportados como falha.
            if ($Arguments.Count -gt 0) { & $Path @Arguments | Out-Host } else { & $Path | Out-Host }
            return $LASTEXITCODE
        }
        catch {
            if ($attempt -eq $MaxAttempts) {
                throw "não foi possível executar '$Path' após $MaxAttempts tentativas. Último erro: $($_.Exception.Message)"
            }
            Write-Host "  antivírus ainda bloqueando o binário; nova tentativa em ${DelayMs}ms ($attempt/$MaxAttempts)" -ForegroundColor DarkYellow
            Start-Sleep -Milliseconds $DelayMs
        }
        finally {
            $ErrorActionPreference = $previousPreference
        }
    }
}
