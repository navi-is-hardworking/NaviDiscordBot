import time
import times
from collections import OrderedDict

class TLRUCache:
    def __init__(self, capacity=4, cache_clear_time=times.minutes(3)):
        self.cache: OrderedDict[str, float] = OrderedDict()
        self.capacity = capacity
        self.cache_clear_time = cache_clear_time
        
    def is_empty(self):
        return len(self.cache) == 0
    
    def append(self, key):
        if key in self.cache:
            self.cache.pop(key)
        elif len(self.cache) >= self.capacity:
            self.cache.popitem(last=False)
        self.cache[key] = time.time()
        
    def get_cache(self):
        return self.cache
    
    def get_key_age(self, key):
        return time.time() - self.cache.get(key, 0)
    
    def prune_expired_keys(self):
        cur_time = time.time()
        expired_count = 0
        
        for _, v in self.cache.items():
            if cur_time - v >= self.cache_clear_time:
                expired_count += 1
            else:
                break
            
        for _ in range(0, expired_count):
            self.cache.popitem(last=False)
    
    def as_string(self):
        if (self.cache_clear_time != None):
            self.prune_expired_keys()
        return "\n".join([k for k, v in self.cache.items()])
        
