# shellcheck shell=sh

# Print the last value for KEY in .env. Missing files and keys print an empty value.
envval() {
  envval_key=$1

  if [ ! -f .env ]; then
    printf '\n'
    return 0
  fi

  envval_value=$(awk -v k="$envval_key" '
    index($0, k "=") == 1 {
      v = substr($0, length(k) + 2)
      sub(/\r$/, "", v)
      found = v
    }
    END { print found }
  ' .env) || return 0

  case $envval_value in
    \"*\")
      if [ "${#envval_value}" -ge 2 ]; then
        envval_value=$(printf '%s' "$envval_value" | sed 's/^.//; s/.$//')
      fi
      ;;
    \'*\')
      if [ "${#envval_value}" -ge 2 ]; then
        envval_value=$(printf '%s' "$envval_value" | sed 's/^.//; s/.$//')
      fi
      ;;
  esac

  printf '%s\n' "$envval_value"
}
