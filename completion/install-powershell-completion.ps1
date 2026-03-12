# PowerShell completion installation script for make-folder-txt

function Install-MakeFolderTxtCompletion {
    param(
        [switch]$Force,
        [switch]$CurrentUser
    )
    
    $ErrorActionPreference = 'Stop'
    
    # Determine PowerShell profile path
    if ($CurrentUser) {
        $profilePath = $PROFILE.CurrentUserCurrentHost
    } else {
        $profilePath = $PROFILE.AllUsersCurrentHost
    }
    
    # Create profile directory if it doesn't exist
    $profileDir = Split-Path $profilePath -Parent
    if (-not (Test-Path $profileDir)) {
        try {
            New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
            Write-Host "Created profile directory: $profileDir" -ForegroundColor Green
        } catch {
            Write-Error "Failed to create profile directory: $profileDir"
            return
        }
    }
    
    # Get the completion script content
    $completionScriptPath = Join-Path $PSScriptRoot 'make-folder-txt-completion.ps1'
    if (-not (Test-Path $completionScriptPath)) {
        Write-Error "Completion script not found: $completionScriptPath"
        return
    }
    
    $completionContent = Get-Content $completionScriptPath -Raw
    
    # Check if completion is already installed
    if (Test-Path $profilePath) {
        $profileContent = Get-Content $profilePath -Raw
        if ($profileContent -match 'make-folder-txt.*completion') {
            if (-not $Force) {
                Write-Host "make-folder-txt completion is already installed in $profilePath" -ForegroundColor Yellow
                Write-Host "Use -Force to reinstall" -ForegroundColor Yellow
                return
            }
            Write-Host "Removing existing completion..." -ForegroundColor Yellow
            # Remove existing completion
            $profileContent = $profileContent -replace '(?s)# make-folder-txt completion.*?Register-ArgumentComplester.*?Export-ModuleMember.*?\n', ''
            Set-Content $profilePath $profileContent -Force
        }
    }
    
    # Add completion to profile
    $completionBlock = @"

# make-folder-txt completion
$completionContent
"@
    
    try {
        Add-Content $profilePath $completionBlock -Force
        Write-Host "✅ PowerShell completion installed successfully!" -ForegroundColor Green
        Write-Host "Added to: $profilePath" -ForegroundColor Cyan
        Write-Host "Restart PowerShell or run: . `$profile" -ForegroundColor Cyan
    } catch {
        Write-Error "Failed to install completion: $_"
    }
}

# Auto-install if script is run directly
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    Install-MakeFolderTxtCompletion -CurrentUser
}
