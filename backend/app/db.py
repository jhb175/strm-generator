"""Database setup."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DB_PATH

engine = create_engine(
    f'sqlite:///{DB_PATH}',
    future=True,
    connect_args={
        'check_same_thread': False,
        'timeout': 30,
    },
    pool_pre_ping=True,
)


@event.listens_for(engine, 'connect')
def _sqlite_on_connect(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA journal_mode=WAL;')
    cursor.execute('PRAGMA busy_timeout=30000;')
    cursor.execute('PRAGMA synchronous=NORMAL;')
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
