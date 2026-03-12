#compdef make-folder-txt
# make-folder-txt zsh completion

_make_folder_txt() {
    local -a arguments
    arguments=(
        '--ignore-folder[Ignore specific folders by name]:folder:_directories'
        '-ifo[Ignore specific folders by name]:folder:_directories'
        '--ignore-file[Ignore specific files by name]:file:_files'
        '-ifi[Ignore specific files by name]:file:_files'
        '--only-folder[Include only specific folders]:folder:_directories'
        '-ofo[Include only specific folders]:folder:_directories'
        '--only-file[Include only specific files]:file:_files'
        '-ofi[Include only specific files]:file:_files'
        '--copy[Copy output to clipboard]'
        '--force[Include everything (overrides all ignore patterns)]'
        '--help[Show help message]'
        '--version[Show version information]'
        '-h[Show help message]'
        '-v[Show version information]'
    )
    
    _arguments -s -S $arguments && return 0
}

_make_folder_txt "$@"
