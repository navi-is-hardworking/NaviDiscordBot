import asyncio
from logger import log
from collections import OrderedDict

class ImageCache:
    def __init__(self, capacity=100):
        self.cache = OrderedDict()
        self.capacity = capacity
        self.lock = asyncio.Lock()
    
    async def get_image(self, image_url, fetch_func):
        async with self.lock:
            if image_url not in self.cache:
                log.debug("image not made yet: creating image")
                future = asyncio.Future()
                self.cache[image_url] = future
                asyncio.create_task(self._fetch_and_update(image_url, fetch_func, future))
                if len(self.cache) > self.capacity:
                    self.cache.popitem(last=False)
            else:
                log.debug("FOUND CACHED IMAGE")
            value = self.cache[image_url]
        
        if isinstance(value, asyncio.Future):
            return await value
        
        async with self.lock:
            if image_url in self.cache:
                self.cache.move_to_end(image_url)
        
        return value
    
    async def _fetch_and_update(self, image_url, fetch_func, future):
        try:
            result = await fetch_func(image_url)
            async with self.lock:
                self.cache[image_url] = result
            
            future.set_result(result)
        except Exception as e:
            async with self.lock:
                if self.cache.get(image_url) is future:
                    self.cache.pop(image_url)
            
            future.set_exception(e)
            
image_cache = ImageCache()