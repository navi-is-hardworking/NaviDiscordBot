from message_queue import MessageQueue, Role, Message
from prompt_manager import PromptManager
from logger import log

class Parameters:
    model: str
    messages: MessageQueue
    prompt_manager: PromptManager
    max_tokens: int
    temperature: int
    top_p: float
    frequency_penalty: float
    presence_penalty: float
    n: int
    stream: bool
    stop: set[str]
    reminder: str = None
    
    def __init__(self, configuration_dict: dict):
        
        self.prompt_manager = PromptManager()
        self.messages = MessageQueue(configuration_dict.get('max_context_length', 3000), configuration_dict.get('min_context_length', 0))
        
        self.model = configuration_dict.get('model', "accounts/fireworks/models/llama4-maverick-instruct-basic")
        self.max_tokens = configuration_dict.get('max_tokens', 100)
        self.temperature = configuration_dict.get('temperature', 0.6)
        self.top_p = configuration_dict.get('top_p', 1)
        self.top_k = configuration_dict.get('top_k', 50)
        self.frequency_penalty = configuration_dict.get('frequency_penalty', 1.0)
        self.presence_penalty = configuration_dict.get('presence_penalty', 0)
        self.n = configuration_dict.get('n', 1)
        self.stream = configuration_dict.get('stream', False)
        self.stop = configuration_dict.get('stop', [])
        self.reminder = configuration_dict.get('reminder', None)
    
    def set_prompt(self, prompt_manager: PromptManager):
        self.prompt_manager = prompt_manager
        
    # same without warnings... Mainly just for printing and debugging
    def get_messages(self):
        serialized_messages = []
        if self.prompt_manager.has_prompt():
            serialized_messages.append(self.prompt_manager.get_prompt())
            
        serialized_messages += self.messages.to_list()
        if (self.reminder):
            serialized_messages.append(Message(Role.event, self.reminder).to_dict())
        
        return serialized_messages
    
    def serialize_messages(self):
        serialized_messages = self.get_messages()
        if not serialized_messages:
            log.warning("WARNING: No messages found in context")
            return serialized_messages
        
        head_role = serialized_messages[0]['role']
        if head_role == Role.assistant:
            log.warning("WARNING: first message in context cannot be from assistant")
        elif head_role == Role.system and ((len(serialized_messages) < 2) or serialized_messages[1]['role'] == Role.assistant):
            log.warning("WARNING: first in context messages cannot be from assistant")
        if self.messages.back() and self.messages.back().role == Role.assistant:
            log.warning("WARNING: last message in context cannot be from assistant")
            log.warning(f"last message: {self.messages.back().content}")
        
        return serialized_messages
    
    def to_dict(self):
        
        serialized_params = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": self.serialize_messages(),
            "temperature": self.temperature,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "frequency_penalty": self.frequency_penalty,
            "presence_penalty": self.presence_penalty,
            "n": self.n,
            "stream": self.stream,
            "stop": list(self.stop)
        }
        return serialized_params
    