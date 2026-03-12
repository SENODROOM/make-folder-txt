# make-folder-txt PowerShell completion script

Register-ArgumentCompleter -Native -CommandName 'make-folder-txt' -ScriptBlock {
    param($commandName, $wordToComplete, $commandAst, $fakeBoundParameters)

    # Get the current argument being completed
    $currentArgument = $wordToComplete

    # Define available options
    $options = @(
        '--ignore-folder', '-ifo',
        '--ignore-file', '-ifi', 
        '--only-folder', '-ofo',
        '--only-file', '-ofi',
        '--copy',
        '--force',
        '--install-completion',
        '--help', '-h',
        '--version', '-v'
    )

    # Get the previous parameter to determine context
    $previousParameter = if ($commandAst.CommandElements.Count -gt 1) {
        $commandAst.CommandElements[-2].Extent.Text
    } else {
        ''
    }

    switch ($previousParameter) {
        { $_ -in '--ignore-folder', '-ifo', '--only-folder', '-ofo' } {
            # Complete with folder names
            try {
                $folders = Get-ChildItem -Directory -Name | Where-Object { $_ -like "*$currentArgument*" }
                return $folders | ForEach-Object { 
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', "Folder: $_")
                }
            } catch {
                return @()
            }
        }
        { $_ -in '--ignore-file', '-ifi', '--only-file', '-ofi' } {
            # Complete with file names
            try {
                $files = Get-ChildItem -File -Name | Where-Object { $_ -like "*$currentArgument*" }
                return $files | ForEach-Object { 
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', "File: $_")
                }
            } catch {
                return @()
            }
        }
        default {
            # Complete with options
            if ($currentArgument -like '-*') {
                $matchingOptions = $options | Where-Object { $_ -like "*$currentArgument*" }
                return $matchingOptions | ForEach-Object { 
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', "Option: $_")
                }
            }
        }
    }

    return @()
}

# Export the completion function
Export-ModuleMember -Function *
