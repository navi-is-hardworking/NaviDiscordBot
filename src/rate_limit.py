import time
from collections import deque

class RateLimit:
    def __init__(self, limit, interval):
        self.limit = limit
        self.interval = interval
        self.timestamps = deque(maxlen=limit)
        
    def add(self):
        current_time = time.time()
        self._clean_old_timestamps(current_time)
        self.timestamps.append(current_time)
        
    def _clean_old_timestamps(self, current_time):
        cutoff = current_time - self.interval
        while self.timestamps and self.timestamps[0] <= cutoff:
            self.timestamps.popleft()
        
    def full(self):
        self._clean_old_timestamps(time.time())
        return len(self.timestamps) >= self.limit
    
    def empty(self):
        return len(self.timestamps) == 0