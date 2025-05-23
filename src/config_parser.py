import json5
import os
    
        
def parse_json(json_path) -> dict:
    with open(json_path, "r", encoding='utf-8') as f:
        data = json5.load(f)
    return data
        

def parse_prompt(prompt_path):
    head_path = prompt_path + "/prompt_head"
    tail_path = prompt_path + "/prompt_tail"
    cache_header_path = prompt_path + "/cache_header"
    dictionary_path = prompt_path + "/dictionary.json"
    
    head = ""
    tail = ""
    cache_header = ""
    dictionary = {}
    
    if os.path.exists(head_path):
        with open(head_path, "r", encoding='utf-8') as f:
            head = f.read()
    
    if os.path.exists(tail_path):
        with open(tail_path, "r", encoding='utf-8') as f:
            tail = f.read()
    
    if os.path.exists(cache_header_path):
        with open(cache_header_path, "r", encoding='utf-8') as f:
            cache_header = f.read()
    
    if os.path.exists(dictionary_path):
        with open(dictionary_path, "r", encoding='utf-8') as f:
            dictionary = json5.load(f)
        
    
    return head, tail, cache_header, dictionary
    
    

        
    
