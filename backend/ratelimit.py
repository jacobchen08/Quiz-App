import threading
import time
import weakref
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    """Allow at most `limit` hits per `window` seconds for each key (usually an IP address).

    Kept in memory, which is right for a single server; several servers would need a
    shared store such as Redis.
    """

    _all = weakref.WeakSet()

    def __init__(self, limit, window):
        self.limit = limit
        self.window = window
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()
        RateLimiter._all.add(self)

    @classmethod
    def reset_all(cls):
        """Forget every hit (tests start each case with a clean slate)."""
        for limiter in list(cls._all):
            with limiter._lock:
                limiter._hits.clear()

    def allow(self, key, now=None):
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            if len(self._hits) > 10_000:  # forget idle visitors so memory can't grow forever
                for stale in [k for k, h in self._hits.items() if not h or now - h[-1] >= self.window]:
                    del self._hits[stale]
            return True


def client_ip(request_or_ws):
    """The visitor's address. Behind a proxy (as on Render) it's the first X-Forwarded-For entry."""
    forwarded = request_or_ws.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request_or_ws.client.host if request_or_ws.client else "unknown"


def limited(limiter, message="Too many requests. Wait a moment and try again."):
    """A FastAPI dependency that answers 429 once a visitor goes over the limit."""

    def check(request: Request):
        if not limiter.allow(client_ip(request)):
            raise HTTPException(status_code=429, detail=message)

    return check
