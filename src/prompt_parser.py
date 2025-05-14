

def parse_prompt(prompt_path):
    
    with open(prompt_path, "r", encoding='utf-8') as f:
        data = f.read()
        
    head_start = data.find("### PROMPT HEAD ") + len("### PROMPT HEAD ")
    head_end = data.find("### PROMPT_TAIL")
    tail_start = head_end + len("### PROMPT_TAIL")
    
    prompt_head = data[head_start:head_end].strip()
    prompt_tail = data[tail_start:].strip()
    return prompt_tail, prompt_head

    