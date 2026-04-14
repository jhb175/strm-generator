"""HTTP Basic Auth dependency."""
import os

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic()


def get_auth_user() -> str:
    """Return configured auth username."""
    return os.getenv("STRS_AUTH_USER", "change_me")


def get_auth_pass() -> str:
    """Return configured auth password."""
    return os.getenv("STRS_AUTH_PASS", "change_me_now")


def basic_auth(credentials: HTTPBasicCredentials = Depends(security)):
    """Validate Basic Auth credentials. Raises 401 on failure."""
    from secrets import compare_digest
    correct_user = get_auth_user()
    correct_pass = get_auth_pass()

    # Use constant-time comparison to avoid timing attacks
    user_ok = compare_digest(credentials.username, correct_user)
    pass_ok = compare_digest(credentials.password, correct_pass)

    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic realm=\"STRM Generator\""},
        )
    return credentials.username
