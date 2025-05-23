import json5
from discord_llama import chat_manager
from prompt_manager import PromptManager
from parameters import Parameters
from vision_processor import VisionProcessor
from completion_generator import CompletionGenerator
from provider_settings import LLM_Provider
from discord_bot import DiscordBot
from logger import log



def parse_json(json_path) -> dict:
    with open(json_path, "r", encoding='utf-8') as f:
        data = json5.load(f)
    return data


def create_bot_list(settings_file_path: str) -> list[DiscordBot]:
    bots: list[DiscordBot] = []
    log.debug(f"reading settings from {settings_file_path}")
    
    for char_name, settings in parse_json(settings_file_path).items():
        if not settings["enabled"]:
            continue
        
        chat = create_llm(char_name=char_name, settings=settings)
        
        
        bot_token_location = settings["bot_token"]
        ## I regret everything
        response_limits = settings['response_limits']
        response_limits["max_vision_queries_per_interval"]=settings["vision_settings"]["max_vision_queries_per_interval"]
        response_limits["vision_limit_interval"]=settings["vision_settings"]["vision_limit_interval"]
        print(response_limits["vision_limit_interval"],"  ",response_limits["max_vision_queries_per_interval"])
        
        discord_bot = DiscordBot(bot_name=char_name, bot_token_location=bot_token_location, setting_dictionary=response_limits, chat=chat)
        bots.append(discord_bot)
        log.debug(f"initialized {char_name}")
        
    return bots


def create_llm(char_name: str, settings: dict):
        
        prompt_settings: dict = settings["prompt_settings"]
        vision_settings: dict = settings["vision_settings"]
        llm_settings: dict = settings["llm_settings"]
        
        ## Main components of LLM
        completion_client: CompletionGenerator = None
        vision_client: VisionProcessor = None
        parameters: Parameters = None
        prompt_manager: PromptManager = None
        
        primary_completion_provider = LLM_Provider(provider=llm_settings["provider"], endpoint=llm_settings["endpoint"], model=llm_settings["model"])
        backup_completion_providers = [
            LLM_Provider(provider=backup_models["provider"], endpoint=backup_models["endpoint"], model=backup_models["model"]) for backup_models in llm_settings.get("backup_models", [])
        ]
        vision_provider = LLM_Provider(provider=vision_settings["provider"], endpoint=vision_settings["endpoint"], model=vision_settings["model"])
        backup_vision_providers = [LLM_Provider(provider=backup_models["provider"], endpoint=backup_models["endpoint"], model=backup_models["model"]) for backup_models in vision_settings.get("backup_models", [])]
        
        completion_client = CompletionGenerator(
            primairy_provider=primary_completion_provider,
            backup_providers=backup_completion_providers
        )
        
        vision_client = VisionProcessor(
            vision_enabled=vision_settings["vision_enabled"],
            primary_provider=vision_provider,
            backup_providers=backup_vision_providers,
            vision_prompt=vision_settings["vision_prompt"]
        )
        prompt_manager = PromptManager(
            prompt_head=prompt_settings['prompt_head'],
            prompt_tail=prompt_settings['prompt_tail'],
            cache_header=prompt_settings['dictionary_cache_header'],
            word_dict=prompt_settings['dictionary_cache'],
            cache_capacity=prompt_settings['cache_capacity'],
            cache_clear_time=prompt_settings['cache_clear_time'],
        )
        parameters = Parameters(
            prompt_manager=prompt_manager,
            configuration_dict=llm_settings
        )
        
        chat = chat_manager(
            char_name=char_name,
            completion_client=completion_client,
            vision_client=vision_client,
            params=parameters,
        )
        
        return chat
