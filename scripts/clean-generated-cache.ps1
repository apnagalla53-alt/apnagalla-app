param([switch]$Apply)
$ErrorActionPreference='Stop'
$cacheRoot=(Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path.TrimEnd('\')
# Explicit generated-cache allowlist. Never broaden to output, docs, uploads, dumps or .git.
$cachePaths=@('frontend/node_modules/.vite','backend-typescript/node_modules/.cache')
$cachePlan=foreach($relativeCachePath in $cachePaths){
 $absoluteCachePath=[IO.Path]::GetFullPath((Join-Path $cacheRoot $relativeCachePath))
 if(-not $absoluteCachePath.StartsWith($cacheRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Cache path escaped the workspace.'}
 if(Test-Path -LiteralPath $absoluteCachePath){
  $cacheItem=Get-Item -LiteralPath $absoluteCachePath -Force
  if($cacheItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked cache directories are not eligible.'}
  $cacheChildren=@(Get-ChildItem -LiteralPath $absoluteCachePath -Force -Recurse)
  if($cacheChildren | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}){throw 'Linked cache entries are not eligible.'}
  $cacheFiles=@($cacheChildren | Where-Object {-not $_.PSIsContainer})
  [pscustomobject]@{path=$absoluteCachePath;bytes=[long](($cacheFiles | Measure-Object Length -Sum).Sum);files=$cacheFiles.Count;action=if($Apply){'remove generated cache'}else{'dry run'}}
 }
}
$cachePlan | ConvertTo-Json
if($Apply){foreach($cacheTarget in $cachePlan){Remove-Item -LiteralPath $cacheTarget.path -Recurse -Force}}
