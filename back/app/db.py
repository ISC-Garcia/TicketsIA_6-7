from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import SettingsDep


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def get_db(settings: SettingsDep) -> Iterator[Session]:
    session = sessionmaker(get_engine(settings.database_url), expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()


DbDep = Annotated[Session, Depends(get_db)]
