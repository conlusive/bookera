"""
Перевірка DNS-записів пошти для домену відправника: SPF, DKIM, DMARC.

    venv/bin/python scripts/check_email_dns.py bookera.com [dkim-selector ...]

Селектор DKIM дає поштовий провайдер (Resend/SendGrid/Mailgun/Brevo показують його в панелі домену).
Скрипт лише читає DNS і нічого не змінює.
"""
import subprocess
import sys


def txt(name: str) -> list[str]:
    try:
        out = subprocess.run(["dig", "+short", "TXT", name], capture_output=True, text=True, timeout=15).stdout
    except Exception as exc:
        print(f"  dig недоступний: {exc}")
        return []
    return [line.strip().strip('"').replace('" "', "") for line in out.splitlines() if line.strip()]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    domain, selectors = sys.argv[1], sys.argv[2:]
    problems = 0

    spf = [r for r in txt(domain) if r.lower().startswith("v=spf1")]
    if len(spf) == 1:
        tail = spf[0].split()[-1]
        note = "" if tail in ("-all", "~all") else "  (краще закінчувати на ~all або -all)"
        print(f"✓ SPF: {spf[0]}{note}")
    else:
        problems += 1
        print("✗ SPF: " + ("запису немає" if not spf else "їх кілька, має бути один") + " - додайте TXT на домен із include вашого провайдера")

    dmarc = [r for r in txt(f"_dmarc.{domain}") if r.lower().startswith("v=dmarc1")]
    if dmarc:
        print(f"✓ DMARC: {dmarc[0]}")
        if "p=none" in dmarc[0].replace(" ", "").lower():
            print("  порада: почніть із p=none, а коли листи проходять - переходьте на p=quarantine")
    else:
        problems += 1
        print("✗ DMARC: запису немає - додайте TXT _dmarc: v=DMARC1; p=none; rua=mailto:dmarc@" + domain)

    if not selectors:
        print("• DKIM: селектор не передано (його дає провайдер) - перевірка пропущена")
    for sel in selectors:
        name = f"{sel}._domainkey.{domain}"
        recs = txt(name)
        if recs:
            print(f"✓ DKIM ({sel}): запис є")
        else:
            cname = subprocess.run(["dig", "+short", "CNAME", name], capture_output=True, text=True, timeout=15).stdout.strip()
            if cname:
                print(f"✓ DKIM ({sel}): CNAME → {cname}")
            else:
                problems += 1
                print(f"✗ DKIM ({sel}): запису {name} немає")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
