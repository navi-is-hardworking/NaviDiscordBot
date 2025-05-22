from dataclasses import dataclass
import os
from dotenv import load_dotenv
load_dotenv()

API_KEY_MAP = {
    "TogetherAI": "TOGETHERAI_API_KEY",
    "Fireworks": "FIREWORKS_API_KEY"
}

@dataclass
class LLM_Provider:
    provider: str
    endpoint: str
    model: str
    
    def __post_init__(self):
        self.api_key = os.environ.get(API_KEY_MAP[self.provider])
