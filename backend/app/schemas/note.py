from datetime import datetime

from pydantic import BaseModel

from app.models.enums import NoteVisibility


class StudentNoteCreate(BaseModel):
    body: str
    visibility: NoteVisibility = NoteVisibility.PRIVATE


class StudentNoteOut(BaseModel):
    id: int
    student_id: int
    author_teacher_id: int
    body: str
    visibility: NoteVisibility
    created_at: datetime

    model_config = {"from_attributes": True}
