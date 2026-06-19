from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated
from uuid import UUID

class SessionCreateResponse(BaseModel):
    session_id: Annotated[UUID, Field(..., title="Session ID", description="ID of the session", examples=["123e4567-e89b-12d3-a456-426614174000"])]
    created_at : Annotated[datetime, Field(..., default_factory=datetime.now, title="Created At", description="Time when the session was created", examples=["2022-01-01T00:00:00"])]

    model_config = ConfigDict(from_attributes=True) # This is used to convert the database model to a Pydantic model and help pydantic to understand the object 