import logging
import sys


def setup_logging() -> logging.Logger:
    """
    Структуроване логування замість print(). print() губиться під навантаженням
    (немає рівнів, немає часових міток, немає стандартного формату для збору
    логів у продакшн-системах типу CloudWatch/Datadog).
    """
    logger = logging.getLogger("bookera")
    if logger.handlers:
        return logger  # уникаємо дублікатів хендлерів при повторному імпорті

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


logger = setup_logging()
