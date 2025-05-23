let settings = {};
let activeTab = null;
let collapsedSections = {};
let botRunning = false;
let autoSaveTimer = null;
let uiInitTime = 0;
const PASSWORD_ENTRY_GRACE_PERIOD = 3000;

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
            "Qwen-3 235B": "accounts/fireworks/models/qwen3-235b-a22b",
        }
    },
    "TogetherAI": {
        "https://api.together.xyz/v1/chat/completions": {
            "Llama-3.3 70B Free": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
            "Llama-Vision-Free": "meta-llama/Llama-Vision-Free",
            "Deepseek Free": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
            "Llama-3.3 70B": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        }
    }
};

let settingsSchema = {
    _global: {
        enabled: { type: 'boolean', tooltip: 'Enable or disable this bot' },
        bot_token: { type: 'text', tooltip: 'Discord Bot Token' },
        prompt_settings: {
            prompt_head: { type: 'text', multiline: true, tooltip: 'The main part of the prompt. Add style guidelines and Character definition here.' },
            dictionary_cache_header: { type: 'text', multiline: true, tooltip: '(Optional) Header text for the dictionary_cache section. Tell the bot what the dictionary_cache means. ie. # Memories, # Notes:, # Response examples... etc...' },
            dictionary_cache: { type: 'dictionary', tooltip: 'Mini Rag generation for model knowledge. Keywords separated by spaces will retrieve the memory.' },
            cache_capacity: { type: 'number', min: 1, max: 20, tooltip: 'Max number of messages to keep in cache' },
            cache_clear_time: { type: 'number', min: 0, tooltip: 'The amount of time (second) an item can exist in the cache without being triggered before it is removed.' },
            prompt_tail: { type: 'text', multiline: true, tooltip: '(Optional) Final note for the model. Example: You are chatting in a discord server' },
        },
        llm_settings: {
            provider: { type: 'text', hidden: true },
            endpoint: { type: 'text', hidden: true },
            model: { type: 'text', hidden: true },
            backup_models: {
                type: 'array',
                tooltip: 'List of backup LLM models to try if the primary fails. Ordered by preference.',
                itemSchema: {
                    provider: { type: 'select', options: Object.keys(modelOptions), tooltip: "Provider for this backup LLM." },
                    endpoint: { type: 'text', hidden: true },
                    model: { type: 'select', options: {}, tooltip: "Model for this backup LLM (populates based on provider)." }
                }
            },
            max_context_length: { type: 'number', min: 0, max: 24000, tooltip: 'Maximum length (characters) of message context (excluding prompt) to use in generation' },
            min_context_length: { type: 'number', min: 0, max: 24000, tooltip: 'The length (characters) to truncate the message context down to after chat_clear_time interval. (This keeps the context warm and prevents certain bad responses, ie model saying \'I\'m new here\').' },
            max_tokens: { type: 'number', min: 1, max: 4096, tooltip: 'Maximum number of tokens to generate in the model response. Below 100 tokens is recommended for short responses and to keep costs low' },
            temperature: { type: 'number', min: 0, max: 2, step: 0.1, tooltip: "Regulates the randomness in token selection during text generation. Higher values means more diversity in token selection but setting it too high can result in gibberish outputs. (safe range from 0 to 1)" },
            top_p: { type: 'number', min: 0, max: 1, step: 0.05, tooltip: "Filters token selection range based on probability. A value of 1 means all tokens in the vocabulary are considered for selection based on their probabilities. Lower values restrict selection to only the most likely tokens." },
            top_k: { type: 'number', min: 1, max: 100, tooltip: "Limits token selection to only the top k most probable tokens at each generation step. With value 50, the model considers only the 50 highest probability tokens when deciding what to generate next, discarding all other possibilities." },
            frequency_penalty: { type: 'number', min: 0, max: 2, step: 0.1, tooltip: "Reduces token repetition, scales up based on the number of times a token has occured the context" },
            presence_penalty: { type: 'number', min: 0, max: 2, step: 0.1, tooltip: "Reduces the likelyhood a token will be selected if it has already occured in the context. (Unlike frequency penalty it only cares if the token has occured at all in the text, rather than the number of occurences)" },
            n: { type: 'number', min: 1, max: 5, tooltip: "Number of responses (mainly for testing, wastes tokens in most cases)" },
            stop: { type: 'array', itemType: 'text', tooltip: "List of tokens that will cause the generation to stop when reached. (You can leave this empty most of the time in chat models. But it can be very useful when using completion models. For example, you can set closing quotes as the stop token to get the model to finish the dialogue.)" },
            reminder: { type: 'text', multiline: true, tooltip: 'Optional reminder text for the model. Recommended not to use for now' }
        },
        vision_settings: {
            vision_enabled: { type: 'boolean', tooltip: 'Vision Enabled or disabled for this bot' },
            vision_prompt: { type: 'text', multiline: true, tooltip: 'System prompt for vision requests. Define how the vision model should interpret images.' },
            provider: { type: 'text', hidden: true },
            endpoint: { type: 'text', hidden: true },
            model: { type: 'text', hidden: true },
            backup_models: {
                type: 'array',
                tooltip: 'List of backup vision models.',
                itemSchema: {
                    provider: { type: 'select', options: Object.keys(visionOptions), tooltip: "Provider for backup vision model." },
                    endpoint: { type: 'text', hidden: true },
                    model: { type: 'select', options: {}, tooltip: "Backup vision model." }
                }
            },
            max_vision_queries_per_interval: { type: 'number', min: 0, tooltip: 'Max number of images that can be read per response limit interval' },
            vision_limit_interval: { type: 'number', min: 0, tooltip: 'interval at which vision is in time our ot time limit' },
        },
        response_limits : {
            response_limit_interval: { type: 'number', min: 0, tooltip: 'Time interval for rate limiting (seconds)' },
            max_bot_response_count_per_interval: { type: 'number', min: 1, tooltip: 'Number of responses from the bot allowed within the response_limit_interval' },
            max_user_input_message_length: { type: 'number', min: 1, tooltip: 'Maximum length of user messages (in characters)' },
            chat_clear_time: { type: 'number', min: 0, tooltip: 'Time (seconds) before chat history is truncated (see min_context_length)' },
            monitored_servers: { type: 'array', itemType: 'text', tooltip: 'Will ignore all messages not in this server (except for admin commands)' },
            monitored_channels: { type: 'array', itemType: 'text', tooltip: 'Channel IDs that the bot can read and write to' },
            partial_ignore_list: { type: 'array', itemType: 'text', tooltip: 'IDs of users or bots that the bot will read, but will not trigger a response' },
            full_ignore_list: { type: 'array', itemType: 'text', tooltip: 'IDs that the bot will neither read nor respond to.' },
            admins: { type: 'array', itemType: 'text', tooltip: 'User IDs that are administrators for this bot. Can use admin commands.' },
            typing_delay_range: { type: 'range', min: 0, max: 60, tooltip: 'Random number within the range is selected and the bot will spend that much time tyiping to create a typing effect.' },
            random_occurences_enabled: { type: 'boolean', tooltip: 'Bot can randomly pop up and respond in any channel. Bot will also respond when name is called. Regardless of monitored channels (but only in monitored servers)' },
        }
    }
};

function getApiKeyEnvName(providerName) {
    if (!providerName) return null;
    return `${providerName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_API_KEY`;
}

function getFirstProviderAndModelDetails(isVision = false) {
    const optionsToSearch = isVision ? visionOptions : modelOptions;
    for (const providerName in optionsToSearch) {
        const endpoints = optionsToSearch[providerName];
        for (const endpointUrl in endpoints) {
            const modelsAtEndpoint = endpoints[endpointUrl];
            if (Object.keys(modelsAtEndpoint).length > 0) {
                const firstModelDisplayName = Object.keys(modelsAtEndpoint)[0];
                return { provider: providerName, endpoint: endpointUrl, model: modelsAtEndpoint[firstModelDisplayName] };
            }
        }
    }
    const fallbackOptions = isVision ? visionOptions : modelOptions;
    const firstProvider = Object.keys(fallbackOptions)[0];
    if (!firstProvider) return { provider: null, endpoint: null, model: null };
    const firstEndpoint = Object.keys(fallbackOptions[firstProvider])[0];
    if (!firstEndpoint) return { provider: firstProvider, endpoint: null, model: null };
    const models = fallbackOptions[firstProvider][firstEndpoint];
    const firstModelName = Object.keys(models)[0];
    if (!firstModelName) return { provider: firstProvider, endpoint: firstEndpoint, model: null };
    return { provider: firstProvider, endpoint: firstEndpoint, model: models[firstModelName] };
}

const defaultLLMSelections = getFirstProviderAndModelDetails(false);
let defaultVisionSelections = getFirstProviderAndModelDetails(true);

if (!defaultVisionSelections.provider && Object.keys(visionOptions).length === 0) {
    defaultVisionSelections = { provider: defaultLLMSelections.provider, endpoint: defaultLLMSelections.endpoint, model: defaultLLMSelections.model };
} else if (!defaultVisionSelections.provider && Object.keys(visionOptions).length > 0) {
    const firstVisionProvider = Object.keys(visionOptions)[0];
    if (firstVisionProvider) {
        const firstVisionEndpoint = Object.keys(visionOptions[firstVisionProvider])[0];
        const modelsAtFirstEndpoint = visionOptions[firstVisionProvider][firstVisionEndpoint] || {};
        const firstModelKey = Object.keys(modelsAtFirstEndpoint)[0];
        defaultVisionSelections = {
            provider: firstVisionProvider,
            endpoint: firstVisionEndpoint || null,
            model: firstModelKey ? modelsAtFirstEndpoint[firstModelKey] : null
        };
    } else {
        defaultVisionSelections = { provider: null, endpoint: null, model: null };
    }
}

const defaultSettings = {
    enabled: true,
    bot_token: "YOUR_BOT_NAME_BOT_TOKEN",
    prompt_settings: {
        prompt_head: "", prompt_tail: "", dictionary_cache_header: "", dictionary_cache: {},
        cache_capacity: 3, cache_clear_time: 300
    },
    llm_settings: {
        provider: defaultLLMSelections.provider,
        endpoint: defaultLLMSelections.endpoint,
        model: defaultLLMSelections.model,
        backup_models: [],
        max_context_length: 3000, min_context_length: 0, max_tokens: 100,
        temperature: 0.7, top_p: 1, top_k: 50, frequency_penalty: 1, presence_penalty: 0,
        n: 1, stop: [], reminder: ""
    },
    vision_settings: {
        vision_enabled: false,
        vision_prompt: "Describe the image in a short but dense description. Use keywords and positional terms only. # Example: green house on hill, surrounded by dense ivy. Dark night. Single Dim lamp on left side of porch",
        provider: defaultVisionSelections.provider,
        endpoint: defaultVisionSelections.endpoint,
        model: defaultVisionSelections.model,
        backup_models: [],
        max_vision_queries_per_interval: 4,
        vision_limit_interval: 120,
    },
    response_limits: {
        max_user_input_message_length: 300, response_limit_interval: 240,
        max_bot_response_count_per_interval: 20, chat_clear_time: 900,
        monitored_channels: [], admins: [], partial_ignore_list: [], full_ignore_list: [],
        typing_delay_range: [1, 12], random_occurences_enabled: false
    }
};

function ensureSettingsExist(modelName) {
    if (!settings[modelName] || typeof settings[modelName] !== 'object') {
        settings[modelName] = JSON.parse(JSON.stringify(defaultSettings));
        settings[modelName].bot_token = `${modelName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
    }
    const botData = settings[modelName];

    if (botData.bot_settings && botData.bot_settings.enabled !== undefined) {
        botData.enabled = botData.bot_settings.enabled;
        delete botData.bot_settings;
    }
    if (botData.enabled === undefined) {
        botData.enabled = defaultSettings.enabled;
    }

    if (!botData.bot_token || botData.bot_token === "BOT_TOKEN" || botData.bot_token === defaultSettings.bot_token) {
        botData.bot_token = `${modelName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
    } else if (typeof botData.bot_token === 'string' && botData.bot_token.startsWith('ENV:')) {
        botData.bot_token = botData.bot_token.substring(4);
    }

    if (typeof botData.prompt_settings !== 'object' || botData.prompt_settings === null) {
        botData.prompt_settings = JSON.parse(JSON.stringify(defaultSettings.prompt_settings));
    }
    if (botData.prompt_settings.hasOwnProperty('dictionary')) {
        if (!botData.prompt_settings.hasOwnProperty('dictionary_cache')) {
            botData.prompt_settings.dictionary_cache = botData.prompt_settings.dictionary;
        }
        delete botData.prompt_settings.dictionary;
    }
    if (botData.prompt_settings.hasOwnProperty('dictionary_header')) {
        if (!botData.prompt_settings.hasOwnProperty('dictionary_cache_header')) {
            botData.prompt_settings.dictionary_cache_header = botData.prompt_settings.dictionary_header;
        }
        delete botData.prompt_settings.dictionary_header;
    }
    if (typeof botData.prompt_settings.dictionary_cache !== 'object' || botData.prompt_settings.dictionary_cache === null) {
        botData.prompt_settings.dictionary_cache = defaultSettings.prompt_settings.dictionary_cache !== undefined
            ? JSON.parse(JSON.stringify(defaultSettings.prompt_settings.dictionary_cache))
            : {};
    }
    if (typeof botData.prompt_settings.dictionary_cache_header !== 'string') {
        botData.prompt_settings.dictionary_cache_header = defaultSettings.prompt_settings.dictionary_cache_header !== undefined
            ? defaultSettings.prompt_settings.dictionary_cache_header
            : "";
    }

    if (typeof botData.llm_settings !== 'object' || botData.llm_settings === null) {
        botData.llm_settings = JSON.parse(JSON.stringify(defaultSettings.llm_settings));
    }

    let llmTempProvider = botData.llm_settings.provider;
    let llmTempEndpoint = botData.llm_settings.endpoint;
    let llmTempModel = botData.llm_settings.model;

    if (botData.llm_settings.hasOwnProperty('llm_provider')) {
        if (llmTempProvider === undefined) llmTempProvider = botData.llm_settings.llm_provider;
        delete botData.llm_settings.llm_provider;
    }
    if (botData.llm_settings.hasOwnProperty('llm_endpoint')) {
        if (llmTempEndpoint === undefined) llmTempEndpoint = botData.llm_settings.llm_endpoint;
        delete botData.llm_settings.llm_endpoint;
    }
    if (botData.llm_settings.hasOwnProperty('llm_model')) {
        if (llmTempModel === undefined) llmTempModel = botData.llm_settings.llm_model;
        delete botData.llm_settings.llm_model;
    }

    if (botData.hasOwnProperty('llm_provider')) {
        if (llmTempProvider === undefined) llmTempProvider = botData.llm_provider;
        delete botData.llm_provider;
    }
    if (botData.hasOwnProperty('llm_endpoint')) {
        if (llmTempEndpoint === undefined) llmTempEndpoint = botData.llm_endpoint;
        delete botData.llm_endpoint;
    }
    if (botData.hasOwnProperty('llm_model')) {
        if (llmTempModel === undefined) llmTempModel = botData.llm_model;
        delete botData.llm_model;
    }

    botData.llm_settings.provider = llmTempProvider;
    botData.llm_settings.endpoint = llmTempEndpoint;
    botData.llm_settings.model = llmTempModel;

    if (typeof botData.llm_settings.model === 'string' && botData.llm_settings.provider === undefined) {
        const oldModelIdOrName = botData.llm_settings.model;
        let migrated = false;
        for (const pName in modelOptions) {
            for (const epUrl in modelOptions[pName]) {
                const modelsAtEndpoint = modelOptions[pName][epUrl];
                if (Object.values(modelsAtEndpoint).includes(oldModelIdOrName)) {
                    botData.llm_settings.provider = pName; botData.llm_settings.endpoint = epUrl; botData.llm_settings.model = oldModelIdOrName; migrated = true; break;
                }
                if (modelsAtEndpoint[oldModelIdOrName]) {
                    botData.llm_settings.provider = pName; botData.llm_settings.endpoint = epUrl; botData.llm_settings.model = modelsAtEndpoint[oldModelIdOrName]; migrated = true; break;
                }
            }
            if (migrated) break;
        }
        if (!migrated) {
            botData.llm_settings.provider = defaultSettings.llm_settings.provider;
            botData.llm_settings.endpoint = defaultSettings.llm_settings.endpoint;
            botData.llm_settings.model = defaultSettings.llm_settings.model;
        }
    }

    if (botData.llm_settings.provider === undefined) botData.llm_settings.provider = defaultSettings.llm_settings.provider;
    if (botData.llm_settings.endpoint === undefined) botData.llm_settings.endpoint = defaultSettings.llm_settings.endpoint;
    if (botData.llm_settings.model === undefined) botData.llm_settings.model = defaultSettings.llm_settings.model;

    if (botData.response_limits && botData.response_limits.vision_enabled !== undefined) {
        if (typeof botData.vision_settings !== 'object' || botData.vision_settings === null) {
            botData.vision_settings = JSON.parse(JSON.stringify(defaultSettings.vision_settings));
        }
        botData.vision_settings.vision_enabled = botData.response_limits.vision_enabled;
        delete botData.response_limits.vision_enabled;
    }

    if (typeof botData.vision_settings !== 'object' || botData.vision_settings === null) {
        botData.vision_settings = JSON.parse(JSON.stringify(defaultSettings.vision_settings));
    } else {
        if (botData.vision_settings.hasOwnProperty('vision_models') && !botData.vision_settings.hasOwnProperty('backup_models')) {
            botData.vision_settings.backup_models = botData.vision_settings.vision_models;
            delete botData.vision_settings.vision_models;
        }
    }
    if (botData.vision_settings.backup_models === undefined) {
        botData.vision_settings.backup_models = JSON.parse(JSON.stringify(defaultSettings.vision_settings.backup_models || []));
    } else if (!Array.isArray(botData.vision_settings.backup_models)) {
        botData.vision_settings.backup_models = JSON.parse(JSON.stringify(defaultSettings.vision_settings.backup_models || []));
    }

    let visionTempProvider = botData.vision_settings.provider;
    let visionTempEndpoint = botData.vision_settings.endpoint;
    let visionTempModel = botData.vision_settings.model;

    if (botData.vision_settings.hasOwnProperty('vision_provider')) {
        if (visionTempProvider === undefined) visionTempProvider = botData.vision_settings.vision_provider;
        delete botData.vision_settings.vision_provider;
    }
    if (botData.vision_settings.hasOwnProperty('vision_endpoint')) {
        if (visionTempEndpoint === undefined) visionTempEndpoint = botData.vision_settings.vision_endpoint;
        delete botData.vision_settings.vision_endpoint;
    }
    if (botData.vision_settings.hasOwnProperty('vision_model')) {
        if (visionTempModel === undefined) visionTempModel = botData.vision_settings.vision_model;
        delete botData.vision_settings.vision_model;
    }

    botData.vision_settings.provider = visionTempProvider;
    botData.vision_settings.endpoint = visionTempEndpoint;
    botData.vision_settings.model = visionTempModel;

    if (botData.vision_settings && typeof botData.vision_settings.model === 'string' && botData.vision_settings.provider === undefined) {
        const oldVisionModelIdOrName = botData.vision_settings.model;
        let migratedVision = false;
        for (const pName in visionOptions) {
            for (const epUrl in visionOptions[pName]) {
                const modelsAtEndpoint = visionOptions[pName][epUrl];
                if (Object.values(modelsAtEndpoint).includes(oldVisionModelIdOrName)) {
                    botData.vision_settings.provider = pName; botData.vision_settings.endpoint = epUrl; botData.vision_settings.model = oldVisionModelIdOrName; migratedVision = true; break;
                }
                if (modelsAtEndpoint[oldVisionModelIdOrName]) {
                    botData.vision_settings.provider = pName; botData.vision_settings.endpoint = epUrl; botData.vision_settings.model = modelsAtEndpoint[oldVisionModelIdOrName]; migratedVision = true; break;
                }
            }
            if (migratedVision) break;
        }
        if (!migratedVision) {
            botData.vision_settings.provider = defaultSettings.vision_settings.provider;
            botData.vision_settings.endpoint = defaultSettings.vision_settings.endpoint;
            botData.vision_settings.model = defaultSettings.vision_settings.model;
        }
    }

    const visionDefaults = defaultSettings.vision_settings || {};
    for (const key in visionDefaults) {
        if (botData.vision_settings[key] === undefined) {
            botData.vision_settings[key] = JSON.parse(JSON.stringify(visionDefaults[key]));
        }
    }
    if (botData.vision_settings.vision_enabled && botData.vision_settings.provider === undefined) {
        const inferredVision = getFirstProviderAndModelDetails(true);
        botData.vision_settings.provider = inferredVision.provider ?? defaultSettings.vision_settings.provider;
        botData.vision_settings.endpoint = inferredVision.endpoint ?? defaultSettings.vision_settings.endpoint;
        botData.vision_settings.model = inferredVision.model ?? defaultSettings.vision_settings.model;
    }

    const defaultCategories = Object.keys(defaultSettings);
    for (const category of defaultCategories) {
        if (category === 'enabled' || category === 'bot_token') {
            continue;
        }
        if (typeof defaultSettings[category] === 'object' && defaultSettings[category] !== null) {
            if (typeof botData[category] !== 'object' || botData[category] === null) {
                botData[category] = JSON.parse(JSON.stringify(defaultSettings[category]));
            } else {
                for (const key in defaultSettings[category]) {
                    if ( (category === 'llm_settings' || category === 'vision_settings') &&
                         (key === 'provider' || key === 'endpoint' || key === 'model') ) {
                        if (botData[category][key] === undefined) {
                                botData[category][key] = JSON.parse(JSON.stringify(defaultSettings[category][key]));
                        }
                        continue;
                    }
                    if (botData[category][key] === undefined) {
                        botData[category][key] = JSON.parse(JSON.stringify(defaultSettings[category][key]));
                    }
                    if (Array.isArray(defaultSettings[category][key]) && !Array.isArray(botData[category][key])) {
                        botData[category][key] = JSON.parse(JSON.stringify(defaultSettings[category][key]));
                    }
                }
            }
        } else {
            if (botData[category] === undefined) {
                botData[category] = defaultSettings[category];
            }
        }
    }

    const arrayFieldsPaths = [
        "llm_settings.backup_models", "llm_settings.stop",
        "vision_settings.backup_models",
        "response_limits.monitored_channels", "response_limits.admins", "response_limits.partial_ignore_list", "response_limits.full_ignore_list"
    ];
    for (const path of arrayFieldsPaths) {
        const parts = path.split('.');
        let current = botData;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) { current = null; break;}
            current = current[parts[i]];
        }
        if (current && typeof current === 'object' && !Array.isArray(current[parts[parts.length - 1]])) {
            current[parts[parts.length - 1]] = [];
        }
    }
    if (botData.prompt_settings && (typeof botData.prompt_settings.dictionary_cache !== 'object' || botData.prompt_settings.dictionary_cache === null) ) {
        botData.prompt_settings.dictionary_cache = {};
    }

    const allKnownKeys = new Set(Object.keys(defaultSettings));
    Object.keys(settingsSchema._global).forEach(k => allKnownKeys.add(k));

    for (const key in botData) {
        if (!allKnownKeys.has(key)) {
            if (!defaultSettings.hasOwnProperty(key) && !settingsSchema._global.hasOwnProperty(key)) {
            }
        } else if (typeof defaultSettings[key] === 'object' && defaultSettings[key] !== null && typeof botData[key] === 'object' && botData[key] !== null) {
            const defaultCategoryKeys = new Set(Object.keys(defaultSettings[key]));
            if (settingsSchema._global[key]) {
                    Object.keys(settingsSchema._global[key]).forEach(sk => defaultCategoryKeys.add(sk));
            }
            for (const subKey in botData[key]) {
                if (!defaultCategoryKeys.has(subKey)) {
                    delete botData[key][subKey];
                }
            }
        }
    }
}

async function updateBotToken(modelName, tokenValue) {
    const tokenKeyForEnv = `${modelName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
    if (Date.now() - uiInitTime < PASSWORD_ENTRY_GRACE_PERIOD && tokenValue === tokenKeyForEnv) return false;
    showLoading();
    try {
        const response = await fetch('/api/update_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token_key: tokenKeyForEnv, token_value: tokenValue }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || `Failed to update bot token (HTTP ${response.status})`);
        settings[modelName].bot_token = tokenKeyForEnv; setUnsavedChanges();
        showNotification(`Bot token for ${modelName} (as ${tokenKeyForEnv}) updated in .env!`, 'success');
        return true;
    } catch (error) { showNotification(`Error updating bot token for ${modelName}: ` + error.message, 'error'); return false;
    } finally { hideLoading(); }
}

async function updateProviderApiToken(providerName, tokenValue, inputElement) {
    const tokenKeyForEnv = getApiKeyEnvName(providerName);
    if (!tokenKeyForEnv) { showNotification(`API token key not defined for provider ${providerName}.`, 'error'); return false; }
    if (Date.now() - uiInitTime < PASSWORD_ENTRY_GRACE_PERIOD && (!inputElement || inputElement.value === '')) return false;
    showLoading();
    try {
        const response = await fetch('/api/update_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token_key: tokenKeyForEnv, token_value: tokenValue }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || `Failed to update ${providerName} API token (HTTP ${response.status})`);
        showNotification(`${providerName} API token (${tokenKeyForEnv}) updated in .env!`, 'success');
        if(inputElement) { inputElement.value = ''; inputElement.placeholder = 'Token updated in .env'; }
        return true;
    } catch (error) { showNotification(`Error updating ${providerName} API token: ` + error.message, 'error'); return false;
    } finally { hideLoading(); }
}

function renderModelContent(modelName) {
    const container = document.getElementById('models-content');
    container.innerHTML = '';
    ensureSettingsExist(modelName);
    const modelData = settings[modelName];
    const modelSection = document.createElement('div'); modelSection.className = 'tab-content active'; modelSection.setAttribute('data-model', modelName);

    const botStatusToggle = document.createElement('div'); botStatusToggle.className = 'bot-status-toggle';
    const isEnabled = modelData.enabled !== false;
    botStatusToggle.innerHTML = `<label class="switch"><input type="checkbox" id="bot-enabled-toggle-${modelName}" ${isEnabled ? 'checked' : ''}><span class="slider round"></span></label><label for="bot-enabled-toggle-${modelName}">Bot Status: <span class="status-text ${isEnabled ? 'status-enabled' : 'status-disabled'}">${isEnabled ? 'Enabled' : 'Disabled'}</span></label>`;
    botStatusToggle.querySelector(`#bot-enabled-toggle-${modelName}`).onchange = function() {
        settings[modelName].enabled = this.checked;
        botStatusToggle.querySelector('.status-text').textContent = this.checked ? 'Enabled' : 'Disabled';
        botStatusToggle.querySelector('.status-text').className = `status-text ${this.checked ? 'status-enabled' : 'status-disabled'}`;
        const tab = document.querySelector(`.tab[data-model="${modelName}"]`);
        if (tab) { this.checked ? tab.classList.remove('disabled') : tab.classList.add('disabled'); }
        setUnsavedChanges();
    };
    modelSection.appendChild(botStatusToggle);

    const topConfigSection = document.createElement('div');
    topConfigSection.className = 'section';
    topConfigSection.style.marginBottom = '20px';
    topConfigSection.innerHTML = '<h2>Bot & API Key Configuration</h2>';

    const tokenAndApiKeysRow = document.createElement('div');
    tokenAndApiKeysRow.className = 'form-row';

    const botTokenCol = document.createElement('div');
    botTokenCol.className = 'form-col';
    const botTokenFormGroup = document.createElement('div'); botTokenFormGroup.className = 'form-group';
    const botTokenInputContainer = createTextInput(modelName, null, 'bot_token', modelData.bot_token, settingsSchema._global.bot_token);
    const botTokenField = botTokenInputContainer.querySelector('input, textarea');
    if (botTokenField) {
        botTokenField.onchange = async function() { if (this.value.trim() === '') return; await updateBotToken(modelName, this.value); this.value = ''; this.placeholder = settings[modelName].bot_token; };
        botTokenField.placeholder = modelData.bot_token; botTokenField.value = '';
    }
    botTokenFormGroup.appendChild(botTokenInputContainer);
    botTokenCol.appendChild(botTokenFormGroup);
    tokenAndApiKeysRow.appendChild(botTokenCol);

    const allProviders = {...modelOptions, ...visionOptions};
    for (const providerName in allProviders) {
        const apiKeyEnvVar = getApiKeyEnvName(providerName);
        if (!apiKeyEnvVar) continue;
        const apiKeyCol = document.createElement('div');
        apiKeyCol.className = 'form-col';
        const keyGroup = document.createElement('div');
        keyGroup.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = `${providerName} API Key`;
        label.htmlFor = `${modelName}-${providerName}-global-apikey`;
        const envVarDisplay = document.createElement('span');
        envVarDisplay.textContent = ` (${apiKeyEnvVar})`;
        envVarDisplay.style.fontSize = '0.8em';
        envVarDisplay.style.marginLeft = '5px';
        label.appendChild(envVarDisplay);
        const input = document.createElement('input');
        input.type = 'password';
        input.id = `${modelName}-${providerName}-global-apikey`;
        input.placeholder = `Enter token for ${apiKeyEnvVar}`;
        input.dataset.provider = providerName;
        input.onchange = async function() {
            if (this.value.trim() === '') return;
            await updateProviderApiToken(this.dataset.provider, this.value, this);
        };
        keyGroup.appendChild(label);
        keyGroup.appendChild(input);
        apiKeyCol.appendChild(keyGroup);
        tokenAndApiKeysRow.appendChild(apiKeyCol);
    }
    topConfigSection.appendChild(tokenAndApiKeysRow);
    modelSection.appendChild(topConfigSection);

    const categoryRenderOrder = Object.keys(settingsSchema._global).filter(key =>
        key !== 'enabled' && key !== 'bot_token'
    );

    for (const category of categoryRenderOrder) {
        const categorySchema = settingsSchema._global[category];
        const categoryData = modelData[category] || {};

        const categorySectionDiv = document.createElement('div');
        categorySectionDiv.className = 'section';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'collapsible-section';
        headerDiv.style.backgroundColor = '#222222';
        headerDiv.style.color = '#E0E0E0';
        headerDiv.style.padding = '8px 10px';
        headerDiv.style.borderRadius = '3px';
        headerDiv.style.marginBottom = '10px';
        headerDiv.style.cursor = 'pointer';

        const headerTitle = document.createElement('h3');
        headerTitle.style.margin = '0';
        headerTitle.style.padding = '0';
        headerTitle.style.color = 'inherit';
        headerTitle.style.display = 'flex';
        headerTitle.style.justifyContent = 'space-between';
        headerTitle.style.alignItems = 'center';
        headerTitle.innerHTML = `${formatCategoryName(category)} <span class="toggle-icon" style="color: inherit;">▼</span>`;
        headerDiv.appendChild(headerTitle);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'collapsible-content';

        categorySectionDiv.appendChild(headerDiv);
        categorySectionDiv.appendChild(contentDiv);
        modelSection.appendChild(categorySectionDiv);

        const sectionKey = `${modelName}-${category}`;
        const mainSectionIcon = headerTitle.querySelector('.toggle-icon');

        if (collapsedSections[sectionKey] === undefined) {
            collapsedSections[sectionKey] = true;
        }

        const isCurrentlyCollapsed = collapsedSections[sectionKey] === true;
        if(mainSectionIcon) mainSectionIcon.classList.toggle('collapsed', isCurrentlyCollapsed);
        contentDiv.classList.toggle('collapsed', isCurrentlyCollapsed);

        headerDiv.onclick = function() {
            const targetStateCollapsed = !contentDiv.classList.contains('collapsed');
            contentDiv.classList.toggle('collapsed', targetStateCollapsed);
            if(mainSectionIcon) mainSectionIcon.classList.toggle('collapsed', targetStateCollapsed);
            collapsedSections[sectionKey] = targetStateCollapsed;
        };

        let currentFieldsInRow = 0; let currentRowElement = null;
        const fieldOrder = Object.keys(categorySchema);

        if (category === 'llm_settings') {
            const primaryLLMTitle = document.createElement('h4'); primaryLLMTitle.textContent = "Primary LLM Configuration"; primaryLLMTitle.style.marginTop = "0px"; primaryLLMTitle.style.marginBottom = "10px";
            contentDiv.appendChild(primaryLLMTitle);

            const llmSelectorsContainer = document.createElement('div'); llmSelectorsContainer.className = 'form-row';
            createProviderModelSelectors(modelName, 'llm_primary', categoryData, llmSelectorsContainer, false);
            contentDiv.appendChild(llmSelectorsContainer);

            const backupLLMTitle = document.createElement('h4'); backupLLMTitle.textContent = "LLM Backup Models"; backupLLMTitle.style.marginTop = "20px";
            contentDiv.appendChild(backupLLMTitle);

            const llmBackupSchema = categorySchema.backup_models;
            if (llmBackupSchema) {
                const backupFormGroup = document.createElement('div'); backupFormGroup.className = 'form-group';
                backupFormGroup.appendChild(createArrayInput(modelName, category, 'backup_models', categoryData.backup_models || [], llmBackupSchema));
                contentDiv.appendChild(backupFormGroup);
            }
            const otherLLMSettingsTitle = document.createElement('h4'); otherLLMSettingsTitle.textContent = "Other LLM Parameters"; otherLLMSettingsTitle.style.marginTop = "20px";
            contentDiv.appendChild(otherLLMSettingsTitle);
        }

        if (category === 'vision_settings') {
            const visionEnabledGroup = document.createElement('div'); visionEnabledGroup.className = 'form-group';
            visionEnabledGroup.appendChild(createBooleanInput(modelName, category, 'vision_enabled', categoryData.vision_enabled, categorySchema.vision_enabled));
            contentDiv.appendChild(visionEnabledGroup);

            const primaryVisionTitle = document.createElement('h4'); primaryVisionTitle.textContent = "Primary Vision Model"; primaryVisionTitle.style.marginTop = "0px"; primaryVisionTitle.style.marginBottom = "10px";
            contentDiv.appendChild(primaryVisionTitle);
            const visionSelectorsContainer = document.createElement('div'); visionSelectorsContainer.className = 'form-row';
            createProviderModelSelectors(modelName, 'vision_primary', categoryData, visionSelectorsContainer, true);
            contentDiv.appendChild(visionSelectorsContainer);

            const additionalVisionModelsTitle = document.createElement('h4');
            additionalVisionModelsTitle.textContent = "Additional Vision Models";
            additionalVisionModelsTitle.style.marginTop = "20px";
            contentDiv.appendChild(additionalVisionModelsTitle);

            const visionBackupModelsSchema = categorySchema.backup_models;
            if (visionBackupModelsSchema) {
                const visionModelsFormGroup = document.createElement('div'); visionModelsFormGroup.className = 'form-group';
                visionModelsFormGroup.appendChild(createArrayInput(modelName, 'vision_settings', 'backup_models', categoryData.backup_models || [], visionBackupModelsSchema));
                contentDiv.appendChild(visionModelsFormGroup);
            }
            const otherVisionSettingsTitle = document.createElement('h4'); otherVisionSettingsTitle.textContent = "Other Vision Parameters"; otherVisionSettingsTitle.style.marginTop = "20px";
            contentDiv.appendChild(otherVisionSettingsTitle);
        }

        for (const settingKey of fieldOrder) {
            if (categorySchema[settingKey].hidden) continue;
            if (category === 'llm_settings' && (settingKey === 'provider' || settingKey === 'endpoint' || settingKey === 'model' || settingKey === 'backup_models')) continue;
            if (category === 'vision_settings' && (settingKey === 'provider' || settingKey === 'endpoint' || settingKey === 'model' || settingKey === 'backup_models' || settingKey === 'vision_enabled')) continue;

            if (category === 'prompt_settings' && settingKey === 'dictionary_cache') {
                const dictCacheSchema = categorySchema[settingKey];
                const dictCacheData = categoryData[settingKey] || {};

                const dictCollapsibleContainer = document.createElement('div');
                dictCollapsibleContainer.style.marginTop = '15px';
                dictCollapsibleContainer.style.marginBottom = '10px';

                const dictHeaderDiv = document.createElement('div');
                dictHeaderDiv.className = 'collapsible-section sub-collapsible-section';
                dictHeaderDiv.style.backgroundColor = '#252525';
                dictHeaderDiv.style.color = '#E0E0E0';
                dictHeaderDiv.style.padding = '6px 10px';
                dictHeaderDiv.style.borderRadius = '3px';
                dictHeaderDiv.style.marginBottom = '5px';
                dictHeaderDiv.style.cursor = 'pointer';

                const dictHeaderTitle = document.createElement('h4');
                dictHeaderTitle.style.margin = '0';
                dictHeaderTitle.style.padding = '0';
                dictHeaderTitle.style.color = 'inherit';
                dictHeaderTitle.style.display = 'flex';
                dictHeaderTitle.style.justifyContent = 'space-between';
                dictHeaderTitle.style.alignItems = 'center';
                dictHeaderTitle.innerHTML = `${formatSettingName(settingKey)} <span class="toggle-icon" style="color: inherit;">▼</span>`;
                dictHeaderDiv.appendChild(dictHeaderTitle);

                const dictContentElement = document.createElement('div');
                dictContentElement.className = 'collapsible-content';

                const dictSectionKey = `${modelName}-${category}-${settingKey}-collapsible`;
                const dictIconElement = dictHeaderTitle.querySelector('.toggle-icon');

                if (collapsedSections[dictSectionKey] === undefined) {
                    collapsedSections[dictSectionKey] = true;
                }

                const isDictCurrentlyCollapsed = collapsedSections[dictSectionKey] === true;
                if(dictIconElement) dictIconElement.classList.toggle('collapsed', isDictCurrentlyCollapsed);
                dictContentElement.classList.toggle('collapsed', isDictCurrentlyCollapsed);

                dictHeaderDiv.onclick = function() {
                    const targetDictCollapseState = !dictContentElement.classList.contains('collapsed');
                    dictContentElement.classList.toggle('collapsed', targetDictCollapseState);
                    if(dictIconElement) dictIconElement.classList.toggle('collapsed', targetDictCollapseState);
                    collapsedSections[dictSectionKey] = targetDictCollapseState;
                };

                const dictInputGroup = document.createElement('div');
                dictInputGroup.className = 'form-group';
                dictInputGroup.style.padding = '10px';
                dictInputGroup.appendChild(createDictionaryInput(modelName, category, settingKey, dictCacheData, {...dictCacheSchema, isSubComponent: true}));
                dictContentElement.appendChild(dictInputGroup);

                dictCollapsibleContainer.appendChild(dictHeaderDiv);
                dictCollapsibleContainer.appendChild(dictContentElement);
                contentDiv.appendChild(dictCollapsibleContainer);

                currentFieldsInRow = 0; currentRowElement = null;
                continue;
            }

            const settingValue = categoryData[settingKey]; const schemaForItem = categorySchema[settingKey];
            let formGroup = document.createElement('div');
            let fieldRendered = true;
            const isSmallNumberField = schemaForItem.type === 'number' &&
                (schemaForItem.max === undefined || schemaForItem.max < 10000) &&
                (!schemaForItem.step || schemaForItem.step >= 0.01) &&
                settingKey !== 'cache_clear_time' && settingKey !== 'chat_clear_time' &&
                settingKey !== 'response_limit_interval' && settingKey !== 'vision_limit_interval' &&
                settingKey !== 'max_context_length' && settingKey !== 'min_context_length' && settingKey !== 'max_tokens';

            if (isSmallNumberField) {
                if (currentFieldsInRow === 0 || !currentRowElement || !contentDiv.contains(currentRowElement) ) {
                    currentRowElement = document.createElement('div'); currentRowElement.className = 'form-row';
                    contentDiv.appendChild(currentRowElement);
                }
                formGroup.className = 'form-col'; currentRowElement.appendChild(formGroup); currentFieldsInRow++;
            } else {
                formGroup.className = 'form-group'; contentDiv.appendChild(formGroup);
                currentFieldsInRow = 0; currentRowElement = null;
            }

            if (schemaForItem.type === 'array') {
                formGroup.appendChild(createArrayInput(modelName, category, settingKey, settingValue || [], schemaForItem));
            } else if (schemaForItem.type === 'dictionary') {
                formGroup.appendChild(createDictionaryInput(modelName, category, settingKey, settingValue || {}, schemaForItem));
            } else if (schemaForItem.type === 'boolean') {
                formGroup.appendChild(createBooleanInput(modelName, category, settingKey, !!settingValue, schemaForItem));
            } else if (schemaForItem.type === 'number') {
                formGroup.appendChild(createNumberInputWithSchema(modelName, category, settingKey, Number(settingValue !== undefined ? settingValue : (schemaForItem.min !== undefined ? schemaForItem.min : 0)), schemaForItem));
            } else if (schemaForItem.type === 'text') {
                formGroup.appendChild(createTextInput(modelName, category, settingKey, String(settingValue || ''), schemaForItem));
            } else if (schemaForItem.type === 'range') {
                const rangeValue = Array.isArray(settingValue) && settingValue.length === 2 ? settingValue : (defaultSettings[category]?.[settingKey] || [0,10]);
                formGroup.appendChild(createRangeInput(modelName, category, settingKey, rangeValue, schemaForItem));
            } else { fieldRendered = false; if(formGroup.parentNode && formGroup.parentNode === currentRowElement) {currentRowElement.removeChild(formGroup); currentFieldsInRow--;} else if(formGroup.parentNode){formGroup.parentNode.removeChild(formGroup);} }

            if (!fieldRendered && formGroup.className === 'form-col' && currentRowElement && currentRowElement.children.length === 0) {
                if(currentRowElement.parentNode) currentRowElement.parentNode.removeChild(currentRowElement);
                currentRowElement = null; currentFieldsInRow = 0;
            } else if (!fieldRendered && formGroup.className === 'form-group' && formGroup.children.length === 0){
                if(formGroup.parentNode) formGroup.parentNode.removeChild(formGroup);
            }
            if (currentFieldsInRow >= 3) { currentFieldsInRow = 0; currentRowElement = null; }
        }
    }
    container.appendChild(modelSection);
}

function createProviderModelSelectors(modelName, settingsGroupKey, configObject, targetElement, isVisionSelectors = false) {
    targetElement.innerHTML = '';

    const pKey = 'provider';
    const epKey = 'endpoint';
    const mKey = 'model';

    let currentProvider = configObject[pKey];
    let currentModel = configObject[mKey];
    let currentEndpoint = configObject[epKey];

    const sourceForOptions = isVisionSelectors ? visionOptions : modelOptions;

    const providerGroup = document.createElement('div'); providerGroup.className = 'form-col';
    const providerLabelText = settingsGroupKey.includes('backup_') ? 'Backup Provider' : `${isVisionSelectors ? 'Vision' : 'LLM'} Provider`;
    const providerLabel = document.createElement('label'); providerLabel.textContent = providerLabelText;
    const providerSelect = document.createElement('select'); providerSelect.id = `${modelName}-${settingsGroupKey}-provider`;

    Object.keys(sourceForOptions).forEach(pName => {
        const option = document.createElement('option'); option.value = pName; option.textContent = pName;
        if (pName === currentProvider) option.selected = true;
        providerSelect.appendChild(option);
    });

    if (!currentProvider && providerSelect.options.length > 0) {
        providerSelect.selectedIndex = 0; currentProvider = providerSelect.value; configObject[pKey] = currentProvider;
    } else if (providerSelect.options.length === 0) {
        const option = document.createElement('option'); option.textContent = "No providers defined"; option.disabled = true; providerSelect.appendChild(option);
    }

    providerGroup.appendChild(providerLabel); providerGroup.appendChild(providerSelect); targetElement.appendChild(providerGroup);

    const modelGroup = document.createElement('div'); modelGroup.className = 'form-col';
    const modelLabelText = settingsGroupKey.includes('backup_') ? 'Backup Model' : 'Model';
    const modelLabel = document.createElement('label'); modelLabel.textContent = modelLabelText;
    const modelSelect = document.createElement('select'); modelSelect.id = `${modelName}-${settingsGroupKey}-model`;
    modelGroup.appendChild(modelLabel); modelGroup.appendChild(modelSelect); targetElement.appendChild(modelGroup);

    function populateModelsAndUpdateStorage(selectedProviderName, currentSourceOptions) {
        modelSelect.innerHTML = '';
        const providerData = currentSourceOptions[selectedProviderName] || {};
        let modelSelectedInUI = false;
        let firstAvailableModelComposite = null;

        for (const endpointUrl in providerData) {
            const modelsAtEndpoint = providerData[endpointUrl] || {};
            for (const modelDisplayName in modelsAtEndpoint) {
                const modelId = modelsAtEndpoint[modelDisplayName];
                const compositeValue = `${endpointUrl}::${modelId}`;
                if (!firstAvailableModelComposite) firstAvailableModelComposite = compositeValue;

                const option = document.createElement('option'); option.value = compositeValue; option.textContent = `${modelDisplayName}`;
                if (modelId === currentModel && endpointUrl === currentEndpoint && selectedProviderName === currentProvider) {
                    option.selected = true; modelSelectedInUI = true;
                }
                modelSelect.appendChild(option);
            }
        }

        if (!modelSelectedInUI && modelSelect.options.length > 0) {
            modelSelect.value = firstAvailableModelComposite || modelSelect.options[0].value;
        } else if (modelSelect.options.length === 0) {
            const option = document.createElement('option');
            option.textContent = selectedProviderName ? "No models for provider" : "Select provider";
            option.disabled = true; modelSelect.appendChild(option);
        }

        const selectedComposite = modelSelect.value;
        if (selectedComposite && selectedComposite.includes("::")) {
            const [ep, mId] = selectedComposite.split("::");
            configObject[epKey] = ep; configObject[mKey] = mId;
            currentEndpoint = ep; currentModel = mId;
        } else {
            configObject[epKey] = null; configObject[mKey] = null;
            currentEndpoint = null; currentModel = null;
        }
    }

    providerSelect.onchange = function() {
        const newProvider = this.value;
        configObject[pKey] = newProvider; currentProvider = newProvider;
        currentEndpoint = null; currentModel = null;
        populateModelsAndUpdateStorage(newProvider, sourceForOptions);
        setUnsavedChanges();
    };
    modelSelect.onchange = function() {
        const selectedComposite = this.value;
        if (selectedComposite && selectedComposite.includes("::")) {
            const [ep, mId] = selectedComposite.split("::");
            configObject[epKey] = ep; configObject[mKey] = mId;
            currentEndpoint = ep; currentModel = mId;
        }
        setUnsavedChanges();
    };

    if (currentProvider) {
        populateModelsAndUpdateStorage(currentProvider, sourceForOptions);
    } else if (providerSelect.options.length > 0 && providerSelect.value) {
        currentProvider = providerSelect.value;
        configObject[pKey] = currentProvider;
        populateModelsAndUpdateStorage(currentProvider, sourceForOptions);
    } else {
        populateModelsAndUpdateStorage(null, sourceForOptions);
    }
}

function createTextInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldId = category === null ? `${modelName}-${settingKey}` : `${modelName}-${category}-${settingKey}`;
    const labelContainer = document.createElement('div'); labelContainer.className = 'label-container';
    const labelElement = document.createElement('label'); labelElement.setAttribute('for', fieldId); labelElement.textContent = formatSettingName(settingKey);
    labelContainer.appendChild(labelElement);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    let inputElement;
    const isMultiline = schema && schema.multiline;
    const isPasswordField = (settingKey === 'bot_token' && category === null);
    if (isMultiline) {
        inputElement = document.createElement('textarea');
        const largeMultilineKeys = ['prompt_head', 'prompt_tail', 'dictionary_cache_header', 'reminder', 'vision_prompt'];
        inputElement.className = largeMultilineKeys.includes(settingKey) ? 'large' : 'medium';
    } else {
        inputElement = document.createElement('input'); inputElement.type = isPasswordField ? 'password' : 'text';
    }
    inputElement.id = fieldId;
    if (isPasswordField) {
        inputElement.placeholder = String(settingValue || 'Enter token...'); inputElement.value = '';
    } else {
        inputElement.value = String(settingValue || '');
    }
    inputElement.onchange = function() { updateSetting(modelName, category, settingKey, this.value); };
    container.appendChild(labelContainer); container.appendChild(inputElement);
    return container;
}

function createNumberInputWithSchema(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldId = `${modelName}-${category}-${settingKey}`;
    const labelContainer = document.createElement('div'); labelContainer.className = 'label-container';
    const labelElement = document.createElement('label'); labelElement.setAttribute('for', fieldId); labelElement.textContent = formatSettingName(settingKey);
    labelContainer.appendChild(labelElement);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    const inputElement = document.createElement('input'); inputElement.type = 'number'; inputElement.id = fieldId; inputElement.className = 'number-input';
    inputElement.value = settingValue;
    if (schema) {
        if (schema.min !== undefined) inputElement.min = schema.min;
        if (schema.max !== undefined) inputElement.max = schema.max;
        if (schema.step !== undefined) inputElement.step = schema.step;
    }
    const validationMessage = document.createElement('div'); validationMessage.className = 'validation-message'; validationMessage.style.display = 'none';
    inputElement.oninput = function() {
        const validation = validateInput(this.value, schema);
        if (!validation.valid) {
            this.classList.add('invalid-input'); validationMessage.textContent = validation.message; validationMessage.style.display = 'block';
        } else {
            this.classList.remove('invalid-input'); validationMessage.style.display = 'none';
        }
    };
    inputElement.onchange = function() {
        const validation = validateInput(this.value, schema);
        const originalValue = settings[modelName]?.[category]?.[settingKey] !== undefined ? settings[modelName][category][settingKey] : (schema?.min !== undefined ? schema.min : 0);
        if (!validation.valid) {
            showNotification(validation.message || `Invalid input for ${settingKey}`, 'error');
            this.value = originalValue; this.classList.remove('invalid-input'); validationMessage.style.display = 'none'; return;
        }
        updateSetting(modelName, category, settingKey, Number(this.value));
    };
    container.appendChild(labelContainer); container.appendChild(inputElement); container.appendChild(validationMessage);
    return container;
}

function createBooleanInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldId = `${modelName}-${category}-${settingKey}`;
    const labelContainer = document.createElement('div'); labelContainer.className = 'label-container';
    const labelElement = document.createElement('label'); labelElement.setAttribute('for', fieldId); labelElement.textContent = formatSettingName(settingKey);
    labelContainer.appendChild(labelElement);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    const select = document.createElement('select'); select.id = fieldId;
    ['True', 'False'].forEach(valStr => {
        const option = document.createElement('option'); option.value = valStr.toLowerCase(); option.textContent = valStr;
        if ((valStr === 'True' && settingValue === true) || (valStr === 'False' && settingValue === false)) { option.selected = true; }
        select.appendChild(option);
    });
    select.onchange = function() { updateSetting(modelName, category, settingKey, this.value === 'true'); };
    container.appendChild(labelContainer); container.appendChild(select);
    return container;
}

function createRangeInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldIdPrefix = `${modelName}-${category}-${settingKey}`;
    const labelContainer = document.createElement('div'); labelContainer.className = 'label-container';
    const rangeLabel = document.createElement('label'); rangeLabel.textContent = formatSettingName(settingKey);
    labelContainer.appendChild(rangeLabel);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    container.appendChild(labelContainer);
    const rangeContainer = document.createElement('div'); rangeContainer.className = 'range-container';
    const val1 = Array.isArray(settingValue) && settingValue.length > 0 ? settingValue[0] : (schema.min || 0);
    const val2 = Array.isArray(settingValue) && settingValue.length > 1 ? settingValue[1] : (schema.max || 10);
    const minInput = document.createElement('input'); minInput.type = 'number'; minInput.id = `${fieldIdPrefix}-min`; minInput.value = val1;
    if (schema && schema.min !== undefined) minInput.min = schema.min; if (schema && schema.max !== undefined) minInput.max = schema.max;
    minInput.style.width = '80px';
    const separator = document.createElement('span'); separator.textContent = ' to '; separator.style.margin = "0 5px";
    const maxInput = document.createElement('input'); maxInput.type = 'number'; maxInput.id = `${fieldIdPrefix}-max`; maxInput.value = val2;
    if (schema && schema.min !== undefined) maxInput.min = schema.min; if (schema && schema.max !== undefined) maxInput.max = schema.max;
    maxInput.style.width = '80px';
    function updateRange() {
        const numMin = Number(minInput.value); const numMax = Number(maxInput.value);
        if (numMin > numMax) {
            showNotification('Minimum value in range cannot exceed maximum.', 'error');
            minInput.value = settings[modelName][category][settingKey][0]; maxInput.value = settings[modelName][category][settingKey][1]; return;
        }
        updateSetting(modelName, category, settingKey, [numMin, numMax]);
    }
    minInput.onchange = updateRange; maxInput.onchange = updateRange;
    rangeContainer.appendChild(document.createTextNode("Min: ")); rangeContainer.appendChild(minInput);
    rangeContainer.appendChild(separator); rangeContainer.appendChild(document.createTextNode("Max: ")); rangeContainer.appendChild(maxInput);
    container.appendChild(rangeContainer);
    return container;
}

function createArrayInput(modelName, category, settingKey, currentArray, arraySchema) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'array-input-half-width';

    const fieldId = `${modelName}-${category}-${settingKey}`;

    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    const arrayLabel = document.createElement('label');
    arrayLabel.setAttribute('for', fieldId + '-entries');
    arrayLabel.textContent = formatSettingName(settingKey);
    labelContainer.appendChild(arrayLabel);
    if (arraySchema && arraySchema.tooltip) {
        labelContainer.appendChild(createTooltip(arraySchema.tooltip));
    }
    fieldWrapper.appendChild(labelContainer);

    const arrayInputBox = document.createElement('div');
    arrayInputBox.className = 'array-input-box';

    const entriesContainerId = `${fieldId}-entries`;
    const entriesContainer = document.createElement('div');
    entriesContainer.id = entriesContainerId;

    arrayInputBox.appendChild(entriesContainer);

    const addButton = document.createElement('button');
    addButton.className = 'add-entry';
    addButton.textContent = '+ Add Entry';
    addButton.onclick = function() {
        addArrayEntry(modelName, category, settingKey, arraySchema);
        setTimeout(() => {
            if (entriesContainer.scrollHeight > entriesContainer.clientHeight) {
                entriesContainer.scrollTop = entriesContainer.scrollHeight;
            }
        }, 0);
    };
    arrayInputBox.appendChild(addButton);

    fieldWrapper.appendChild(arrayInputBox);

    function renderArrayEntries() {
        entriesContainer.innerHTML = '';
        
        if (!settings[modelName]) settings[modelName] = {};
        if (!settings[modelName][category]) settings[modelName][category] = {};
        if (!settings[modelName][category][settingKey] || !Array.isArray(settings[modelName][category][settingKey])) {
            settings[modelName][category][settingKey] = [];
        }
        
        const arrayToRender = settings[modelName][category][settingKey];

        arrayToRender.forEach((itemValue, index) => {
            const entryDiv = createArrayEntryElement(modelName, category, settingKey, index, itemValue, arraySchema, renderArrayEntries);
            entriesContainer.appendChild(entryDiv);
        });
    }

    renderArrayEntries();
    entriesContainer.renderEntries = renderArrayEntries;

    return fieldWrapper;
}


function createArrayEntryElement(modelName, category, settingKey, index, itemValue, arraySchema, rerenderCallback) {
    const entryDiv = document.createElement('div'); entryDiv.className = 'array-entry section';
    entryDiv.style.padding = '10px'; entryDiv.style.marginBottom = '10px'; entryDiv.style.backgroundColor = '#272727';
    if (arraySchema && arraySchema.itemSchema && arraySchema.itemSchema.provider && arraySchema.itemSchema.model) {
        const isVisionContextForBackupModels = (category === 'vision_settings' && settingKey === 'backup_models');
        const backupItemSelectorsContainer = document.createElement('div'); backupItemSelectorsContainer.className = 'form-row';
        const itemGroupKey = `backup_${isVisionContextForBackupModels ? 'vision' : 'llm'}_${index}`;
        const currentItemValue = itemValue || {};
            if (!currentItemValue.endpoint ) {
            const defaultSelections = getFirstProviderAndModelDetails(isVisionContextForBackupModels);
            if(defaultSelections.endpoint) currentItemValue.endpoint = defaultSelections.endpoint;
        }
        createProviderModelSelectors(modelName, itemGroupKey, currentItemValue, backupItemSelectorsContainer, isVisionContextForBackupModels);
        entryDiv.appendChild(backupItemSelectorsContainer);
    } else {
        const inputElement = document.createElement('input');
        const itemType = (arraySchema && arraySchema.itemType) || (typeof itemValue === 'number' ? 'number' : 'text');
        inputElement.type = itemType; inputElement.value = itemValue; inputElement.style.flexGrow = '1';
        inputElement.onchange = function() {
            const val = itemType === 'number' ? Number(this.value) : this.value;
            updateArrayValue(modelName, category, settingKey, index, val);
        };
        entryDiv.appendChild(inputElement);
    }
    const removeButton = document.createElement('button'); removeButton.className = 'remove-entry delete-btn'; removeButton.textContent = 'Remove';
    removeButton.style.marginLeft = '10px';
    removeButton.onclick = function() { removeArrayEntry(modelName, category, settingKey, index); rerenderCallback(); };
    entryDiv.appendChild(removeButton);
    return entryDiv;
}

function addArrayEntry(modelName, category, settingKey, arraySchema) {
    if (!settings[modelName]) settings[modelName] = {};
    if (!settings[modelName][category]) settings[modelName][category] = {};
    if (!Array.isArray(settings[modelName][category][settingKey])) {
        settings[modelName][category][settingKey] = [];
    }
    let newItem;
    if (arraySchema && arraySchema.itemSchema && arraySchema.itemSchema.provider) {
        const isVision = (category === 'vision_settings' && settingKey === 'backup_models');
        const defaultSelections = getFirstProviderAndModelDetails(isVision);
        newItem = {
            provider: defaultSelections.provider,
            endpoint: defaultSelections.endpoint,
            model: defaultSelections.model
        };
    } else {
        const itemType = (arraySchema && arraySchema.itemType) || 'text';
        newItem = itemType === 'number' ? 0 : '';
    }
    settings[modelName][category][settingKey].push(newItem);
    setUnsavedChanges();
    const entriesContainer = document.getElementById(`${modelName}-${category}-${settingKey}-entries`);
    if (entriesContainer && entriesContainer.renderEntries) {
        entriesContainer.renderEntries();
    } else {
        renderModelContent(activeTab);
    }
}

function createDictionaryInput(modelName, category, settingKey, currentValue, schema) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'input-field-container';

    const fieldId = `${modelName}-${category}-${settingKey}`;

    if (!(schema && schema.isSubComponent)) {
        const labelContainer = document.createElement('div');
        labelContainer.className = 'label-container';
        const dictLabel = document.createElement('label');
        dictLabel.setAttribute('for', fieldId + '-entries'); 
        dictLabel.textContent = formatSettingName(settingKey);
        labelContainer.appendChild(dictLabel);
        if (schema && schema.tooltip) {
            labelContainer.appendChild(createTooltip(schema.tooltip));
        }
        fieldWrapper.appendChild(labelContainer);
    }

    const dictionaryInputBox = document.createElement('div');
    dictionaryInputBox.className = 'dictionary-input-box'; 

    const entriesContainerId = `${fieldId}-entries`;
    const entriesContainer = document.createElement('div');
    entriesContainer.id = entriesContainerId;
    entriesContainer.style.maxHeight = '450px';
    entriesContainer.style.overflowY = 'auto';
    dictionaryInputBox.appendChild(entriesContainer);

    const addButton = document.createElement('button');
    addButton.className = 'add-entry';
    addButton.textContent = '+ Add Entry';
    addButton.onclick = function() {
        addDictionaryEntry(modelName, category, settingKey);
        setTimeout(() => {
            if (entriesContainer.scrollHeight > entriesContainer.clientHeight) {
                entriesContainer.scrollTop = entriesContainer.scrollHeight;
            }
        }, 0);
    };
    dictionaryInputBox.appendChild(addButton);
    
    fieldWrapper.appendChild(dictionaryInputBox);

    function renderDictEntries() {
        let dictToRender = settings[modelName]?.[category]?.[settingKey];
        if (typeof dictToRender !== 'object' || dictToRender === null) {
            dictToRender = {};
            if (settings[modelName] && settings[modelName][category]) {
                 settings[modelName][category][settingKey] = dictToRender;
            } else {
                if(!settings[modelName]) settings[modelName] = {};
                if(!settings[modelName][category]) settings[modelName][category] = {};
                settings[modelName][category][settingKey] = dictToRender;
            }
        }

        const keyOrder = [];
        const existingKeyElements = entriesContainer.querySelectorAll('.dictionary-entry .dictionary-key input');
        existingKeyElements.forEach(inputEl => {
            const key = inputEl.dataset.originalKey || inputEl.value;
            if (dictToRender.hasOwnProperty(key) && !keyOrder.includes(key)) {
                keyOrder.push(key);
            }
        });
        for (const keyInDict in dictToRender) {
            if (dictToRender.hasOwnProperty(keyInDict) && !keyOrder.includes(keyInDict)) {
                keyOrder.push(keyInDict);
            }
        }
        entriesContainer.innerHTML = '';
        keyOrder.forEach(dictKey => {
            const dictValue = dictToRender[dictKey];
            const entryDiv = createDictionaryEntryElement(modelName, category, settingKey, dictKey, dictValue, renderDictEntries);
            entriesContainer.appendChild(entryDiv);
        });
    }
    renderDictEntries();
    entriesContainer.renderEntries = renderDictEntries;
    return fieldWrapper;
}

function createDictionaryEntryElement(modelName, category, settingKey, dictKey, dictValue, rerenderCallback) {
    const entryDiv = document.createElement('div'); entryDiv.className = 'dictionary-entry';
    const keyInput = document.createElement('input'); keyInput.type = 'text'; keyInput.className = 'dictionary-key';
    keyInput.value = dictKey; keyInput.placeholder = 'Key'; keyInput.dataset.originalKey = dictKey;
    const valueInput = document.createElement('input'); valueInput.type = 'text'; valueInput.className = 'dictionary-value';
    valueInput.value = typeof dictValue === 'string' ? dictValue : JSON.stringify(dictValue); valueInput.placeholder = 'Value';
    keyInput.onchange = function() {
        const oldKey = this.dataset.originalKey; const newKey = this.value.trim();
        if (newKey === oldKey) return;
        if (!newKey) { showNotification('Dictionary key cannot be empty.', 'error'); this.value = oldKey; return; }
        const currentDict = settings[modelName][category][settingKey];
        if (currentDict.hasOwnProperty(newKey)) { showNotification(`Key "${newKey}" already exists.`, 'error'); this.value = oldKey; return; }

        const newOrderedDict = {};
        const allKeyInputElements = Array.from(this.closest(`#${modelName}-${category}-${settingKey}-entries`).querySelectorAll('.dictionary-entry .dictionary-key input'));
        allKeyInputElements.forEach(inpEl => {
            let k = inpEl.dataset.originalKey;
            if(inpEl === this) {
                newOrderedDict[newKey] = currentDict[oldKey];
            } else if (currentDict.hasOwnProperty(k)) {
                newOrderedDict[k] = currentDict[k];
            }
        });

        for(const original_dict_key in currentDict){
            if (!newOrderedDict.hasOwnProperty(original_dict_key) && original_dict_key !== oldKey) {
                newOrderedDict[original_dict_key] = currentDict[original_dict_key];
            } else if (original_dict_key === oldKey && !newOrderedDict.hasOwnProperty(newKey) ) {
                newOrderedDict[newKey] = currentDict[oldKey];
            }
        }
        settings[modelName][category][settingKey] = newOrderedDict;
        this.dataset.originalKey = newKey;
        setUnsavedChanges();
    };
    valueInput.onchange = function() { updateDictionaryValue(modelName, category, settingKey, keyInput.dataset.originalKey, this.value); };
    const removeButton = document.createElement('button'); removeButton.className = 'remove-entry delete-btn'; removeButton.textContent = '-';
    removeButton.onclick = function() { removeDictionaryEntry(modelName, category, settingKey, keyInput.dataset.originalKey); rerenderCallback(); };
    entryDiv.appendChild(keyInput); entryDiv.appendChild(valueInput); entryDiv.appendChild(removeButton);
    return entryDiv;
}

function addDictionaryEntry(modelName, category, settingKey) {
    let newKeyBase = `new_key_`;
    let i = 1;
    let newKey = `${newKeyBase}${i}`;

    if (!settings[modelName]) {
        settings[modelName] = {};
    }
    if (!settings[modelName][category]) {
        settings[modelName][category] = {};
    }

    if (typeof settings[modelName][category][settingKey] !== 'object' || settings[modelName][category][settingKey] === null) {
        settings[modelName][category][settingKey] = {};
    }

    const targetDictionary = settings[modelName][category][settingKey];

    while (targetDictionary.hasOwnProperty(newKey)) {
        newKey = `${newKeyBase}${++i}`;
    }

    targetDictionary[newKey] = '';

    setUnsavedChanges();

    const entriesContainer = document.getElementById(`${modelName}-${category}-${settingKey}-entries`);
    if (entriesContainer && entriesContainer.renderEntries) {
        entriesContainer.renderEntries();
    } else {
        renderModelContent(activeTab);
    }
}

function setUnsavedChanges() {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); }
    autoSaveTimer = setTimeout(autoSaveSettings, 1500);
}

function updateSetting(modelName, category, settingKey, value) {
    if (category === null) { settings[modelName][settingKey] = value; }
    else {
        if (!settings[modelName][category]) settings[modelName][category] = {};
        settings[modelName][category][settingKey] = value;
    }
    setUnsavedChanges();
}

function updateArrayValue(modelName, category, settingKey, index, value) {
    if (settings[modelName]?.[category]?.[settingKey]?.[index] !== undefined) { settings[modelName][category][settingKey][index] = value; setUnsavedChanges(); }
}

function updateDictionaryValue(modelName, category, settingKey, key, value) {
    if (settings[modelName]?.[category]?.[settingKey] !== undefined) {
        if (settings[modelName][category][settingKey].hasOwnProperty(key)) {
            settings[modelName][category][settingKey][key] = value;
            setUnsavedChanges();
        }
    }
}

function removeArrayEntry(modelName, category, settingKey, index) {
    if (settings[modelName]?.[category]?.[settingKey] && settings[modelName][category][settingKey].splice) { settings[modelName][category][settingKey].splice(index, 1); setUnsavedChanges(); }
}

function removeDictionaryEntry(modelName, category, settingKey, key) {
    if (settings[modelName]?.[category]?.[settingKey]) { delete settings[modelName][category][settingKey][key]; setUnsavedChanges(); }
}

function validateInput(value, schema) {
    if (!schema) return { valid: true };
    if (schema.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) return { valid: false, message: 'Must be a valid number.' };
        if (schema.min !== undefined && numValue < schema.min) return { valid: false, message: `Min value: ${schema.min}` };
        if (schema.max !== undefined && numValue > schema.max) return { valid: false, message: `Max value: ${schema.max}` };
    }
    return { valid: true };
}

function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatCategoryName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
function formatSettingName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message; notification.className = 'notification ' + type; notification.style.display = 'block';
    setTimeout(() => { notification.style.display = 'none'; }, 3000);
}
function showLoading() { document.getElementById('loading').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading').style.display = 'none'; }

async function fetchSettings() {
    showLoading();
    try {
        uiInitTime = Date.now();
        const response = await fetch('/api/settings?t=' + Date.now());
        if (!response.ok) {
            const responseText = await response.text().catch(() => "");
            if (response.status >= 400 || !responseText.trim() || responseText.trim() === "{}") {
                settings = initializeDefaultSettings();
            } else {
                try {
                    const parsed = JSON.parse(responseText);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
                        settings = initializeDefaultSettings();
                    } else {
                        settings = parsed;
                    }
                } catch (e) {
                    showNotification('Error parsing settings from server. Using defaults.', 'error');
                    settings = initializeDefaultSettings();
                }
            }
        } else {
            const text = await response.text();
            if (!text || !text.trim() || text.trim() === "{}") {
                settings = initializeDefaultSettings();
            } else {
                try {
                    const parsed = JSON.parse(text);
                        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        settings = initializeDefaultSettings();
                    } else {
                        settings = parsed;
                    }
                } catch (parseError) {
                    showNotification('Invalid settings JSON from server, using defaults.', 'error');
                    settings = initializeDefaultSettings();
                }
            }
        }
        if (Object.keys(settings).length === 0) {
            settings = initializeDefaultSettings();
        }
        for (const modelName in settings) {
            ensureSettingsExist(modelName);
        }
        if (Object.keys(settings).length === 0) {
            addNewModel("BotName");
        }
        createModelTabs();
        activateTab(Object.keys(settings)[0]);
    } catch (error) {
        showNotification('Error fetching settings: ' + error.message, 'error');
        settings = initializeDefaultSettings();
        for (const modelName in settings) { ensureSettingsExist(modelName); }
        if (Object.keys(settings).length === 0) addNewModel("BotName");
        createModelTabs();
        activateTab(Object.keys(settings)[0] || "BotName");
    } finally {
        hideLoading();
    }
}

function initializeDefaultSettings() {
    const newBotName = "BotName";
    const newSettings = {};
    newSettings[newBotName] = JSON.parse(JSON.stringify(defaultSettings));
    newSettings[newBotName].bot_token = `${newBotName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
    return newSettings;
}

async function autoSaveSettings() {
    if (Object.keys(settings).length === 0) { showNotification("Cannot save empty settings.", "error"); return; }
    try {
        const response = await fetch('/api/settings?nocache=' + Date.now(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify(settings) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({ error: response.statusText })); throw new Error(errorData.error || 'Unknown error occurred'); }
    } catch (error) { showNotification('Auto-save failed: ' + error.message, 'error'); }
}

async function exitServer() {
    await autoSaveSettings(); showLoading();
    try {
        await fetch('/api/shutdown'); showNotification('Server is shutting down...', 'success');
        setTimeout(() => { document.body.innerHTML = '<div class="container"><h1>Server has been shut down</h1><p>You can close this window now.</p></div>'; }, 1000);
    } catch (error) { showNotification('Error during server shutdown: ' + error.message, 'error'); hideLoading(); }
}

function createModelTabs() {
    const tabsContainer = document.getElementById('models-tabs'); tabsContainer.innerHTML = '';
    for (const modelName in settings) {
        const tab = document.createElement('div'); tab.className = 'tab';
        if (settings[modelName].enabled === false) { tab.classList.add('disabled'); }
        tab.textContent = escapeHtml(modelName); tab.setAttribute('data-model', modelName);
        tab.onclick = function() { activateTab(modelName); }; tab.ondblclick = function() { renameModel(modelName); };
        tabsContainer.appendChild(tab);
    }
    const addButton = document.createElement('button'); addButton.className = 'add-bot-button';
    addButton.innerHTML = '<i>+</i> Add Bot'; addButton.onclick = function(){ addNewModel(); };
    tabsContainer.appendChild(addButton); updateDeleteButtonVisibility();
}

function renameModel(oldName) {
    const newName = prompt('Enter new name for the bot:', oldName);
    if (!newName || newName.trim() === '') return;
    const sanitizedNewName = newName.trim();
    if (sanitizedNewName !== oldName && settings[sanitizedNewName]) { showNotification('A bot with this name already exists', 'error'); return; }
    if (sanitizedNewName !== oldName) {
        const currentSettingsForOldName = JSON.parse(JSON.stringify(settings[oldName]));
        const newSettingsObject = {};
        for (const modelKey in settings) {
            if (modelKey === oldName) { newSettingsObject[sanitizedNewName] = currentSettingsForOldName; }
            else { newSettingsObject[modelKey] = settings[modelKey]; }
        }
        settings = newSettingsObject; if (activeTab === oldName) activeTab = sanitizedNewName;
        setUnsavedChanges(); createModelTabs(); activateTab(activeTab);
        showNotification(`Bot renamed from "${escapeHtml(oldName)}" to "${escapeHtml(sanitizedNewName)}"`, 'success');
    }
}

function addNewModel(nameFromButton = "") {
    const modelName = nameFromButton || prompt('Enter name for the new model:');
    if (modelName && modelName.trim() !== '') {
        const sanitizedName = modelName.trim();
        if (settings[sanitizedName]) { if(!nameFromButton) showNotification('A model with this name already exists', 'error'); return; }
        settings[sanitizedName] = JSON.parse(JSON.stringify(defaultSettings)); ensureSettingsExist(sanitizedName);
        setUnsavedChanges(); createModelTabs(); activateTab(sanitizedName);
    }
}

function deleteModel(modelName) {
    if (!confirm(`Are you sure you want to delete the bot "${escapeHtml(modelName)}"?`)) return;
    if (Object.keys(settings).length === 1) {
        settings[modelName] = JSON.parse(JSON.stringify(defaultSettings)); ensureSettingsExist(modelName);
        setUnsavedChanges(); renderModelContent(modelName);
        showNotification(`Bot "${escapeHtml(modelName)}" has been reset to defaults.`, 'success'); return;
    }
    delete settings[modelName]; setUnsavedChanges(); createModelTabs();
    const modelNames = Object.keys(settings);
    if (modelNames.length > 0) { activateTab(modelNames[0]); }
    else { document.getElementById('models-content').innerHTML = '<p>No models. Please add one.</p>'; }
    showNotification(`Bot "${escapeHtml(modelName)}" deleted.`, 'success');
}

function activateTab(modelName) {
    if (!settings[modelName]) {
        if (Object.keys(settings).length > 0) modelName = Object.keys(settings)[0];
        else { addNewModel("BotName"); modelName = "BotName"; }
    }
    activeTab = modelName;
    document.querySelectorAll('.tab').forEach(tab => { tab.classList.toggle('active', tab.getAttribute('data-model') === modelName); });
    renderModelContent(modelName); updateDeleteButtonVisibility();
}

function updateDeleteButtonVisibility() {
    const deleteBtn = document.getElementById('delete-model-btn');
    if (activeTab) {
        deleteBtn.style.display = 'block';
        deleteBtn.textContent = (Object.keys(settings).length === 1) ? `Reset "${escapeHtml(activeTab)}" to Defaults` : `Delete "${escapeHtml(activeTab)}"`;
    } else { deleteBtn.style.display = 'none'; }
}

async function checkBotStatus() {
    try {
        const response = await fetch('/api/bot/status?t=' + Date.now());
        if (response.ok) { const data = await response.json(); updateBotStatusUI(data.running); }
        else { updateBotStatusUI(false); }
    } catch (error) { updateBotStatusUI(false); }
}

function updateBotStatusUI(isRunning) {
    botRunning = isRunning;
    const button = document.getElementById('bot-control-btn'); const indicator = document.getElementById('bot-status-indicator');
    button.innerHTML = '';
    if (isRunning) {
        indicator.className = 'bot-status-indicator status-running'; button.appendChild(indicator); button.appendChild(document.createTextNode(' Stop Bot')); button.className = 'bot-control-btn stop-btn';
    } else {
        indicator.className = 'bot-status-indicator status-stopped'; button.appendChild(indicator); button.appendChild(document.createTextNode(' Start Bot')); button.className = 'bot-control-btn start-btn';
    }
}

async function toggleBot() {
    showLoading();
    try {
        await autoSaveSettings(); let endpoint = botRunning ? '/api/bot/stop' : '/api/bot/start';
        const response = await fetch(endpoint, { method: 'POST' }); const data = await response.json();
        if (!response.ok && !(data && data.success === false && data.message && data.message.includes("not running"))) {
            throw new Error(data.error || data.message || `Bot operation failed (HTTP ${response.status})`);
        }
        updateBotStatusUI(data.running);
        if (data.success || (data.hasOwnProperty('running') && data.running === !botRunning && !data.error) || (endpoint === '/api/bot/stop' && !data.running) ) {
            showNotification(data.message || (data.running ? 'Bot started!' : 'Bot stopped!'), 'success');
        } else if (data.error || data.message) { showNotification('Warning: ' + (data.error || data.message), 'error'); }
    } catch (error) { showNotification('Error: ' + error.message, 'error');
    } finally { hideLoading(); setTimeout(checkBotStatus, 500); }
}

function initBotControls() {
    setInterval(checkBotStatus, 10000);
    const botControlBtn = document.getElementById('bot-control-btn');
    if (botControlBtn) {
        const newBotControlBtn = botControlBtn.cloneNode(true);
        botControlBtn.parentNode.replaceChild(newBotControlBtn, botControlBtn);
        newBotControlBtn.addEventListener('click', toggleBot);
    }
    checkBotStatus();
}

function startServerHealthCheck() {
    window.healthCheckIntervalId = setInterval(async () => {
        try {
            const response = await fetch('/api/settings', { signal: AbortSignal.timeout(3000) });
            if (!response.ok) { handleServerShutdown("Server responded with an error: " + response.status); }
        } catch (error) { handleServerShutdown("Server connection lost."); }
    }, 7000);
}

function handleServerShutdown(reason = "The settings server appears to have been shut down.") {
    if (window.healthCheckIntervalId) { clearInterval(window.healthCheckIntervalId); window.healthCheckIntervalId = null; }
    if (document.body.innerHTML.includes("Server Connection Lost") || document.body.innerHTML.includes("Server has been shut down")) return;
    try { window.close(); } catch (e) {}
    document.body.innerHTML = `<div class="container"><h1>Server Connection Lost</h1><p>${escapeHtml(reason)}</p><p>You can close this window now. If you didn't shut it down, please check the server console.</p></div>`;
}

function createTooltip(tooltipText) {
    if (!tooltipText) return document.createDocumentFragment();
    const tooltipContainer = document.createElement('span'); tooltipContainer.className = 'tooltip';
    const tooltipIcon = document.createElement('span'); tooltipIcon.className = 'tooltip-icon'; tooltipIcon.textContent = '?';
    const tooltipContent = document.createElement('span'); tooltipContent.className = 'tooltip-text'; tooltipContent.textContent = tooltipText;
    tooltipIcon.addEventListener('mouseenter', function() {
        const rect = tooltipIcon.getBoundingClientRect(); const contentWidth = tooltipContent.offsetWidth; const contentHeight = tooltipContent.offsetHeight;
        let left = rect.left + (rect.width / 2) - (contentWidth / 2);
        left = Math.max(10, Math.min(left, window.innerWidth - contentWidth - 10));
        tooltipContent.style.left = left + 'px';
        if (rect.top < 150 && (rect.bottom + 10 + contentHeight < window.innerHeight)) {
            tooltipContent.style.top = (rect.bottom + 10) + 'px'; tooltipContent.style.bottom = 'auto';
        } else {
            tooltipContent.style.bottom = (window.innerHeight - rect.top + 10) + 'px'; tooltipContent.style.top = 'auto';
        }
    });
    tooltipContainer.appendChild(tooltipIcon); tooltipContainer.appendChild(tooltipContent);
    return tooltipContainer;
}

document.addEventListener('DOMContentLoaded', function() {
    uiInitTime = Date.now();
    fetchSettings().then(() => {
        initBotControls(); startServerHealthCheck();
    }).catch(error => { showNotification("Failed to initialize settings editor: " + error.message, "error"); });
    document.getElementById('exit-button').addEventListener('click', exitServer);
    document.getElementById('delete-model-btn').addEventListener('click', function() { if (activeTab) { deleteModel(activeTab); } });
});