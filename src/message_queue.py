#%%

from collections import deque

'''

Bounded message Queue with min and max length... Roughly estimates the current character count in the 
It currently counts username but does not count things like serialization tokens ie < >: so each user message will be 4 characters more but
Token usage is roughly 1/4 character count

ALSO this only truncates message context, not prompt context.


'''


class Role:
    system = "system"
    event = "# NOTIFICATION: "
    user = "user"
    assistant = "assistant"

class Message:
    def __init__(self, role: str, message: str, name: str = ""):
        self.role: str = role
        self.content: str = message
        self.name: str = name
        
    def serialize_usermessage(self):
        if self.role == Role.event:
            return self.name + self.content
        elif len(self.name) > 0 and self.role != Role.assistant:
            return "<" + self.name + ">: " + self.content
        else:
            return self.content
    
    def to_dict(self):
        return {"role": self.role, "content": self.serialize_usermessage()}

class MessageQueue:
    def __init__(self, max_len, min_len):
        self.queue: deque[Message] = deque()
        self.char_count = 0
        self.max_length = max_len
        self.min_length = min_len
        
    # oldest message
    def front(self):
        if not self.queue:
            return None
        return self.queue[0]
    
    # latest message
    def back(self):
        if not self.queue:
            return None
        return self.queue[len(self.queue) - 1]
    
    # Oldest message at the front
    def popleft(self):
        if not self.queue:
            return None
        item = self.queue.popleft()
        self.char_count -= len(item.content)
        self.char_count -= len(item.name)
        return item
    
    # Newest message at the back
    def pop(self):
        if not self.queue:
            return None
        item = self.queue.pop()
        self.char_count -= len(item.content)
        self.char_count -= len(item.name)
        return item
    
    def append(self, role, content, name: str = ""):
        if (self.queue and self.back().role == role and self.back().name == name):
            content = self.back().content + " " + content
            self.pop()
        
        self.queue.append(Message(role, content, name))
        self.char_count += len(self.back().content) + len(self.back().name)
        
        self.truncate_to_max()
    
    def append_message(self, message: Message):
        self.queue.append(message)
        self.char_count += len(message.content)
        
        self.truncate_to_max()
        
    def clear(self):
        self.queue.clear()
        self.char_count = 0
    
    def truncate_to_min(self):
        while self.queue and (self.char_count > self.min_length or self.front().role == Role.assistant):
            self.popleft()
    
    def truncate_to_max(self):
        while self.queue and (self.char_count > self.max_length or self.front().role == Role.assistant):
            self.popleft()
    
    def to_list(self):
        new_list: list[dict[str, str]] = []
        for item in self.queue:
            if new_list and new_list[-1]['role'] == item.role:
                new_list[-1]['content'] += "\n" + item.serialize_usermessage()
            else:
                new_list.append(item.to_dict())
        return new_list
        
        
    def __iter__(self):
        return iter(self.queue)

if __name__ == "__main__":
    q = MessageQueue(1000)