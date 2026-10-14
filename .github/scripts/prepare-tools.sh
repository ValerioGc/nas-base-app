#!/usr/bin/env bash
# Restrict the tool paths checked by process-tools.mjs on the ephemeral Linux runner.
set -euo pipefail

SYSTEM_DIRECTORIES=(/usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin)
SYSTEM_EXECUTABLES=(/usr/bin/git)

secure_path() {
  local path=$1 runner_uid=$2 ancestor=${3:-false} owner mode
  if [[ ! -d "$path" && ! -f "$path" ]]; then
    echo "Unexpected tool path type: $path" >&2
    return 1
  fi
  owner=$(/usr/bin/stat -Lc '%u' -- "$path")
  if [[ "$owner" != 0 && "$owner" != "$runner_uid" ]]; then
    /usr/bin/chown 0 -- "$path"
  fi
  mode=$(/usr/bin/stat -Lc '%a' -- "$path")
  # Sticky ancestors such as /tmp stay shared; direct PATH entries must be protected.
  if [[ "$ancestor" == true && -d "$path" ]] && (( (8#$mode & 01000) != 0 )); then
    return
  fi
  if (( (8#$mode & 0022) != 0 )); then
    /usr/bin/chmod go-w -- "$path"
  fi
}

secure_directory_and_parents() {
  local directory=$1 runner_uid=$2 resolved path parent
  resolved=$(/usr/bin/readlink -e -- "$directory")
  for path in "$directory" "$resolved"; do
    secure_path "$path" "$runner_uid"
    parent=$path
    while [[ "$parent" != / ]]; do
      parent=$(/usr/bin/dirname -- "$parent")
      secure_path "$parent" "$runner_uid" true
    done
  done
}

prepare_tools() {
  local node=$1 cargo_home=$2 runner_uid=$3 installation path target
  node=$(/usr/bin/readlink -e -- "$node")
  if [[ "$node" != */bin/node || ! -f "$node" ]]; then
    echo "Expected the Node executable inside its installation's bin directory" >&2
    return 1
  fi
  installation=$(/usr/bin/dirname -- "$(/usr/bin/dirname -- "$node")")
  # npm points into lib/node_modules. Validate links before changing the installation.
  while IFS= read -r -d '' path; do
    target=$(/usr/bin/readlink -e -- "$path")
    if [[ "$target" != "$installation/"* ]]; then
      echo "Node symlink escapes its installation: $path" >&2
      return 1
    fi
  done < <(/usr/bin/find "$installation" -type l -print0)
  while IFS= read -r -d '' path; do
    echo "Unexpected tool path type: $path" >&2
    return 1
  done < <(/usr/bin/find "$installation" ! -type f ! -type d ! -type l -print0)
  /usr/bin/find "$installation" ! -type l ! -uid 0 ! -uid "$runner_uid" \
    -exec /usr/bin/chown 0 -- {} +
  /usr/bin/chmod -R go-w -- "$installation"
  for path in "$(/usr/bin/dirname -- "$node")" "$cargo_home/bin" "${SYSTEM_DIRECTORIES[@]}"; do
    if [[ -d "$path" ]]; then
      secure_directory_and_parents "$path" "$runner_uid"
    fi
  done
  for path in "${SYSTEM_EXECUTABLES[@]}"; do
    if [[ -f "$path" ]]; then
      target=$(/usr/bin/readlink -e -- "$path")
      secure_path "$target" "$runner_uid"
      secure_directory_and_parents "$(/usr/bin/dirname -- "$path")" "$runner_uid"
      secure_directory_and_parents "$(/usr/bin/dirname -- "$target")" "$runner_uid"
    fi
  done
}

main() {
  if [[ $# != 8 || $1 != --node || $3 != --cargo-home || $5 != --runner-uid || ! $6 =~ ^[0-9]+$ || $7 != --tool-cache ]]; then
    echo 'usage: prepare-tools.sh --node PATH --cargo-home PATH --runner-uid UID --tool-cache PATH' >&2
    return 1
  fi
  if [[ "$EUID" != 0 ]]; then
    echo 'Run this preparation with sudo on the ephemeral CI runner' >&2
    return 1
  fi
  local node cache
  node=$(/usr/bin/readlink -e -- "$2")
  cache=$(/usr/bin/readlink -e -- "$8")
  if [[ "$node" != "$cache/"node/*/bin/node ]]; then
    echo 'The Node installation must belong to the runner toolcache' >&2
    return 1
  fi
  prepare_tools "$node" "$4" "$6"
  echo 'Tool permissions prepared: Node/npm, Git, Rust PATH, system directories and all ancestors'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
