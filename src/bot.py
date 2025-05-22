import signal
import sys
import asyncio
from discord_bot import DiscordBot
import config_parser
from logger import log
from llm_setup import create_llm

import sys; sys.stderr.write("BOT SCRIPT STARTED\n"); sys.stderr.flush()

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
    log.debug(f"reading settings from {settings_file_path}")
    for char_name, settings in config_parser.parse_json(settings_file_path).items():
        if not settings["enabled"]:
            continue
        
        chat = create_llm(char_name=char_name, settings=settings)
        
        bot_token_location = settings["bot_token"]
        response_limits = settings['response_limits']
        discord_bot = DiscordBot(bot_name=char_name, bot_token_location=bot_token_location, setting_dictionary=response_limits, chat=chat)
        bots.append(discord_bot)
        log.debug(f"initialized {char_name}")
    
    try:
        asyncio.run(run_bots(bots))
    finally:
        for bot in bots:
            log.debug(f"{char_name} context: {bot.get_context()}")
    
    
