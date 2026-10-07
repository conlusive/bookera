#!/usr/bin/env python3
"""PreToolUse(Bash): автоматична перевірка перед `git commit`.

Спрацьовує лише на справжню команду git commit (текст у лапках/heredoc ігнорується).
Блокує коміт, якщо:
  1) не проходить `tsc --noEmit` (коли змінено файли фронтенда),
  2) є синтаксична помилка в змінених .py,
  3) у змінах з'явився схожий на секрет рядок або файл .env.
Перевіряється весь робочий каталог відносно HEAD, бо `git add && git commit` часто йдуть однією командою.
"""
import json, os, re, subprocess, sys

try:
    cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "") or ""
except Exception:
    sys.exit(0)

code = re.sub(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\b", "<<HEREDOC", cmd, flags=re.S)
code = re.sub(r'"(?:\\.|[^"\\])*"', '""', code, flags=re.S)
code = re.sub(r"'[^']*'", "''", code, flags=re.S)
if not re.search(r"(?:^|[;&|(]|\n)\s*git\s+(?:-C\s+\S+\s+)?commit\b", code):
    sys.exit(0)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def run(args, cwd=ROOT, timeout=110):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def fail(title, body):
    print(f"КОМІТ ЗАБЛОКОВАНО: {title}\n{body}\nВиправте і повторіть коміт.", file=sys.stderr)
    sys.exit(2)


st = run(["git", "status", "--porcelain"]).stdout.splitlines()
changed = []
for line in st:
    path = line[3:].split(" -> ")[-1].strip().strip('"')
    if line[:2].strip() == "D":
        continue
    changed.append(path)

# --- 1) файли .env ---
for p in changed:
    if re.search(r"(^|/)\.env(\.[^/]*)?$", p) and not re.search(r"\.(example|sample|template)$|\.example\.local$|example\.local$", p):
        fail("у коміт потрапляє файл зі змінними середовища", p + "  (додайте в .gitignore, ключі не комітимо)")

# --- 2) синтаксис Python ---
py = [p for p in changed if p.endswith(".py") and os.path.exists(os.path.join(ROOT, p))]
if py:
    r = run([os.path.join(ROOT, "venv/bin/python"), "-m", "py_compile", *py])
    if r.returncode != 0:
        fail("синтаксична помилка Python", (r.stderr or r.stdout)[:1500])

# --- 3) типи фронтенда ---
if any(re.match(r"bookera-frontend/(src|e2e)/.*\.(ts|tsx)$", p) or p in ("bookera-frontend/package.json", "bookera-frontend/tsconfig.json") for p in changed):
    r = run(["npx", "--no-install", "tsc", "--noEmit"], cwd=os.path.join(ROOT, "bookera-frontend"))
    if r.returncode != 0:
        fail("помилки типів (tsc --noEmit)", "\n".join((r.stdout or r.stderr).splitlines()[:25]))

# --- 4) секрети у доданих рядках ---
SECRET = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "приватний ключ"),
    (re.compile(r"\bsbp_[A-Za-z0-9]{20,}"), "токен Supabase (sbp_)"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{24,}"), "ключ у стилі sk-"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "ключ AWS"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"), "JWT-токен"),
    (re.compile(r"(?i)(?:password|passwd|secret|api[_-]?key|token)['\"\]]*\s*[=:]\s*['\"]([^'\"\s]{16,})['\"]"), "пароль/ключ у коді"),
]
SAFE = re.compile(r"(?i)test|example|changeme|placeholder|dummy|your[-_]|xxxx|\$\{|process\.env|os\.environ|getenv|fake|sandbox|<")
added = []
d = run(["git", "diff", "HEAD", "-U0", "--no-color"]).stdout
cur = None
for line in d.splitlines():
    if line.startswith("+++ b/"):
        cur = line[6:]
    elif line.startswith("+") and not line.startswith("+++") and cur and not cur.startswith((".claude/", "tests/")):
        added.append((cur, line[1:]))
for p in changed:  # нові (untracked) файли
    if not any(x[0] == p for x in added) and p.startswith(("app/", "scripts/", "bookera-frontend/src/", "alembic/")):
        fp = os.path.join(ROOT, p)
        if os.path.isfile(fp) and os.path.getsize(fp) < 400_000 and run(["git", "ls-files", "--error-unmatch", p]).returncode != 0:
            try:
                added += [(p, l) for l in open(fp, encoding="utf-8", errors="ignore").read().splitlines()]
            except OSError:
                pass
hits = []
for path, text in added:
    for rx, label in SECRET:
        m = rx.search(text)
        if m and not SAFE.search(text):
            hits.append(f"{path}: {label}")
            break
if hits:
    fail("схоже на секрет у змінах", "\n".join(sorted(set(hits))[:10]) + "\n(якщо це не секрет — додайте 'test'/'example' у значення або змініть рядок)")
sys.exit(0)
