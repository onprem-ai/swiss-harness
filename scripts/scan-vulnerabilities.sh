#!/usr/bin/env bash
# Report known vulnerabilities in our dependencies. Changes nothing in the repository
# (no audit fix, no lockfile edits). Locally it leaves one image tag per Dockerfile
# (harness-<dir>:scan, e.g. harness-root:scan) and the docker volumes trivy-cache and
# pip-audit-cache. npm audit and pip-audit send the dependency lists to the npm registry
# and to PyPI's advisory service.
#
# Usage: scripts/scan-vulnerabilities.sh [npm|python|image]...   (default: all three)
#
#   npm     pnpm audit of every pnpm-lock.yaml (the workspace lockfile at the root) and
#           npm audit of every package-lock.json, runtime dependencies only, HIGH and
#           CRITICAL
#   python  pip-audit of every Python project in the repository, found by uv.lock
#           (runtime dependencies, uv export --no-dev; workspace members such as
#           python/sdk-runtime are scanned as their own project), else
#           requirements*.txt, else pyproject.toml; pip-audit has no severity filter, so
#           every finding counts
#   image   builds every Dockerfile in the repository except test fixtures (a path with
#           tests/ or fixtures/), each with its own directory as context, and scans each
#           image with Trivy (OS packages, node_modules, Python packages), HIGH and
#           CRITICAL with a fix
#
# Projects are found with git ls-files (tracked and untracked, .gitignore honoured), so
# node_modules/ and .venv/ are never scanned; .agents/ and .claude/ (agent tooling) and
# vendor/ (pinned upstream copies, their own lockfiles) are left out. Every scan runs even when an earlier one
# finds something. Exit status: 0 nothing found, 1 findings, 2 a scan could not run (a
# scan that did not run is never read as clean). Needs docker; the audits use the host's
# pnpm and npm when there are any, pip-audit and Trivy always run in containers.
set -uo pipefail

TRIVY_IMAGE="aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa"
NODE_IMAGE="node:22-alpine"
PYTHON_IMAGE="python:3.12-slim"
PIP_AUDIT_VERSION="2.10.1"
UV_VERSION="0.13.1"

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
scans=("$@")
((${#scans[@]})) || scans=(npm python image)

# Files in the repository (tracked or new, not ignored) matching the given names.
repo_files() {
  local args=()
  for name in "$@"; do args+=("$name" "**/$name"); done
  git -C "$root" ls-files --cached --others --exclude-standard -- "${args[@]}" \
    ':!:.agents/' ':!:.claude/' ':!:vendor/' | sort -u
}

# Combine statuses: findings (1) and failures (2) are kept, the worst wins.
worst_of() { (($2 > $1)) && echo "$2" || echo "$1"; }

npm_scan() {
  local lockfiles dir status worst=0 found=0
  lockfiles=(); while IFS= read -r _l; do lockfiles+=("$_l"); done < <(repo_files pnpm-lock.yaml)
  for lockfile in "${lockfiles[@]}"; do
    found=1; dir="$(dirname -- "$lockfile")"
    echo "--- pnpm audit $dir/"
    if command -v pnpm >/dev/null; then
      (cd "$root/$dir" && pnpm audit --prod --audit-level=high)
    else  # corepack reads the packageManager field and runs the pinned pnpm
      docker run --rm -v "$root/$dir:/src:ro" -w /src "$NODE_IMAGE" \
        sh -c 'corepack enable >/dev/null && corepack pnpm audit --prod --audit-level=high'
    fi
    status=$?
    # pnpm audit exits 1 for findings and also for a failed registry lookup; its output says which.
    ((status > 1)) && status=2
    worst=$(worst_of "$worst" "$status")
  done
  lockfiles=(); while IFS= read -r _l; do lockfiles+=("$_l"); done < <(repo_files package-lock.json)
  for lockfile in "${lockfiles[@]}"; do
    dir="$(dirname -- "$lockfile")"
    [[ -f "$root/$dir/package.json" ]] || continue  # a lockfile kept as data (scripts/dependency-catalog), not a project
    found=1
    echo "--- npm audit $dir/"
    if command -v npm >/dev/null; then
      (cd "$root/$dir" && npm audit --omit=dev --audit-level=high)
    else
      docker run --rm -v "$root/$dir:/src:ro" -w /src "$NODE_IMAGE" \
        npm audit --omit=dev --audit-level=high
    fi
    status=$?
    ((status > 1)) && status=2
    worst=$(worst_of "$worst" "$status")
  done
  ((found)) || { echo "no pnpm-lock.yaml or package-lock.json found"; return 0; }
  return "$worst"
}

python_scan() {
  local files dirs dir targets=()
  files=(); while IFS= read -r _l; do files+=("$_l"); done < <(repo_files uv.lock 'requirements*.txt' pyproject.toml)
  dirs=(); while IFS= read -r _l; do dirs+=("$_l"); done < <(for f in "${files[@]}"; do dirname -- "$f"; done | sort -u)
  # Per project directory: uv.lock if there is one, else its requirements*.txt, else pyproject.toml.
  for dir in "${dirs[@]}"; do
    local in_dir=() req=()
    for f in "${files[@]}"; do [[ "$(dirname -- "$f")" == "$dir" ]] && in_dir+=("$f"); done
    for f in "${in_dir[@]}"; do [[ $f == */uv.lock || $f == uv.lock ]] && { targets+=("$f"); continue 2; }; done
    for f in "${in_dir[@]}"; do [[ "$(basename -- "$f")" == requirements*.txt ]] && req+=("$f"); done
    if ((${#req[@]})); then targets+=("${req[@]}"); else targets+=("${in_dir[0]}"); fi
  done
  ((${#targets[@]})) || { echo "no Python project found (no uv.lock, requirements*.txt or pyproject.toml)"; return 0; }

  # One container for all projects; the repository is mounted read-only.
  docker run --rm -i -v "$root:/src:ro" -v pip-audit-cache:/root/.cache -w /src \
    -e PIP_DISABLE_PIP_VERSION_CHECK=1 "$PYTHON_IMAGE" bash -s -- "${targets[@]}" <<EOF
set -uo pipefail
pip install -q --root-user-action=ignore "pip-audit==$PIP_AUDIT_VERSION" "uv==$UV_VERSION" \
  || { echo "installing pip-audit failed" >&2; exit 2; }
worst=0
for target in "\$@"; do
  echo "--- pip-audit \$target"
  case "\$target" in
    */uv.lock|uv.lock)
      dir="\$(dirname -- "\$target")"
      if ! uv export --project "\$dir" --frozen --no-dev --no-emit-project --no-emit-workspace \
          --format requirements-txt -o /tmp/requirements.txt >/dev/null; then
        echo "uv export of \$target failed" >&2; status=2
      else
        # A sibling project pulled in by path (python/sdk -> ../sdk-runtime) has no hash; it
        # is scanned as its own project, so its line goes.
        grep -v -e '^-e ' -e '^--editable ' /tmp/requirements.txt > /tmp/requirements.hashed.txt
        pip-audit --progress-spinner off --disable-pip --require-hashes -r /tmp/requirements.hashed.txt; status=\$?
      fi ;;
    *.txt) pip-audit --progress-spinner off -r "\$target"; status=\$? ;;
    *) pip-audit --progress-spinner off "\$(dirname -- "\$target")"; status=\$? ;;
  esac
  ((status > 1)) && status=2
  ((status > worst)) && worst=\$status
done
exit \$worst
EOF
}

image_scan() {
  local dockerfiles dir tag status worst=0
  dockerfiles=(); while IFS= read -r _l; do
    case "$_l" in */tests/*|*/fixtures/*) continue ;; esac  # test fixtures are not shipped
    dockerfiles+=("$_l")
  done < <(repo_files Dockerfile)
  ((${#dockerfiles[@]})) || { echo "no Dockerfile found (test fixtures are left out)"; return 0; }
  for dockerfile in "${dockerfiles[@]}"; do
    dir="$(dirname -- "$dockerfile")"
    tag="harness-$([[ $dir == . ]] && echo root || echo "${dir//\//-}"):scan"
    echo "--- trivy $dockerfile ($tag)"
    if ! docker build -q -t "$tag" "$root/$dir" >/dev/null; then
      echo "docker build of $dockerfile failed" >&2; worst=2; continue
    fi
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache \
      "$TRIVY_IMAGE" image --quiet --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed \
      --exit-code 1 "$tag"
    status=$?
    ((status > 1)) && status=2
    worst=$(worst_of "$worst" "$status")
  done
  return "$worst"
}

worst=0
for scan in "${scans[@]}"; do
  echo "=== $scan"
  case "$scan" in
    npm) npm_scan; status=$? ;;
    python) python_scan; status=$? ;;
    image) image_scan; status=$? ;;
    *) echo "unknown scan '$scan' (expected npm, python or image)" >&2; exit 2 ;;
  esac
  case "$status" in 0) result=clean ;; 1) result=findings ;; *) status=2; result="SCAN FAILED" ;; esac
  echo "=== $scan: $result"
  worst=$(worst_of "$worst" "$status")
done
exit "$worst"
