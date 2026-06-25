with open("app/api/businesses.py", "r", encoding="utf-8") as f:
    content = f.read()
    if "@router.get" in content:
        print("✅ Успіх: Код містить GET-декоратори!")
    else:
        print("❌ Помилка: GET-декораторів у файлі НЕМАЄ.")
    print("--- Початок файлу ---")
    print(content)
    print("--- Кінець файлу ---")