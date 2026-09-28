param(
  [Parameter(Position = 0)]
  [ValidateSet('setup', 'dev', 'package', 'installer')]
  [string]$Action = 'dev'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Cần cài Node.js 24 trước khi chạy script này.'
}

$nodeMajor = [int]((node --version) -replace '^v(\d+)\..*$', '$1')
if ($nodeMajor -ne 24) {
  throw "Dự án dùng Node.js 24; phiên bản hiện tại là $(node --version)."
}

if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw 'Không tìm thấy Corepack. Cài Corepack cho Node.js, rồi chạy lại script.'
}

function Invoke-Pnpm {
  & corepack pnpm @args
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($args -join ' ') thất bại với mã $LASTEXITCODE."
  }
}

if ($Action -eq 'setup' -or -not (Test-Path -LiteralPath 'node_modules')) {
  Invoke-Pnpm install --frozen-lockfile
}

switch ($Action) {
  'setup' { Write-Host 'Đã cài dependencies. Chạy .\scripts\windows.ps1 dev để mở ứng dụng.' }
  'dev' { Invoke-Pnpm dev }
  'package' {
    Invoke-Pnpm package
    Write-Host 'EXE: .\out\Read-Anything-win32-x64\Read-Anything.exe'
  }
  'installer' {
    Invoke-Pnpm make:win
    Write-Host 'Bộ cài nằm trong .\out\make\squirrel.windows\x64\'
  }
}
