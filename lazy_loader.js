let settings = {};
let activeTab = null;
let collapsedSections = {};
let botRunning = false;
let autoSaveTimer = null;
let uiInitTime = 0;
const PASSWORD_ENTRY_GRACE_PERIOD = 3000;

let settingsSchema = {
    _global: {
        enabled: { type: 'boolean', tooltip: 'Enable or disable this bot' },
        bot_token: { type: 'text', tooltip: 'Discord Bot Token' },
        prompt_settings: {
            prompt_head: { type: 'text', multiline: true, tooltip: 'The main part of the prompt. Add style guidelines and Character definition here.' },
            dictionary_header: { type: 'text', multiline: true, tooltip: '(Optional) Header text for the dictionary section. Tell the bot what the dictionary means. ie. # Memories, # Notes:, # Response examples... etc...' },
            dictionary: { type: 'dictionary', tooltip: 'Mini Rag generation for model knowledge. Keywords separated by spaces will retrieve the memory.' },
            cache_capacity: { type: 'number', min: 1, max: 20, tooltip: 'Max number of messages to keep in cache' },
            cache_clear_time: { type: 'number', min: 0, tooltip: 'The amount of time (second) an item can exist in the cache without being triggered before it is removed.' },
            prompt_tail: { type: 'text', multiline: true, tooltip: '(Optional) Final note for the model. Example: You are chatting in a discord server' },
        },
        llm_settings: {
            model: { type: 'text', tooltip: 'Model identifier to use for generation' },
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
        response_limits: {
            response_limit_interval: { type: 'number', min: 0, tooltip: 'Time interval for rate limiting (seconds)' },
            max_bot_response_count_per_interval: { type: 'number', min: 1, tooltip: 'Number of responses from the bot allowed within the response_limit_interval' },
            max_user_input_message_length: { type: 'number', min: 1, tooltip: 'Maximum length of user messages (in characters)' },
            chat_clear_time: { type: 'number', min: 0, tooltip: 'Time (seconds) before chat history is truncated (see min_context_length)' },
            monitored_channels: { type: 'array', itemType: 'text', tooltip: 'Channel IDs that the bot can read and write to' },
            partial_ignore_list: { type: 'array', itemType: 'text', tooltip: 'IDs of users or bots that the bot will read, but will not trigger a response' },
            full_ignore_list: { type: 'array', itemType: 'text', tooltip: 'IDs that the bot will neither read nor respond to.' },
            typing_delay_range: { type: 'range', min: 0, max: 60, tooltip: 'Random number within the range is selected and the bot will spend that much time tyiping to create a typing effect.' },
            vision_enabled: { type: 'boolean', tooltip: 'Vision Enabled or disabled for this bot' },
            max_vision_queries_per_interval: { type: 'number', min: 0, tooltip: 'Max number of images that can be read per response limit interval' },
            vision_limit_interval: { type: 'number', min: 0, tooltip: 'interval at which vision is in time our ot time limit' },
            random_occurences_enabled: { type: 'boolean', tooltip: 'Bot can randomly pop up and respond in any channel' },
        }
    }
};

const defaultSettings = {
    enabled: true,
    bot_token: "BOT_TOKEN",
    prompt_settings: {
        prompt_head: "",
        prompt_tail: "",
        dictionary_header: "",
        dictionary: {},
        cache_capacity: 3,
        cache_clear_time: 300
    },
    llm_settings: {
        model: "accounts/fireworks/models/llama4-maverick-instruct-basic",
        max_context_length: 3000,
        min_context_length: 0,
        max_tokens: 100,
        temperature: 0.7,
        top_p: 1,
        top_k: 50,
        frequency_penalty: 1,
        presence_penalty: 0,
        n: 1,
        stop: [],
        reminder: ""
    },
    response_limits : {
        max_user_input_message_length: 300,
        response_limit_interval: 240,
        max_bot_response_count_per_interval: 20,
        chat_clear_time: 900,
        monitored_channels: [],
        partial_ignore_list: [],
        full_ignore_list: [],
        typing_delay_range: [1, 12],
        vision_enabled: false,
        vision_limit_interval: 120,
        max_vision_queries_per_interval: 4,
        random_occurences_enabled: false
    }
};

function ensureSettingsExist(modelName) {
    if (!settings[modelName]) {
        settings[modelName] = JSON.parse(JSON.stringify(defaultSettings));
        return;
    }
    
    if (settings[modelName].bot_settings) {
        if (settings[modelName].bot_settings.enabled !== undefined) {
            settings[modelName].enabled = settings[modelName].bot_settings.enabled;
        }
        
        if (settings[modelName].bot_settings.bot_token !== undefined) {
            settings[modelName].bot_token = settings[modelName].bot_settings.bot_token;
        }
        
        delete settings[modelName].bot_settings;
    }
    
    if (settings[modelName].enabled === undefined) {
        settings[modelName].enabled = defaultSettings.enabled;
    }
    
    if (settings[modelName].bot_token === undefined) {
        settings[modelName].bot_token = defaultSettings.bot_token;
    }
    
    if (settings[modelName].api_token !== undefined) {
        delete settings[modelName].api_token;
    }
    
    if (settings[modelName].bot_token && settings[modelName].bot_token.startsWith('ENV:')) {
        settings[modelName].bot_token = settings[modelName].bot_token.substring(4);
    }
    
    for (const category in defaultSettings) {
        if (category === 'enabled' || category === 'bot_token') continue;
        
        if (!settings[modelName][category]) {
            settings[modelName][category] = JSON.parse(JSON.stringify(defaultSettings[category]));
            continue;
        }
        
        for (const key in defaultSettings[category]) {
            if (settings[modelName][category][key] === undefined) {
                settings[modelName][category][key] = JSON.parse(JSON.stringify(defaultSettings[category][key]));
            }
        }
        
        const keysToRemove = [];
        for (const key in settings[modelName][category]) {
            if (defaultSettings[category][key] === undefined) {
                keysToRemove.push(key);
            }
        }
        
        for (const key of keysToRemove) {
            delete settings[modelName][category][key];
        }
    }
    
    const categoriesToRemove = [];
    for (const category in settings[modelName]) {
        if (category !== 'enabled' && 
            category !== 'bot_token' && 
            defaultSettings[category] === undefined) {
            categoriesToRemove.push(category);
        }
    }
    
    for (const category of categoriesToRemove) {
        delete settings[modelName][category];
    }
}

function setUnsavedChanges() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(autoSaveSettings, 3000);
}

async function autoSaveSettings() {
    try {
        for (const modelName in settings) {
            if (settings[modelName].api_token !== undefined) {
                delete settings[modelName].api_token;
            }
        }
        
        const response = await fetch('/api/settings?nocache=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || 'Unknown error occurred');
        }
        
        console.log('Settings saved immediately at ' + new Date().toLocaleTimeString());
    } catch (error) {
        console.error('Save error:', error);
        showNotification('Save failed: ' + error.message, 'error');
    }
}

async function updateBotToken(modelName, token) {
    if (Date.now() - uiInitTime < PASSWORD_ENTRY_GRACE_PERIOD) {
        console.log("Ignoring token update during grace period");
        return false;
    }
    
    try {
        const response = await fetch('/api/update_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_name: modelName,
                token: token
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || 'Unknown error occurred');
        }
        
        const data = await response.json();
        
        if (data.success && data.token_key) {
            settings[modelName].bot_token = data.token_key;
            setUnsavedChanges();
            return true;
        } else {
            throw new Error('Failed to update token');
        }
    } catch (error) {
        showNotification('Error updating token: ' + error.message, 'error');
        return false;
    }
}

async function updateApiToken(token) {
    if (Date.now() - uiInitTime < PASSWORD_ENTRY_GRACE_PERIOD) {
        console.log("Ignoring API token update during grace period");
        return false;
    }
    
    try {
        const response = await fetch('/api/update_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_name: 'api',
                token: token,
                token_key: "API_KEY"
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || 'Unknown error occurred');
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('API token updated successfully!', 'success');
            return true;
        } else {
            throw new Error('Failed to update API token');
        }
    } catch (error) {
        showNotification('Error updating API token: ' + error.message, 'error');
        return false;
    }
}

async function fetchSettings() {
    showLoading();
    try {
        uiInitTime = Date.now();
        
        const response = await fetch('/api/settings');
        if (!response.ok) {
            console.error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
            settings = initializeDefaultSettings();
            createModelTabs();
            activateTab("Bot");
            showNotification('Error fetching settings, using defaults', 'error');
            hideLoading();
            return;
        }
        
        let text = await response.text();
        console.log("Received settings text:", text ? text.substring(0, 50) + "..." : "(empty)");
        
        if (!text || !text.trim()) {
            console.log("Empty settings file detected, using defaults");
            settings = initializeDefaultSettings();
        } else {
            try {
                const parsed = JSON.parse(text);
                console.log("Parsed settings:", parsed);
                
                if (!parsed || 
                    typeof parsed !== 'object' || 
                    Array.isArray(parsed) || 
                    Object.keys(parsed).length === 0) {
                    console.log("Invalid or empty settings structure, using defaults");
                    settings = initializeDefaultSettings();
                } else {
                    settings = parsed;
                    
                    for (const modelName in settings) {
                        ensureSettingsExist(modelName);
                        
                        if (settings[modelName].bot_token && settings[modelName].bot_token.startsWith('ENV:')) {
                            settings[modelName].bot_token = settings[modelName].bot_token.substring(4);
                        }
                    }
                }
            } catch (parseError) {
                console.error("JSON parse error:", parseError);
                settings = initializeDefaultSettings();
                showNotification('Invalid settings JSON, using defaults', 'error');
            }
        }
        
        if (Object.keys(settings).length === 0) {
            console.log("No models after processing, creating default Default model");
            settings["BotName"] = JSON.parse(JSON.stringify(defaultSettings));
        }
        
        createModelTabs();
        
        const modelNames = Object.keys(settings);
        if (modelNames.length > 0) {
            console.log("Activating model:", modelNames[0]);
            activateTab(modelNames[0]);
        } else {
            console.error("Critical error: No models available after initialization");
            showNotification('Failed to initialize settings', 'error');
        }
    } catch (error) {
        console.error("Fatal error in fetchSettings:", error);
        showNotification('Critical error: ' + error.message, 'error');
        
        settings = initializeDefaultSettings();
        createModelTabs();
        activateTab("BotName");
    } finally {
        hideLoading();
    }
}

async function exitServer() {
    await autoSaveSettings();
    
    showLoading();
    try {
        const response = await fetch('/api/shutdown');
        if (!response.ok) {
            throw new Error(`Failed to shutdown server: ${response.status} ${response.statusText}`);
        }
        showNotification('Server is shutting down...', 'success');
        setTimeout(() => {
            document.body.innerHTML = '<div class="container"><h1>Server has been shut down</h1><p>You can close this window now.</p></div>';
        }, 1000);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function getFieldSchema(modelName, category, settingKey, subKey = null) {
    if (category === null && settingsSchema._global[settingKey]) {
        return settingsSchema._global[settingKey];
    }
    
    if (subKey !== null &&
        settingsSchema._global[category] && 
        settingsSchema._global[category][settingKey] && 
        settingsSchema._global[category][settingKey][subKey]) {
        return settingsSchema._global[category][settingKey][subKey];
    }
    
    if (subKey === null && 
        settingsSchema._global[category] && 
        settingsSchema._global[category][settingKey]) {
        return settingsSchema._global[category][settingKey];
    }
    
    return { 
        type: typeof settings[modelName][category][settingKey] === 'number' ? 'number' : 'text' 
    };
}

function createTooltip(tooltipText) {
    if (!tooltipText) return '';
    
    const tooltipContainer = document.createElement('span');
    tooltipContainer.className = 'tooltip';
    
    const tooltipIcon = document.createElement('span');
    tooltipIcon.className = 'tooltip-icon';
    tooltipIcon.textContent = '?';
    
    const tooltipContent = document.createElement('span');
    tooltipContent.className = 'tooltip-text';
    tooltipContent.textContent = tooltipText;
    
    tooltipIcon.addEventListener('mouseenter', function() {
        const rect = tooltipIcon.getBoundingClientRect();
        
        tooltipContent.style.left = Math.min(
            Math.max(10, rect.left + (rect.width / 2)),
            window.innerWidth - 260
        ) + 'px';
        
        if (rect.top < 150) {
            tooltipContent.style.top = (rect.bottom + 10) + 'px';
            tooltipContent.style.bottom = 'auto';
            tooltipContent.style.setProperty('--arrow-top', '-5px');
            tooltipContent.style.setProperty('--arrow-bottom', 'auto');
            tooltipContent.style.setProperty('--border-color', 'transparent transparent #2d2d2d transparent');
        } else {
            tooltipContent.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            tooltipContent.style.top = 'auto';
            tooltipContent.style.setProperty('--arrow-bottom', '-5px');
            tooltipContent.style.setProperty('--arrow-top', 'auto');
            tooltipContent.style.setProperty('--border-color', '#2d2d2d transparent transparent transparent');
        }
    });
    
    tooltipContainer.appendChild(tooltipIcon);
    tooltipContainer.appendChild(tooltipContent);
    
    return tooltipContainer;
}

function validateInput(value, schema) {
    if (!schema) return { valid: true };
    
    if (schema.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
            return { valid: false, message: 'Must be a valid number' };
        }
        
        if (schema.min !== undefined && numValue < schema.min) {
            return { valid: false, message: `Minimum value is ${schema.min}` };
        }
        
        if (schema.max !== undefined && numValue > schema.max) {
            return { valid: false, message: `Maximum value is ${schema.max}` };
        }
    }
    
    return { valid: true };
}

function initializeDefaultSettings() {
    if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
        console.log("Creating default settings with Default model");
        settings = { 
            "BotName": JSON.parse(JSON.stringify(defaultSettings)) 
        };
    }
    return settings;
}

function createModelTabs() {
    const tabsContainer = document.getElementById('models-tabs');
    tabsContainer.innerHTML = '';
    
    for (const modelName in settings) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        
        if (settings[modelName].enabled === false) {
            tab.classList.add('disabled');
        }
        
        tab.textContent = escapeHtml(modelName);
        tab.setAttribute('data-model', modelName);
        
        tab.onclick = function(e) {
            activateTab(modelName);
        };
        
        tab.ondblclick = function(e) {
            renameModel(modelName);
        };
        
        tabsContainer.appendChild(tab);
    }
    
    const addButton = document.createElement('button');
    addButton.className = 'add-bot-button';
    addButton.innerHTML = '<i>+</i> Add Bot';
    addButton.onclick = addNewModel;
    tabsContainer.appendChild(addButton);
    
    updateDeleteButtonVisibility();
}

function renameModel(oldName) {
    const newName = prompt('Enter new name for the bot:', oldName);
    
    if (!newName || newName.trim() === '') {
        return;
    }
    
    if (newName !== oldName && settings[newName]) {
        showNotification('A bot with this name already exists', 'error');
        return;
    }
    
    if (newName !== oldName) {
        const orderedSettings = {};
        const allModelNames = Object.keys(settings);
        
        for (const modelName of allModelNames) {
            if (modelName === oldName) {
                orderedSettings[newName] = JSON.parse(JSON.stringify(settings[oldName]));
            } else {
                orderedSettings[modelName] = settings[modelName];
            }
        }
        
        settings = orderedSettings;
        const tab = document.querySelector(`.tab[data-model="${oldName}"]`);
        if (tab) {
            tab.textContent = escapeHtml(newName);
            tab.setAttribute('data-model', newName);
            
            tab.onclick = function(e) {
                activateTab(newName);
            };
            
            tab.ondblclick = function(e) {
                renameModel(newName);
            };
        }
        
        if (activeTab === oldName) {
            activeTab = newName;
        }
        
        // need to update token name
        updateDeleteButtonVisibility();
        setUnsavedChanges();
        showNotification(`Bot renamed from "${escapeHtml(oldName)}" to "${escapeHtml(newName)}"`, 'success');
    }
}

function renderModelContent(modelName) {
    const container = document.getElementById('models-content');
    container.innerHTML = '';
    
    ensureSettingsExist(modelName);
    
    const modelSection = document.createElement('div');
    modelSection.className = 'tab-content active';
    modelSection.setAttribute('data-model', modelName);
    
    const botStatusToggle = document.createElement('div');
    botStatusToggle.className = 'bot-status-toggle';
    
    const isEnabled = settings[modelName].enabled !== false;
    
    botStatusToggle.innerHTML = `
        <label class="switch">
            <input type="checkbox" id="bot-enabled-toggle" ${isEnabled ? 'checked' : ''}>
            <span class="slider"></span>
        </label>
        <label for="bot-enabled-toggle">
            Bot Status: 
            <span class="status-text ${isEnabled ? 'status-enabled' : 'status-disabled'}">
                ${isEnabled ? 'Enabled' : 'Disabled'}
            </span>
        </label>
    `;
    
    const toggleInput = botStatusToggle.querySelector('#bot-enabled-toggle');
    toggleInput.onchange = function() {
        const newStatus = this.checked;
        settings[modelName].enabled = newStatus;
        
        const statusText = botStatusToggle.querySelector('.status-text');
        statusText.textContent = newStatus ? 'Enabled' : 'Disabled';
        statusText.className = `status-text ${newStatus ? 'status-enabled' : 'status-disabled'}`;
        
        const tab = document.querySelector(`.tab[data-model="${modelName}"]`);
        if (newStatus) {
            tab.classList.remove('disabled');
        } else {
            tab.classList.add('disabled');
        }
        
        setUnsavedChanges();
    };
    
    modelSection.appendChild(botStatusToggle);
    
    const tokensSection = document.createElement('div');
    tokensSection.className = 'section';
    tokensSection.style.marginBottom = '20px';
    
    const botTokenFormGroup = document.createElement('div');
    botTokenFormGroup.className = 'form-group';
    
    const botTokenSchema = getFieldSchema(modelName, null, 'bot_token');
    botTokenFormGroup.appendChild(createTextInput(modelName, null, 'bot_token', settings[modelName].bot_token, botTokenSchema));
    
    tokensSection.appendChild(botTokenFormGroup);
    
    const apiTokenFormGroup = document.createElement('div');
    apiTokenFormGroup.className = 'form-group';
    
    const apiTokenLabel = document.createElement('div');
    apiTokenLabel.className = 'label-container';
    
    const apiTokenLabelText = document.createElement('label');
    apiTokenLabelText.textContent = 'API Token';
    apiTokenLabel.appendChild(apiTokenLabelText);
    
    const apiTokenTooltip = createTooltip('API Token (stored in .env file as API_BOT_TOKEN, not in settings.json)');
    apiTokenLabel.appendChild(apiTokenTooltip);
    
    apiTokenFormGroup.appendChild(apiTokenLabel);
    
    const apiTokenInput = document.createElement('input');
    apiTokenInput.setAttribute('type', 'password');
    apiTokenInput.setAttribute('placeholder', '•••••••••••••••••••••••');
    apiTokenInput.setAttribute('id', `${modelName}-api-token`);
    
    apiTokenInput.onchange = async function() {
        if (this.value.trim() === '') {
            return;
        }
        
        showLoading();
        
        try {
            await updateApiToken(this.value);
            this.value = '';
        } finally {
            hideLoading();
        }
    };
    
    apiTokenFormGroup.appendChild(apiTokenInput);
    
    const apiTokenNote = document.createElement('div');
    apiTokenNote.style.marginTop = '5px';
    apiTokenNote.style.fontSize = '12px';
    apiTokenNote.style.color = '#aaa';
    apiTokenNote.textContent = 'Note: API token is stored in .env file as API_BOT_TOKEN';
    
    apiTokenFormGroup.appendChild(apiTokenNote);
    tokensSection.appendChild(apiTokenFormGroup);
    
    modelSection.appendChild(tokensSection);
    
    const schemaCategories = Object.keys(settingsSchema._global || {})
        .filter(cat => cat !== 'enabled' && cat !== 'bot_token');
    
    const categoryOrder = [...schemaCategories];
    for (const category in settings[modelName]) {
        if (category === 'enabled' || category === 'bot_token') continue;
        if (!categoryOrder.includes(category)) {
            categoryOrder.push(category);
        }
    }
    
    for (const category of categoryOrder) {
        if (!settings[modelName][category]) continue;
        
        const categorySection = document.createElement('div');
        categorySection.className = 'section';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'collapsible-section';
        
        const headerTitle = document.createElement('h3');
        headerTitle.innerHTML = `${formatCategoryName(category)} <span class="toggle-icon">▼</span>`;
        
        headerDiv.appendChild(headerTitle);
        categorySection.appendChild(headerDiv);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'collapsible-content';
        
        const sectionKey = `${modelName}-${category}`;
        if (collapsedSections[sectionKey] === false) {
        } else {
            headerTitle.querySelector('.toggle-icon').classList.add('collapsed');
            contentDiv.classList.add('collapsed');
        }

        headerDiv.addEventListener('click', function() {
            const icon = headerTitle.querySelector('.toggle-icon');
            icon.classList.toggle('collapsed');
            contentDiv.classList.toggle('collapsed');
            collapsedSections[sectionKey] = contentDiv.classList.contains('collapsed');
        });
        
        const categorySchema = settingsSchema._global[category] || {};
        
        const allSettingKeys = new Set();
        if (categorySchema) {
            Object.keys(categorySchema).forEach(key => allSettingKeys.add(key));
        }
        Object.keys(settings[modelName][category]).forEach(key => allSettingKeys.add(key));
        
        let orderedSettingKeys = Array.from(allSettingKeys);
        
        let currentIndex = 0;
        while (currentIndex < orderedSettingKeys.length) {
            const settingKey = orderedSettingKeys[currentIndex];
            const settingValue = settings[modelName][category][settingKey];
            
            if (settingValue === undefined || settingKey === 'typing_delay_range') {
                currentIndex++;
                continue;
            }
            
            if (typeof settingValue === 'object' && settingValue !== null && 
                !Array.isArray(settingValue) && settingKey !== 'dictionary' && 
                Object.keys(settingValue).length > 0) {
                currentIndex++;
                continue;
            }
            
            if (typeof settingValue === 'number') {
                const numericRow = document.createElement('div');
                numericRow.className = 'form-row';
                numericRow.style.display = 'flex';
                numericRow.style.justifyContent = 'flex-start';
                numericRow.style.alignItems = 'flex-start';
                numericRow.style.flexWrap = 'wrap';
                numericRow.style.gap = '10px';
                
                let numericCount = 0;
                let i = currentIndex;
                
                while (i < orderedSettingKeys.length && numericCount < 3) {
                    const nextKey = orderedSettingKeys[i];
                    const nextValue = settings[modelName][category][nextKey];
                    
                    if (nextKey === 'typing_delay_range' || 
                        nextValue === undefined || 
                        typeof nextValue !== 'number') {
                        break;
                    }
                    
                    const formCol = document.createElement('div');
                    formCol.className = 'form-col';
                    formCol.style.width = 'calc(33% - 10px)';
                    formCol.style.boxSizing = 'border-box';
                    
                    const schema = getFieldSchema(modelName, category, nextKey);
                    formCol.appendChild(createNumberInputWithSchema(modelName, category, nextKey, nextValue, schema));
                    
                    numericRow.appendChild(formCol);
                    numericCount++;
                    i++;
                }
                
                if (numericCount > 0) {
                    contentDiv.appendChild(numericRow);
                    currentIndex += numericCount;
                    continue;
                }
            }
            
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            
            renderSettingField(modelName, category, settingKey, settingValue, formGroup);
            contentDiv.appendChild(formGroup);
            
            currentIndex++;
        }
        
        if (settings[modelName][category]['typing_delay_range']) {
            const rangeValues = settings[modelName][category]['typing_delay_range'];
            if (Array.isArray(rangeValues) && rangeValues.length === 2) {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                
                const schema = getFieldSchema(modelName, category, 'typing_delay_range');
                
                const labelContainer = document.createElement('div');
                labelContainer.className = 'label-container';
                
                const rangeLabel = document.createElement('label');
                rangeLabel.setAttribute('for', `${modelName}-${category}-typing_delay_range`);
                rangeLabel.textContent = 'Typing Delay Range';
                
                labelContainer.appendChild(rangeLabel);
                
                if (schema && schema.tooltip) {
                    labelContainer.appendChild(createTooltip(schema.tooltip));
                }
                
                const rangeContainer = document.createElement('div');
                rangeContainer.className = 'range-container';
                
                const minInput = document.createElement('input');
                minInput.setAttribute('type', 'number');
                minInput.setAttribute('id', `${modelName}-${category}-typing_delay_range-min`);
                minInput.value = rangeValues[0];
                
                if (schema && schema.min !== undefined) minInput.min = schema.min;
                if (schema && schema.max !== undefined) minInput.max = schema.max;
                
                minInput.onchange = function() {
                    updateRangeValue(modelName, category, 'typing_delay_range', 0, Number(this.value));
                };
                
                const separator = document.createElement('span');
                separator.textContent = 'to';
                
                const maxInput = document.createElement('input');
                maxInput.setAttribute('type', 'number');
                maxInput.setAttribute('id', `${modelName}-${category}-typing_delay_range-max`);
                maxInput.value = rangeValues[1];
                
                if (schema && schema.min !== undefined) maxInput.min = schema.min;
                if (schema && schema.max !== undefined) maxInput.max = schema.max;
                
                maxInput.onchange = function() {
                    updateRangeValue(modelName, category, 'typing_delay_range', 1, Number(this.value));
                };
                
                rangeContainer.appendChild(minInput);
                rangeContainer.appendChild(separator);
                rangeContainer.appendChild(maxInput);
                
                formGroup.appendChild(labelContainer);
                formGroup.appendChild(rangeContainer);
                contentDiv.appendChild(formGroup);
            }
        }
        
        for (const settingKey of orderedSettingKeys) {
            const settingValue = settings[modelName][category][settingKey];
            
            if (typeof settingValue !== 'object' || settingValue === null || 
                Array.isArray(settingValue) || settingKey === 'dictionary' || 
                Object.keys(settingValue).length === 0) {
                continue;
            }
            
            const subsection = document.createElement('div');
            subsection.className = 'section';
            subsection.innerHTML = `<h4>${formatSettingName(settingKey)}</h4>`;
            
            const subSchema = categorySchema[settingKey] || {};
            const subSchemaKeys = Object.keys(subSchema);
            
            const subKeyOrder = [...subSchemaKeys];
            for (const subKey in settingValue) {
                if (!subKeyOrder.includes(subKey)) {
                    subKeyOrder.push(subKey);
                }
            }
            
            let nestedIndex = 0;
            while (nestedIndex < subKeyOrder.length) {
                const subKey = subKeyOrder[nestedIndex];
                const subValue = settingValue[subKey];
                
                if (subValue === undefined) {
                    nestedIndex++;
                    continue;
                }
                
                if (typeof subValue === 'number') {
                    const numericRow = document.createElement('div');
                    numericRow.className = 'form-row';
                    numericRow.style.display = 'flex';
                    numericRow.style.justifyContent = 'flex-start'; // Left align
                    numericRow.style.alignItems = 'flex-start';
                    numericRow.style.flexWrap = 'wrap';
                    numericRow.style.gap = '10px'; // Add gap between columns
                    
                    let numericCount = 0;
                    let i = nestedIndex;
                    
                    while (i < subKeyOrder.length && numericCount < 3) {
                        const nextKey = subKeyOrder[i];
                        const nextValue = settingValue[nextKey];
                        
                        if (nextValue === undefined || typeof nextValue !== 'number') {
                            break;
                        }
                        
                        const formCol = document.createElement('div');
                        formCol.className = 'form-col';
                        formCol.style.width = 'calc(33% - 10px)'; // Fixed width with gap spacing
                        formCol.style.boxSizing = 'border-box';
                        
                        const schema = getFieldSchema(modelName, category, settingKey, nextKey);
                        formCol.appendChild(createNestedNumberInput(modelName, category, settingKey, nextKey, nextValue, schema));
                        
                        numericRow.appendChild(formCol);
                        numericCount++;
                        i++;
                    }
                    
                    if (numericCount > 0) {
                        subsection.appendChild(numericRow);
                        nestedIndex += numericCount;
                        continue;
                    }
                }
                
                const subFormGroup = document.createElement('div');
                subFormGroup.className = 'form-group';
                
                renderNestedSettingField(modelName, category, settingKey, subKey, subValue, subFormGroup);
                subsection.appendChild(subFormGroup);
                
                nestedIndex++;
            }
            
            contentDiv.appendChild(subsection);
        }
        
        categorySection.appendChild(contentDiv);
        modelSection.appendChild(categorySection);
    }
    
    container.appendChild(modelSection);
}

function renderSettingField(modelName, category, settingKey, settingValue, formGroup) {
    const schema = category === null ? 
        getFieldSchema(modelName, null, settingKey) : 
        getFieldSchema(modelName, category, settingKey);
    
    if (settingKey === 'dictionary' || (schema && schema.type === 'dictionary')) {
        const dictSchema = schema || { type: 'dictionary', tooltip: 'Key-value dictionary' };
        
        const labelContainer = document.createElement('div');
        labelContainer.className = 'label-container';
        
        const dictLabel = document.createElement('label');
        dictLabel.setAttribute('for', `${modelName}-${category}-${settingKey}`);
        dictLabel.textContent = 'Dictionary';
        
        labelContainer.appendChild(dictLabel);
        
        if (dictSchema.tooltip) {
            labelContainer.appendChild(createTooltip(dictSchema.tooltip));
        }
        
        const entriesContainer = document.createElement('div');
        entriesContainer.setAttribute('id', `${modelName}-${category}-${settingKey}-entries`);
        
        const addButton = document.createElement('button');
        addButton.className = 'add-entry';
        addButton.textContent = '+ Add Entry';
        addButton.onclick = function() {
            addDictionaryEntry(modelName, category, settingKey);
        };
        
        formGroup.appendChild(labelContainer);
        formGroup.appendChild(entriesContainer);
        formGroup.appendChild(addButton);
        
        for (const dictKey in settingValue) {
            const dictValue = settingValue[dictKey];
            const entryDiv = createDictionaryEntryElement(modelName, category, settingKey, dictKey, dictValue);
            entriesContainer.appendChild(entryDiv);
        }
        
        return true;
    }
    
    else if (Array.isArray(settingValue) && settingKey !== 'typing_delay_range') {
        const arraySchema = schema || { 
            type: 'array', 
            itemType: typeof settingValue[0] === 'number' ? 'number' : 'text',
            tooltip: `List of ${formatSettingName(settingKey)}` 
        };
        
        const labelContainer = document.createElement('div');
        labelContainer.className = 'label-container';
        
        const arrayLabel = document.createElement('label');
        arrayLabel.setAttribute('for', `${modelName}-${category}-${settingKey}`);
        arrayLabel.textContent = formatSettingName(settingKey);
        
        labelContainer.appendChild(arrayLabel);
        
        if (arraySchema.tooltip) {
            labelContainer.appendChild(createTooltip(arraySchema.tooltip));
        }
        
        const entriesContainer = document.createElement('div');
        entriesContainer.setAttribute('id', `${modelName}-${category}-${settingKey}-entries`);
        
        const addButton = document.createElement('button');
        addButton.className = 'add-entry';
        addButton.textContent = '+ Add Entry';
        addButton.onclick = function() {
            addArrayEntry(modelName, category, settingKey);
        };
        
        formGroup.appendChild(labelContainer);
        formGroup.appendChild(entriesContainer);
        formGroup.appendChild(addButton);
        
        settingValue.forEach((value, index) => {
            const entryDiv = createArrayEntryElement(modelName, category, settingKey, index, value);
            entriesContainer.appendChild(entryDiv);
        });
        
        return true;
    }
    
    else if (typeof settingValue === 'boolean' || (schema && schema.type === 'boolean')) {
        formGroup.appendChild(createBooleanInput(modelName, category, settingKey, settingValue, schema));
        return true;
    }
    
    else if (typeof settingValue === 'string' || (schema && schema.type === 'text')) {
        formGroup.appendChild(createTextInput(modelName, category, settingKey, settingValue, schema));
        return true;
    }
    
    return false;
}

function renderNestedSettingField(modelName, category, parentKey, childKey, settingValue, formGroup) {
    const schema = getFieldSchema(modelName, category, parentKey, childKey);
    
    if (typeof settingValue === 'boolean' || (schema && schema.type === 'boolean')) {
        formGroup.appendChild(createNestedBooleanInput(modelName, category, parentKey, childKey, settingValue, schema));
    } else if (typeof settingValue === 'string' || (schema && schema.type === 'text')) {
        formGroup.appendChild(createNestedTextInput(modelName, category, parentKey, childKey, settingValue, schema));
    }
}

function createFormRow(modelName, category, fields) {
    const formRow = document.createElement('div');
    formRow.className = 'form-row';
    
    fields.forEach(settingKey => {
        const settingValue = settings[modelName][category][settingKey];
        const formCol = document.createElement('div');
        formCol.className = 'form-col';
        
        const schema = getFieldSchema(modelName, category, settingKey);
        formCol.appendChild(createNumberInputWithSchema(modelName, category, settingKey, settingValue, schema));
        
        formRow.appendChild(formCol);
    });
    
    return formRow;
}

function createNumberInputWithSchema(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    
    const fieldId = category === null ? 
        `${modelName}-${settingKey}` : 
        `${modelName}-${category}-${settingKey}`;
    
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', fieldId);
    labelElement.textContent = formatSettingName(settingKey);
    
    labelContainer.appendChild(labelElement);
    
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    
    const inputElement = document.createElement('input');
    inputElement.setAttribute('type', 'number');
    inputElement.setAttribute('id', fieldId);
    inputElement.className = 'number-input';
    inputElement.value = settingValue;
    
    if (schema) {
        if (schema.min !== undefined) inputElement.setAttribute('min', schema.min);
        if (schema.max !== undefined) inputElement.setAttribute('max', schema.max);
        if (schema.step !== undefined) inputElement.setAttribute('step', schema.step);
    }
    
    const validationMessage = document.createElement('div');
    validationMessage.className = 'validation-message';
    validationMessage.style.display = 'none';
    
    inputElement.oninput = function() {
        const validation = validateInput(this.value, schema);
        if (!validation.valid) {
            this.classList.add('invalid-input');
            validationMessage.textContent = validation.message;
            validationMessage.style.display = 'block';
        } else {
            this.classList.remove('invalid-input');
            validationMessage.style.display = 'none';
        }
    };
    
    inputElement.onchange = function() {
        const validation = validateInput(this.value, schema);
        if (!validation.valid) {
            showNotification(validation.message, 'error');
            this.value = settingValue;
            this.classList.remove('invalid-input');
            validationMessage.style.display = 'none';
            return;
        }
        
        let numValue = Number(this.value);
        updateSetting(modelName, category, settingKey, numValue);
    };
    
    container.appendChild(labelContainer);
    container.appendChild(inputElement);
    container.appendChild(validationMessage);
    
    return container;
}

function createNestedNumberInput(modelName, category, parentKey, childKey, settingValue, schema) {
    const container = document.createElement('div');
    
    const fieldId = `${modelName}-${category}-${parentKey}-${childKey}`;
    
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', fieldId);
    labelElement.textContent = formatSettingName(childKey);
    
    labelContainer.appendChild(labelElement);
    
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    
    const inputElement = document.createElement('input');
    inputElement.setAttribute('type', 'number');
    inputElement.setAttribute('id', fieldId);
    inputElement.className = 'number-input';
    inputElement.value = settingValue;
    
    if (schema) {
        if (schema.min !== undefined) inputElement.setAttribute('min', schema.min);
        if (schema.max !== undefined) inputElement.setAttribute('max', schema.max);
        if (schema.step !== undefined) inputElement.setAttribute('step', schema.step);
    }
    
    inputElement.onchange = function() {
        const numValue = Number(this.value);
        if (isNaN(numValue)) {
            showNotification('Please enter a valid number', 'error');
            this.value = settingValue;
            return;
        }
        updateNestedSetting(modelName, category, parentKey, childKey, numValue);
    };
    
    container.appendChild(labelContainer);
    container.appendChild(inputElement);
    
    return container;
}

function createTextInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    
    const fieldId = category === null ? 
        `${modelName}-${settingKey}` : 
        `${modelName}-${category}-${settingKey}`;
    
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', fieldId);
    labelElement.textContent = formatSettingName(settingKey);
    
    labelContainer.appendChild(labelElement);
    
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    
    let inputElement;
    const isMultiline = (schema && schema.multiline) || 
                        settingKey === 'prompt_head' || 
                        settingKey === 'prompt_tail' || 
                        settingKey === 'dictionary_header' || 
                        settingKey === 'reminder';
    
    const isPasswordField = (settingKey === 'bot_token');
    
    if (isMultiline) {
        inputElement = document.createElement('textarea');
        inputElement.setAttribute('id', fieldId);
        
        if (settingKey === 'prompt_head' || settingKey === 'prompt_tail') {
            inputElement.className = 'large';
        } else if (settingKey === 'dictionary_header' || settingKey === 'reminder') {
            inputElement.className = 'medium';
        }
    } else {
        inputElement = document.createElement('input');
        inputElement.setAttribute('type', isPasswordField ? 'password' : 'text');
        inputElement.setAttribute('id', fieldId);
    }
    
    if (settingKey === 'bot_token') {
        if (settingValue) {
            inputElement.setAttribute('placeholder', '•••••••••••••••••••••••');
        } else {
            inputElement.setAttribute('placeholder', 'Enter your bot token');
        }
        inputElement.value = '';
    } else {
        inputElement.value = settingValue;
    }
    
    if (settingKey === 'bot_token') {
        inputElement.onchange = async function() {
            if (this.value.trim() === '') {
                return;
            }
            
            showLoading();
            
            try {
                const success = await updateBotToken(modelName, this.value);
                
                if (success) {
                    this.value = '';
                    this.setAttribute('placeholder', '•••••••••••••••••••••••');
                    showNotification('Bot token updated successfully!', 'success');
                }
            } finally {
                hideLoading();
            }
        };
    } else {
        inputElement.onchange = function() {
            if (category === null) {
                settings[modelName][settingKey] = this.value;
                setUnsavedChanges();
            } else {
                settings[modelName][category][settingKey] = this.value;
                setUnsavedChanges();
            }
        };
    }
    
    container.appendChild(labelContainer);
    container.appendChild(inputElement);
    
    return container;
}

function createNestedTextInput(modelName, category, parentKey, childKey, settingValue, schema) {
    const container = document.createElement('div');
    
    const fieldId = `${modelName}-${category}-${parentKey}-${childKey}`;
    
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', fieldId);
    labelElement.textContent = formatSettingName(childKey);
    
    labelContainer.appendChild(labelElement);
    
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    
    let inputElement;
    const isMultiline = (schema && schema.multiline) || 
                        childKey === 'prompt_head' || 
                        childKey === 'prompt_tail' || 
                        childKey === 'dictionary_header' || 
                        childKey === 'reminder';
    
    if (isMultiline) {
        inputElement = document.createElement('textarea');
        inputElement.setAttribute('id', fieldId);
        
        if (childKey === 'prompt_head' || childKey === 'prompt_tail') {
            inputElement.className = 'large';
        } else if (childKey === 'dictionary_header' || childKey === 'reminder') {
            inputElement.className = 'medium';
        }
    } else {
        inputElement = document.createElement('input');
        inputElement.setAttribute('type', 'text');
        inputElement.setAttribute('id', fieldId);
    }
    
    inputElement.value = settingValue;
    
    inputElement.onchange = function() {
        updateNestedSetting(modelName, category, parentKey, childKey, this.value);
    };
    
    container.appendChild(labelContainer);
    container.appendChild(inputElement);
    
    return container;
}

function createBooleanInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    
    const fieldId = category === null ? 
        `${modelName}-${settingKey}` : 
        `${modelName}-${category}-${settingKey}`;
    
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', fieldId);
    labelElement.textContent = formatSettingName(settingKey);
    
    labelContainer.appendChild(labelElement);
    
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    
    const select = document.createElement('select');
    select.setAttribute('id', fieldId);
    
    const trueOption = document.createElement('option');
    trueOption.value = 'true';
    trueOption.textContent = 'True';
    if (settingValue) trueOption.selected = true;
    
    const falseOption = document.createElement('option');
    falseOption.value = 'false';
    falseOption.textContent = 'False';
    if (!settingValue) falseOption.selected = true;
    
    select.appendChild(trueOption);
    select.appendChild(falseOption);
    
    select.onchange = function() {
        updateSetting(modelName, category, settingKey, this.value === 'true');
    };
    
    container.appendChild(labelContainer);
    container.appendChild(select);
    
    return container;
}

function createNestedBooleanInput(modelName, category, parentKey, childKey, settingValue, schema) {
    const container = document.createElement('div');
    
    const fieldId = `${modelName}-${category}-${parentKey}-${childKey}`;
    
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', fieldId);
    labelElement.textContent = formatSettingName(childKey);
    
    labelContainer.appendChild(labelElement);
    
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    
    const select = document.createElement('select');
    select.setAttribute('id', fieldId);
    
    const trueOption = document.createElement('option');
    trueOption.value = 'true';
    trueOption.textContent = 'True';
    if (settingValue) trueOption.selected = true;
    
    const falseOption = document.createElement('option');
    falseOption.value = 'false';
    falseOption.textContent = 'False';
    if (!settingValue) falseOption.selected = true;
    
    select.appendChild(trueOption);
    select.appendChild(falseOption);
    
    select.onchange = function() {
        updateNestedSetting(modelName, category, parentKey, childKey, this.value === 'true');
    };
    
    container.appendChild(labelContainer);
    container.appendChild(select);
    
    return container;
}

function createArrayEntryElement(modelName, category, settingKey, index, value) {
    const schema = getFieldSchema(modelName, category, settingKey);
    const entryDiv = document.createElement('div');
    entryDiv.className = 'array-entry';
    
    let inputElement;
    const itemType = schema && schema.itemType ? schema.itemType : typeof value === 'number' ? 'number' : 'text';
    
    if (itemType === 'number') {
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        inputElement.value = Number(value);
        
        if (schema) {
            if (schema.min !== undefined) inputElement.min = schema.min;
            if (schema.max !== undefined) inputElement.max = schema.max;
            if (schema.step !== undefined) inputElement.step = schema.step;
        }
        
        inputElement.onchange = function() {
            const numValue = Number(this.value);
            if (isNaN(numValue)) {
                showNotification('Please enter a valid number', 'error');
                this.value = value;
                return;
            }
            updateArrayValue(modelName, category, settingKey, index, numValue);
        };
    } else {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = typeof value === 'string' ? value : String(value);
        inputElement.onchange = function() {
            updateArrayValue(modelName, category, settingKey, index, this.value);
        };
    }
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-entry';
    removeButton.textContent = '-';
    removeButton.onclick = function() {
        removeArrayEntry(modelName, category, settingKey, index);
    };
    
    entryDiv.appendChild(inputElement);
    entryDiv.appendChild(removeButton);
    
    return entryDiv;
}

function createDictionaryEntryElement(modelName, category, settingKey, dictKey, dictValue) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'dictionary-entry';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'dictionary-key';
    keyInput.value = dictKey;
    keyInput.onchange = function() {
        updateDictionaryKey(modelName, category, settingKey, dictKey, this.value);
    };
    
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'dictionary-value';
    valueInput.value = typeof dictValue === 'string' ? dictValue : '';
    valueInput.onchange = function() {
        updateDictionaryValue(modelName, category, settingKey, dictKey, this.value);
    };
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'dictionary-actions';
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-entry';
    removeButton.textContent = '-';
    removeButton.onclick = function() {
        removeDictionaryEntry(modelName, category, settingKey, dictKey);
    };
    
    actionsDiv.appendChild(removeButton);
    
    entryDiv.appendChild(keyInput);
    entryDiv.appendChild(valueInput);
    entryDiv.appendChild(actionsDiv);
    
    return entryDiv;
}

function updateSetting(modelName, category, settingKey, value) {
    if (category === null) {
        settings[modelName][settingKey] = value;
    } else {
        settings[modelName][category][settingKey] = value;
    }
    
    setUnsavedChanges();
}

function updateNestedSetting(modelName, category, parentKey, childKey, value) {
    settings[modelName][category][parentKey][childKey] = value;
    setUnsavedChanges();
}

function updateRangeValue(modelName, category, settingKey, index, value) {
    const array = settings[modelName][category][settingKey];
    if (index === 0 && value > array[1]) {
        showNotification('Minimum value cannot be greater than maximum', 'error');
        return;
    } else if (index === 1 && value < array[0]) {
        showNotification('Maximum value cannot be less than minimum', 'error');
        ;return
    }
    settings[modelName][category][settingKey][index] = value;
    setUnsavedChanges();


}function updateDictionaryKey(modelName, category, settingKey, oldKey, newKey) {
    if (oldKey === newKey) return;
    
    if (newKey.trim() === '') {
        showNotification('Dictionary key cannot be empty', 'error');
        renderModelContent(activeTab);
        return;
    }
    
    if (settings[modelName][category][settingKey][newKey] !== undefined) {
        showNotification('A key with this name already exists', 'error');
        renderModelContent(activeTab);
        return;
    }
    
    const oldDict = settings[modelName][category][settingKey];
    const newDict = {};
    
    for (const key in oldDict) {
        if (key === oldKey) {
            newDict[newKey] = oldDict[oldKey];
        } else {
            newDict[key] = oldDict[key];
        }
    }
    
    settings[modelName][category][settingKey] = newDict;
    setUnsavedChanges();
    
    renderModelContent(activeTab);
}

function updateDictionaryValue(modelName, category, settingKey, key, value) {
    settings[modelName][category][settingKey][key] = value;
    setUnsavedChanges();
}

function updateArrayValue(modelName, category, settingKey, index, value) {
    const schema = getFieldSchema(modelName, category, settingKey);
    const itemType = schema && schema.itemType ? schema.itemType : typeof value === 'number' ? 'number' : 'text';
    
    let typedValue = value;
    if (itemType === 'number') {
        typedValue = Number(value);
        if (isNaN(typedValue)) {
            showNotification('Please enter a valid number', 'error');
            return;
        }
    }
    
    settings[modelName][category][settingKey][index] = typedValue;
    setUnsavedChanges();
}

function addNewModel() {
    const modelName = prompt('Enter name for the new model:');
    if (modelName && modelName.trim() !== '') {
        const sanitizedName = modelName.trim();
        
        if (settings[sanitizedName]) {
            showNotification('A model with this name already exists', 'error');
            return;
        }
        
        settings[sanitizedName] = JSON.parse(JSON.stringify(defaultSettings));
        
        setUnsavedChanges();
        
        createModelTabs();
        activateTab(sanitizedName);
    }
}

function deleteModel(modelName) {
    if (!confirm(`Are you sure you want to delete the bot "${escapeHtml(modelName)}"?`)) {
        return;
    }
    
    if (Object.keys(settings).length === 1) {
        const defaultName = "Bot";
        
        if (modelName === defaultName) {
            settings[modelName] = JSON.parse(JSON.stringify(defaultSettings));
            setUnsavedChanges();
            renderModelContent(modelName);
            showNotification(`Model "${escapeHtml(modelName)}" has been reset to defaults`, 'success');
        } else {
            const newSettings = {};
            newSettings[defaultName] = JSON.parse(JSON.stringify(defaultSettings));
            settings = newSettings;
            activeTab = defaultName;
            createModelTabs();
            activateTab(defaultName);
            
            showNotification(`Model "${escapeHtml(modelName)}" has been reset to defaults and renamed to "${defaultName}"`, 'success');
        }
        return;
    }
    
    delete settings[modelName];
    setUnsavedChanges();
    
    createModelTabs();
    
    const modelNames = Object.keys(settings);
    if (modelNames.length > 0) {
        activateTab(modelNames[0]);
    } else {
        document.getElementById('models-content').innerHTML = '<p>No models available. Please add a model.</p>';
    }
    
    showNotification(`Model "${escapeHtml(modelName)}" deleted`, 'success');
}

function addDictionaryEntry(modelName, category, settingKey) {
    let newKey = '';
    
    settings[modelName][category][settingKey][newKey] = '';
    setUnsavedChanges();
    renderModelContent(activeTab);
}

function removeDictionaryEntry(modelName, category, settingKey, key) {
    delete settings[modelName][category][settingKey][key];
    setUnsavedChanges();
    renderModelContent(activeTab);
}

function addArrayEntry(modelName, category, settingKey) {
    if (!Array.isArray(settings[modelName][category][settingKey])) {
        settings[modelName][category][settingKey] = [];
    }
    
    const schema = getFieldSchema(modelName, category, settingKey);
    const itemType = schema && schema.itemType ? schema.itemType : 'text';
    
    if (itemType === 'number') {
        const defaultValue = (schema && schema.min !== undefined) ? schema.min : 0;
        settings[modelName][category][settingKey].push(defaultValue);
    } else {
        settings[modelName][category][settingKey].push('');
    }
    
    setUnsavedChanges();
    renderModelContent(activeTab);
}

function removeArrayEntry(modelName, category, settingKey, index) {
    settings[modelName][category][settingKey].splice(index, 1);
    setUnsavedChanges();
    renderModelContent(activeTab);
}

function activateTab(modelName) {
    activeTab = modelName;
    
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-model') === modelName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    renderModelContent(modelName);
    updateDeleteButtonVisibility();
}

function updateDeleteButtonVisibility() {
    const deleteBtn = document.getElementById('delete-model-btn');
    if (activeTab) {
        deleteBtn.style.display = 'block';
        
        if (Object.keys(settings).length === 1) {
            deleteBtn.textContent = `Reset "${escapeHtml(activeTab)}" to Defaults`;
        } else {
            deleteBtn.textContent = `Delete "${escapeHtml(activeTab)}"`;
        }
    } else {
        deleteBtn.style.display = 'none';
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCategoryName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatSettingName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification ' + type;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

async function checkBotStatus() {
    try {
        const response = await fetch('/api/bot/status');
        if (response.ok) {
            const data = await response.json();
            updateBotStatusUI(data.running);
        } else {
            console.error('Error checking bot status:', response.statusText);
            updateBotStatusUI(false);
        }
    } catch (error) {
        console.error('Error checking bot status:', error);
        updateBotStatusUI(false);
    }
}

function updateBotStatusUI(isRunning) {
    botRunning = isRunning;
    const button = document.getElementById('bot-control-btn');
    const indicator = document.getElementById('bot-status-indicator');
    
    if (isRunning) {
        button.textContent = ' Stop Bot';
        button.className = 'bot-control-btn stop-btn';
        indicator.className = 'bot-status-indicator status-running';
        button.prepend(indicator);
    } else {
        button.textContent = ' Start Bot';
        button.className = 'bot-control-btn start-btn';
        indicator.className = 'bot-status-indicator status-stopped';
        button.prepend(indicator);
    }
}

async function toggleBot() {
    showLoading();
    
    try {
        await autoSaveSettings();
        
        let endpoint = botRunning ? '/api/bot/stop' : '/api/bot/start';
        const response = await fetch(endpoint, { method: 'POST' });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || 'Unknown error occurred');
        }
        
        const data = await response.json();
        
        updateBotStatusUI(data.running);
        
        if (data.success) {
            if (data.running) {
                showNotification('Bot started successfully!', 'success');
            } else {
                showNotification('Bot stopped successfully!', 'success');
            }
        } else if (data.error) {
            showNotification('Warning: ' + data.error, 'error');
        }
        
        setTimeout(checkBotStatus, 1000);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        setTimeout(checkBotStatus, 1000);
    } finally {
        hideLoading();
    }
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

function addBotControlStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #restart-bot-btn {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background-color: #f39c12;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
            margin-left: 10px;
        }
        
        #restart-bot-btn:hover {
            background-color: #e67e22;
        }
        
        #restart-bot-btn .bot-status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            background-color: #f39c12;
        }
    `;
    document.head.appendChild(style);
}

function startServerHealthCheck() {
    console.log("Starting server health check");
    const healthCheckInterval = setInterval(() => {
        fetch('/api/settings', { 
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        })
        .then(response => {
            if (!response.ok) {
                handleServerShutdown();
            }
        })
        .catch(error => {
            console.log("Server connection lost:", error);
            handleServerShutdown();
        });
    }, 5000);
    
    window.healthCheckIntervalId = healthCheckInterval;
}

function handleServerShutdown() {
    if (window.healthCheckIntervalId) {
        clearInterval(window.healthCheckIntervalId);
    }
    
    try {
        window.close();
    } catch (e) {
        console.log("Unable to close window due to browser security policy probably");
    }
    
    document.body.innerHTML = `
        <div class="container">
            <h1>Server Connection Lost</h1>
            <p>The settings server appears to have been shut down.</p>
            <p>You can close this window now.</p>
        </div>`;
}

document.addEventListener('DOMContentLoaded', function() {
    uiInitTime = Date.now();
    
    fetchSettings();
    
    document.getElementById('exit-button').addEventListener('click', exitServer);
    document.getElementById('delete-model-btn').addEventListener('click', function() {
        if (activeTab) {
            deleteModel(activeTab);
        }
    });
    
    addBotControlStyles();
    initBotControls();
    
    startServerHealthCheck();
});