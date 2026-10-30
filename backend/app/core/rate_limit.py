import time
from collections import defaultdict
from threading import Lock
from typing import Dict, List
from fastapi import HTTPException, status

class InMemoryRateLimiter:
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.lock = Lock()

    def check_rate_limit(self, key: str):
        now = time.time()
        with self.lock:
            # Filter timestamps within window
            cutoff = now - self.window_seconds
            self.requests[key] = [t for t in self.requests[key] if t > cutoff]

            if len(self.requests[key]) >= self.max_requests:
                retry_after = int(self.requests[key][0] + self.window_seconds - now)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Too many login attempts. Please wait {max(1, retry_after)} seconds before trying again.",
                        "details": {"retry_after_seconds": max(1, retry_after)}
                    }
                )
            self.requests[key].append(now)

    def reset(self):
        with self.lock:
            self.requests.clear()

login_rate_limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
