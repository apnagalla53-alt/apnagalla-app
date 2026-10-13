param(
  [string]$Workspace = (Split-Path -Parent $PSScriptRoot),
  [string]$OutputPath = ''
)
$ErrorActionPreference = 'Stop'
$auditRoot = (Resolve-Path -LiteralPath $Workspace).Path.TrimEnd('\', '/')
$scanErrors = @()
# PowerShell does not follow directory links without -FollowSymlink.
$auditFiles = @(Get-ChildItem -LiteralPath $auditRoot -File -Force -Recurse -ErrorAction SilentlyContinue -ErrorVariable +scanErrors)
$directoryTotals = @{}
foreach ($auditFile in $auditFiles) {
  $relativePath = $auditFile.FullName.Substring($auditRoot.Length + 1)
  $directoryKey = if ($relativePath.Contains('\')) { $relativePath.Split('\')[0] } else { '(root files)' }
  if (-not $directoryTotals.ContainsKey($directoryKey)) { $directoryTotals[$directoryKey] = @{ bytes = [long]0; files = 0 } }
  $directoryTotals[$directoryKey].bytes += $auditFile.Length
  $directoryTotals[$directoryKey].files++
}
$importantPaths = @('frontend/node_modules','backend-typescript/node_modules','frontend/dist','backend-typescript/dist','frontend/coverage','backend-typescript/coverage','frontend/playwright-report','frontend/test-results','.playwright-cli','scratchpad','output','refrence','.git','frontend/.vite','frontend/node_modules/.vite','backend-typescript/uploads')
$nested = foreach ($directory in $importantPaths) {
  $absoluteDirectory = [IO.Path]::GetFullPath((Join-Path $auditRoot $directory)).TrimEnd('\', '/')
  $prefix = $absoluteDirectory + [IO.Path]::DirectorySeparatorChar
  $selected = @($auditFiles | Where-Object { $_.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
  [pscustomobject]@{ path=$directory; exists=(Test-Path -LiteralPath $absoluteDirectory); bytes=[long](($selected | Measure-Object Length -Sum).Sum); files=$selected.Count }
}
$report = [ordered]@{
  timestamp_utc=[DateTime]::UtcNow.ToString('o'); workspace=$auditRoot
  bytes=[long](($auditFiles | Measure-Object Length -Sum).Sum); files=$auditFiles.Count; scan_errors=$scanErrors.Count
  top_level=@($directoryTotals.GetEnumerator() | ForEach-Object { [pscustomobject]@{path=$_.Key;bytes=$_.Value.bytes;files=$_.Value.files} } | Sort-Object bytes -Descending)
  important=$nested
  largest_files=@($auditFiles | Sort-Object Length -Descending | Select-Object -First 20 | ForEach-Object { [pscustomobject]@{path=$_.FullName.Substring($auditRoot.Length+1);bytes=$_.Length} })
}
$reportJson = $report | ConvertTo-Json -Depth 6
if ($OutputPath) {
  $reportTarget = [IO.Path]::GetFullPath((Join-Path $auditRoot $OutputPath))
  if (-not $reportTarget.StartsWith($auditRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Audit output must remain inside the workspace.' }
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($reportTarget)) | Out-Null
  [IO.File]::WriteAllText($reportTarget, $reportJson, [Text.UTF8Encoding]::new($false))
  [pscustomobject]@{output=$reportTarget;bytes=$report.bytes;files=$report.files;scan_errors=$report.scan_errors} | ConvertTo-Json
} else { $reportJson }
