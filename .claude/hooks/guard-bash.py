#!/usr/bin/env python3
"""PreToolUse(Bash): блокує команди, що вже раз стерли справжні дані.

pytest TRUNCATE-ить таблиці, тому його не можна запускати з DATABASE_URL справжньої бази.
Дивимось лише на справжній виклик команди: вміст heredoc і текст у лапках (повідомлення комітів,
нотатки) ігноруємо, інакше згадка слова «pytest» у тексті давала б хибне блокування.
"""
import json, re, sys

try:
    cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "") or ""
except Exception:
    sys.exit(0)


def block(msg):
    print("ЗАБЛОКОВАНО: " + msg, file=sys.stderr)
    sys.exit(2)


# 1) прибрати тіла heredoc  <<'EOF' ... EOF
code = re.sub(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\b", "<<HEREDOC", cmd, flags=re.S)
# 2) прибрати вміст лапок
code = re.sub(r'"(?:\\.|[^"\\])*"', '""', code, flags=re.S)
code = re.sub(r"'[^']*'", "''", code, flags=re.S)

# pytest на позиції команди: початок, або після ; & | ( , можливо з env/VAR=.../python -m
PYTEST = re.compile(
    r"(?:^|[;&|(]|\n)\s*"
    r"(?:env\s+(?:-u\s+\w+\s+|\w+=\S*\s+)*|\w+=\S*\s+)*"
    r"(?:\S*/)?(?:python[0-9.]*\s+-m\s+)?(?:pytest|py\.test)\b"
)
SOURCE_ENV = re.compile(r"(?:^|[;&|(]|\n)\s*(?:source|\.)\s+(?:\./)?\.env\b")

if PYTEST.search(code):
    safe = re.search(r"env\s+(?:\S+\s+)*-u\s+DATABASE_URL\b", code) or re.search(r"DATABASE_URL=\S*test", cmd)
    if not safe:
        block("pytest без 'env -u DATABASE_URL' або DATABASE_URL з назвою тестової бази (*test*). "
              "Тести роблять TRUNCATE і вже стирали справжні дані.")
    if SOURCE_ENV.search(code):
        block("pytest після 'source .env' - змінні справжньої бази потраплять у тести.")

if SOURCE_ENV.search(code) and re.search(r"\b(truncate|drop\s+(table|database)|seed|cleanup)", code, re.I):
    block("засівання/очищення після 'source .env' зачепить справжню базу.")
sys.exit(0)
