from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

ALGORITHM = "HS256"

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return _hasher.verify(password, password_hash)


def create_token(username: str, secret: str, hours: int) -> str:
    # El vencimiento usa el reloj real: APP_NOW es la hora de la demo, no la de la sesión.
    issued = datetime.now(UTC)
    claims = {"sub": username, "iat": issued, "exp": issued + timedelta(hours=hours)}
    return jwt.encode(claims, secret, algorithm=ALGORITHM)


def read_token(token: str, secret: str) -> str | None:
    """Devuelve el usuario del token, o None si es inválido o ya venció."""
    try:
        claims = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp"]})
    except jwt.PyJWTError:
        return None
    subject = claims.get("sub")
    return subject if isinstance(subject, str) else None
