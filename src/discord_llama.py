import os
from message_queue import Role, Message
from parameters import Parameters
from prompt_manager import PromptManager
from dotenv import load_dotenv
from completion_generator import CompletionGenerator
from vision_processor import VisionProcessor
from rate_limit import RateLimit
from logger import log

load_dotenv()

class discord_llama:
    
    def __init__(self, api_key: str = None, params: dict = {}):
        
        self.client = CompletionGenerator(api_key)
        self.Params = Parameters(params)
        self.input_tokens = 0
        self.output_tokens = 0
        
        self.vision_client = VisionProcessor()
    
    def set_parameters(self, configuration_dict):
        if (not configuration_dict):
            log.error("ERROR: no configuration")
        self.Params = Parameters(configuration_dict)
        
    def set_vision_client(self, vision_client):
        self.vision_client = vision_client
    
    def set_parameters(self, configuration_dict):
        if (not configuration_dict):
            log.error("ERROR: no configuration")
        self.Params = Parameters(configuration_dict)
    
    def set_prompt_manager(self, prompt_manager: PromptManager):
        self.Params.set_prompt(prompt_manager)
        
    def set_api_key(self, api_key: str = None):
        self.client = CompletionGenerator(api_key)

    def set_model(self, model: str):
        self.Params.model = model
    
    def set_max_tokens(self, max_tokens: int):
        self.Params.max_tokens = max_tokens
    
    def set_messages(self, messages: Message):
        self.Params.messages.clear()
        
        for message in messages:
            self.Params.messages.append_message(message)
    
    def set_temperature(self, temperature: int):
        self.Params.temperature = temperature
    
    def set_top_p(self, top_p: float):
        self.Params.top_p = top_p
    
    def set_frequency_penalty(self, frequency_penalty: float):
        self.Params.frequency_penalty = frequency_penalty

    def set_presence_penalty(self, presence_penalty: float):
        self.Params.presence_penalty = presence_penalty
    
    def set_n(self, n: int):
        self.Params.n = n

    def set_stream(self, stream: bool):
        self.Params.stream = stream
    
    def set_reminder(self, reminder: str):
        self.Params.reminder = reminder
    
    def set_stop_tokens(self, stop_tokens):
        if isinstance(stop_tokens, list):
            stop_tokens = set(stop_tokens)
        elif not isinstance(stop_tokens, set):
            raise TypeError("stop_tokens must be a set or a list")

        self.Params.stop = stop_tokens
        self.Params.stop.add("<|eot_id|>")

    def add_event_message(self, message: str):
        self.Params.messages.append(Role.event, message)
        
    def search(self, message: str, name: str = ""):
        self.Params.prompt_manager.search(message=message, username=name)
    
    def add_user_message(self, message: str, name: str = ""):
        self.search(message, name)
        log.debug(f"adding message {name}: {message}")
        self.Params.messages.append(Role.user, message, name)

    def add_assistant_message(self, message: str, name: str = ""):
        log.debug(f"adding message {name}: {message}")
        self.Params.messages.append(Role.assistant, message, name)

    def clear_memory(self):
        self.Params.messages.clear()
    
    def truncate_memory(self):
        self.Params.messages.truncate_to_min()

    def clear_prompt(self):
        self.Params.prompt = {}
    
    def remove_last_message(self):
        return self.Params.messages.pop()
    
    def get_context(self):
        return self.Params.to_dict()
        
    def get_context_length(self):
        return self.Params.messages.char_count
        
    def is_vision_enabled(self):
        return self.vision_client.is_vision_enabled()
    
    async def generate_response(self) -> str:
        message = ""
        request = {}
        try:
            context = self.Params.to_dict()
            request = await self.client.fetch_completion(context)
            
            message: str = request['choices'][0]['message']['content']
            # log.debug(f"response length{len(message)}")
            initial_len = len(message)
            self.output_tokens += request['usage']['prompt_tokens']
            self.output_tokens += request['usage']['completion_tokens']
            log.info(f"==usage==\ninput: {self.input_tokens}\noutput: {self.output_tokens}")
            
            # TODO: optimize to prevent unnessisary checks
            think_end = message.find("</think>")
            if message and think_end >= 0:
                message = message[think_end+len("</think>"):].strip()
            else:
                log.error("Tried to think but did not finish thinking")
                
            log.debug(f"{initial_len - len(message)} think characters removed")
            if message and message[0] == "<":
                log.debug(f"pruned message header: {message}")
                closing = message.find(">:")
                if closing:
                    message = message[closing+1:].strip()
                elif message.find("<think>") >= 0:
                    log.error(f"Found thinking content but could not find thinking end")
                
            self.add_assistant_message(message)
        except Exception as e:
            log.error(f"error generating response {e}: payload from api {request}")
            
        return message
        
    async def generate_image_to_text(self, image_url) -> str:
        try:
            (image_text, prompt_tokens, completion_tokens) = await self.vision_client.read_image(image_url)
            self.input_tokens += prompt_tokens
            self.output_tokens += completion_tokens
            
            log.info(f"==usage==\ninput: {self.input_tokens}\noutput: {self.output_tokens}")
            
            return image_text
        except Exception as e:
            log.error(f"error generating image to text {e}")
        
        
    def _print_chat(self):
        log.info('==usage==')
        log.info(f"input:({self.input_tokens}), output:({self.output_tokens})")
        
        for message in self.Params.get_messages():
            log.info(f"{message.role}: {message.content}")
        return