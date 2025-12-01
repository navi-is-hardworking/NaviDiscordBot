

const visionOptions = {
    "Fireworks": {
        "https://api.fireworks.ai/inference/v1/chat/completions": {
            "Llama-4 Scout V": "accounts/fireworks/models/llama4-scout-instruct-basic",
            "Llama-4 Maverick V": "accounts/fireworks/models/llama4-maverick-instruct-basic",
            "Qwen-2.5 32B V": "accounts/fireworks/models/qwen2p5-vl-32b-instruct",
        }
    },
    "TogetherAI": {
        "https://api.together.xyz/v1/chat/completions": {
            "Llama-Vision-Free": "meta-llama/Llama-Vision-Free",
        }
    }
};

const modelOptions = {
    "Fireworks": {
        "https://api.fireworks.ai/inference/v1/chat/completions": {
            "Llama-3.1 8B": "accounts/fireworks/models/llama-v3p1-8b-instruct",
            "Llama-3.1 70B": "accounts/fireworks/models/llama-v3p1-70b-instruct",
            "Llama-3.1 405B": "accounts/fireworks/models/llama-v3p1-405b-instruct",
            "Llama-3.3 70B": "accounts/fireworks/models/llama-v3p3-70b-instruct",
            "Llama-4 Scout V": "accounts/fireworks/models/llama4-scout-instruct-basic",
            "Llama-4 Maverick V": "accounts/fireworks/models/llama4-maverick-instruct-basic",
            "Qwen-2.5 32B V": "accounts/fireworks/models/qwen2p5-vl-32b-instruct",
            "Qwen-3 30B": "accounts/fireworks/models/qwen3-30b-a3b",
            "Qwen-3 235B": "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
        }
    },
    "TogetherAI": {
        "https://api.together.xyz/v1/chat/completions": {
            "Llama-3.3 70B Free": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
            "Llama-Vision-Free": "meta-llama/Llama-Vision-Free",
            "Deepseek Free": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
            "Llama-3.3 70B": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        }
    },
    "Groq": {
        "https://api.groq.com/openai/v1/chat/completions": {
            "Llama-4 Maverick (1k rpd)": "meta-llama/llama-4-maverick-17b-128e-instruct",
            "Llama-4 Scout (1k rpd)": "meta-llama/llama-4-scout-17b-16e-instruct",
            "Llama-3.1 8B Instant (14k rpd)": "llama-3.1-8b-instant",
            "Llama-3.3 70B Ver (1k rpd)": "llama-3.3-70b-versatile",
            "Llama-3 70B (8k context 14k rpd)": "llama3-70b-8192",
        }
    }
};

let settingsSchema = {
    _global: {
        enabled: {
            title: 'Bot Enabled',
            type: 'boolean',
            tooltip: 'Enable or disable this bot',
            default: true
        },
        bot_token: {
            title: 'Discord Bot Token',
            type: 'text',
            tooltip: 'Discord Bot Token',
            default: "YOUR_BOT_NAME_BOT_TOKEN"
        },
        prompt_settings: {
            title: 'Character Settings',
            fields: {
                prompt_head: {
                    title: 'Prompt Head',
                    type: 'text',
                    multiline: true,
                    textareaSize: 'large',
                    tooltip: 'The main part of the prompt. Add style guidelines and Character definition here.',
                    default: ""
                },
                dictionary_cache_header: {
                    title: 'Memory Cache Header',
                    type: 'text',
                    multiline: true,
                    textareaSize: 'large',
                    tooltip: '(Optional) Header text for the dictionary_cache section. Tell the bot what the dictionary_cache means. ie. # Memories, # Notes:, # Response examples... etc...',
                    default: ""
                },
                cache_capacity: {
                    title: 'Memory Capacity',
                    type: 'number',
                    min: 1,
                    max: 20,
                    tooltip: 'Max number of messages to keep in cache',
                    default: 4
                },
                cache_clear_time: {
                    title: 'Memory Expiration Time (seconds)',
                    type: 'number',
                    min: 0,
                    tooltip: 'The amount of time (second) an item can exist in the cache without being triggered before it is removed. Reducing this can lower AI fixating on a single topic as long as the keyword is not being mentioned repeatedly. Set it too low, though, and it might leave the context before the AI gets a chance to respond.',
                    default: 300
                },
                dictionary_cache: {
                    title: 'Memory Cache',
                    type: 'dictionary',
                    tooltip: 'Mini Rag generation for model knowledge. Keywords separated by spaces will retrieve the memory. You can set tons of these to increase the diverity and knowledge of the bots responses. Make sure all the keys are unique and have no special characters. If you find a item popping up too often, try reducing the keyword scope. For example if you set an entry like: key-> like | item-> You like to eat pancakes, Then its likely this item will get stuck in their memory very frequently. You can change it to key-> pancake pancakes | item-> You like to eat pancakes, and this will make it show up only when pancake or pancakes is mentioned.',
                    default: {}
                },
                prompt_tail: {
                    title: 'Prompt Tail',
                    type: 'text',
                    multiline: false,
                    textareaSize: 'large',
                    tooltip: '(Optional) Final note for the model. Example: You are chatting in a discord server. You can set /no_think here for Qwen think models too.',
                    default: ""
                },
                case_sensitive_replacements: {
                    title: 'Case Sensitive Replacements',
                    type: 'boolean',
                    tooltip: 'When replacing phrases, the keys will be case sensitive when true',
                    default: false
                },
                replacement_dictionary: {
                    title: 'Replacement Dictionary',
                    type: 'dictionary',
                    tooltip: 'Experimental: Replace coffee -> <a:BunnyDrinkingTatlsCoffee:1367856945112940624>. Currently subsitutions based on \w definition',
                    default: {'wow': '😱'}
                },
            }
        },
        llm_settings: {
            title: 'LLM Settings',
            fields: {
                provider: {
                    title: 'Provider',
                    type: 'text',
                    tooltip: 'Primary model that will be used for generation. This model will be replaced if CUSTOM_COMPLETION_URL, CUSTOM_COMPLETION_MODEL, and CUSTOM_COMPLETION_KEY are set manually in .env',
                    hidden: true,
                    default: "Groq" // Static default value based on original modelOptions
                },
                endpoint: {
                    title: 'Endpoint',
                    type: 'text',
                    hidden: true,
                    default: "https://api.groq.com/openai/v1/chat/completions" // Static default value
                },
                model: {
                    title: 'Model',
                    type: 'text',
                    hidden: true,
                    default: "llama3-70b-8192"
                },
                backup_models: {
                    title: 'Backup LLM Models',
                    type: 'array',
                    tooltip: 'List of backup LLM models to try if the primary fails. Ordered by preference.',
                    default: [],
                    itemSchema: {
                        provider: { title: 'Provider', type: 'select', options: ["Fireworks", "TogetherAI"], tooltip: "Provider for this backup LLM." },
                        endpoint: { title: 'Endpoint', type: 'text', hidden: true, default: null },
                        model: { title: 'Model', type: 'select', options: {}, tooltip: "Model for this backup LLM (populates based on provider).", default: null }
                    }
                },
                max_context_length: {
                    title: 'Max Context Length (chars)',
                    type: 'number',
                    min: 0,
                    max: 24000,
                    tooltip: 'Maximum length (characters) of message context (excluding prompt) to use in generation',
                    default: 3000
                },
                min_context_length: {
                    title: 'Min Context Length (chars)',
                    type: 'number',
                    min: 0,
                    max: 24000,
                    tooltip: 'The length (characters) to truncate the message context down to after chat_clear_time interval. (This keeps the context warm and prevents certain bad responses, ie model saying \'I\'m new here\').',
                    default: 0
                },
                max_tokens: {
                    title: 'Max Tokens',
                    type: 'number',
                    min: 1,
                    max: 4096,
                    tooltip: 'Maximum number of tokens to generate in the model response. Below 100 tokens is recommended for short responses and to keep costs low',
                    default: 100
                },
                temperature: {
                    title: 'Temperature',
                    type: 'number',
                    min: 0,
                    max: 2,
                    step: 0.1,
                    tooltip: "Regulates the randomness in token selection during text generation. Higher values means more diversity in token selection but setting it too high can result in gibberish outputs. (safe range from 0 to 1)",
                    default: 0.7
                },
                top_p: {
                    title: 'Top P',
                    type: 'number',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    tooltip: "Filters token selection range based on probability. A value of 1 means all tokens in the vocabulary are considered for selection based on their probabilities. Lower values restrict selection to only the most likely tokens.",
                    default: 1
                },
                top_k: {
                    title: 'Top K',
                    type: 'number',
                    min: 1,
                    max: 100,
                    tooltip: "Limits token selection to only the top k most probable tokens at each generation step. With value 50, the model considers only the 50 highest probability tokens when deciding what to generate next, discarding all other possibilities.",
                    default: 50
                },
                frequency_penalty: {
                    title: 'Frequency Penalty',
                    type: 'number',
                    min: 0,
                    max: 2,
                    step: 0.1,
                    tooltip: "Reduces token repetition, scales up based on the number of times a token has occured the context",
                    default: 1
                },
                presence_penalty: {
                    title: 'Presence Penalty',
                    type: 'number',
                    min: 0,
                    max: 2,
                    step: 0.1,
                    tooltip: "Reduces the likelyhood a token will be selected if it has already occured in the context. (Unlike frequency penalty it only cares if the token has occured at all in the text, rather than the number of occurences)",
                    default: 0
                },
                n: {
                    title: 'N (Responses)',
                    type: 'number',
                    min: 1,
                    max: 5,
                    tooltip: "Number of responses (mainly for testing, wastes tokens in most cases)",
                    default: 1
                },
                stop: {
                    title: 'Stop Tokens',
                    type: 'array',
                    itemType: 'text',
                    tooltip: "List of tokens that will cause the generation to stop when reached. (You can leave this empty most of the time in chat models. But it can be very useful when using completion models. For example, you can set closing quotes as the stop token to get the model to finish the dialogue.)",
                    default: []
                },
                reminder: {
                    title: 'Reminder Text',
                    type: 'text',
                    multiline: true,
                    textareaSize: 'large',
                    tooltip: 'Optional reminder text for the model. Recommended not to use for now',
                    default: ""
                }
            }
        },
        vision_settings: {
            title: 'Vision Settings',
            fields: {
                vision_enabled: {
                    title: 'Vision Enabled',
                    type: 'boolean',
                    tooltip: 'Vision Enabled or disabled for this bot',
                    default: false
                },
                vision_prompt: {
                    title: 'Vision Prompt',
                    type: 'text',
                    multiline: true,
                    textareaSize: 'large',
                    tooltip: 'System prompt for vision requests. Define how the vision model should interpret images.',
                    default: "Describe the image in a short but dense description. Use keywords and positional terms only. # Example: green house on hill, surrounded by dense ivy. Dark night. Single Dim lamp on left side of porch"
                },
                provider: {
                    title: 'Provider',
                    type: 'text',
                    hidden: true,
                    default: "Fireworks" // Static default value based on original visionOptions
                },
                endpoint: {
                    title: 'Endpoint',
                    type: 'text',
                    hidden: true,
                    default: "https://api.fireworks.ai/inference/v1/chat/completions" // Static default value
                },
                model: {
                    title: 'Model',
                    type: 'text',
                    hidden: true,
                    default: "accounts/fireworks/models/llama4-scout-instruct-basic" // Static default value
                },
                backup_models: {
                    title: 'Backup Vision Models',
                    type: 'array',
                    tooltip: 'List of backup vision models.',
                    default: [],
                    itemSchema: {
                        provider: { title: 'Provider', type: 'select', options: ["Fireworks", "TogetherAI"], tooltip: "Provider for backup vision model." },
                        endpoint: { title: 'Endpoint', type: 'text', hidden: true, default: null },
                        model: { title: 'Model', type: 'select', options: {}, tooltip: "Backup vision model.", default: null }
                    }
                },
                max_vision_queries_per_interval: {
                    title: 'Max Vision Queries / Interval',
                    type: 'number',
                    min: 0,
                    tooltip: 'Max number of images that can be read per response limit interval',
                    default: 4
                },
                vision_limit_interval: {
                    title: 'Vision Limit Interval (seconds)',
                    type: 'number',
                    min: 0,
                    tooltip: 'interval at which vision is in time our ot time limit',
                    default: 120
                },
            }
        },
        response_limits : {
            title: 'Response & Interaction Limits',
            fields: {
                response_limit_interval: {
                    title: 'Response Limit Interval (seconds)',
                    type: 'number',
                    min: 0,
                    tooltip: 'Time interval for rate limiting (seconds)',
                    default: 240
                },
                max_bot_response_count_per_interval: {
                    title: 'Max Bot Responses / Interval',
                    type: 'number',
                    min: 1,
                    tooltip: 'Number of responses from the bot allowed within the response_limit_interval',
                    default: 20
                },
                max_user_input_message_length: {
                    title: 'Max User Input Length (chars)',
                    type: 'number',
                    min: 1,
                    tooltip: 'Maximum length of user messages (in characters)',
                    default: 300
                },
                chat_clear_time: {
                    title: 'Chat Clear Time (seconds)',
                    type: 'number',
                    min: 0,
                    tooltip: 'Time (seconds) before chat history is truncated (see min_context_length)',
                    default: 900
                },
                monitored_servers: {
                    title: 'Monitored Server IDs',
                    type: 'array',
                    itemType: 'text',
                    tooltip: 'List of Servers the bot can respond in globally when called with @BotName',
                    default: []
                },
                monitored_channels: {
                    title: 'Monitored Channel IDs',
                    type: 'array',
                    itemType: 'text',
                    tooltip: 'Channel IDs that the bot can read and write to',
                    default: []
                },
                partial_ignore_list: {
                    title: 'Partial Ignore List (User/Bot IDs)',
                    type: 'array',
                    itemType: 'text',
                    tooltip: 'IDs of users or bots that the bot will read, but will not trigger a response. This can be used if you have two bots and you want them to be able to hear each other, but not to get stuck in an infinite loop.',
                    default: []
                },
                full_ignore_list: {
                    title: 'Full Ignore List (User/Bot IDs)',
                    type: 'array',
                    itemType: 'text',
                    tooltip: 'IDs that the bot will neither read nor respond to.',
                    default: []
                },
                admins: {
                    title: 'Admin User IDs',
                    type: 'array',
                    itemType: 'text',
                    tooltip: 'User IDs that are administrators for this bot. Can use admin commands.',
                    default: []
                },
                banned_inputs: {
                    title: 'Banned Phrases',
                    type: 'array',
                    itemType: 'text',
                    tooltip: "List of banned phrases. Bot will ignore any user messages that matches the regex",
                    default: []
                },
                typing_delay_range: {
                    title: 'Typing Delay Range (seconds)',
                    type: 'range',
                    min: 0,
                    max: 60,
                    tooltip: 'Random number within the range is selected and the bot will spend that much time tyiping to create a typing effect.',
                    default: [1, 12]
                },
                random_occurences_enabled: {
                    title: 'Bot Responds on @Mention',
                    type: 'boolean',
                    tooltip: '@BotName and bot will respond in any SERVER added to monitored SERVER list.',
                    default: false
                },
                mentions_per_interval: {
                    title: 'Limit @Mentions Responses', // Main title for the setting
                    type: 'range',
                    min: 0,
                    max: 2000,
                    tooltip: 'Defines the maximum number of times a bot will respond to @Mentions within a given duration window',
                    default: [5, 120],
                    value1Label: 'Response Count:',           // Custom label for the first input
                    value2Label: 'Per Seconds:',     // Custom label for the second input
                    valueSeparator: ''             // No text separator like "to"
                }
            }
        }
    }
};

