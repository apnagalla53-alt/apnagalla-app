# Run locally in your own terminal. Windows DPAPI binds this handoff to the
# Windows user who performed the credential rotation. Never paste its output.
$credentialFile = Join-Path $PSScriptRoot '..\backend-typescript\.operator-access.local.dpapi'
if (-not (Test-Path -LiteralPath $credentialFile)) { throw 'Local encrypted access handoff was not found.' }
$protectedValue = (Get-Content -LiteralPath $credentialFile -Raw).Trim() | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protectedValue)
try {
    $records = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json
    $records | Format-Table database, kind, username, temporaryPassword -AutoSize -Wrap
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
