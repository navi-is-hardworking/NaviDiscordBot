import os
from serialization_definitions import Message, Role
from parameters import Parameters
from dotenv import load_dotenv
from completion_generator import CompletionGenerator
from vision_processor import VisionProcessor
from logger import log
from rate_limit import RateLimit
import re

load_dotenv()

class chat_manager:
    def __init__(
        self,
        char_name: str,
        completion_client: CompletionGenerator,
        vision_client: VisionProcessor,
        params: Parameters,
        context_rate_limiter: RateLimit,
        vision_rate_limiter: RateLimit,
        banned_inputs: list[str]
    ):
        
        self.char_name = char_name
        self.Params: Parameters = params
        self.completion_generator: CompletionGenerator = completion_client
        self.vision_client: VisionProcessor = vision_client
        self.context_rate_limiter: RateLimit = context_rate_limiter
        self.vision_rate_limiter: RateLimit = vision_rate_limiter
        
        if banned_inputs:
            log.debug(f"found bound inputs: {banned_inputs}")
            self.banned_inputs: re.Pattern[str] = re.compile("|".join(f"({p})" for p in banned_inputs), re.IGNORECASE)
        else:
            self.banned_inputs = None
    
    def set_api_key(self, api_key: str = None):
        self.completion_generator = CompletionGenerator(api_key)

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
        self.Params.prompt_manager.update_dictionary(message=message, username=name)
    
    def add_user_message(self, message: str, name: str = ""):
        self.search(message=message, name=name)
        self.Params.messages.append(role=Role.user, content=message, name=name)
        
    def contains_banned_input(self, message: str, name: str = ""):
        if self.banned_inputs and self.banned_inputs.search(message):
            log.ignored(f"message from ({name}) ignored because contained banned regex: {message}")
            return True
        return False

    def add_assistant_message(self, message: str, name: str = ""):
        self.Params.messages.append(Role.assistant, message, name)

    def clear_memory(self):
        self.Params.messages.clear()
    
    def truncate_memory(self):
        self.Params.messages.truncate_to_min()

    def clear_prompt(self):
        # depreciated
        pass
        # self.Params.clear = {}
    
    def remove_last_message(self):
        return self.Params.messages.pop()
    
    def get_context(self):
        return self.Params.to_dict()
        
    def get_context_length(self):
        return self.Params.messages.char_count
        
    def is_vision_enabled(self):
        return self.vision_client.is_vision_enabled()
    
    
    async def _get_completion(self, context) -> str:
        message = ""
        request = {}
        try:
            request = await self.completion_generator.fetch_completion(context)
            message: str = request['choices'][0]['message']['content']
            initial_len = len(message)
            
            # TODO: optimize to prevent unnessisary checks
            think_end = message.find("</think>")
            if message and think_end >= 0:
                message = message[think_end+len("</think>"):].strip()
            if message.find("<think>") > 0:
                log.error("tried to think but failed to finish though")
                message = "I'm a dumb dumb baka waka who tried to think but failed!"
                return 
                
            log.debug(f"{initial_len - len(message)} think characters removed")
            if message and message[0] == "<":
                log.debug(f"pruned message header: {message}")
                closing = message.find(">:")
                if closing:
                    message = message[closing+len(">:"):].strip()
                elif message.find("<think>") >= 0:
                    log.error(f"Found thinking content but could not find thinking end")
                
            return message
        except Exception as e:
            log.error(f"error generating response {e}: payload from api {request}")
        
    
    async def generate_response(self) -> str:
        if self.context_rate_limiter.full():
            log.warning(f"_get_completion canceled due to exceeding user set rate limit")
            return ""
        self.context_rate_limiter.add()
        
        context = self.Params.to_dict()
        message = await self._get_completion(context)
        if not message:
            return ""
        
        self.add_assistant_message(message)
            
        return message
        
    def can_receive_vision_request(self) -> bool:
        return not self.vision_rate_limiter.full()
    
    async def generate_image_to_text(self, image_url) -> str:
        if self.vision_rate_limiter.full():
            log.warning(f"generate_image_to_text canceled due to exceeding user set rate limit")
            return
        self.vision_rate_limiter.add()
        
        try:
            image_text = await self.vision_client.read_image(image_url)
            return image_text
        except Exception as e:
            log.error(f"error generating image to text {e}")
        
        
    def _print_chat(self):
        log.info('==usage==')
        
        for message in self.Params._get_messages():
            log.info(f"{message.role}: {message.content}")
        return
    
    
    def _get_chat(self) -> dict:
        return self.Params.to_dict()
    
    
    def _get_rates(self) -> str:
        return self.completion_generator.log_usage(force=True)
    
    
    def get_prompt_memories(self) -> str:
        return self.Params.prompt_manager.get_memories()
    
    
    async def get_oneshot_response(self, messages: list[Message]):
        # put separate limiting in discord_bot.py which is going to confuse me later o7
        payload = self.Params.create_mock_payload(messages, self.banned_inputs)
        log.one_shot(f"sending one shot response: {payload}")
        message = await self._get_completion(payload)
        return message
        
