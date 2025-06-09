import logging
import sys
import os
import shutil
from logging.handlers import RotatingFileHandler

LOG_DIR = 'logs'
OLD_LOG_DIR = os.path.join(LOG_DIR, 'old_logs')
MAX_OLD_LOG_COPIES = 4

class Logger:
    def __init__(self):
        if not os.path.exists(LOG_DIR):
            os.makedirs(LOG_DIR)
        if not os.path.exists(OLD_LOG_DIR):
            os.makedirs(OLD_LOG_DIR)

        self.log_files_to_manage = [
            "main.log",
            "message.log",
            "context.log",
            "memory.log",
            "oneshot.log",
            "ignored.log",
            "error.log"
        ]

        self._archive_logs()

        self.main_log = self.create_log("main.log", "discord_bot_main")
        self.message_log = self.create_log("message.log", "discord_bot_message")
        self.context_log = self.create_log("context.log", "discord_bot_context")
        self.memory_log = self.create_log("memory.log", "discord_bot_rag")
        self.oneshot_log = self.create_log("oneshot.log", "discord_bot_oneshot")
        self.ignored_log = self.create_log("ignored.log", "discord_bot_ignored")
        self.error_log = self.create_log("error.log", "discord_bot_error")

    def _archive_logs(self):
        for log_base_name in self.log_files_to_manage:
            current_log_file_path = os.path.join(LOG_DIR, log_base_name)
            
            oldest_archived_log_path = os.path.join(OLD_LOG_DIR, f"{log_base_name}.{MAX_OLD_LOG_COPIES}")
            if os.path.exists(oldest_archived_log_path):
                try:
                    os.remove(oldest_archived_log_path)
                except OSError as e:
                    print(f"Error removing old log {oldest_archived_log_path}: {e}", file=sys.stderr)

            for i in range(MAX_OLD_LOG_COPIES - 1, 0, -1):
                src_path = os.path.join(OLD_LOG_DIR, f"{log_base_name}.{i}")
                dest_path = os.path.join(OLD_LOG_DIR, f"{log_base_name}.{i+1}")
                if os.path.exists(src_path):
                    try:
                        os.rename(src_path, dest_path)
                    except OSError as e:
                        print(f"Error renaming archived log {src_path} to {dest_path}: {e}", file=sys.stderr)
            
            if os.path.exists(current_log_file_path):
                new_archive_path = os.path.join(OLD_LOG_DIR, f"{log_base_name}.1")
                copied_successfully = False
                try:
                    shutil.copy2(current_log_file_path, new_archive_path)
                    copied_successfully = True
                except Exception as e_copy:
                    print(f"Error copying {current_log_file_path} to {new_archive_path}: {e_copy}", file=sys.stderr)
                
                if copied_successfully:
                    try:
                        os.remove(current_log_file_path)
                    except Exception as e_remove:
                        print(f"Error removing original log file {current_log_file_path} after successful archiving: {e_remove}", file=sys.stderr)

    def create_log(self, file_log_name, logger_instance_name):
        log_file_path = os.path.join(LOG_DIR, file_log_name)
        file_handler = RotatingFileHandler(log_file_path, maxBytes=1024*1024*5, backupCount=3, encoding='utf-8')
        console_handler = logging.StreamHandler(sys.stdout)

        log = logging.getLogger(logger_instance_name)
        log.setLevel(logging.DEBUG)
        log.propagate = False

        if not log.handlers:
            file_handler.setLevel(logging.DEBUG)
            console_handler.setLevel(logging.DEBUG)

            formatter = logging.Formatter(
                '%(asctime)s[%(levelname)s]%(filename)s(%(lineno)d)%(funcName)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )

            file_handler.setFormatter(formatter)
            console_handler.setFormatter(formatter)

            log.addHandler(file_handler)
            log.addHandler(console_handler)
        return log

    def debug(self, message, *args, **kwargs):
        self.main_log.debug(message, *args, stacklevel=2, **kwargs)

    def info(self, message, *args, **kwargs):
        self.main_log.info(message, *args, stacklevel=2, **kwargs)

    def warning(self, message, *args, **kwargs):
        self.main_log.warning(message, *args, stacklevel=2, **kwargs)

    def error(self, message, *args, **kwargs):
        self.error_log.error(message, *args, stacklevel=2, **kwargs)

    def context(self, message, *args, **kwargs):
        self.context_log.debug(message, *args, stacklevel=2, **kwargs)
    
    def ignored(self, message, *args, **kwargs):
        self.ignored_log.debug(message, *args, stacklevel=2, **kwargs)
    
    def one_shot(self, message, *args, **kwargs):
        self.oneshot_log.debug(message, *args, stacklevel=2, **kwargs)

    def memory(self, message, *args, **kwargs):
        self.memory_log.debug(message, *args, stacklevel=2, **kwargs)

    def message(self, message, *args, **kwargs):
        self.message_log.debug(message, *args, stacklevel=2, **kwargs)
    

log = Logger()

if __name__ == "__main__":
    log.info("Main log test info for current session.")
    log.debug("Main log test debug for current session.")
    log.message("This is a message log entry for current session.")
    log.context("This is a context log entry for current session.")
    log.memory("This is a memory log entry for current session.")
    log.one_shot("This is a one_shot log entry for current session.")
    log.ignored("This is an ignored log entry for current session.")
    log.error("This is an error log entry for current session.")
    
    for i in range(2): # Reduced loop for quicker testing
        log.info(f"Test log entry {i+1} for main log in current session.")

    print(f"Check logs in '{LOG_DIR}' and archived logs in '{OLD_LOG_DIR}'.")
    print(f"The files in '{LOG_DIR}' should only contain logs from this run.")
    print(f"The file '{os.path.join(OLD_LOG_DIR, 'main.log.1')}' (and others like it) should contain logs from the *previous* run.")