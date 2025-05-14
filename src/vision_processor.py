import aiohttp
from together import AsyncTogether
from logger import log
import json
import os
import re
from rate_limit import RateLimit
from dotenv import load_dotenv
load_dotenv()

class VisionProcessor:
    
    def __init__(self, prompt = "", max_length=300, max_requests=3, interval=60):
        
        self.enabled = False
        if len(prompt) > 0:
            self.prompt = prompt
        else:
            self.prompt = "Describe the image in a short but dense description. Use keywords and positional terms only. # Example: green house on hill, surrounded by dense ivy. Dark night. Single Dim lamp on left side of porch"
            
        self.api_key = os.environ.get("API_BOT_TOKEN")
        self.url = os.environ.get("VISION_ENDPOINT")
        self.model = os.environ.get("VISION_MODEL", "accounts/fireworks/models/llama4-scout-instruct-basic")
        self.rate_limiter = RateLimit(limit=max_requests, interval=interval)
        
        ignored_words = [".", ",", "?", "!", ";"]
        ignored_words = sorted(ignored_words, key=len, reverse=True)
        pattern_str = '|'.join(re.escape(word) for word in ignored_words)
        self.pattern = re.compile(pattern_str, re.IGNORECASE)
        self.max_length = max_length
        
        print(self.url and self.model) 
        self.enabled = self.url and self.model
    
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
    
    async def read_image(self, image_url, model=None, timeout=20, retry=True):
        if not self.enabled:
            log.warning("tried reading image but image not enabled")
            return ""
        
        if not model:
            model = self.model
        
        try:
            payload = {
                "model": model,
                "messages": [ {
                        "role": "user",
                        "content": [ {
                                "type": "text", "text": self.prompt
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
                "Authorization": f"Bearer {self.api_key}"
            }
            
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.url, json=payload, headers=headers, timeout=timeout) as response:
                    response_data = await response.text()
                    
                    log.debug(response_data)
                    response_json: dict = json.loads(response_data)
                    error = response_json.get("error", None)
                    if error and retry:
                        log.error("failed to read image, trying again with backup model")
                        return await self.read_image(image_url=image_url, model="accounts/fireworks/models/qwen2p5-vl-32b-instruct", retry=False)
                    elif error:
                        log.error("failed to read image with both models")
                        return ("", 0, 0)
                    
                    return (self.purne_response(
                        response_json['choices'][0]['message']['content'],
                    ),
                    response_json['usage']['prompt_tokens'],
                    response_json['usage']['completion_tokens'])
                    
        except Exception as e:
            log.warning(f"failed to read image {e}")
            log.debug(f"image_url type: {type(image_url)}")
            log.debug(f"key type: {type(self.api_key)}")
            log.debug(f"prompt: {type(self.prompt)}")
            log.debug(f"url: {type(self.url)}")
            return ""
        
