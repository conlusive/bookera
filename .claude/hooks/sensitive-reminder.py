#!/usr/bin/env python3
"""PostToolUse(Edit|Write): після змін у чутливих місцях нагадує запустити відповідного агента.

Підказка йде в контекст моделі (additionalContext), по одному разу на категорію за сесію,
щоб не шуміти. Агенти запускаються за постійним дозволом користувача (див. CLAUDE.md).
"""
import json, os, re, sys, tempfile

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

f = (data.get("tool_input", {}).get("file_path") or data.get("tool_response", {}).get("filePath") or "")
sid = data.get("session_id", "nosession")

RULES = [
    ("security", r"/app/core/auth\.py|/app/api/(deps|payments_wfp|wallet|platform|account|unsubscribe)\.py|/app/api/crm/(access|staff|monetization)\.py|/app/services/(payments|deposits|monetization|subscription|ranking)\.py|/app/core/(rate_limit|security|email)\.py",
     "Змінено чутливий код (доступ/оплати/виплати/публічні ендпоінти). Перед завершенням запустіть агента security-auditor на змінених файлах і сусідніх ендпоінтах (він лише читає, можна паралельно з іншими читаючими агентами)."),
    ("migration", r"/alembic/versions/|/app/models/[^/]+\.py$",
     "Змінено міграцію або модель. Перед застосуванням/комітом запустіть агента migration-reviewer (RLS, права, блокування, дублікати, downgrade, TRUNCATE-список у conftest)."),
    ("ui", r"/bookera-frontend/src/(app|components)/.*\.(tsx|css)$",
     "Змінено інтерфейс. Для значної візуальної зміни перед пушем перевірте на 1440 і 390 px (агент ui-reviewer, або власна пісочниця). Для дрібної правки достатньо typecheck."),
]

marker = os.path.join(tempfile.gettempdir(), f"claude-reminders-{re.sub(r'[^A-Za-z0-9_-]', '', sid)}.json")
try:
    done = set(json.load(open(marker)))
except Exception:
    done = set()

msgs = []
for key, rx, msg in RULES:
    if key not in done and re.search(rx, f):
        msgs.append(msg)
        done.add(key)

if msgs:
    try:
        json.dump(sorted(done), open(marker, "w"))
    except OSError:
        pass
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": " ".join(msgs)}}, ensure_ascii=False))
sys.exit(0)
