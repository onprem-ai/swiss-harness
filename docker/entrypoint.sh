#!/bin/sh
# Serve a Web profile on this container's own address; the server rejects wildcard binds.
# `serve` (default) boots $DSH_PROFILE; any other first argument runs `dsh` with the given arguments.
set -eu

if [ "$#" -gt 0 ] && [ "$1" != "serve" ]; then
  exec node /app/lib/bin.js "$@"
fi
[ "$#" -gt 0 ] && shift

host="${DSH_WEB_HOST:-$(hostname -i | awk '{print $1}')}"
set -- --host "$host" --port "${DSH_WEB_PORT:-3080}" --no-open "$@"
if [ -n "${DSH_PUBLIC_URL:-}" ]; then
  set -- "$@" --public-url "$DSH_PUBLIC_URL"
fi
for authority in ${DSH_TRUSTED_HOSTS:-}; do
  set -- "$@" --trusted-host "$authority"
done

exec node /app/lib/bin.js --profile "${DSH_PROFILE:-onprem}" "$@"
