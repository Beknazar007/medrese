from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import NoteVisibility, UserRole
from app.models.note import StudentNote
from app.models.student import Student
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.note import StudentNoteCreate, StudentNoteOut

router = APIRouter(tags=["notes"])


@router.get("/students/{student_id}/notes", response_model=list[StudentNoteOut])
def list_notes(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StudentNote]:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    stmt = select(StudentNote).where(StudentNote.student_id == student_id)

    if current_user.role == UserRole.TEACHER:
        teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
        if teacher is None:
            return []
        # A teacher sees only their own notes about this student — private or shared —
        # never another teacher's, per the visibility rule.
        stmt = stmt.where(StudentNote.author_teacher_id == teacher.id)
    else:
        assert_department_access(current_user, student.group.department_id)
        # Rector/Dean see every SHARED note, from any teacher, about students in their scope.
        stmt = stmt.where(StudentNote.visibility == NoteVisibility.SHARED)

    stmt = stmt.order_by(StudentNote.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/students/{student_id}/notes", response_model=StudentNoteOut, status_code=201)
def create_note(
    student_id: int,
    payload: StudentNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> StudentNote:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
    if teacher is None:
        raise HTTPException(status_code=403, detail="This account has no teacher profile")

    teaches_group = db.scalar(
        select(TeachingAssignment.id).where(
            TeachingAssignment.teacher_id == teacher.id,
            TeachingAssignment.group_id == student.group_id,
        )
    )
    if teaches_group is None:
        raise HTTPException(status_code=403, detail="You do not teach this student's group")

    note = StudentNote(
        student_id=student_id,
        author_teacher_id=teacher.id,
        body=payload.body,
        visibility=payload.visibility,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> None:
    note = db.get(StudentNote, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
    if teacher is None or note.author_teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="You may only delete your own notes")

    db.delete(note)
    db.commit()
