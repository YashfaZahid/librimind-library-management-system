def classify(message: str) -> str:
    text = " ".join(message.casefold().split())
    if "similar" in text:
        return "similar"
    if any(phrase in text for phrase in ("recommend", "suggest", "what should i read")):
        return "recommendation"
    if any(phrase in text for phrase in ("reserve", "my fines", "due date", "issue ", "return ")):
        return "circulation"
    if any(phrase in text for phrase in ("low stock", "inventory", "how many copies")):
        return "inventory"
    if any(phrase in text for phrase in ("duplicate", "same title", "metadata")):
        return "metadata"
    return "search"
