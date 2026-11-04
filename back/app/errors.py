"""Respuestas de error uniformes: siempre `{ detail }` en español y nunca trazas."""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

INVALID_DATA = "Revisa los datos enviados."
SERVER_ERROR = "Ocurrió un error en el servidor. Intenta de nuevo."


class FieldError(Exception):
    """Un error de un campo que solo se detecta en el servidor, como un usuario repetido.

    Responde igual que una validación: 422 con `errors`, para que el front lo muestre en el campo.
    """

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


def describe(error: dict[str, Any]) -> str:
    context = error.get("ctx") or {}
    match error["type"]:
        case "missing":
            return "Este campo es obligatorio."
        case "string_too_short" if context.get("min_length") == 1:
            return "Este campo es obligatorio."
        case "string_too_short":
            return f"Debe tener al menos {context.get('min_length')} caracteres."
        case "string_too_long":
            return f"Debe tener como máximo {context.get('max_length')} caracteres."
        case "string_pattern_mismatch":
            return "El formato no es válido."
        case "literal_error" | "enum":
            return "El valor no está permitido."
        case "int_parsing" | "int_type" | "float_parsing" | "float_type":
            return "Debe ser un número."
        case "greater_than" | "greater_than_equal":
            return f"Debe ser mayor que {context.get('gt', context.get('ge'))}."
        case _:
            return "El valor no es válido."


def field_of(error: dict[str, Any]) -> str:
    # La ubicación empieza con "body" o "query"; el resto es la ruta del campo.
    return ".".join(str(part) for part in error["loc"][1:]) or str(error["loc"][0])


async def validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [{"field": field_of(error), "message": describe(error)} for error in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": INVALID_DATA, "errors": errors},
    )


async def field_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, FieldError)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": INVALID_DATA, "errors": [{"field": exc.field, "message": exc.message}]},
    )


async def server_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": SERVER_ERROR}
    )


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(FieldError, field_error)
    app.add_exception_handler(Exception, server_error)
