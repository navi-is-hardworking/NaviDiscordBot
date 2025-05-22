from discord_llama import chat_manager
from prompt_manager import PromptManager
from parameters import Parameters
from vision_processor import VisionProcessor
from completion_generator import CompletionGenerator
from provider_settings import LLM_Provider

def create_llm(char_name: str, settings: dict):
        
        prompt_settings = settings["prompt_settings"]
        vision_settings = settings["vision_settings"]
        llm_settings = settings["llm_settings"]
        
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
            max_vision_queries_per_interval=vision_settings["max_vision_queries_per_interval"],
            vision_limit_interval=vision_settings["vision_limit_interval"],
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
        
        # phew... now add them to the manager
        chat = chat_manager(
            completion_client=completion_client,
            vision_client=vision_client,
            params=parameters,
        )
        
        return chat
