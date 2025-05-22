import logging
import sys
import os
from logging.handlers import RotatingFileHandler

if not os.path.exists('logs'):
    os.makedirs('logs')

file_handler = RotatingFileHandler(
    'logs/my_bot.log', maxBytes=1024*1024*5, backupCount=3,
    encoding='utf-8'
)
console_handler = logging.StreamHandler()

log = logging.getLogger('discord_bot')
log.setLevel(logging.DEBUG)

file_handler.setLevel(logging.DEBUG)
console_handler.setLevel(logging.DEBUG)

formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(filename)s:%(lineno)d - %(funcName)s - %(message)s')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

log.addHandler(file_handler)
log.addHandler(console_handler)

def handle_global_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    log.critical("Unhandled exception caught by global handler:",
                 exc_info=(exc_type, exc_value, exc_traceback))

sys.excepthook = handle_global_exception