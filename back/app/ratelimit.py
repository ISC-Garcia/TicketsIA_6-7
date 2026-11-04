"""Límite de intentos fallidos de login (E10-02): 5 por minuto para cada usuario y cliente.

Vive en la memoria de la API, que en Render corre en una sola instancia. Solo cuentan los
intentos fallidos, así que quien entra bien no se bloquea aunque inicie sesión seguido.
"""

import math
import time
from collections import deque
from collections.abc import Callable

MAX_FAILURES = 5
WINDOW_SECONDS = 60


class LoginLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self.clock = clock
        self.failures: dict[str, deque[float]] = {}

    def _recent(self, key: str) -> deque[float]:
        attempts = self.failures.setdefault(key, deque())
        limit = self.clock() - WINDOW_SECONDS
        while attempts and attempts[0] <= limit:
            attempts.popleft()
        return attempts

    def retry_after(self, key: str) -> int:
        """Segundos que faltan para poder intentar de nuevo; 0 si ya se puede."""
        attempts = self._recent(key)
        if len(attempts) < MAX_FAILURES:
            return 0
        return max(1, math.ceil(attempts[0] + WINDOW_SECONDS - self.clock()))

    def fail(self, key: str) -> None:
        self._recent(key).append(self.clock())

    def reset(self, key: str) -> None:
        self.failures.pop(key, None)
