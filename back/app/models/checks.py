def one_of(column: str, values: tuple[str, ...]) -> str:
    """Condición SQL para un `CHECK` que limita la columna a un catálogo."""
    options = ", ".join("'" + value.replace("'", "''") + "'" for value in values)
    return f"{column} IN ({options})"
