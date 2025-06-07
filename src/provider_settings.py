from dataclasses import dataclass
import os
from dotenv import load_dotenv
load_dotenv()

# API_KEY_MAP = {
#     "TogetherAI": "TOGETHERAI_API_KEY",
#     "Fireworks": "FIREWORKS_API_KEY"
# }

@dataclass
class LLM_Provider:
    provider: str
    endpoint: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    request_count: int = 0
    
    def __post_init__(self):
        key_name = self.provider.upper() + "_API_KEY"
        self.api_key = os.environ.get(key_name)
