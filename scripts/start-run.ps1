# Starts Strata's campaign run: an interactive agent session in this checkout, in its own window, with every
# permission prompt off and its goal set. The run starts only when the operator starts it, and ends when its window
# closes, it crashes or the machine restarts: nothing here, or anywhere in the repository, starts or resumes it.
#
#   pwsh scripts/start-run.ps1                    start the run in Claude Code (the latest Opus), elevated
#   pwsh scripts/start-run.ps1 -Runner agy        start it in Antigravity on Orchestrator (Carbon)
#   pwsh scripts/start-run.ps1 -InstallShortcut   put "Strata Claude campaign" and "Strata Carbon campaign" on the
#                                                 desktop, each running the line above for its runner
#   pwsh scripts/start-run.ps1 -DryRun            print what would run or be written, and change nothing
#   pwsh scripts/start-run.ps1 -NoElevate         start without administrator rights (see below)
#   pwsh scripts/start-run.ps1 -Model sonnet      start on another model
#   pwsh scripts/start-run.ps1 -Effort high       start the Claude runner at another effort (default medium)
#   pwsh scripts/start-run.ps1 -TakeOver          take over a held run guard without being asked
#
# Why elevated (owner decision 2026-11-17). One section of the plan, D00 T01 §4, builds the fixture disk image, which
# mounts a VHD and creates shadow copies: both need administrator rights. The run therefore starts elevated, with one
# UAC prompt at launch, so it never has to stop for a person. The plan marks such sections with the Need `elevated`,
# which todo/plan.json probes; with -NoElevate the run does everything else and parks at those sections.
# An elevated agent with permission prompts off can change anything on this machine. Start it only on a workstation
# you would hand to an administrator, and close its window to end it.
#
# Each shortcut's icon is Strata's mark (assets/brand/strata.ico) with its runner's badge in the corner, rendered on
# this machine into %LOCALAPPDATA%\Strata by scripts/campaign-icon.py, never into the repository.
#
# The goal is a Claude Code /goal, checked after every turn: the plan finished through the process-plan skill. That
# skill starts the run guard itself (scripts/campaign_guard.py and a heartbeat inside the session), so this file
# starts no guard. Two sessions must never write to one tree: when a guard from an earlier session is held, this file
# names that session and waits for Enter (or takes -TakeOver as the answer).
#
# The session signs in with the long-lived token kept in the user variable CLAUDE_CODE_OAUTH_TOKEN when one is
# stored, and with the claude.ai sign-in otherwise. The token is never printed, and this file never creates one.
#
# Adapted from Conclave-SDK's own scripts/start-run.ps1. The unattended kit's tmux runner (scripts/unattended-run.py)
# is installed too, but it runs in WSL, where Strata's Windows toolchain, WebView2 and VHD tools are not available.
param(
  [ValidateSet('claude', 'agy')]
  [string]$Runner = 'claude',
  [switch]$InstallShortcut,
  [switch]$DryRun,
  [switch]$TakeOver,
  [switch]$NoElevate,
  [string]$ShortcutDir = [Environment]::GetFolderPath('Desktop'),
  [string]$Model = '',
  [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')]
  [string]$Effort = 'medium',
  [string]$IconDir = (Join-Path $env:LOCALAPPDATA 'Strata'),
  [string]$UserEnvKey = 'HKCU:\Environment',
  [string]$Goal = '',
  # A goal handed across the elevation boundary, where quoting a long sentence as an argument is not safe.
  [string]$GoalBase64 = '',
  [string]$GuardFile = ''
)
$ErrorActionPreference = 'Stop'
# The automations kit marks every process a scheduled task runs: a run starts only when its operator starts it.
if ($env:CONCLAVE_AUTOMATION -and -not $InstallShortcut) {
  "start refused: it came from the scheduled task $env:CONCLAVE_AUTOMATION, and a run starts only when its operator starts it"
  exit 2
}
$repo = Split-Path $PSScriptRoot
if ($GoalBase64) { $Goal = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($GoalBase64)) }
$customGoal = $Goal
$customGuard = $GuardFile
$tokenName = 'CLAUDE_CODE_OAUTH_TOKEN'
if (-not $Model) { $Model = if ($Runner -eq 'agy') { 'gemini-pro-orchestrator' } else { 'opus' } }
if (-not $GuardFile) { $GuardFile = Join-Path $repo 'build\claude-campaign-guard.json' }
$elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# Each runner's shortcut: its name is also the window title, so the operator can tell the campaigns apart.
$shortcuts = @(
  @{ Runner = 'claude'; Name = 'Strata Claude campaign'; Icon = 'strata-campaign-claude.ico'
     Description = 'Start the Strata campaign in Claude Code (the latest Opus), elevated' },
  @{ Runner = 'agy'; Name = 'Strata Carbon campaign'; Icon = 'strata-campaign-carbon.ico'
     Description = 'Start the Strata campaign in Google Antigravity on Orchestrator (Carbon), elevated' }
)
$title = ($shortcuts | Where-Object { $_.Runner -eq $Runner }).Name

if ($InstallShortcut) {
  $pwsh = (Get-Process -Id $PID).Path
  $brand = Join-Path $repo 'assets\brand\strata.ico'
  $renderer = Join-Path $repo 'scripts\campaign-icon.py'
  if ($DryRun) {
    foreach ($s in $shortcuts) {
      "would write: $(Join-Path $ShortcutDir "$($s.Name).lnk") (run as administrator)"
      "  target: $pwsh -NoLogo -NoExit -NoProfile -File `"$PSCommandPath`" -Runner $($s.Runner)"
      "  icon: $(Join-Path $IconDir $s.Icon)"
    }
    exit 0
  }
  $python = (Get-Command python -CommandType Application -ErrorAction Ignore | Select-Object -First 1).Source
  if (-not $python) { 'python is not on PATH: install Python 3, then write the shortcuts again'; exit 1 }
  New-Item -ItemType Directory -Force $IconDir | Out-Null
  foreach ($s in $shortcuts) {
    $icon = Join-Path $IconDir $s.Icon
    & $python $renderer badge $brand $s.Runner $icon
    if ($LASTEXITCODE -ne 0) { "the icon for $($s.Name) could not be rendered"; exit 1 }
    $link = Join-Path $ShortcutDir "$($s.Name).lnk"
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
    $shortcut.TargetPath = $pwsh
    $shortcut.Arguments = "-NoLogo -NoExit -NoProfile -File `"$PSCommandPath`" -Runner $($s.Runner)"
    $shortcut.WorkingDirectory = $repo
    $shortcut.Description = $s.Description
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Save()
    # Byte 21 of a .lnk holds the flag Explorer shows as "Run as administrator": the shortcut asks for elevation
    # itself, so the window it opens is the run's own and there is one UAC prompt, at launch.
    $bytes = [IO.File]::ReadAllBytes($link)
    $bytes[21] = $bytes[21] -bor 0x20
    [IO.File]::WriteAllBytes($link, $bytes)
    "shortcut written: $link (run as administrator)"
  }
  exit 0
}

if (-not $Goal) {
  $Goal = (@'
Finish the Strata implementation plan (todo/implementation-plan.md) 100% complete and aim for excellence: a digital forensics suite an examiner would trust, with the desktop app matching the approved design in design/ui 1:1 under design/CONTRACT.md. Act autonomously under the Operating directive in AGENTS.md: decide and act instead of asking, heal what breaks at its owning layer, and never loosen a test, a parity bar or a licence rule to pass. Work it with the process-plan skill, as the prompt `process plan` does, without stopping between sections or phases. Never ask the operator a question: take the industry-standard option and record the decision, and what reversing it would cost, in the run file. Evidence is read-only and no parser may panic. The goal is met only when `python scripts/todo-graph.py query stats` shows verified equal to total, or every row still open is in phase 99 or waits on a Need this session cannot meet and the run file carries its PARKED line and park record.
'@).Trim()
}
if ($elevated) {
  $Goal += ' This session runs with administrator rights so that fixtures/build-fixture.ps1 can mount a VHD and create shadow copies: use those rights for nothing else, change nothing outside this repository and its fixtures/out folder except what a plan section names, and never disable a security control.'
} else {
  $Goal += ' This session has no administrator rights: sections with the Need elevated are held, so work everything else and park at them.'
}

# Who holds the run, read before anything starts. The guard's own field is session_id (scripts/campaign_guard.py).
$held = $null
if (Test-Path -LiteralPath $GuardFile) {
  $held = try { [string](Get-Content -LiteralPath $GuardFile -Raw | ConvertFrom-Json).session_id } catch { '' }
  if ($held -notmatch '^[0-9A-Za-z-]{8,64}$') { $held = '' }
}
if ($null -eq $held) {
  $Goal += ' No run guard was held when this session was launched: if process-plan finds a guard owned by another session, another run is live, so start nothing, never use --handover, and end the turn.'
} elseif ($held) {
  $Goal += " A run guard held by session $held was acknowledged by the operator at launch: take the run over from that session only, with ``acquire --handover resumed-from-launcher``. If the guard names any other session, another run is live: start nothing and end the turn."
} else {
  $Goal += ' A run guard file was present at launch but named no session: do not take it over. Report what the guard file holds and end the turn.'
}
# One line with no double quote: it is passed to the agent as a single argument. Claude Code allows 4,000 characters.
if ($Goal.Contains('"') -or $Goal.Contains("`n")) { 'the goal must be one line with no double quote'; exit 1 }
if ($Goal.Length -gt 4000) { "the goal is $($Goal.Length) characters; Claude Code allows 4,000"; exit 1 }

if ($Runner -eq 'agy') {
  $agent = 'agy'
  $arguments = @("--model=$Model", '--dangerously-skip-permissions', "--prompt-interactive=$Goal")
} else {
  $agent = 'claude'
  $session = [guid]::NewGuid().ToString()
  $arguments = @('--session-id', $session, '--dangerously-skip-permissions', '--model', $Model, '--effort', $Effort, '--name', $title, "/goal $Goal")
}
# Everything the operator set must survive the restart as administrator: a dropped option would silently run the
# default campaign instead of the one asked for.
$again = @('-NoLogo', '-NoExit', '-NoProfile', '-File', "`"$PSCommandPath`"", '-Runner', $Runner, '-Model', $Model, '-Effort', $Effort,
            '-UserEnvKey', "`"$UserEnvKey`"")
if ($TakeOver) { $again += '-TakeOver' }
if ($customGuard) { $again += @('-GuardFile', "`"$customGuard`"") }
if ($customGoal) { $again += @('-GoalBase64', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($customGoal))) }
if ($DryRun) {
  if (-not $elevated -and -not $NoElevate) { "would restart elevated: $($again -join ' ')" }
  "in $repo ($(if ($elevated) { 'elevated' } elseif ($NoElevate) { 'not elevated, by -NoElevate' } else { 'not elevated: a real start asks for elevation first' }))"
  if ($null -ne $held) { "a run guard is held by session $(if ($held) { $held } else { '(the guard file names none)' }): a real start asks before taking it over" }
  "$agent $($arguments[0..($arguments.Count - 2)] -join ' ') `"$($arguments[-1])`""
  exit 0
}

# Not elevated and not told to stay so: start this same file again elevated, in its own window, and end here.
if (-not $elevated -and -not $NoElevate) {
  $pwsh = (Get-Process -Id $PID).Path
  'asking for administrator rights (one prompt): the run opens in its own window'
  try { Start-Process -FilePath $pwsh -ArgumentList $again -Verb RunAs -WorkingDirectory $repo | Out-Null }
  catch { "elevation was refused: nothing was started. Use -NoElevate to run without it. ($($_.Exception.Message))"; exit 1 }
  exit 0
}

# Looked up, not assumed: a missing tool is named with its fix instead of failing as a bare "not recognized".
$python = (Get-Command python -CommandType Application -ErrorAction Ignore | Select-Object -First 1).Source
$program = (Get-Command $agent -ErrorAction Ignore | Select-Object -First 1).Source
if (-not $python) { 'python is not on PATH: install Python 3, then start again'; exit 1 }
if (-not $program) {
  if ($agent -eq 'agy') { 'agy is not on PATH: install Google Antigravity, then start again' } else { 'claude is not on PATH: install Claude Code, then start again' }
  exit 1
}
foreach ($tool in 'cargo', 'pnpm', 'git') {
  if (-not (Get-Command $tool -ErrorAction Ignore)) { "warning: $tool is not on PATH in this window; the run will have to find or install it" }
}

if ($null -ne $held) {
  "a run guard is held by session $(if ($held) { $held } else { '(the guard file names none)' })"
  'If that session is still working in another window, close this one now.'
  if (-not $TakeOver) { [void](Read-Host 'Press Enter to start a new session that takes the run over') }
}

# The sign-in (Claude Code's; Antigravity signs in itself). Each line says where it came from, never the token itself.
if ($agent -eq 'agy') {
  'sign-in: Antigravity uses its own Google sign-in'
} elseif ([Environment]::GetEnvironmentVariable($tokenName)) {
  'sign-in: the long-lived token this window already has'
} else {
  $token = if (Test-Path -LiteralPath $UserEnvKey) { (Get-Item -LiteralPath $UserEnvKey).GetValue($tokenName, $null) }
  if ($token) {
    [Environment]::SetEnvironmentVariable($tokenName, $token)
    $token = $null
    'sign-in: the long-lived token from your user variables'
  } else {
    'sign-in: no long-lived token is stored, so the session uses the claude.ai sign-in'
    "          to store one: run ``claude setup-token`` and keep its output as the user variable $tokenName"
  }
}

"rights: $(if ($elevated) { 'administrator (sections with the Need elevated can run)' } else { 'standard user (sections with the Need elevated are held)' })"
try { $Host.UI.RawUI.WindowTitle = $title } catch { Write-Verbose "window title not set: $($_.Exception.Message)" }
Set-Location -LiteralPath $repo
& $program @arguments
