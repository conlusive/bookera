"""
Категорії закладів - єдиний список на бекенді.

Дзеркало bookera-frontend/src/lib/categories.ts: ті самі коди, у тому
самому порядку. Раніше на сайті було п'ять різних списків, і заклад,
зареєстрований як `wellness`, не знаходився в «Масаж і SPA», а
`home_services` з реєстрації не збігався з `home-services` на головній.

У базі зберігається лише КОД категорії. Будь-яке інше значення - стара
назва, код зі старого списку, українська назва - перетворюється на код
функцією normalize_category.
"""
from typing import Optional

CATEGORY_SLUGS = [
    "hair", "barber", "nails", "brows", "skincare", "cosmetology",
    "massage", "tattoo", "epilation", "makeup",
    "home", "pets", "dentistry", "health", "other",
]

# Старі коди й назви -> код. Ключі в нижньому регістрі.
_ALIASES = {
    "hair": ["hair", "волосся", "перукарня", "перукарні", "салон краси", "beauty", "salon"],
    "barber": ["barber", "барбер", "барбершоп", "барбершопи"],
    "nails": ["nails", "nail", "нігті", "манікюр", "манікюр і педикюр", "нігті та манікюр"],
    "brows": ["brows", "lashes", "брови", "брови та вії"],
    "skincare": ["skincare", "skin", "догляд", "догляд за шкірою"],
    "cosmetology": ["cosmetology", "aesthetic", "естетична медицина", "косметологія"],
    "massage": ["massage", "spa", "wellness", "масаж", "спа", "масаж та spa", "масаж і spa", "wellness & spa"],
    "tattoo": ["tattoo", "piercing", "тату", "пірсинг", "тату та пірсинг", "тату й пірсинг", "пірсинг студії"],
    "epilation": ["epilation", "hair_removal", "hair-removal", "епіляція", "видалення волосся"],
    "makeup": ["makeup", "макіяж", "макіяж та візаж"],
    "home": ["home", "home_services", "home-services", "послуги на дому", "майстри з виїздом"],
    "pets": ["pets", "домашні улюбленці", "грумінг"],
    "dentistry": ["dentistry", "стоматологія"],
    "health": ["health", "здоров'я", "здоровʼя", "здоров'я та самопочуття"],
    # «Професійні послуги» нічого не описували - обʼєднано з «Інше».
    "other": ["other", "professional", "професійні послуги", "інше", "інші послуги"],
}
_LOOKUP = {alias: slug for slug, aliases in _ALIASES.items() for alias in aliases}

DEFAULT_CATEGORY = "other"


def normalize_category(value: Optional[str]) -> str:
    """Будь-яке значення категорії -> код зі списку. Невідоме - «other»."""
    key = (value or "").strip().lower()
    if key in CATEGORY_SLUGS:
        return key
    return _LOOKUP.get(key, DEFAULT_CATEGORY)
