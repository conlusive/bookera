#!/bin/bash
# PostToolUse(Edit|Write): швидка перевірка файлу, який щойно змінено.
#  - bookera-frontend/src/**/*.ts(x): tsc --noEmit
#  - *.py: py_compile (синтаксис)
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // ""')
[ -z "$f" ] && exit 0
root="$(cd "$(dirname "$0")/../.." && pwd)"

case "$f" in
  */bookera-frontend/src/*.ts|*/bookera-frontend/src/*.tsx)
    out=$(cd "$root/bookera-frontend" && npx --no-install tsc --noEmit 2>&1)
    if [ $? -ne 0 ]; then
      echo "Помилки типів після зміни $f:" >&2
      echo "$out" | head -25 >&2
      exit 2
    fi
    ;;
  *.py)
    out=$("$root/venv/bin/python" -m py_compile "$f" 2>&1)
    if [ $? -ne 0 ]; then
      echo "Синтаксична помилка у $f:" >&2
      echo "$out" | head -15 >&2
      exit 2
    fi
    ;;
esac
exit 0
