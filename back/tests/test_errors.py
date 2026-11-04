import pytest

from app.errors import describe, field_of


@pytest.mark.parametrize(
    ("error", "message"),
    [
        ({"type": "missing"}, "Este campo es obligatorio."),
        ({"type": "string_too_short", "ctx": {"min_length": 1}}, "Este campo es obligatorio."),
        (
            {"type": "string_too_short", "ctx": {"min_length": 20}},
            "Debe tener al menos 20 caracteres.",
        ),
        (
            {"type": "string_too_long", "ctx": {"max_length": 9}},
            "Debe tener como máximo 9 caracteres.",
        ),
        ({"type": "string_pattern_mismatch"}, "El formato no es válido."),
        ({"type": "literal_error"}, "El valor no está permitido."),
        ({"type": "enum"}, "El valor no está permitido."),
        ({"type": "int_parsing"}, "Debe ser un número."),
        ({"type": "float_type"}, "Debe ser un número."),
        ({"type": "greater_than", "ctx": {"gt": 0}}, "Debe ser mayor que 0."),
        ({"type": "greater_than_equal", "ctx": {"ge": 1}}, "Debe ser mayor que 1."),
        ({"type": "url_parsing"}, "El valor no es válido."),
    ],
)
def test_e1_02_traduce_los_errores_de_validacion(error: dict, message: str) -> None:
    assert describe(error) == message


def test_e1_02_el_campo_omite_el_origen() -> None:
    assert field_of({"loc": ("body", "user", "name")}) == "user.name"
    assert field_of({"loc": ("body",)}) == "body"
