from logger import log
from TLRUCache import TLRUCache
import re
from serialization_definitions import Message, Role

class PromptManager:
    
    def __init__(
        self,
        prompt_head,
        prompt_tail,
        cache_header,
        word_dict,
        cache_capacity,
        cache_clear_time
    ):
        self.word_cache: list[str] = []
        self.prompt_head: str = prompt_head
        self.prompt_tail: str = prompt_tail
        self.cache_header: str = cache_header
        self.dictionary_cache: dict[str, int] = word_dict
        self.cache_capacity: int = cache_capacity
        self.cache_clear_time: int = cache_clear_time
        self.memory_dictionary: TLRUCache = TLRUCache(self.cache_capacity, self.cache_clear_time)
        
        self.pattern = re.compile(r'\W', re.IGNORECASE)
        
        dict_temp = {}
        for (k, v) in self.dictionary_cache.items():
            strings: list[str] = k.lower().split(' ')
            self.word_cache.append(v)
            for trigger_keys in strings:
                trigger_keys = trigger_keys.strip()
                if trigger_keys:
                    dict_temp[trigger_keys] = len(self.word_cache) - 1 # storing indexes of the word
                
        self.prompt_dictionary: dict[str, int] = dict_temp
        
    
    def has_prompt(self) -> bool:
        return self.prompt_head or self.prompt_tail
        
        
    def search(self, message: str, username: str, database: TLRUCache) -> None:
        # log.debug(f"searching")
        if (not self.prompt_dictionary):
            # log.warning("no prompt_dictionary found")
            return
        
        words: list[str] = [self.pattern.sub("", t) for t in message.lower().split(' ')]
        words.append(username.lower())
        
        log.memory(f"searching for matches in: {message}")
        for word in words:
            word = word.strip()
            if word in self.prompt_dictionary:
                database.append(self.word_cache[self.prompt_dictionary[word]])
                log.memory(f"Adding memory: {word} -- {self.word_cache[self.prompt_dictionary[word]]}")
        
    
    def update_dictionary(self, message: str, username: str) -> None:
        self.search(message, username, self.memory_dictionary)
    
    
    def _create_prompt(self, rag_dictionary: TLRUCache) -> Message:
        temp_prompt = ""
        if not rag_dictionary.is_empty():
            temp_prompt = self.prompt_head + f"\n{self.cache_header}\n{rag_dictionary.as_string()}\n" + self.prompt_tail
        else:
            temp_prompt = self.prompt_head + "\n" + self.prompt_tail
        
        return Message(role=Role.system, content=temp_prompt)
    
    
    def get_prompt(self):
        return self._create_prompt(self.memory_dictionary)
    
    
    def get_memories(self) -> str:
        return self.memory_dictionary.as_string()
    
    
    def create_mock_prompt(self, messages: list[Message]):
        temp_cache: TLRUCache = TLRUCache(self.cache_capacity, self.cache_clear_time)
        for m in messages:
            self.search(m.content, m.name, temp_cache)
        return self._create_prompt(temp_cache)

