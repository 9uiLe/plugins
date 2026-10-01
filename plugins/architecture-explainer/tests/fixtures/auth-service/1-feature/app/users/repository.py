import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    username: str
    password_hash: str


class UserRepository:
    def __init__(self, connection: sqlite3.Connection):
        self._db = connection
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS users ("
            "id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)"
        )

    def add(self, username: str, password_hash: str) -> User:
        cursor = self._db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash)
        )
        return User(cursor.lastrowid, username, password_hash)

    def find_by_username(self, username: str) -> User | None:
        row = self._db.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
        return User(*row) if row else None

    def find_by_id(self, user_id: int) -> User | None:
        row = self._db.execute(
            "SELECT id, username, password_hash FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return User(*row) if row else None
