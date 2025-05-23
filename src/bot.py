import signal
import sys
import asyncio
from discord_bot import DiscordBot
from logger import log
from llm_setup import create_bot_list

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
    
    bots = create_bot_list(settings_file_path=settings_file_path)
    
    try:
        asyncio.run(run_bots(bots))
    finally:
        for bot in bots:
            log.debug(f"context: {bot.get_context()}")
    
    
