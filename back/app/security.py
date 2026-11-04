from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from pwdlib import PasswordHash

ALGORITHM = "HS256"

# "session" abre todo lo que permite el rol; "password" solo sirve para cambiar la contraseña
# temporal del primer acceso (P-4).
Scope = Literal["session", "password"]


@dataclass(frozen=True)
class TokenClaims:
    username: str
    scope: Scope


_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return _hasher.verify(password, password_hash)


def create_token(username: str, secret: str, hours: int, scope: Scope = "session") -> str:
    # El vencimiento usa el reloj real: APP_NOW es la hora de la demo, no la de la sesión.
    issued = datetime.now(UTC)
    claims = {
        "sub": username,
        "scope": scope,
        "iat": issued,
        "exp": issued + timedelta(hours=hours),
    }
    return jwt.encode(claims, secret, algorithm=ALGORITHM)


def read_token(token: str, secret: str) -> TokenClaims | None:
    """Devuelve el usuario y el alcance del token, o None si es inválido o ya venció."""
    try:
        claims = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp"]})
    except jwt.PyJWTError:
        return None
    subject, scope = claims.get("sub"), claims.get("scope", "session")
    if not isinstance(subject, str) or scope not in ("session", "password"):
        return None
    return TokenClaims(subject, scope)
