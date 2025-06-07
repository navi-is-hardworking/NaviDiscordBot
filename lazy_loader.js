
let settings = {};
let activeTab = null;
let collapsedSections = {};
let botRunning = false;
let autoSaveTimer = null;
let uiInitTime = 0;
const PASSWORD_ENTRY_GRACE_PERIOD = 3000;

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


function getApiKeyEnvName(providerName) {
    if (!providerName) return null;
    return `${providerName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_API_KEY`;
}

function createBotConfigFromSchema(botName) {
    const newBotSettings = {};
    const globalSchema = settingsSchema._global;

    for (const key in globalSchema) {
        const schemaEntry = globalSchema[key];
        if (schemaEntry.fields) {
            newBotSettings[key] = {};
            for (const fieldKey in schemaEntry.fields) {
                const fieldSchema = schemaEntry.fields[fieldKey];
                newBotSettings[key][fieldKey] = (typeof fieldSchema.default === 'object' && fieldSchema.default !== null)
                    ? JSON.parse(JSON.stringify(fieldSchema.default))
                    : fieldSchema.default;
            }
        } else {
            if (key === 'bot_token') {
                newBotSettings[key] = `${botName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
            } else {
                 newBotSettings[key] = (typeof schemaEntry.default === 'object' && schemaEntry.default !== null)
                    ? JSON.parse(JSON.stringify(schemaEntry.default))
                    : schemaEntry.default;
            }
        }
    }
    return newBotSettings;
}


function ensureSettingsExist(modelName) {
    const globalSchema = settingsSchema._global;
    if (!settings[modelName] || typeof settings[modelName] !== 'object') {
        settings[modelName] = createBotConfigFromSchema(modelName);
    }
    const botData = settings[modelName];

    for (const key in globalSchema) {
        const schemaEntry = globalSchema[key];
        if (schemaEntry.fields) {
            if (!botData.hasOwnProperty(key) || typeof botData[key] !== 'object' || botData[key] === null) {
                botData[key] = {};
                for (const fieldKey in schemaEntry.fields) {
                     const fieldSchema = schemaEntry.fields[fieldKey];
                     botData[key][fieldKey] = (typeof fieldSchema.default === 'object' && fieldSchema.default !== null)
                        ? JSON.parse(JSON.stringify(fieldSchema.default))
                        : fieldSchema.default;
                }
            } else {
                 for (const fieldKey in schemaEntry.fields) {
                    const fieldSchema = schemaEntry.fields[fieldKey];
                    if (!botData[key].hasOwnProperty(fieldKey) ||
                        (fieldSchema.type === 'array' && !Array.isArray(botData[key][fieldKey])) ||
                        (fieldSchema.type === 'dictionary' && (typeof botData[key][fieldKey] !== 'object' || botData[key][fieldKey] === null || Array.isArray(botData[key][fieldKey])))
                    ) {
                        botData[key][fieldKey] = (typeof fieldSchema.default === 'object' && fieldSchema.default !== null)
                            ? JSON.parse(JSON.stringify(fieldSchema.default))
                            : fieldSchema.default;
                    }
                    if ((fieldKey === 'backup_models' || fieldKey === 'stop' || fieldKey === 'monitored_servers' || fieldKey === 'monitored_channels' || fieldKey === 'admins' || fieldKey === 'partial_ignore_list' || fieldKey === 'full_ignore_list') && !Array.isArray(botData[key][fieldKey])) {
                        botData[key][fieldKey] = JSON.parse(JSON.stringify(fieldSchema.default || []));
                    }
                    if (fieldKey === 'dictionary_cache' && (typeof botData[key][fieldKey] !== 'object' || botData[key][fieldKey] === null || Array.isArray(botData[key][fieldKey]))) {
                         botData[key][fieldKey] = JSON.parse(JSON.stringify(fieldSchema.default || {}));
                    }
                     if (fieldKey === 'typing_delay_range' && (!Array.isArray(botData[key][fieldKey]) || botData[key][fieldKey].length !==2 )) {
                         botData[key][fieldKey] = JSON.parse(JSON.stringify(fieldSchema.default || [0,0]));
                    }
                }
            }
        } else {
            if (!botData.hasOwnProperty(key)) {
                if (key === 'bot_token') {
                     botData[key] = `${modelName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
                } else {
                    botData[key] = (typeof schemaEntry.default === 'object' && schemaEntry.default !== null)
                        ? JSON.parse(JSON.stringify(schemaEntry.default))
                        : schemaEntry.default;
                }
            }
        }
    }

    if (botData.bot_settings && botData.bot_settings.enabled !== undefined) {
        botData.enabled = botData.bot_settings.enabled;
        delete botData.bot_settings;
    }

    const botTokenSchemaEntry = globalSchema.bot_token;
    if (botData.bot_token === "BOT_TOKEN" || (botTokenSchemaEntry && botData.bot_token === botTokenSchemaEntry.default)) {
         botData.bot_token = `${modelName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_BOT_TOKEN`;
    } else if (typeof botData.bot_token === 'string' && botData.bot_token.startsWith('ENV:')) {
        botData.bot_token = botData.bot_token.substring(4);
    }


    if (botData.prompt_settings) {
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
    }

    if (botData.llm_settings) {
        let llmTempProvider = botData.llm_settings.provider;
        let llmTempEndpoint = botData.llm_settings.endpoint;
        let llmTempModel = botData.llm_settings.model;

        if (botData.llm_settings.hasOwnProperty('llm_provider')) {
            if (llmTempProvider === undefined || llmTempProvider === globalSchema.llm_settings.fields.provider.default) llmTempProvider = botData.llm_settings.llm_provider;
            delete botData.llm_settings.llm_provider;
        }
        if (botData.llm_settings.hasOwnProperty('llm_endpoint')) {
            if (llmTempEndpoint === undefined || llmTempEndpoint === globalSchema.llm_settings.fields.endpoint.default) llmTempEndpoint = botData.llm_settings.llm_endpoint;
            delete botData.llm_settings.llm_endpoint;
        }
        if (botData.llm_settings.hasOwnProperty('llm_model')) {
            if (llmTempModel === undefined || llmTempModel === globalSchema.llm_settings.fields.model.default) llmTempModel = botData.llm_settings.llm_model;
            delete botData.llm_settings.llm_model;
        }
        if (botData.hasOwnProperty('llm_provider')) {
            if (llmTempProvider === undefined || llmTempProvider === globalSchema.llm_settings.fields.provider.default) llmTempProvider = botData.llm_provider;
            delete botData.llm_provider;
        }
        if (botData.hasOwnProperty('llm_endpoint')) {
            if (llmTempEndpoint === undefined || llmTempEndpoint === globalSchema.llm_settings.fields.endpoint.default) llmTempEndpoint = botData.llm_endpoint;
            delete botData.llm_endpoint;
        }
        if (botData.hasOwnProperty('llm_model')) {
            if (llmTempModel === undefined || llmTempModel === globalSchema.llm_settings.fields.model.default) llmTempModel = botData.llm_model;
            delete botData.llm_model;
        }

        botData.llm_settings.provider = llmTempProvider;
        botData.llm_settings.endpoint = llmTempEndpoint;
        botData.llm_settings.model = llmTempModel;

        if (typeof botData.llm_settings.model === 'string' &&
            (botData.llm_settings.provider === undefined || botData.llm_settings.provider === globalSchema.llm_settings.fields.provider.default ||
             botData.llm_settings.endpoint === undefined || botData.llm_settings.endpoint === globalSchema.llm_settings.fields.endpoint.default)
           ) {
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
                botData.llm_settings.provider = globalSchema.llm_settings.fields.provider.default;
                botData.llm_settings.endpoint = globalSchema.llm_settings.fields.endpoint.default;
                botData.llm_settings.model = globalSchema.llm_settings.fields.model.default;
            }
        }
    }

    if (botData.response_limits && botData.response_limits.vision_enabled !== undefined) {
        if (!botData.vision_settings || typeof botData.vision_settings !== 'object') {
            botData.vision_settings = {};
            for (const fieldKey in globalSchema.vision_settings.fields) {
                 botData.vision_settings[fieldKey] = JSON.parse(JSON.stringify(globalSchema.vision_settings.fields[fieldKey].default));
            }
        }
        botData.vision_settings.vision_enabled = botData.response_limits.vision_enabled;
        delete botData.response_limits.vision_enabled;
    }

    if (botData.vision_settings) {
        if (botData.vision_settings.hasOwnProperty('vision_models') && !botData.vision_settings.hasOwnProperty('backup_models')) {
            botData.vision_settings.backup_models = botData.vision_settings.vision_models;
            delete botData.vision_settings.vision_models;
        }

        let visionTempProvider = botData.vision_settings.provider;
        let visionTempEndpoint = botData.vision_settings.endpoint;
        let visionTempModel = botData.vision_settings.model;

        if (botData.vision_settings.hasOwnProperty('vision_provider')) {
            if (visionTempProvider === undefined || visionTempProvider === globalSchema.vision_settings.fields.provider.default) visionTempProvider = botData.vision_settings.vision_provider;
            delete botData.vision_settings.vision_provider;
        }
        if (botData.vision_settings.hasOwnProperty('vision_endpoint')) {
            if (visionTempEndpoint === undefined || visionTempEndpoint === globalSchema.vision_settings.fields.endpoint.default) visionTempEndpoint = botData.vision_settings.vision_endpoint;
            delete botData.vision_settings.vision_endpoint;
        }
        if (botData.vision_settings.hasOwnProperty('vision_model')) {
            if (visionTempModel === undefined || visionTempModel === globalSchema.vision_settings.fields.model.default) visionTempModel = botData.vision_settings.vision_model;
            delete botData.vision_settings.vision_model;
        }

        botData.vision_settings.provider = visionTempProvider;
        botData.vision_settings.endpoint = visionTempEndpoint;
        botData.vision_settings.model = visionTempModel;

        if (botData.vision_settings.vision_enabled && typeof botData.vision_settings.model === 'string' &&
            (botData.vision_settings.provider === undefined || botData.vision_settings.provider === globalSchema.vision_settings.fields.provider.default ||
             botData.vision_settings.endpoint === undefined || botData.vision_settings.endpoint === globalSchema.vision_settings.fields.endpoint.default )
           ) {
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
                botData.vision_settings.provider = globalSchema.vision_settings.fields.provider.default;
                botData.vision_settings.endpoint = globalSchema.vision_settings.fields.endpoint.default;
                botData.vision_settings.model = globalSchema.vision_settings.fields.model.default;
            }
        }
        if (botData.vision_settings.vision_enabled && (botData.vision_settings.provider === undefined || botData.vision_settings.provider === null)) {
            botData.vision_settings.provider = globalSchema.vision_settings.fields.provider.default;
            botData.vision_settings.endpoint = globalSchema.vision_settings.fields.endpoint.default;
            botData.vision_settings.model = globalSchema.vision_settings.fields.model.default;
        }
    }

    const allKnownTopLevelKeys = new Set();
    for(const k in globalSchema) allKnownTopLevelKeys.add(k);

    for (const key in botData) {
        if (!allKnownTopLevelKeys.has(key)) {
            delete botData[key];
        } else if (globalSchema[key] && globalSchema[key].fields && typeof botData[key] === 'object' && botData[key] !== null) {
            const knownCategoryFields = new Set(Object.keys(globalSchema[key].fields));
            for (const subKey in botData[key]) {
                if (!knownCategoryFields.has(subKey)) {
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
    const botTokenSchema = settingsSchema._global.bot_token;
    const botTokenInputContainer = createTextInput(modelName, null, 'bot_token', modelData.bot_token, botTokenSchema);
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
        settingsSchema._global[key].fields && key !== 'enabled' && key !== 'bot_token'
    );

    for (const categoryKey of categoryRenderOrder) {
        const categoryDefinition = settingsSchema._global[categoryKey];
        const categoryData = modelData[categoryKey] || {};

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
        headerTitle.innerHTML = `${categoryDefinition.title || formatCategoryName(categoryKey)} <span class="toggle-icon" style="color: inherit;">▼</span>`;
        headerDiv.appendChild(headerTitle);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'collapsible-content';

        categorySectionDiv.appendChild(headerDiv);
        categorySectionDiv.appendChild(contentDiv);
        modelSection.appendChild(categorySectionDiv);

        const sectionKey = `${modelName}-${categoryKey}`;
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
        const fieldOrder = Object.keys(categoryDefinition.fields);

        if (categoryKey === 'llm_settings') {
            const primaryLLMTitle = document.createElement('h4'); primaryLLMTitle.textContent = "Primary LLM Configuration"; primaryLLMTitle.style.marginTop = "0px"; primaryLLMTitle.style.marginBottom = "10px";
            contentDiv.appendChild(primaryLLMTitle);

            const llmSelectorsContainer = document.createElement('div'); llmSelectorsContainer.className = 'form-row';
            createProviderModelSelectors(modelName, 'llm_primary', categoryData, llmSelectorsContainer, false);
            contentDiv.appendChild(llmSelectorsContainer);

            const backupLLMTitle = document.createElement('h4'); backupLLMTitle.textContent = "LLM Backup Models"; backupLLMTitle.style.marginTop = "20px";
            contentDiv.appendChild(backupLLMTitle);

            const llmBackupSchema = categoryDefinition.fields.backup_models;
            if (llmBackupSchema) {
                const backupFormGroup = document.createElement('div'); backupFormGroup.className = 'form-group';
                backupFormGroup.appendChild(createArrayInput(modelName, categoryKey, 'backup_models', categoryData.backup_models || [], llmBackupSchema));
                contentDiv.appendChild(backupFormGroup);
            }
            const otherLLMSettingsTitle = document.createElement('h4'); otherLLMSettingsTitle.textContent = "Other LLM Parameters"; otherLLMSettingsTitle.style.marginTop = "20px";
            contentDiv.appendChild(otherLLMSettingsTitle);
        }

        if (categoryKey === 'vision_settings') {
            const visionEnabledGroup = document.createElement('div'); visionEnabledGroup.className = 'form-group';
            visionEnabledGroup.appendChild(createBooleanInput(modelName, categoryKey, 'vision_enabled', categoryData.vision_enabled, categoryDefinition.fields.vision_enabled));
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

            const visionBackupModelsSchema = categoryDefinition.fields.backup_models;
            if (visionBackupModelsSchema) {
                const visionModelsFormGroup = document.createElement('div'); visionModelsFormGroup.className = 'form-group';
                visionModelsFormGroup.appendChild(createArrayInput(modelName, categoryKey, 'backup_models', categoryData.backup_models || [], visionBackupModelsSchema));
                contentDiv.appendChild(visionModelsFormGroup);
            }
            const otherVisionSettingsTitle = document.createElement('h4'); otherVisionSettingsTitle.textContent = "Other Vision Parameters"; otherVisionSettingsTitle.style.marginTop = "20px";
            contentDiv.appendChild(otherVisionSettingsTitle);
        }

        for (const settingKey of fieldOrder) {
            const schemaForItem = categoryDefinition.fields[settingKey];
            if (schemaForItem.hidden) continue;
            if (categoryKey === 'llm_settings' && (settingKey === 'provider' || settingKey === 'endpoint' || settingKey === 'model' || settingKey === 'backup_models')) continue;
            if (categoryKey === 'vision_settings' && (settingKey === 'provider' || settingKey === 'endpoint' || settingKey === 'model' || settingKey === 'backup_models' || settingKey === 'vision_enabled')) continue;

            if (schemaForItem.type === 'dictionary') {
                const dictCacheSchema = schemaForItem;
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
                const leftContentContainer = document.createElement('span');
                leftContentContainer.style.display = 'flex';
                leftContentContainer.style.alignItems = 'center';
                const titleTextNode = document.createTextNode(dictCacheSchema.title || formatSettingName(settingKey));
                leftContentContainer.appendChild(titleTextNode);
                if (dictCacheSchema.tooltip) {
                const tooltipElement = createTooltip(dictCacheSchema.tooltip);
                leftContentContainer.appendChild(tooltipElement);
                }
                dictHeaderTitle.appendChild(leftContentContainer);
                const toggleIconSpan = document.createElement('span');
                toggleIconSpan.className = 'toggle-icon';
                toggleIconSpan.innerHTML = '▼';
                dictHeaderTitle.appendChild(toggleIconSpan);

                dictHeaderDiv.appendChild(dictHeaderTitle);

                const dictContentElement = document.createElement('div');
                dictContentElement.className = 'collapsible-content';

                const dictSectionKey = `${modelName}-${categoryKey}-${settingKey}-collapsible`;
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
                dictInputGroup.appendChild(createDictionaryInput(modelName, categoryKey, settingKey, dictCacheData, {...dictCacheSchema, isSubComponent: true}));
                dictContentElement.appendChild(dictInputGroup);

                dictCollapsibleContainer.appendChild(dictHeaderDiv);
                dictCollapsibleContainer.appendChild(dictContentElement);
                contentDiv.appendChild(dictCollapsibleContainer);

                currentFieldsInRow = 0; currentRowElement = null;
                continue;
            }

            const settingValue = categoryData[settingKey];
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
                formGroup.appendChild(createArrayInput(modelName, categoryKey, settingKey, settingValue, schemaForItem));
            } else if (schemaForItem.type === 'dictionary') {
                formGroup.appendChild(createDictionaryInput(modelName, categoryKey, settingKey, settingValue, schemaForItem));
            } else if (schemaForItem.type === 'boolean') {
                formGroup.appendChild(createBooleanInput(modelName, categoryKey, settingKey, !!settingValue, schemaForItem));
            } else if (schemaForItem.type === 'number') {
                formGroup.appendChild(createNumberInputWithSchema(modelName, categoryKey, settingKey, Number(settingValue !== undefined ? settingValue : schemaForItem.default), schemaForItem));
            } else if (schemaForItem.type === 'text') {
                formGroup.appendChild(createTextInput(modelName, categoryKey, settingKey, String(settingValue !== undefined ? settingValue : schemaForItem.default), schemaForItem));
            } else if (schemaForItem.type === 'range') {
                const rangeValue = Array.isArray(settingValue) && settingValue.length === 2 ? settingValue : schemaForItem.default;
                formGroup.appendChild(createRangeInput(modelName, categoryKey, settingKey, rangeValue, schemaForItem));
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

    const isBackupModel = settingsGroupKey.includes('backup_');
    let arrayIndex = null;
    let categoryKey = null;
    let settingKey = null;
    
    if (isBackupModel) {
        const match = settingsGroupKey.match(/backup_(?:llm|vision)_(\d+)/);
        if (match) {
            arrayIndex = parseInt(match[1]);
            categoryKey = isVisionSelectors ? 'vision_settings' : 'llm_settings';
            settingKey = 'backup_models';
        }
    }

    const providerGroup = document.createElement('div'); 
    providerGroup.className = 'form-col';
    const providerLabelText = settingsGroupKey.includes('backup_') ? 'Backup Provider' : `${isVisionSelectors ? 'Vision' : 'LLM'} Provider`;
    const providerLabel = document.createElement('label'); 
    providerLabel.textContent = providerLabelText;
    const providerSelect = document.createElement('select'); 
    providerSelect.id = `${modelName}-${settingsGroupKey}-provider`;

    Object.keys(sourceForOptions).forEach(pName => {
        const option = document.createElement('option'); 
        option.value = pName; 
        option.textContent = pName;
        if (pName === currentProvider) option.selected = true;
        providerSelect.appendChild(option);
    });

    if (!currentProvider && providerSelect.options.length > 0) {
        providerSelect.selectedIndex = 0; 
        currentProvider = providerSelect.value; 
        configObject[pKey] = currentProvider;
    } else if (providerSelect.options.length === 0) {
        const option = document.createElement('option'); 
        option.textContent = "No providers defined"; 
        option.disabled = true; 
        providerSelect.appendChild(option);
    }

    providerGroup.appendChild(providerLabel); 
    providerGroup.appendChild(providerSelect); 
    targetElement.appendChild(providerGroup);

    const modelGroup = document.createElement('div'); 
    modelGroup.className = 'form-col';
    const modelLabelText = settingsGroupKey.includes('backup_') ? 'Backup Model' : 'Model';
    const modelLabel = document.createElement('label'); 
    modelLabel.textContent = modelLabelText;
    const modelSelect = document.createElement('select'); 
    modelSelect.id = `${modelName}-${settingsGroupKey}-model`;
    modelGroup.appendChild(modelLabel); 
    modelGroup.appendChild(modelSelect); 
    targetElement.appendChild(modelGroup);

    function updateSettingsObject(newProvider, newEndpoint, newModel) {
        configObject[pKey] = newProvider;
        configObject[epKey] = newEndpoint;
        configObject[mKey] = newModel;
        
        if (isBackupModel && arrayIndex !== null && categoryKey && settingKey) {
            if (settings[modelName] && settings[modelName][categoryKey] && 
                Array.isArray(settings[modelName][categoryKey][settingKey]) &&
                settings[modelName][categoryKey][settingKey][arrayIndex]) {
                
                settings[modelName][categoryKey][settingKey][arrayIndex][pKey] = newProvider;
                settings[modelName][categoryKey][settingKey][arrayIndex][epKey] = newEndpoint;
                settings[modelName][categoryKey][settingKey][arrayIndex][mKey] = newModel;
            }
        }
        
        currentProvider = newProvider;
        currentEndpoint = newEndpoint;
        currentModel = newModel;
    }

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

                const option = document.createElement('option'); 
                option.value = compositeValue; 
                option.textContent = `${modelDisplayName}`;
                if (modelId === currentModel && endpointUrl === currentEndpoint && selectedProviderName === currentProvider) {
                    option.selected = true; 
                    modelSelectedInUI = true;
                }
                modelSelect.appendChild(option);
            }
        }

        if (!modelSelectedInUI && modelSelect.options.length > 0) {
            modelSelect.value = firstAvailableModelComposite || modelSelect.options[0].value;
        } else if (modelSelect.options.length === 0) {
            const option = document.createElement('option');
            option.textContent = selectedProviderName ? "No models for provider" : "Select provider";
            option.disabled = true; 
            modelSelect.appendChild(option);
        }

        const selectedComposite = modelSelect.value;
        if (selectedComposite && selectedComposite.includes("::")) {
            const [ep, mId] = selectedComposite.split("::");
            updateSettingsObject(selectedProviderName, ep, mId);
        } else {
            updateSettingsObject(selectedProviderName, null, null);
        }
    }

    providerSelect.onchange = function() {
        const newProvider = this.value;
        populateModelsAndUpdateStorage(newProvider, sourceForOptions);
        setUnsavedChanges();
    };
    
    modelSelect.onchange = function() {
        const selectedComposite = this.value;
        if (selectedComposite && selectedComposite.includes("::")) {
            const [ep, mId] = selectedComposite.split("::");
            updateSettingsObject(currentProvider, ep, mId);
        }
        setUnsavedChanges();
    };

    if (currentProvider) {
        populateModelsAndUpdateStorage(currentProvider, sourceForOptions);
    } else if (providerSelect.options.length > 0 && providerSelect.value) {
        currentProvider = providerSelect.value;
        populateModelsAndUpdateStorage(currentProvider, sourceForOptions);
    } else {
        populateModelsAndUpdateStorage(null, sourceForOptions);
    }
}

function createTextInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldId = category === null ? `${modelName}-${settingKey}` : `${modelName}-${category}-${settingKey}`;
    const labelContainer = document.createElement('div'); labelContainer.className = 'label-container';
    const labelElement = document.createElement('label'); labelElement.setAttribute('for', fieldId);
    labelElement.textContent = (schema && schema.title) ? schema.title : formatSettingName(settingKey);
    labelContainer.appendChild(labelElement);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    let inputElement;
    const isMultiline = schema && schema.multiline;
    const isPasswordField = (settingKey === 'bot_token' && category === null);
    if (isMultiline) {
        inputElement = document.createElement('textarea');
        if (schema.textareaSize === 'large') {
            inputElement.className = 'large';
        } else {
            inputElement.className = 'medium';
        }
    } else {
        inputElement = document.createElement('input'); inputElement.type = isPasswordField ? 'password' : 'text';
    }
    inputElement.id = fieldId;
    const valToSet = settingValue !== undefined ? settingValue : (schema && schema.default !== undefined ? schema.default : '');
    if (isPasswordField) {
        inputElement.placeholder = String(valToSet || 'Enter token...'); inputElement.value = '';
    } else {
        inputElement.value = String(valToSet);
    }
    inputElement.onchange = function() { updateSetting(modelName, category, settingKey, this.value); };
    container.appendChild(labelContainer); container.appendChild(inputElement);
    return container;
}

function createNumberInputWithSchema(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldId = `${modelName}-${category}-${settingKey}`;
    const labelContainer = document.createElement('div'); labelContainer.className = 'label-container';
    const labelElement = document.createElement('label'); labelElement.setAttribute('for', fieldId);
    labelElement.textContent = (schema && schema.title) ? schema.title : formatSettingName(settingKey);
    labelContainer.appendChild(labelElement);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    const inputElement = document.createElement('input'); inputElement.type = 'number'; inputElement.id = fieldId; inputElement.className = 'number-input';
    inputElement.value = settingValue !== undefined ? settingValue : (schema && schema.default !== undefined ? schema.default : 0);
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
        const originalValue = settings[modelName]?.[category]?.[settingKey] !== undefined
            ? settings[modelName][category][settingKey]
            : (schema && schema.default !== undefined ? schema.default : (schema?.min !== undefined ? schema.min : 0));

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
    const labelElement = document.createElement('label'); labelElement.setAttribute('for', fieldId);
    labelElement.textContent = (schema && schema.title) ? schema.title : formatSettingName(settingKey);
    labelContainer.appendChild(labelElement);
    if (schema && schema.tooltip) { labelContainer.appendChild(createTooltip(schema.tooltip)); }
    const select = document.createElement('select'); select.id = fieldId;
    const currentVal = settingValue !== undefined ? settingValue : (schema && schema.default !== undefined ? schema.default : false);
    ['True', 'False'].forEach(valStr => {
        const option = document.createElement('option'); option.value = valStr.toLowerCase(); option.textContent = valStr;
        if ((valStr === 'True' && currentVal === true) || (valStr === 'False' && currentVal === false)) { option.selected = true; }
        select.appendChild(option);
    });
    select.onchange = function() { updateSetting(modelName, category, settingKey, this.value === 'true'); };
    container.appendChild(labelContainer); container.appendChild(select);
    return container;
}

function createRangeInput(modelName, category, settingKey, settingValue, schema) {
    const container = document.createElement('div');
    const fieldIdPrefix = `${modelName}-${category}-${settingKey}`;

    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    const rangeTitleLabel = document.createElement('label');
    rangeTitleLabel.textContent = (schema && schema.title) ? schema.title : formatSettingName(settingKey);
    labelContainer.appendChild(rangeTitleLabel);
    if (schema && schema.tooltip) {
        labelContainer.appendChild(createTooltip(schema.tooltip));
    }
    container.appendChild(labelContainer);

    const rangeContainer = document.createElement('div');
    rangeContainer.className = 'range-container';

    const currentVal = (Array.isArray(settingValue) && settingValue.length === 2)
        ? settingValue
        : (schema && schema.default !== undefined ? schema.default : [0, 10]);

    const val1 = currentVal[0];
    const val2 = currentVal[1];

    const defaultVal1Label = "Min:";
    const defaultVal2Label = "Max:";
    const defaultValueSeparator = "to";

    const value1Label = (schema && typeof schema.value1Label === 'string') ? schema.value1Label : defaultVal1Label;
    const value2Label = (schema && typeof schema.value2Label === 'string') ? schema.value2Label : defaultVal2Label;
    const valueSeparator = (schema && typeof schema.valueSeparator === 'string') ? schema.valueSeparator : defaultValueSeparator;

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.id = `${fieldIdPrefix}-min`;
    minInput.value = val1;
    if (schema && schema.min !== undefined) minInput.min = schema.min;
    if (schema && schema.max !== undefined) minInput.max = schema.max;
    minInput.style.width = '80px';

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.id = `${fieldIdPrefix}-max`;
    maxInput.value = val2;
    if (schema && schema.min !== undefined) maxInput.min = schema.min;
    if (schema && schema.max !== undefined) maxInput.max = schema.max;
    maxInput.style.width = '80px';

    function updateRange() {
        const numMin = Number(minInput.value);
        const numMax = Number(maxInput.value);

        if (schema) {
            if (schema.min !== undefined && numMin < schema.min) {
                showNotification(`First value cannot be less than ${schema.min}. Reverting.`, 'error');
                minInput.value = settings[modelName]?.[category]?.[settingKey]?.[0] !== undefined ? settings[modelName][category][settingKey][0] : schema.default[0];
                return;
            }
            if (schema.max !== undefined && numMax > schema.max) {
                showNotification(`Second value cannot be greater than ${schema.max}. Reverting.`, 'error');
                maxInput.value = settings[modelName]?.[category]?.[settingKey]?.[1] !== undefined ? settings[modelName][category][settingKey][1] : schema.default[1];
                return;
            }
        }

        if (numMin > numMax) {
            showNotification('The first value in a range cannot exceed the second value. Reverting.', 'error');
            const originalRange = settings[modelName]?.[category]?.[settingKey] || schema.default || [0,10];
            minInput.value = originalRange[0];
            maxInput.value = originalRange[1];
            return;
        }
        updateSetting(modelName, category, settingKey, [numMin, numMax]);
    }
    minInput.onchange = updateRange;
    maxInput.onchange = updateRange;

    if (value1Label) {
        rangeContainer.appendChild(document.createTextNode(value1Label + " "));
    }
    rangeContainer.appendChild(minInput);

    if (valueSeparator) {
        const separatorSpan = document.createElement('span');
        separatorSpan.textContent = ` ${valueSeparator} `;
        separatorSpan.style.margin = "0 5px";
        rangeContainer.appendChild(separatorSpan);
    } else {
        const spacer = document.createElement('span');
        spacer.innerHTML = '&nbsp;&nbsp;';
        rangeContainer.appendChild(spacer);
    }

    if (value2Label) {
        rangeContainer.appendChild(document.createTextNode(value2Label + " "));
    }
    rangeContainer.appendChild(maxInput);

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
    arrayLabel.textContent = (arraySchema && arraySchema.title) ? arraySchema.title : formatSettingName(settingKey);
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

        if (!settings[modelName]?.[category]?.[settingKey] || !Array.isArray(settings[modelName][category][settingKey])) {
             if(settings[modelName] && settings[modelName][category]) {
                settings[modelName][category][settingKey] = JSON.parse(JSON.stringify(arraySchema.default || []));
             }
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

        const currentItemValue = {...(arraySchema.itemSchema.default || {}), ...(itemValue || {})};
        if (!currentItemValue.provider && arraySchema.itemSchema.provider.default) {
             currentItemValue.provider = arraySchema.itemSchema.provider.default;
        }
         if (!currentItemValue.endpoint && arraySchema.itemSchema.endpoint.default) {
             currentItemValue.endpoint = arraySchema.itemSchema.endpoint.default;
        }
        if (!currentItemValue.model && arraySchema.itemSchema.model.default) {
             currentItemValue.model = arraySchema.itemSchema.model.default;
        }
        if (!currentItemValue.endpoint ) {
            const defaultSelections = getFirstProviderAndModelDetails(isVisionContextForBackupModels);
            if(defaultSelections.endpoint) currentItemValue.endpoint = defaultSelections.endpoint;
             if(!currentItemValue.provider) currentItemValue.provider = defaultSelections.provider;
             if(!currentItemValue.model) currentItemValue.model = defaultSelections.model;
        }

        createProviderModelSelectors(modelName, itemGroupKey, currentItemValue, backupItemSelectorsContainer, isVisionContextForBackupModels);
        entryDiv.appendChild(backupItemSelectorsContainer);
    } else {
        const inputElement = document.createElement('input');
        const itemType = (arraySchema && arraySchema.itemType) || (typeof itemValue === 'number' ? 'number' : 'text');
        inputElement.type = itemType;
        inputElement.value = itemValue !== undefined ? itemValue : (itemType === 'number' ? 0 : '');
        inputElement.style.flexGrow = '1';
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
    if (!settings[modelName]?.[category] || !Array.isArray(settings[modelName][category][settingKey])) {
        if(settings[modelName] && settings[modelName][category]) {
            settings[modelName][category][settingKey] = JSON.parse(JSON.stringify(arraySchema.default || []));
        } else { return; }
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
        if(arraySchema.itemSchema.default){
            newItem = {...newItem, ...JSON.parse(JSON.stringify(arraySchema.itemSchema.default))};
        }
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
        dictLabel.textContent = (schema && schema.title) ? schema.title : formatSettingName(settingKey);
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
        if (!settings[modelName]?.[category] || typeof settings[modelName][category][settingKey] !== 'object' || settings[modelName][category][settingKey] === null) {
            if(settings[modelName] && settings[modelName][category]) {
                settings[modelName][category][settingKey] = JSON.parse(JSON.stringify(schema.default || {}));
            }
        }
        let dictToRender = settings[modelName][category][settingKey];

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
    if (!settings[modelName]?.[category] || typeof settings[modelName][category][settingKey] !== 'object') {
        if(settings[modelName] && settings[modelName][category]) {
             const schemaForDict = settingsSchema._global[category]?.fields?.[settingKey];
             settings[modelName][category][settingKey] = JSON.parse(JSON.stringify(schemaForDict?.default || {}));
        } else { return; }
    }
    const targetDictionary = settings[modelName][category][settingKey];

    let newKeyBase = `new_key_`;
    let i = 1;
    let newKey = `${newKeyBase}${i}`;
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


function initializeLocalSettingsObject() {
    const newBotName = "BotName";
    const newSettings = {};
    newSettings[newBotName] = createBotConfigFromSchema(newBotName);
    return newSettings;
}

async function fetchSettings() {
    showLoading();
    try {
        uiInitTime = Date.now();
        const response = await fetch('/api/settings?t=' + Date.now());
        if (!response.ok) {
            const responseText = await response.text().catch(() => "");
            if (response.status >= 400 || !responseText.trim() || responseText.trim() === "{}") {
                settings = initializeLocalSettingsObject();
            } else {
                try {
                    const parsed = JSON.parse(responseText);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
                        settings = initializeLocalSettingsObject();
                    } else {
                        settings = parsed;
                    }
                } catch (e) {
                    showNotification('Error parsing settings from server. Using defaults.', 'error');
                    settings = initializeLocalSettingsObject();
                }
            }
        } else {
            const text = await response.text();
            if (!text || !text.trim() || text.trim() === "{}") {
                settings = initializeLocalSettingsObject();
            } else {
                try {
                    const parsed = JSON.parse(text);
                         if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        settings = initializeLocalSettingsObject();
                    } else {
                        settings = parsed;
                    }
                } catch (parseError) {
                    showNotification('Invalid settings JSON from server, using defaults.', 'error');
                    settings = initializeLocalSettingsObject();
                }
            }
        }

        if (Object.keys(settings).length === 0) {
            settings = initializeLocalSettingsObject();
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
        settings = initializeLocalSettingsObject();
        for (const modelName in settings) { ensureSettingsExist(modelName); }
        if (Object.keys(settings).length === 0) addNewModel("BotName");
        createModelTabs();
        activateTab(Object.keys(settings)[0] || "BotName");
    } finally {
        hideLoading();
    }
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
        settings[sanitizedName] = createBotConfigFromSchema(sanitizedName);
        ensureSettingsExist(sanitizedName);
        setUnsavedChanges(); createModelTabs(); activateTab(sanitizedName);
    }
}

function deleteModel(modelName) {
    if (!confirm(`Are you sure you want to delete the bot "${escapeHtml(modelName)}"?`)) return;
    if (Object.keys(settings).length === 1) {
        settings[modelName] = createBotConfigFromSchema(modelName);
        ensureSettingsExist(modelName);
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