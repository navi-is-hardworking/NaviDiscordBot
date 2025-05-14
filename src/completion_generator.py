#%%

import aiohttp
import json
from logger import log
import os
from dotenv import load_dotenv
load_dotenv()

class CompletionGenerator:
    def __init__(
        self,
        api_key=None,
    ):
        self.url = os.environ.get('COMPLETION_ENDOINT', "https://api.fireworks.ai/inference/v1/chat/completions")
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = os.environ.get('API_BOT_TOKEN')
            
        self.model = os.environ.get('MODEL', "")
        
    async def fetch_completion(self, payload, timeout=20):
        
        if self.model:
            payload['model'] = self.model
            
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(self.url, json=payload, headers=headers, timeout=timeout) as response:
                try: 
                    response_data = await response.text()
                    response_json = json.loads(response_data)
                    return response_json
                except Exception as e:
                    log.error(f"failed to get completion generation: {e}, {response_data}")