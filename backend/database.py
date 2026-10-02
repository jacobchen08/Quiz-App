import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# Where the daily challenge keeps its results.
#
# - DATABASE_URL set (postgresql://...): a Postgres database, such as a free Neon or Supabase
#   one. Results survive restarts and redeploys. This is what production should use.
# - Otherwise: a SQLite file (QUIZZR_DB, or backend/quizzr.db). Zero setup for development,
#   but on a host with a temporary disk (Render's free plan) it's wiped on every restart.
#
# The SQL in daily.py is written to run on both: "?" placeholders (turned into "%s" for
# Postgres), ON CONFLICT DO NOTHING, and rows read by column name.

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
DB_PATH = os.environ.get("QUIZZR_DB", str(Path(__file__).resolve().parent / "quizzr.db"))

_ready = set()  # databases whose tables have been created by this process


def uses_postgres():
    return DATABASE_URL.startswith(("postgres://", "postgresql://"))


class Connection:
    """A small wrapper so SQLite and Postgres connections read the same way."""

    def __init__(self, raw, postgres):
        self.raw = raw
        self.postgres = postgres

    def execute(self, sql, params=()):
        if self.postgres:
            sql = sql.replace("?", "%s")
        return self.raw.execute(sql, params)


def integrity_errors():
    """The exceptions a duplicate primary key raises, whichever database is in use."""
    errors = [sqlite3.IntegrityError]
    if uses_postgres():
        import psycopg

        errors.append(psycopg.IntegrityError)
    return tuple(errors)


@contextmanager
def connect(schema):
    """A connection for one unit of work: committed if it succeeds, rolled back if not."""
    if uses_postgres():
        import psycopg
        from psycopg.rows import dict_row

        raw = psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10)
        target = DATABASE_URL
    else:
        raw = sqlite3.connect(DB_PATH, timeout=10)
        raw.row_factory = sqlite3.Row
        target = DB_PATH
    conn = Connection(raw, uses_postgres())
    try:
        if target not in _ready:
            for statement in filter(str.strip, schema.split(";")):
                conn.execute(statement)
            raw.commit()
            _ready.add(target)
        yield conn
        raw.commit()
    except BaseException:
        raw.rollback()
        raise
    finally:
        raw.close()
