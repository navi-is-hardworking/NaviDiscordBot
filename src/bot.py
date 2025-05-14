import signal
import sys
import atexit
import asyncio
from discord_llama import discord_llama
from prompt_manager import PromptManager
from discord_bot import DiscordBot
from vision_processor import VisionProcessor
import config_parser
from logger import log

def signal_handler(sig, frame):
    log.debug("Received termination signal. Shutting down gracefully...")
    sys.exit(0)

async def run_bots(bots):
    tasks = [bot.start() for bot in bots]
    await asyncio.gather(
        *tasks
    )

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    settings_file_path = "settings/settings.json"
    if len(sys.argv) > 1:
        settings_file_path = sys.argv[1]
    log.debug(settings_file_path)
    
    bots: list[DiscordBot] = []
    for char_name, settings in config_parser.parse_json(settings_file_path).items():
        
        if not settings["enabled"]:
            continue
        
        bot_token_location = settings["bot_token"]
        chat = discord_llama()
        
        (
            prompt_tail,
            prompt_head,
            dictionary_header,
            definition_dictionary
        ) =  settings['prompt_settings']['prompt_head'], settings['prompt_settings']['prompt_tail'], settings['prompt_settings']['dictionary_header'], settings['prompt_settings']['dictionary']
        
        pm = PromptManager()
        pm.configure(
            prompt_tail,
            prompt_head,
            dictionary_header,
            definition_dictionary,
            settings['prompt_settings']['cache_capacity'],
            settings['prompt_settings']['cache_clear_time']
        )
        
        response_limits = settings['response_limits']
        vision_client = VisionProcessor(max_requests=response_limits['max_vision_queries_per_interval'], interval=response_limits['vision_limit_interval'])
        
        chat.set_parameters(settings['llm_settings'])
        chat.set_prompt_manager(pm)
        chat.set_vision_client(vision_client=vision_client)
        
        
        discord_bot = DiscordBot(char_name, bot_token_location, response_limits, chat)
        bots.append(discord_bot)
    
    try:
        asyncio.run(run_bots(bots))
    finally:
        for bot in bots:
            log.debug(f"{char_name} context: {bot.get_context()}")
    
    
