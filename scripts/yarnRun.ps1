#!/usr/bin/env pwsh
param (
    [switch]$Parallel,
    [Parameter(Mandatory = $true)]
    [string]$command,
    [string]$root = $(Join-Path -Path $PSScriptRoot -ChildPath "..")
)

# read pakage jsons and generate manifest
Filter Read-Package([parameter(ValueFromPipeline = $true)][string[]] $dirNames) {
    $dirNames | ForEach-Object {
        $pkgPath = Join-Path $root -ChildPath "packages" | Join-Path -ChildPath $_ | Join-Path -ChildPath "package.json"
        $json = Get-Content -Path $pkgPath | ConvertFrom-Json
        New-Object PSObject -Property @{
            Name         = $json.name
            DirName      = $_
            Dependencies = $json.dependencies.PSObject.Properties | ForEach-Object Name
            Commands     = $json.scripts.PSObject.Properties | ForEach-Object Name
        }
    }
}

# check if $first has the $second dependence
Function isDependence([object]$first, [object]$second) {
    $(foreach ($dep in $first.Dependencies) {
            if ($dep -eq $second.Name) {
                $true
                break
            }
        })
}

### DFS version topo sort
$order = 1
Function dfs([object]$u) {
    $u.Order = -1
    foreach ($v in ($manifests | Where-Object { $u -ne $_ -and $(isDependence $_ $u) })) {
        if ($v.Order -lt 0) {
            return $false
        }
        if (!$v.Order) {
            dfs $v
        }
    }
    $u.Order = $global:order++
    return $true
}

# generate manifests
$manifests = Join-Path -Path $root -ChildPath "packages" | Get-ChildItem | Where-Object { $_.PsIsContainer -eq $true } | Foreach-Object { $_.Name } | Read-Package | Select-Object Name, DirName, Dependencies, Commands, @{Name = "Order"; Expression = { 0 } }

foreach ($manifest in $manifests) {
    if (!$manifest.Order) {
        if (!(dfs $manifest)) {
            throw "Package cycle dependencies detected"
        }
    }
}

# sort manifests and reset packages
$manifests = $manifests | Sort-Object -Property Order -Descending


Function GetRunnablePackages([string]$cmd) {
    $pkgs = $manifests | Where-Object { $_.Commands.Contains($cmd.Trim()) } | ForEach-Object DirName
    Write-Host begin to process packages: ($pkgs -join ', ')
    return $pkgs
}


Function RunParallel([string]$cmd) {
    $pkgs = GetRunnablePackages $cmd
    Write-Host 'hello', $pkgs 
    $procs = $pkgs | ForEach-Object {
        Start-Process -FilePath yarn -ArgumentList $("--cwd {0} run {1}" -f (Join-Path $root -ChildPath "packages" | Join-Path -ChildPath $_), $cmd)  -PassThru
    }
    $procs | Wait-Process

    foreach ($code in ($procs | ForEach-Object { $procs.ExitCode })) {
        if ($code -ne 0) {
            Exit $code
        }
    }
}

Function RunSequence([string]$cmd) {
    $pkgs = GetRunnablePackages $cmd 
    $pkgs | ForEach-Object {
        $proc = Start-Process -FilePath yarn -ArgumentList $("--cwd {0} run {1}" -f (Join-Path $root "packages" $_), $cmd) -Wait -PassThru
        if ($proc.ExitCode -ne 0) {
            Exit $proc.ExitCode
        }
    }
}


Function PrintHelp() {
    $helpers = @(
        "Usage: ./yarnRun.ps1 [-Parallel] <command>",
        "It will run yarn <command> recursively in every packages sequencely by default unless -Parellel is set"
    )
    $helpers | Write-Host
}

switch ($command) {
    "help" { PrintHelp }
    default {
        if ($Parallel) {
            RunParallel $command
        }
        else {
            RunSequence $command
        }
    }
}