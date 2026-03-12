#!/bin/bash
# make-folder-txt bash completion

_make_folder_txt_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    opts="--ignore-folder -ifo --ignore-file -ifi --only-folder -ofo --only-file -ofi --skip-large --no-skip --split-method --split-size --copy --force --help --version -h -v"
    
    case "${prev}" in
        --ignore-folder|-ifo)
            # Complete with folder names in current directory
            local folders=$(ls -d */ 2>/dev/null | sed 's|/||g')
            COMPREPLY=( $(compgen -W "${folders}" -- ${cur}) )
            return 0
            ;;
        --ignore-file|-ifi|--only-file|-ofi)
            # Complete with file names in current directory
            local files=$(ls -p 2>/dev/null | grep -v /)
            COMPREPLY=( $(compgen -W "${files}" -- ${cur}) )
            return 0
            ;;
        --only-folder|-ofo)
            # Complete with folder names in current directory
            local folders=$(ls -d */ 2>/dev/null | sed 's|/||g')
            COMPREPLY=( $(compgen -W "${folders}" -- ${cur}) )
            return 0
            ;;
        --skip-large)
            # Complete with common size formats
            local sizes="100KB 200KB 400KB 500KB 1MB 5MB 10MB 100MB 1GB 5GB"
            COMPREPLY=( $(compgen -W "${sizes}" -- ${cur}) )
            return 0
            ;;
        --split-method)
            # Complete with split methods
            local methods="folder file size"
            COMPREPLY=( $(compgen -W "${methods}" -- ${cur}) )
            return 0
            ;;
        --split-size)
            # Complete with common size formats
            local sizes="1MB 5MB 10MB 50MB 100MB 500MB 1GB"
            COMPREPLY=( $(compgen -W "${sizes}" -- ${cur}) )
            return 0
            ;;
        *)
            ;;
    esac
    
    if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
}

complete -F _make_folder_txt_completion make-folder-txt
