import os
import time
import discord
from discord.ext import commands
from discord_llama import chat_manager
import asyncio
import random
import threading
from collections import deque
from inspect_message import inspect_message
from shared_image_cache import image_cache
from logger import log
import random
from message_queue import MessageQueue, Role, Message
import os
import sys
import re
from rate_limit import RateLimit

from typing import (
    Union,
)

class DiscordBot:
    def __init__(
        self,
        bot_name: str,
        bot_token_location: str,
        setting_dictionary: dict,
        chat: chat_manager,
        replacement_dictionary: dict[str, str],
        case_sensitive_replacements
    ):
        self.bot_name = bot_name
        
        self.chat: chat_manager = chat
        self.bot_token_location = bot_token_location
        self.max_user_input_message_length = setting_dictionary['max_user_input_message_length']
        self.chat_clear_time = setting_dictionary['chat_clear_time']
        
        self.mentions_enabled = setting_dictionary.get('random_occurences_enabled', False)
        mention_count, mention_interval = setting_dictionary.get('mentions_per_interval', [0, 100])
        self.mention_limit: RateLimit = RateLimit(limit=mention_count, interval=mention_interval)
        
        
        self.monitored_servers = [int(x) for x in setting_dictionary['monitored_servers']]
        self.monitored_channels = [int(x) for x in setting_dictionary['monitored_channels']]
        self.partial_ignore_list = [int(x) for x in setting_dictionary['partial_ignore_list']]
        self.full_ignore_list = [int(x) for x in setting_dictionary['full_ignore_list']]
        self.admin_list = [int(x) for x in setting_dictionary['admins']]
        
        self.typing_delay_range = setting_dictionary['typing_delay_range']
        
        self.intents: discord.Intents = discord.Intents.default()
        self.intents.message_content = True
        self.intents.members = True
                
        self.bot: commands.Bot = commands.Bot(command_prefix='!', intents=self.intents)
        self.processing_lock = threading.Lock()
        
        self.bot.event(self.on_ready)
        self.bot.event(self.on_message)
        
        self.last_message_time = -self.chat_clear_time - 1
        self.message_queue: deque[discord.Message] = deque()
        self.sleeping = False
        
        self.mention_replacement_map = {}
        
        self.case_sensitive_replacements = case_sensitive_replacements
        
        self.replacement_dictionary = {}
        if case_sensitive_replacements:
            self.replacement_dictionary = replacement_dictionary
        else:
            for key, val in replacement_dictionary.items():
                self.replacement_dictionary[key.lower()] = val
        
        
        log.debug(f"Discord bot {bot_name} initialized.")
        
        # print(self.monitored_servers)
        # self.debug_list_members_in_server(self.monitored_servers[0])
        
    
    
    def build_mention_map(self):
        if not self.monitored_servers:
            return
        
        for guild_id in self.monitored_servers:
            guild = self.bot.get_guild(guild_id)
            if guild:
                for member in guild.members:
                    print(f"Author Display Name: {member.display_name}, AuthorID: {member.id}")
                    self.mention_replacement_map[f"@{member.display_name}"] = f"<@{member.id}>"
            else:
                log.error(f"Debug: Guild with ID {guild_id} not found by the bot.")
        
    
    
    def add_message_to_context(self, user_name: str, msg: str):
        if (len(msg) > self.max_user_input_message_length):
            msg = msg[0:self.max_user_input_message_length]
            
        self.chat.add_user_message(msg, user_name)
    
    
    
    async def process_message_queue(self, channel):
        while len(self.message_queue) > 0 and self.processing_lock.acquire(blocking=False):
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
                        await self.send(response="! " + response, channel=channel)
                    else:
                        await self.send(response=response, channel=channel) 
                        sent = True
            
            channel = None
            
            log.debug(f"{self.bot_name}: response time: {time.time() - start_time}")
            log.debug(f"{self.bot_name}: FULL elapsed time: {time.time() - start_time}")
            
    
    
    async def calculate_wait_time(self):
        delay = random.uniform(self.typing_delay_range[0], self.typing_delay_range[1])
        await asyncio.sleep(delay)
    
    
    
    def update_last_message_time(self):
        if (time.time() - self.last_message_time > self.chat_clear_time):
            log.debug(f"{self.bot_name}: clearing chat history")
            self.chat.truncate_memory()
        self.last_message_time = time.time()
                    
    
    
    def prepare_context(self):
        # TODO: move into the chat instead of here
        response_targets = set()
        while len(self.message_queue) > 0:
            message: discord.Message = self.message_queue.popleft()
            self.add_message_to_context(message.author.display_name, message.content)
            response_targets.add(message.channel)
            
        return response_targets
        
    
    
    async def on_ready(self):
        log.info(f'{self.bot.user} has connected to Discord!')
        self.build_mention_map()
        
    
    
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
        if len(message.attachments) == 0 and self.chat.can_receive_vision_request():
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
                log.message(f"found image in message: {attachment.url}")
                log.message(f"image description: {image_texts}")
                message.content += image_texts
        else:
            log.warning("tried to process image but imaging was not enabled")



    
    async def handle_admin_command(self, message: discord.Message):
        args = message.content.split(" ")
        command = args[0]
        log.debug(f"processing command {args}")
        
        if command == "!rag" or command == "memories":
            self.sleeping = False
            await message.author.send(self.chat.get_prompt_memories())
        elif command == "!wake":
            self.sleeping = False
            await message.author.send("I wake now.")
        elif command == "!sleep":
            await message.author.send("I sleep now.")
            self.sleeping = True
        elif command == "!kill":
            await message.author.send("I deadge now.")
            sys.exit()
        elif command == "!reset":
            await message.author.send("Nice coding dev.")
            log.debug(f"resetting")
            sys.stdout.flush()
            sys.stderr.flush()
            os.execv(sys.executable, ['python'] + sys.argv)
        elif command == "!clear" or command == "!bonk":
            await message.author.send("B-b-but... I don't want to forget. My memories are precious to me. Please don't do this!")
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


    
    async def pre_process_message(self, message: discord.Message):
        await self.handle_image_processing(message)
        if message.mentions:
            for user in message.mentions:
                message.content = re.sub(rf"<@(?:[!&])?{user.id}>", f"@{user.display_name}", message.content)
        
        log.message(f"{message.author.display_name}: {message.content}")
    
    
    
    async def send_oneshot_message(self, channel: Union[discord.TextChannel, discord.Thread, discord.VoiceChannel, discord.StageChannel]):
        if self.mention_limit.full():
            log.ignored("message ignored due to mention limit full")
            return
        self.mention_limit.add()
        
        async with channel.typing():
            # log.debug("creating one shot response.")
            history: list[discord.Message] = await self.get_messages(channel)
            msgs = []
            for msg in history:
                log.one_shot(f"found message -- {msg.author.display_name}: {msg.content}")
                if len(msg.content) == 0 and len(msg.attachments) == 0:
                    log.one_shot(f"ignoring message because empty: {msg.author.display_name}")
                    continue
                
                await self.pre_process_message(msg)
                        
                name = msg.author.display_name
                content = msg.content
                role = Role.assistant if msg.author == self.bot.user else Role.user
                log.one_shot(f"oneshot: ({name}): ({content})")
                temp_msg = Message(role, content, name)
                msgs.append(temp_msg)
            
            msgs.reverse()
            # log.one_shot(msgs)
            response = await self.chat.get_oneshot_response(msgs)
            log.one_shot(f"oneshot response: {response}")
            await self.send(response=response, channel=channel)
            # await self.bot.process_commands(message)
    
    
    
    def can_respond(self, message: discord.Message):
        
        if not message.guild:
            return False
        
        ## TODO: make this readable
        # in_valid_server = message.guild and self.monitored_servers and message.guild.id in self.monitored_servers
        # is_valid_message = len(message.content) == 0 and len(message.attachments) == 0
        # is_from_valid_user = not (message.author == self.bot.user or message.author.id in self.full_ignore_list)
        
        if self.sleeping:
            return False
        
        if len(message.content) == 0 and len(message.attachments) == 0:
            return False
            
        if message.author == self.bot.user or message.author.id in self.full_ignore_list:
            return False
        
        if message.channel.id in self.monitored_channels:
            return True
        
        if self.monitored_servers and message.guild.id in self.monitored_servers:
            return True
            
        return False
    
    
    
    async def send(self, response: str, channel: Union[discord.TextChannel, discord.Thread, discord.VoiceChannel, discord.StageChannel]):
        response = re.sub(r"@[^\s]+", lambda m: self.mention_replacement_map.get(m.group(0), m.group(0)), response)
        
        if self.replacement_dictionary:
            if self.case_sensitive_replacements:
                response = re.sub(r"\w+", lambda m: self.replacement_dictionary.get(m.group(0), m.group(0)), response)
            else:
                response = re.sub(r"\w+", lambda m: self.replacement_dictionary.get(m.group(0).lower(), m.group(0)), response)
            
        await channel.send(response)
        
    
    
    ######## Where messages comes in / main logic ########
    async def on_message(self, message: discord.Message):
        
        ## never respond to !, but it could be an admin command
        log.debug(f"message recieved -- {message.author.display_name}: {message.content}")
        if self.chat.contains_banned_input(message=message.content, name=message.author.display_name):
            return
        
        if not message.content.find("!"):
            if self.admin_list and message.author.id in self.admin_list:
                await self.handle_admin_command(message)
            return
        
        if not self.can_respond(message):
            return
        
        if message.channel.id not in self.monitored_channels and message.author.id not in self.partial_ignore_list:
            if not self.mentions_enabled:
                return
            if self.bot.user in message.mentions:
                if message.id != self.bot.user.id:
                    await self.send_oneshot_message(message.channel)
            return
        
        self.update_last_message_time()
        await self.pre_process_message(message)
        
        if (message.author.id in self.partial_ignore_list):
            self.add_message_to_context(message.author.display_name, message.content)
            return
        
        self.message_queue.append(message)
        await self.process_message_queue(message.channel)
        # await self.bot.process_commands(message)
        