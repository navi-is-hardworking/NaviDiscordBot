from message_queue import MessageQueue, Role, Message
from prompt_manager import PromptManager
from logger import log
from serialization_definitions import Message, Role
import re

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
    
    
    def __init__(self, prompt_manager, configuration_dict: dict):
        self.prompt_manager = prompt_manager
        self.max_context_length = configuration_dict.get('max_context_length', 3000)
        self.min_context_length = configuration_dict.get('min_context_length', 0)
        self.messages = MessageQueue(self.max_context_length, self.min_context_length)
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
        
        log.debug(f'''configured model with
                prompt_manager={self.prompt_manager}
                messages={self.messages}
                model={self.model}
                max_tokens={self.max_tokens}
                temperature={self.temperature}
                top_p={self.top_p}
                top_k={self.top_k}
                frequency_penalty={self.frequency_penalty}
                presence_penalty={self.presence_penalty}
                n={self.n}
                stream={self.stream}
                stop={self.stop}
                reminder={self.reminder} ''' )
    
    
    def set_prompt(self, prompt_manager: PromptManager):
        self.prompt_manager = prompt_manager
        
    
    # same without warnings... Mainly just for printing and debugging
    def _get_messages(self, messages: MessageQueue, prompt: Message) -> list[dict]:
        serialized_messages = []
        if prompt:
            serialized_messages.append(prompt.to_dict())
            
        serialized_messages += messages.to_list()
        if (self.reminder):
            serialized_messages.append(Message(Role.user, self.reminder).to_dict())
        
        return serialized_messages
    
    
    def _serialize_messages(self, messages: MessageQueue, prompt: Message):
        serialized_messages = self._get_messages(messages, prompt)
        
        if not serialized_messages:
            log.warning("WARNING: No messages found in context")
            return serialized_messages
        
        head_role = serialized_messages[0]['role']
        if head_role == Role.assistant:
            log.warning("WARNING: first message in context cannot be from assistant")
        elif head_role == Role.system and ((len(serialized_messages) < 2) or serialized_messages[1]['role'] == Role.assistant):
            log.warning("WARNING: first in context messages cannot be from assistant")
        if messages.back() and messages.back().role == Role.assistant:
            log.warning("WARNING: last message in context cannot be from assistant")
            log.warning(f"last message: {messages.back().content}")
        
        return serialized_messages
    
    
    def get_serialize_params(self):
        serialized_params = {
            "model": self.model,
            "max_tokens": self.max_tokens,
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
        
    
    def to_dict(self):
        serialized_params = self.get_serialize_params()
        serialized_params["messages"] = self._serialize_messages(self.messages, self.prompt_manager.get_prompt())
        return serialized_params
        
    
    def create_mock_payload(self, messages: list[Message], banned_inputs: re.Pattern[str]):
        mockMessages = MessageQueue(self.max_context_length, self.min_context_length)
        mockPrompt = self.prompt_manager.create_mock_prompt(messages)
        
        for msg in messages:
            if banned_inputs and banned_inputs.search(msg.content):
                log.one_shot(f"message from ({msg.name}) ignored because contained banned regex: {msg.content}")
                continue
            mockMessages.append(role=msg.role, content=msg.content, name=msg.name)
        log.one_shot("finished creating one shot payload")
            
        # print("finished adding messages classes")
        params = self.get_serialize_params()
        params["messages"] = self._serialize_messages(messages=mockMessages, prompt=mockPrompt)
        return params
            
        
    