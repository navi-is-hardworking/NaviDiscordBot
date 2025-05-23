import os
import time
import discord
from discord.ext import commands
from discord_llama import chat_manager
import asyncio
from rate_limit import RateLimit
import random
import threading
from collections import deque
from inspect_message import inspect_message
from shared_image_cache import image_cache
from logger import log
import random
from message_queue import MessageQueue, Role, Message

from typing import (
    Union,
)

class DiscordBot:
    def __init__(self, bot_name: str, bot_token_location: str, setting_dictionary: dict, chat: chat_manager):
        self.chat: chat_manager = chat
        self.bot_token_location = bot_token_location
        self.max_user_input_message_length = setting_dictionary['max_user_input_message_length']
        self.chat_clear_time = setting_dictionary['chat_clear_time']
        # self.response_targets = set()
        
        self.random_occurences_enabled = setting_dictionary.get('random_occurences_enabled', False)
        
        self.monitored_servers = [int(x) for x in setting_dictionary['monitored_servers']]
        self.monitored_channels = [int(x) for x in setting_dictionary['monitored_channels']]
        self.partial_ignore_list = [int(x) for x in setting_dictionary['partial_ignore_list']]
        self.full_ignore_list = [int(x) for x in setting_dictionary['full_ignore_list']]
        self.admin_list = [int(x) for x in setting_dictionary['admins']]
        
        self.typing_delay_range = setting_dictionary['typing_delay_range']
        
        self.context_rate_limiter = RateLimit(
            setting_dictionary['max_bot_response_count_per_interval'],
            setting_dictionary['response_limit_interval']
        )
        
        self.vision_rate_limiter = RateLimit(
            setting_dictionary['max_vision_queries_per_interval'],
            setting_dictionary['vision_limit_interval']
        )
        
        self.bot_name = bot_name
        self.intents: discord.Intents = discord.Intents.default()
        self.intents.message_content = True
        self.intents.message_content = True
        self.bot: commands.Bot = commands.Bot(command_prefix='!', intents=self.intents)
        self.processing_lock = threading.Lock()
        
        self.bot.event(self.on_ready)
        self.bot.event(self.on_message)
        
        self.last_message_time = -self.chat_clear_time - 1
        self.message_queue: deque[discord.Message] = deque()
        
        log.debug(f"Discord bot {bot_name} initialized.")
        
    
    def add_message_to_context(self, user_name: str, msg: str):
        if (len(msg) > self.max_user_input_message_length):
            msg = msg[0:self.max_user_input_message_length]
            
        self.chat.add_user_message(msg, user_name)
    
    
    async def process_message_queue(self, channel):
        while not self.context_rate_limiter.full() and len(self.message_queue) > 0 and self.processing_lock.acquire(blocking=False):
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
                
        self.context_rate_limiter.add()
        self.last_message_time = time.time()
        
        response_targets = set()
        while len(self.message_queue) > 0:
            message: discord.Message = self.message_queue.popleft()
            self.add_message_to_context(message.author.display_name, message.content)
            response_targets.add(message.channel)
            
        return response_targets
    
    
    async def on_ready(self):
        log.info(f'{self.bot.user} has connected to Discord!')
    
    
    async def start(self):
        log.debug(f"Environment variable {self.bot_token_location}")
        token = os.environ.get(self.bot_token_location)
        if not token:
            log.error(f"Environment variable {self.bot_token_location} not set!")
            raise ValueError(f"Environment variable {self.bot_token_location} not set!")
        await self.bot.start(token)
        
    
    def get_context(self):
        return self.chat.get_context()
    
    
    async def handle_image_processing(self, message: discord.Message):
        if len(message.attachments) == 0 or self.vision_rate_limiter.full():
            return 
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
    
    
    def handle_random_occurance(self, message: discord.Message) -> bool:
        if not self.random_occurences_enabled:
                return True
        if self.bot_name.lower() in message.content.lower():
            return False
        elif (time.time() - self.last_message_time > self.chat_clear_time):
            if random.randint(0, 20): # % 5 chance
                return True
        elif random.randint(0, 50): # %2 chance
            return True
    
    
    async def handle_admin_command(self, message: discord.Message):
        args = message.content.split(" ")
        command = args[0]
        log.debug(f"processing command {args}")
        if command == "!reset":
            self.chat.clear_memory()
        
        elif command == "!context":
            full_context = self.chat._get_chat()
            
            await message.author.send(f"model: {full_context['model']}")
            await message.author.send(f"max_tokens: {full_context['max_tokens']}")
            await message.author.send(f"temperature: {full_context['temperature']}")
            await message.author.send(f"top_p: {full_context['top_p']}")
            await message.author.send(f"top_k: {full_context['top_k']}")
            await message.author.send(f"frequency_penalty: {full_context['frequency_penalty']}")
            await message.author.send(f"presence_penalty: {full_context['presence_penalty']}")
            await message.author.send(f"n: {full_context['n']}")
            await message.author.send(f"stream: {full_context['stream']}")
            await message.author.send(f"stop: {full_context['stop']}")
        
        elif command == "!rates":
            rates_string: str = self.chat._get_rates()
            await message.author.send("!" + rates_string)
        
        return
    
    
    async def send_to_user(self, author: Union[discord.User, discord.Member], message: str):
        await author.send(message)
    
    
    async def get_channel(self, channel_id: discord.abc.Messageable):
        return self.bot.get_channel(channel_id)
        
    
    async def get_messages(self, channel: Union[discord.TextChannel, discord.Thread, discord.VoiceChannel, discord.StageChannel]) -> list[discord.Message]:
        past_messages = []
        async for past_msg in channel.history(limit=20):
            past_messages.append(past_msg)
        return past_messages

            
    async def send_oneshot_message(self, message: discord.Message):
        async with message.channel.typing():
            log.debug("trying to get messages")
            history: list[discord.Message] = await self.get_messages(message.channel)
            msgs = []
            for msg in history:
                log.debug(f"found message: {msg.content}")
                if len(message.content) == 0 and len(message.attachments) == 0:
                    continue
                await self.handle_image_processing(msg)
                
                name = msg.author.display_name
                content = msg.content
                role = Role.assistant if msg.author == self.bot.user else Role.user
                temp_msg = Message(role, content, name)
                msgs.append(temp_msg)
            
            msgs.reverse()
            response = await self.chat.get_oneshot_response(msgs)
            log.debug(f"oneshot response: {response}")
            await message.channel.send(response)
            await self.bot.process_commands(message)
    
            
    ######## Where messages comes in / main logic ########
    async def on_message(self, message: discord.Message):
        
        ## Process admin commands
        if self.admin_list and message.author.id in self.admin_list and not message.content.find("!"):
            # todo handle command
            await self.handle_admin_command(message)
            return
            
        ## Don't respond process disabled channels
        if self.monitored_servers and message.guild:
            if message.guild.id not in self.monitored_servers:
                return
            
        ## Ignore the dup responses which will have ! at the start or be an admin command
        if message.author == self.bot.user or message.author.id in self.full_ignore_list or not message.content.find("!"):
            return
        
        if (message.author.id in self.partial_ignore_list):
            self.add_message_to_context(message.author.display_name, message.content)
            return
                
        if self.context_rate_limiter.full():
            return
            
        ## Random changes to respond anywhere, need to create a oneshot context
        if message.channel.id not in self.monitored_channels:
            log.debug("not in monitored channels")
            if self.handle_random_occurance(message):
                return
            else:
                await self.send_oneshot_message(message)
                return
        
        if len(message.content) == 0 and len(message.attachments) == 0:
            return
        
        await self.handle_image_processing(message)
        
        if message.mentions:
            for user in message.mentions:
                message.content = message.content.replace(f"<@{user.id}>", user.display_name).replace(f"<@!{user.id}>", user.display_name)
        
        self.message_queue.append(message)
        
        await self.process_message_queue(message.channel)
        await self.bot.process_commands(message)
        