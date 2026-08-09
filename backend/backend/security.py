import re

_TAG_RE = re.compile(r'<[^>]*>')


def sanitize_text(value):
    """Strip HTML tags from user text.

    bleach is not installed, so this is the no-dependency equivalent of
    bleach.clean(tags=[], strip=True) for the stored-XSS findings (ATK-20).
    It removes executable HTML while preserving normal text (apostrophes,
    ampersands, etc.), which html.escape would corrupt when rendered by React.
    """
    if value and isinstance(value, str):
        return _TAG_RE.sub('', value)
    return value
