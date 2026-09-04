"""Creates the first Rector account so someone can log in and start managing the university.
Run with: python -m app.seed
"""

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User


def seed_rector() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.seed_rector_username).first()
        if existing is not None:
            print(f"User '{settings.seed_rector_username}' already exists — skipping.")
            return

        rector = User(
            username=settings.seed_rector_username,
            hashed_password=hash_password(settings.seed_rector_password),
            role=UserRole.RECTOR,
        )
        db.add(rector)
        db.commit()
        print(f"Created Rector account: {settings.seed_rector_username}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_rector()
