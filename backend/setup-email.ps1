# Connects Lop-rig to a Gmail account so password-reset codes are really emailed.
#   npm run setup-email
# You need a Gmail "App Password": https://myaccount.google.com/apppasswords (2-Step Verification must be on).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "Lop-rig email setup (Gmail)" -ForegroundColor Yellow
Write-Host "Create an App Password first: https://myaccount.google.com/apppasswords"
Write-Host ""

$address = (Read-Host "Gmail address to send from").Trim()
if ($address -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { Write-Host "That doesn't look like an email address." -ForegroundColor Red; exit 1 }

$secure = Read-Host "16-letter App Password (hidden)" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$password = $password -replace "\s", ""
if ($password.Length -ne 16) { Write-Host "App Passwords are 16 letters (spaces are ignored). Try again." -ForegroundColor Red; exit 1 }

# Rewrite only the email lines in .env; keep everything else and a backup.
Copy-Item .env .env.bak -Force
$keep = Get-Content .env | Where-Object { $_ -notmatch "^(EMAIL_BACKEND|DEFAULT_FROM_EMAIL|EMAIL_HOST_USER|EMAIL_HOST_PASSWORD)=" }
$lines = @($keep) + @(
    "EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend",
    "DEFAULT_FROM_EMAIL=Lop-rig <$address>",
    "EMAIL_HOST_USER=$address",
    "EMAIL_HOST_PASSWORD=$password"
)
# UTF-8 *without* a byte-order mark, so the first setting in .env stays readable.
[IO.File]::WriteAllLines((Join-Path $PSScriptRoot ".env"), [string[]]$lines, (New-Object Text.UTF8Encoding $false))
Write-Host "Saved to backend/.env (backup: .env.bak)." -ForegroundColor Green

$to = (Read-Host "Send a test email to (press Enter for $address)").Trim()
if (-not $to) { $to = $address }
Write-Host "Sending test email to $to ..."
& .\.venv\Scripts\python.exe manage.py sendtestemail $to
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done! Check $to (and the Spam folder)." -ForegroundColor Green
    Write-Host "Now RESTART the backend (Ctrl+C, then 'npm run backend') so Forgot Password uses Gmail." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Gmail refused the login. Check the address and App Password, then run 'npm run setup-email' again." -ForegroundColor Red
    Write-Host "To undo: copy backend\.env.bak over backend\.env"
}
