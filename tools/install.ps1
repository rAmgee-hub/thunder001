# 메이플 시세 도구 설치: Node.js 확인 → API 키 저장(.env) → 바탕화면 바로가기 → 실행
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Say($msg, $color = 'Gray') { Write-Host $msg -ForegroundColor $color }

Say ''
Say '=== 메이플 시세 도구 설치 ===' 'Cyan'
Say ''

# 1) Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Say 'Node.js가 필요해요 (무료 프로그램).' 'Yellow'
  $ans = Read-Host '지금 자동으로 설치할까요? (Y/N)'
  if ($ans -match '^[Yy]') {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      Say 'winget이 없어서 자동 설치를 못 해요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 install.bat을 다시 실행하세요.' 'Red'
      exit 1
    }
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Say ''
    Say 'Node.js 설치가 끝났어요. 이 창을 닫고 install.bat을 한 번 더 실행하세요.' 'Green'
    exit 1
  }
  Say 'https://nodejs.org 에서 LTS 버전을 설치한 뒤 install.bat을 다시 실행하세요.' 'Yellow'
  exit 1
}
$nodeVer = (node -v) -replace '^v', ''
if ([int]($nodeVer.Split('.')[0]) -lt 20) {
  Say "Node.js 버전이 낮아요 ($nodeVer). 20 이상이 필요해요. https://nodejs.org 에서 LTS를 설치하세요." 'Red'
  exit 1
}
Say "Node.js $nodeVer 확인" 'Green'

# 2) API 키
$key = $null
if (Test-Path $EnvFile) {
  $keep = Read-Host '저장된 API 키가 있어요. 그대로 쓸까요? (Y=그대로 / N=새로 입력)'
  if ($keep -match '^[Yy]' -or $keep -eq '') { $key = 'KEEP' }
}
if (-not $key) {
  Say ''
  Say '넥슨 Open API 키를 붙여넣고 Enter를 누르세요. (마우스 오른쪽 클릭 = 붙여넣기)'
  $key = (Read-Host 'API 키').Trim()
  if (-not $key) { Say '키가 비어 있어요. 다시 실행하세요.' 'Red'; exit 1 }

  # 키 확인 (인터넷이 안 되면 건너뜀)
  try {
    Invoke-RestMethod -Uri 'https://open.api.nexon.com/maplestory/v1/character/list' -Headers @{ 'x-nxopen-api-key' = $key } -TimeoutSec 10 | Out-Null
    Say '키 확인 완료' 'Green'
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400 -or $code -eq 401 -or $code -eq 403) {
      Say "넥슨 서버가 이 키를 거절했어요 (코드 $code). 키를 다시 확인하세요." 'Red'
      $go = Read-Host '그래도 저장할까요? (Y/N)'
      if ($go -notmatch '^[Yy]') { exit 1 }
    } else {
      Say '키 확인을 건너뛰었어요 (넥슨 서버 연결 실패). 저장은 해 둘게요.' 'Yellow'
    }
  }
  [IO.File]::WriteAllText($EnvFile, "NEXON_API_KEY=$key`r`n", (New-Object Text.UTF8Encoding($false)))
  Say 'API 키를 저장했어요 (.env 파일, 이 PC에만 있음)' 'Green'
}

# 3) 바탕화면 바로가기
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop '메이플 시세 도구.lnk'
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
$s.TargetPath = Join-Path $Root 'run.bat'
$s.WorkingDirectory = $Root
$s.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
$s.Description = '메이플 시세 도구 실행'
$s.Save()
Say "바탕화면에 '메이플 시세 도구' 아이콘을 만들었어요" 'Green'

# 4) 실행
Say ''
Say '도구를 실행합니다. 다음부터는 바탕화면 아이콘을 더블클릭하세요.' 'Cyan'
Start-Process -FilePath (Join-Path $Root 'run.bat') -WorkingDirectory $Root
