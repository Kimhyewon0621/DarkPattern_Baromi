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

if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
  echo "포트 3000이 이미 사용 중입니다. 기존 개발 서버를 종료한 뒤 다시 실행하세요." >&2
  exit 1
fi

npm run dev &
web_pid=$!

ready="false"
for _ in {1..30}; do
  if ! kill -0 "$web_pid" 2>/dev/null; then
    echo "Next 개발 서버가 시작되지 않았습니다." >&2
    exit 1
  fi
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    ready="true"
    break
  fi
  sleep 1
done

if [[ "$ready" != "true" ]]; then
  echo "로컬 웹 서버가 30초 안에 준비되지 않았습니다." >&2
  exit 1
fi

npm run worker &
worker_pid=$!
echo "바로미 로컬 스택이 실행 중입니다: http://127.0.0.1:3000/scan/new"
echo "종료하려면 Ctrl-C를 누르세요."
wait "$web_pid"
