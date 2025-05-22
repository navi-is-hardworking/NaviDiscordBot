#%%

from provider_settings import LLM_Provider
import aiohttp
import json
from logger import log
import os

from dotenv import load_dotenv
load_dotenv()

class CompletionGenerator:
    def __init__(
        self,
        primairy_provider: LLM_Provider,
        backup_providers: list[LLM_Provider]
    ):
        self.providers = backup_providers
        self.providers.insert(0, primairy_provider)
        
    async def fetch_completion(self, payload, provider_index=0, timeout=15):
        
        if provider_index >= len(self.providers):
            log.error(f"tried to access provider at index ({provider_index}) but was out of range")
            return ""
            
        provider = self.providers[provider_index]
        if provider_index > 0:
            log.debug(f"retrying image generation with {provider.endpoint}, {provider.model}")
            
        payload['model'] = provider.model
            
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {provider.api_key}"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(provider.endpoint, json=payload, headers=headers, timeout=timeout) as response:
                try: 
                    response_data = await response.text()
                    # log.debug(response_data)
                    response_json: dict = json.loads(response_data)
                    error = response_json.get("error", None)
                    if error:
                        log.error(f"error getting completion from {provider.endpoint}: {provider.model}... {response_data}")
                        return await self.fetch_completion(payload=payload, provider_index=provider_index+1)
                    else:
                        return response_json
                except Exception as e:
                    log.error(f"failed to get completion generation: {e}, {response_data}")