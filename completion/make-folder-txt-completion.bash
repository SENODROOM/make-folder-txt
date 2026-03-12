#!/bin/bash
# make-folder-txt bash completion

_make_folder_txt_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    opts="--ignore-folder -ifo --ignore-file -ifi --only-folder -ofo --only-file -ofi --copy --force --help --version -h -v"
    
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
        *)
            ;;
    esac
    
    if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
}

complete -F _make_folder_txt_completion make-folder-txt
