<div style="background-color: #0F0F0F; padding: 10px;">

<!-- <div align="center">
  <p style="text-align: center; text-decoration: none; font-size: 2em;">A software engineer's guide to making friends</p>
</div> -->
<div align="center">
  <h1 style="font-size: 38px; text-decoration: none;">Discord Mishapes</h1>

<div style="width: 60%; text-align: center;">
    <!-- <img src="https://www.youtube.com/watch?v=Ap_idi2ddlw" alt="alt text" style="width:600px;height:auto;"> -->
  
  [![sock cat](./images/example.png)](https://discord.gg/9hcr7rTk36)
  
  <!-- <img src="./images/example.png" alt="alt text" style="width:auto;height:auto;"> -->
</div>
</div>

<div align="center">

<!-- [![ALT TEXT](https://img.youtube.com/vi/O6oTwbE0kyU/0.jpg)](https://www.youtube.com/watch?v=O6oTwbE0kyU) -->
</div>

<!-- 
<div style="display: flex; align-items: center;"> -->
<!-- <div style="width: 40%;"> -->


<h1 align="center">Table of Content</h1>
</br>

- [Overview](#overview)
- [What You Will Need](#what-you-will-need)
- [Create Discord Bot](#discord-set-up)
    * [1. Go To Discord Developer Console](#discord-application-developer)
    * [2. Create New Application](#create-discord-bot)
    * [3. Set Install Link](#set-install-link)
    * [4. Set Bot Settings](#set-bot-settings)
    * [5. Set Content Intent](#set-content-intent)
    * [6. Get Bot Token](#get-bot-token)
    * [7. Add Bot To Server](#add-bot-to-server)
- [API key](#api-keys)
- [Run The Bot](#the-repo)
    * [Clone or Download the Repo](#clone-repo)
- [Set .env File](#bot-token-in-env)
- [Run The Bot](#run-the-bot)
- [Run On Cloud](#run-on-cloud)
    * [1. Making AWS Instance](#make-aws)
    * [2. Docker](#docker)
    * [2.5 No Docker](#no-docker)
- [Configuration Notes](#configuration-notes)
    * [Parameters](#param-notes)
    * [Models](#model-notes)
    * [Custom-Models](#custom-model-notes)
    * [Free-Models](#free-model-notes)
    * [Backup-Models](#backup-model-notes)
- [TLDR](#tldr)
- [Other Notes](#other-notes)


</div>
<!-- </div> -->

<div style="background-color: #0F0F0F; padding: 10px;">

<a id="overview"></a>
<h1 align="center">Overview</h1>

<!-- ## Overview -->

This guide will help you set up your own personalized discord LLM bot. Completely free with 100% uptime. 
It might seem long but if you follow along, I promise it's not that bad.

NOTE: I have some options set up for API providers. You can use them or you can use your own see [custom](#custom-model-notes) api endpoints. 
Groq especially offers a pretty generous free tier model (1000+) requests on some high quality models.

<!-- </div> -->

<div style="background-color: #0F0F0F; padding: 10px;">
<h1 style="font-size: 24px; margin-top: 0.5em; margin-bottom: 0.5em; line-height: 1.1;" align="left">What You Will Need</h1>

<!-- ## Overview -->

<p style="font-size: 18px; font-weight: bold; margin-top: 0.0em; margin-bottom: 0.0em;">The Basics</p>

* Python (run.bat/run.sh will install python and all requirements for windows/linux respectively)
* [Discord Bot and Bot token](#discord-application-developer)
* [API Keys](#api-keys)

1. Initialize virtual environment and settings.json file by running run.bat (Windows) or run.sh (Linux)
1. Place both keys in the designated input fields. 
1. Save the settings
1. Then you can either start the bot from the UI or navigate to the src folder and run python bot.py settings/settings.json

or to run on cloud, configure _upload.sh (linux terminal script) and just run that script

<p style="font-size: 18px; font-weight: bold; margin-top: 0.0em; margin-bottom: 0.0em;">For Permanent Setup</p>

* 100% uptime server (Cloud Server like aws, gcp, acs etc... or your own server device like raspberry pi or something)

##

<a id="discord-set-up"></a>

<h1 style="font-size: 24px;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.1;"
    align="center">Create Discord Bot</h1>
    
<!-- # Create Discord Bot -->

<a id="discord-application-developer"></a>
### 1: Go to https://discord.com/developers/applications

<a id="create-new-application"></a>

### 2: Click "New Application"
<img src="./images/create_new_application.png" alt="alt text" style="width:auto;height:auto;">

<a id="set-install-link"></a>

### 3: Set Install Link to None
<img src="./images/set_install_link.png" alt="alt text" style="width:auto;height:auto;">

<a id="set-bot-settings"></a>

### 4: Set Bot Image, Name, and Set Toggle Public Off
<img src="./images/set_to_private.png" alt="alt text" style="width:auto;height:auto;">

<a id="set-content-intent"></a>

### 5: Set Message Content Intent
<img src="./images/bot-intents.png" alt="alt text" style="width:auto;height:auto;">

<a id="get-bot-token"></a>

### 6: Get Bot Token ([You can place this in the bot_token field in the UI or in the src/.env file, I will show later](#bot-token-in-env))
<img src="./images/get_bot_token.png" alt="alt text" style="width:auto;height:auto;">

<a id="add-bot-to-server"></a>

### 7: Add Bot To Server 
<img src="./images/generate_oauth.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/bot-perm.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/authorize_link.png" alt="alt text" style="width:auto;height:auto;">


<a id="api-keys"></a>

# API keys

https://console.groq.com/keys

https://github.com/navi-is-hardworking/fire_chat?tab=readme-ov-file#TTT-key

https://www.together.ai


<a id="the-repo"></a>
<h1 style="font-size: 32px;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.1;"
    align="center">Running The Bot</h1>

<a id="clone-repo"></a>

## 1.Clone or Download the repo

```
# If you are comfortable with command line just pull
git clone https://github.com/navi-is-hardworking/NaviDiscordBot.git
```
Otherwise you can download and unzip (If you do this, make sure you move it out of the downloads folder before running it)
<img src="./images/for-noobs.png" alt="alt text" style="width:auto;height:auto;">


<a id="bot-token-in-env"></a>

## 2. Save keys via UI file or set in .env file
<img src="./images/set-keys-in-ui.png" alt="alt text" style="width:auto;height:auto;">

## 3. Get Channel ID where the bot will speak

<img src="./images/toggle_developer.png" alt="alt text" style="width:auto;height:auto;">

<img src="./images/get_channel_id.png" alt="alt text" style="width:auto;height:auto;">

## 4. place the channel ids you want the bot to talk in into the settings.json file or use the lazy_ui.py

<img src="./images/monitored-channels.png" alt="alt text" style="width:auto;height:auto;">

You can add multiple channels to the bot but the bot will share the same context across all of them. If you want them to have different context you will need to add another bot in the UI. The UI name does not affect the AI.

## Note
I keep adding settings and I'm getting tired of updating the readme. I will update the tooltips in the UI to make them explain what they do.

<!-- </div> -->

<a id="run-the-bot"></a>
<h1 style="font-size: 32px;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.1;"
    align="center">Run The Bot</h1>

### You can use run.bat/run.sh (Windows/Linux) to create the settings.json file
### You can test out the bot by starting it from the UI. But for long term use you should run the bot.py


### After you have your settings finalized, you can just run with...
```
python -m venv venv
source venv/Scripts/activate # source venv/bin/activate for linux
cd src
python bot.py
```

<a id="run-on-cloud"></a>
<h1 style="font-size: 32px;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.1;"
    align="center">To The Cloud!</>
</h1>

<a id="make-aws"></a>

## https://aws.amazon.com

### This bot can run comfortably on free tier aws micro but they have a one-year limit. After that you can pay the $2, move to another provider, or get a homeserver.
    
<img src="./images/create-aws.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/aws-ec2.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/ec2-micro.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/make-key.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/rsa-pem.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/aws-traffic.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/launch-instance.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/open-instance.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/launch-connect.png" alt="alt text" style="width:auto;height:auto;">
<img src="./images/connecting.png" alt="alt text" style="width:auto;height:auto;">

if you made it here you are doing good.
```
ls # should be empty at this point
```
<img src="./images/inside-instance.png" alt="alt text" style="width:auto;height:auto;">

<a id="docker"></a>
### To run with Docker, you need to install docker first on local machine and aws server then open _upload.sh and replace 

<img src="./images/upload-config.png" alt="alt text" style="width:auto;height:auto;">

### then run...

```
./_upload.sh
```

<a id="no-docker"></a>
## Run without docker enter your aws instance

```
git clone https://github.com/navi-is-hardworking/NaviDiscordBot
```

## then from your local machine ( after you have made your settings.json file )

```
scp -i /path/to/your-key.pem src/settings/settings.json username@ip-address

#example
scp -i ~/.ssh/my-ec2-key.pem src/settings/settings.json ec2-user@33.123.24.22:/home/ec2-user/NaviDiscordBot/src/settings
```
## After uploading your settings enter your aws instance and double check

```
tail -500 /home/ec2-user/NaviDiscordBot/src/settings/settings.json
```
## if it looks good you can try running

```
cd /home/ec2-user/NaviDiscordBot
sudo yum update -y
sudo yum install python3 -y
sudo yum install python3-pip -y
python3 --version
pip3 --version
python3 -m venv botenv
source botenv/bin/activate
pip install discord.py aiohttp python-dotenv json5 httpx dotenv
cd src
python3 bot.py
```

<a id="configuration-notes"></a>
<h1 style="font-size: 32px;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.1;"
    align="center">Configuration Notes</h1>

<a id="param-notes"></a>

### See the UI tooltips for more robust notes. I will probably updating there instead of here.

## LLM Model parameters

```    
max_tokens                -> The maximum length of the models response. 1 token is roughly 4 letters/characters
messages                  -> initial messages, can just leave empty
temperature               -> Regulates the randomness in token selection during text generation. Higher values means more diversity in token selection but setting it too high can result in gibberish outputs. (safe range from 0 to 1)
top_p                     -> Filters token selection range based on probability. A value of 1 means all tokens in the vocabulary are considered for selection based on their probabilities. Lower values restrict selection to only the most likely tokens.
top_k                     -> Limits token selection to only the top k most probable tokens at each generation step. With value 50, the model considers only the 50 highest probability tokens when deciding what to generate next, discarding all other possibilities.
frequency_penalty         -> Reduces token repetition, scales up based on the number of times a token has occured the context
presence_penalty          -> Reduces the likelihood a token will be selected if it has already occured in the context. (Unlike frequency penalty it only cares if the token has occured at all in the text, rather than the number of occurences)
n                         -> number of responses (mainly for testing, wastes tokens in most cases)
stop                      -> List of tokens that will cause the generation to stop when reached. (You can leave this empty most of the time in chat models. But it can be very useful when using completion models. For example, you can set closing quotes " as the stop token to get the model to finish the dialogue.)

max_context_length        -> Max CHARACTER count in context NOT including prompt length. Manage costs keeping in mind that 4 characters is roughly equal to one token.
min_context_length        -> Truncates context length after periods of inactivity 

prompt_head               -> instructions for the model
prompt_tail               -> instructions for the model
dictionary_cache          -> Would normally be vdb but just using simple dictionary for important memories so it can run on aws micro
cache_capacity            -> number of cached memories that can be stored at once
cache_clear_time          -> max duration a memory will exist in context before being removed
reminder                  -> experimental: does not work well on some models. Appends to the end of context before sending. If you are using a reason model that supports /no_reason like Qwen, you can have it so /no_reason is append at the end of every message (should also set /no_reason im prompt too)

```

<a id="bot-configurations"></a>

## Bot Configurations


```
max_user_input_message_length        -> will truncate user messages that are too long
max_bot_response_count_per_interval  -> to prevent overuse. Number of times the llm can respond per interval length
interval                             -> interval length for max_bot_response_count_per_interval time in seconds
chat_clear_time                      -> will truncate chat to min_context_length set in model parameters
channels                             -> channels that it will respond
ignore_names                         -> names to ignore (like other bots)
response_delay_range                 -> Bot will pick a random number in range and respond after typing for that amount of time
```

<a id="model-notes"></a>

## Currently I have two providers set up and some of the models added
<img src="./images/model-notes.png" alt="alt text" style="width:auto;height:auto;">

<a id="custom-model-notes"></a>

# Custom Models
### If you have a fine tuned model or want to set a custom provider you can modify the .env file manually. This will override your primary provider. Also you need to fill out all three so if you are using a local api with no key just put in something random
```
CUSTOM_COMPLETION_URL=
CUSTOM_COMPLETION_MODEL=
CUSTOM_COMPLETION_KEY=
```

<a id="free-model-notes"></a>

# Free Models
### TogetherAI offers a selection of free models with reduced rates, 6 Free requests per minute (Although based on my testing it seems to be a lot less than that, maybe 3-4, at uneven intervals)
<img src="./images/free-models.png" alt="alt text" style="width:auto;height:auto;">


<a id="backup-model-notes"></a>

# If the free model rates are too low, or one of the models is unstable, you can set backup models
### Setting the free TogetherAI model as primary and a cheap Fireworks model as backup means it will try to use free first, if that fails, it will try again on backup.
### This helps keep the quality high and the cost very low.
### If you don't set a backup then you can use it for free albeit with very low usage rates

<img src="./images/backup-models.png" alt="alt text" style="width:auto;height:auto;">





<a id="tldr"></a>

# TLDR

1. run.bat/run.sh
2. set keys
3. Add channel ID to monitored_channels
4. Write prompt and dicitonary
5. Run bot


# TODO:
- Give better example on how to use the dictionary rag
- Add rag cooldown to items
- Nested rag for conditional searches
- User based rag
- Banned phrases list


<a id="other-notes"></a>

# Other notes

* Currently hard codes removal of reason in Qwen models by removing all text between <reason> </reason> I will add a option to remove it in the future
* I plan on finding more providers that offer free models so that free tier can be expanded
* When pulling, ALWAYS backup your settings.json. I make frequent changes to formatting and you could lose your settings when running the run.bat/run.sh (lazy_ui.py)
* The lazy UI components are all "vibe" coded. They are very unstable. You should only use them to make your settings.json. When running the model over the long term, always run via bot.py directly or through docker
* Lazy UI component sometimes fails to kill the bot after starting resulting in hanging process. You will have to kill manually through task manager or get pid through ps aux
* Model name needs to have no spaces in it. It is only used to set the API key. 
* Bot Responds on @Mention setting will used the actual discord bots username.

























