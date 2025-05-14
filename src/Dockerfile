FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir discord.py aiohttp python-dotenv json5 httpx together

COPY . .

CMD ["python", "bot.py", "settings/dual_bot_settings.json"]