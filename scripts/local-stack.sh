#!/usr/bin/env bash
set -euo pipefail

web_pid=""
worker_pid=""
cleanup() {
  [[ -z "$worker_pid" ]] || kill "$worker_pid" 2>/dev/null || true
  [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run db:setup
npm run dev &
web_pid=$!

for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then break; fi
  sleep 1
done

npm run worker &
worker_pid=$!
echo "바로미 로컬 스택이 실행 중입니다: http://127.0.0.1:3000/scan/new"
echo "종료하려면 Ctrl-C를 누르세요."
wait "$web_pid"
