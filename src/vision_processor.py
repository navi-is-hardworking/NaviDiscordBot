import aiohttp
from logger import log
import json
import os
import re
import time
from rate_limit import RateLimit
from provider_settings import LLM_Provider
from dotenv import load_dotenv
load_dotenv()

class VisionProcessor:
    
    def __init__(
        self,
        vision_enabled: bool,
        primary_provider: LLM_Provider,
        backup_providers: list[LLM_Provider],
        vision_prompt: str,
        max_output_length=500
    ):
        self.enabled: bool = vision_enabled
        self.providers: list[LLM_Provider] = backup_providers
        self.providers.insert(0, primary_provider)
        self.vision_prompt: str = vision_prompt
        self.max_length = max_output_length
        
        ignored_words = [".", ",", "?", "!", ";"]
        ignored_words = sorted(ignored_words, key=len, reverse=True)
        pattern_str = '|'.join(re.escape(word) for word in ignored_words)
        self.pattern = re.compile(pattern_str, re.IGNORECASE)
        
    
    def is_vision_enabled(self):
        return self.enabled
    
    def purne_response(self, image_text):
        
        sentences = self.pattern.split(image_text.strip())
        final_text = ""
        
        for sentence in sentences:
            if len(final_text)  + len(sentence) < self.max_length:
                final_text += sentence
            else: 
                break
            
        print(final_text)
        return final_text
    
    def log_usage(self):
        stringl = []
        stringl.append("VISION USAGE STATS")
        for provider in self.providers:
            stringl.append(f"{provider.provider}: {provider.model}\n    total requests: {provider.request_count}\n    input tokens: {provider.input_tokens}\n    output tokens: {provider.output_tokens}\n    failed requests: {provider.failed_request_count}\n")
        
        return '\n'.join(stringl)
    
    async def read_image(self, image_url, provider_index: int=0, timeout=15):
        if not self.enabled:
            log.warning("tried reading image but image not enabled")
            return ""
            
        if provider_index >= len(self.providers):
            log.error(f"(vision) tried to access provider at index ({provider_index}) but was out of range")
            return "image failed to load"
        
        provider = self.providers[provider_index]
        if provider_index > 0:
            log.debug(f"retrying image generation with {provider.endpoint}, {provider.model}")
        
        try:
            payload = {
                "model": provider.model,
                "messages": [ {
                        "role": "user",
                        "content": [ {
                                "type": "text", "text": self.vision_prompt
                            }, {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 200,
                "stream": False
            }
            
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {provider.api_key}"
            }
            
            
            async with aiohttp.ClientSession() as session:
                async with session.post(provider.endpoint, json=payload, headers=headers, timeout=timeout) as response:
                    response_data = await response.text()
                    
                    log.debug(response_data)
                    response_json: dict = json.loads(response_data)
                    error = response_json.get("error", None)
                    if error:
                        log.error(f"error getting image from {provider.endpoint}: {provider.model}... {response_data}")
                        return await self.read_image(image_url=image_url, provider_index=provider_index+1)
                    elif error:
                        log.error("failed to read image with both models")
                        return ("", 0, 0)
                    
                    provider.request_count += 1
                    provider.input_tokens += response_json.get('usage', {}).get('prompt_tokens', 0)
                    provider.output_tokens += response_json.get('usage', {}).get('completion_tokens', 0)
                    self.log_usage()
                    return self.purne_response(response_json['choices'][0]['message']['content'])
                    
        except Exception as e:
            log.warning(f"failed to read image {e}")
            log.debug(f"image_url type: {type(image_url)}")
            log.debug(f"vision_prompt: {type(self.vision_prompt)}")
            log.debug(f"url: {type(provider.endpoint)}")
            log.debug(f"model: {type(provider.model)}")
            return ""
        
