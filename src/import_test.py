#%%


from importlib import import_module
mod = "params"
params = import_module(mod)
print(params.MAX_TOKENS)


#%%

import json5

json_path = "settings.json"
with open(json_path, "r", encoding='utf-8') as f:
    data = json5.load(f)

for character, settings in data.items():
    print(character)
    
#%%

from config_parser import Configurations
import json5

parser = Configurations("settings.json")

parser.parse()

bot_settings = parser.bot_settings_map['Navi']
print(bot_settings.__dict__)

#%%

from config_parser import Configurations, parse_prompt

prompt_path = "prompt.txt"

head, tail = parse_prompt(prompt_path)
print(head)
print(tail)







































