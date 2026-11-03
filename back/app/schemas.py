from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base de las respuestas: los campos viajan en camelCase, como los tipos del front."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
