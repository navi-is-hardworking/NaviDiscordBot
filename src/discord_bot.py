import os
import time
import discord
from discord.ext import commands
from discord_llama import discord_llama
import asyncio
from rate_limit import RateLimit
import random
import threading
from collections import deque
from inspect_message import inspect_message
from shared_image_cache import image_cache
from logger import log
import random

class DiscordBot:
    def __init__(self, bot_name: str, bot_token_location: str, setting_dictionary: dict, chat: discord_llama):
        
        self.chat: discord_llama = chat
        self.bot_token_location = bot_token_location
        self.max_user_input_message_length = setting_dictionary['max_user_input_message_length']
        self.chat_clear_time = setting_dictionary['chat_clear_time']
        # self.response_targets = set()
        
        self.random_occurences_enabled = setting_dictionary.get('random_occurences_enabled', False)
        
        self.monitored_channels = [int(x) for x in setting_dictionary['monitored_channels']]
        self.partial_ignore_list = [int(x) for x in setting_dictionary['partial_ignore_list']]
        self.full_ignore_list = [int(x) for x in setting_dictionary['full_ignore_list']]
        
        self.typing_delay_range = setting_dictionary['typing_delay_range']
        self.rate_limiter = RateLimit(
            setting_dictionary['max_bot_response_count_per_interval'],
            setting_dictionary['response_limit_interval']
        )
        
        self.bot_name = bot_name
        self.intents: discord.Intents = discord.Intents.default()
        self.intents.message_content = True
        self.bot: commands.Bot = commands.Bot(command_prefix='!', intents=self.intents)
        self.processing_lock = threading.Lock()
        
        self.bot.event(self.on_ready)
        self.bot.event(self.on_message)
        
        self.last_message_time = -self.chat_clear_time - 1
        self.message_queue: deque[discord.Message] = deque()
        
    
    def add_message_to_context(self, user_name: str, msg: str):
        if (len(msg) > self.max_user_input_message_length):
            msg = msg[0:self.max_user_input_message_length]
            
        # self.prompter.static_search(user_name, msg)
        self.chat.add_user_message(msg, user_name)
        
    
    async def process_message_queue(self, channel):
        while not self.rate_limiter.full() and len(self.message_queue) > 0 and self.processing_lock.acquire(blocking=False):
            try:
                await self.wait_process_response(channel)
            except Exception as e:
                log.error(f"Exception in {self.bot_name} process_message_queue: {e}")
            finally:
                self.processing_lock.release()
            
    
    async def wait_process_response(self, channel):
        async with channel.typing():
            start_time = time.time()
            
            await self.calculate_wait_time()
            
            response_targets = self.prepare_context()
            response = await self.chat.generate_response()
            
            sent = False
            if response:
                for channel in response_targets:
                    if sent:
                        await channel.send("! " + response)
                        
                    else:
                        await channel.send(response) 
                        sent = True
            
            channel = None
            
            log.debug(f"{self.bot_name}: response time: {time.time() - start_time}")
            log.debug(f"{self.bot_name}: FULL elapsed time: {time.time() - start_time}")
            
    
    async def calculate_wait_time(self):
        delay = random.uniform(self.typing_delay_range[0], self.typing_delay_range[1])
        await asyncio.sleep(delay)
    
    
    def prepare_context(self):
        if (time.time() - self.last_message_time > self.chat_clear_time):
            log.debug(f"{self.bot_name}: clearing chat history")
            self.chat.truncate_memory()
                
        self.rate_limiter.add()
        self.last_message_time = time.time()
        
        ## iter through queue add before sending over
        # log.debug(f"{self.bot_name}: starting message batch for {self.bot_name}")
        # log.debug(f"{self.bot_name} adding messages: {self.message_queue}")
        
        response_targets = set()
        while len(self.message_queue) > 0:
            message: discord.Message = self.message_queue.popleft()
            self.add_message_to_context(message.author.display_name, message.content)
            response_targets.add(message.channel)
            
        return response_targets
            
    
    async def on_ready(self):
        log.info(f'{self.bot.user} has connected to Discord!')
        
    
    async def start(self):
        token = os.environ.get(self.bot_token_location)
        if not token:
            log.error(f"Environment variable {self.bot_token_location} not set!")
            raise ValueError(f"Environment variable {self.bot_token_location} not set!")
        await self.bot.start(token)
        
    def get_context(self):
        return self.chat.get_context()
    
    
    async def handle_image_processing(self, message: discord.Message):
        log.info(f"Attempting to proccess images {message.attachments}")
        if self.chat.is_vision_enabled():
            
            image_texts = f"\n# {message.author.display_name} attachments:\n"
            images_found = False
            
            for i, attachment in enumerate(message.attachments):
                image_text = await image_cache.get_image(attachment.url, self.chat.generate_image_to_text)
                if not image_text:
                    log.error("failed to generate image")
                    break
                if image_text:
                    images_found = True
                    image_text = f"## image({i+1}): ({image_text})\n"
                    image_texts += image_text
                
            if images_found:
                message.content += image_texts
                
            log.info(f"final content: {message.content}")
        else:
            log.warning("tried to process image but imaging was not enabled")
    
    def handle_random_occurance(self, message) -> bool:
        if not self.random_occurences_enabled:
                return True
        elif (time.time() - self.last_message_time > self.chat_clear_time):
            if self.bot_name.lower() in message.content.lower():
                if random.randint(0, 9):
                    return True
            elif random.randint(0, 19): # % 5 chance
                return True
        elif random.randint(0, 99): # %1 chance
            return True
    
    ######## Where messages comes in / main logic ########
    async def on_message(self, message: discord.Message):
        if message.author == self.bot.user or message.author.id in self.full_ignore_list or not message.content.find("!"):
            return
        
        if message.channel.id not in self.monitored_channels:
            if self.handle_random_occurance(message):
                return True
                
        if len(message.content) == 0 and len(message.attachments) == 0:
            return
            
        if self.rate_limiter.full():
            return
            
        # log.debug(f"raw message: {message.content}")
        # log.debug(f"attachments: {message.attachments}")
        # log.debug(f"author: {message.author}")
        # log.debug(f"display name: {message.author.display_name}")
        # inspect_message(message)
        
        if len(message.attachments) > 0:
            await self.handle_image_processing(message)
        
        if message.mentions:
            for user in message.mentions:
                message.content = message.content.replace(f"<@{user.id}>", user.display_name).replace(f"<@!{user.id}>", user.display_name)
        
        if (message.author.id in self.partial_ignore_list):
            self.add_message_to_context(message.author.display_name, message.content)
            return
        
        self.message_queue.append(message)
        
        await self.process_message_queue(message.channel)
        
        await self.bot.process_commands(message)
        