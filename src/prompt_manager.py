from message_queue import Role
from TLRUCache import TLRUCache
import re

class PromptManager:
    def __init__(self):
        self.prompt_head = ""
        self.prompt_tail = ""
        self.dictionary_header = ""
        self.cache_capacity = 0
        self.cache_clear_time = 0
        self.rag_dictionary = None
        self.pattern = None
        
        self.word_dict = {}
        self.word_cache = []
        
    def configure(self, prompt_head, prompt_tail, dictionary_header, word_dict, cache_capacity, cache_clear_time):
        self.prompt_head = prompt_head
        self.prompt_tail = prompt_tail
        self.dictionary_header = dictionary_header
        self.word_dict = word_dict
        self.cache_capacity = cache_capacity
        self.cache_clear_time = cache_clear_time
        self.rag_dictionary = TLRUCache(self.cache_capacity, self.cache_clear_time)
        self.pattern = re.compile(r'\W', re.IGNORECASE)
        
        dict_temp = {}
        for (k, v) in self.word_dict.items():
            strings = k.lower().split(' ')
            self.word_cache.append(v)
            for s in strings:
                dict_temp[s] = len(self.word_cache) - 1 # storing indexes of the word
                
        self.prompt_dictionary: dict[str, int] = dict_temp
        
    def has_prompt(self):
        return self.prompt_head or self.prompt_tail
    
    def search(self, message: str, username: str):
        if (not self.prompt_dictionary):
            return
        
        words = [self.pattern.sub("", t) for t in message.lower().split(' ')]
        words.append(username.lower())
        
        for word in words:
            word = word.strip()
            if word in self.prompt_dictionary:
                self.rag_dictionary.append(self.word_cache[self.prompt_dictionary[word]])
                
    def get_prompt(self):
        temp_prompt = ""
        if not self.rag_dictionary.is_empty():
            temp_prompt = self.prompt_head + f"\n{self.dictionary_header}\n{self.rag_dictionary.as_string()}\n" + self.prompt_tail
        else:
            temp_prompt = self.prompt_head + "\n" + self.prompt_tail
        
        return {"role": Role.system, "content": temp_prompt}

