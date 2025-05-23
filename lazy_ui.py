import http.server
import socketserver
import json
import os
import sys
import threading
import webbrowser
import argparse
import logging
import subprocess
import signal
import time
from urllib.parse import urlparse, parse_qs
from queue import Queue, Empty # For thread-safe communication

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SettingsServer")

parser = argparse.ArgumentParser(description='Run a local settings editor server.')
parser.add_argument('--port', type=int, default=8090, help='Port to run the server on')
parser.add_argument('--settings-path', type=str, default="src/settings/settings.json", help='Path to the settings JSON file')
parser.add_argument('--html-path', type=str, default="lazy.html", help='Path to the HTML UI file')
args = parser.parse_args()

PORT = args.port
SETTINGS_PATH = os.path.abspath(args.settings_path)
HTML_PATH = os.path.abspath(args.html_path)
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
ENV_FILE_PATH = os.path.join(SRC_DIR, ".env")

shutdown_event = threading.Event()
settings_lock = threading.Lock()

os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)

if not os.path.exists(SETTINGS_PATH):
    try:
        with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
            json.dump({}, f, indent=4)
        logger.info(f"Created new settings file at {SETTINGS_PATH}")
    except Exception as e:
        logger.error(f"Failed to create settings file: {e}")
        sys.exit(1)

def stream_reader_thread_func(stream, queue, stream_name_tag):
    try:
        for line in iter(stream.readline, ''):
            if line: # Ensure line is not empty
                queue.put((stream_name_tag, line.strip()))
    except ValueError: # readline on closed file
        pass # Stream closed, expected
    except Exception as e:
        # Log error if queue is available and stream name is known
        if queue and stream_name_tag:
            try:
                queue.put((stream_name_tag, f"Error reading stream {stream_name_tag}: {e}"))
            except Exception: # If queue itself is an issue
                logger.error(f"CRITICAL: Could not queue error for {stream_name_tag}: {e}")
        else:
            logger.error(f"Error reading stream (unknown or queue unavailable): {e}")
    finally:
        if stream:
            try:
                stream.close()
            except Exception:
                pass # Ignore errors on close
        if queue and stream_name_tag:
            try:
                queue.put((stream_name_tag, None)) # Signal end of this stream
            except Exception:
                pass # Ignore if queue is already down

class BotProcess:
    def __init__(self):
        self.process = None
        self.lock = threading.Lock()
        self.output_queue = Queue()
        self.stdout_thread = None
        self.stderr_thread = None
        self.log_handler_thread = None
        self._stop_logging_event = threading.Event()

    def _start_log_handler(self):
        self._stop_logging_event.clear()
        self.log_handler_thread = threading.Thread(target=self._log_bot_output_loop, daemon=True)
        self.log_handler_thread.start()

    def _log_bot_output_loop(self):
        active_streams = 2 # stdout and stderr
        logger.info("Bot output log handler started.")
        while not self._stop_logging_event.is_set() and active_streams > 0:
            try:
                stream_name, line = self.output_queue.get(timeout=0.1)
                if line is None: # A stream ended
                    active_streams -= 1
                    logger.info(f"Bot's {stream_name} stream has ended.")
                    continue
                
                if stream_name == "stdout":
                    logger.info(f"BOT_STDOUT: {line}")
                elif stream_name == "stderr":
                    logger.warning(f"BOT_STDERR: {line}")
                self.output_queue.task_done() # Not strictly necessary if not joining queue
            except Empty:
                continue # No new message, check stop event
            except Exception as e:
                logger.error(f"Error in bot output log handler: {e}", exc_info=True)
        logger.info(f"Bot output log handler finished (stop_event: {self._stop_logging_event.is_set()}, active_streams: {active_streams}).")


    def start(self, settings_file_for_bot):
        with self.lock:
            if self.process is not None and self.process.poll() is None:
                return False, "Bot is already running"

            bot_script_path = os.path.join(SRC_DIR, "bot.py")
            if not os.path.exists(bot_script_path):
                logger.error(f"Bot script not found at {bot_script_path}")
                return False, f"Bot script not found at {bot_script_path}"
            if not os.path.exists(settings_file_for_bot):
                logger.error(f"Settings file for bot run not found at {settings_file_for_bot}")
                return False, f"Settings file for bot run not found: {settings_file_for_bot}"

            bot_env = os.environ.copy()
            if os.path.exists(ENV_FILE_PATH):
                logger.info(f"Loading environment variables from {ENV_FILE_PATH} for bot process")
                with open(ENV_FILE_PATH, 'r', encoding='utf-8') as f_env:
                    for line in f_env:
                        line = line.strip()
                        if line and '=' in line and not line.startswith('#'):
                            key_val = line.split('=', 1)
                            if len(key_val) == 2:
                                bot_env[key_val[0]] = key_val[1]
            else:
                logger.warning(f".env file not found at {ENV_FILE_PATH}. Bot might not have necessary API keys.")
            
            try:
                logger.info(f"Starting bot with: {sys.executable} {bot_script_path} {os.path.abspath(settings_file_for_bot)}")
                
                common_popen_args = {
                    "cwd": SRC_DIR, "env": bot_env,
                    "stdout": subprocess.PIPE, "stderr": subprocess.PIPE,
                    "stdin": subprocess.DEVNULL, "text": True, "bufsize": 1 
                }

                if sys.platform == 'win32':
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE
                    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
                    self.process = subprocess.Popen(
                        [sys.executable, bot_script_path, os.path.abspath(settings_file_for_bot)],
                        creationflags=creation_flags, startupinfo=startupinfo, **common_popen_args
                    )
                else:
                    self.process = subprocess.Popen(
                        [sys.executable, bot_script_path, os.path.abspath(settings_file_for_bot)],
                        preexec_fn=os.setsid, **common_popen_args
                    )
                
                self.output_queue = Queue() # Re-initialize queue for new process
                self._start_log_handler()

                self.stdout_thread = threading.Thread(target=stream_reader_thread_func, args=(self.process.stdout, self.output_queue, "stdout"), daemon=True)
                self.stderr_thread = threading.Thread(target=stream_reader_thread_func, args=(self.process.stderr, self.output_queue, "stderr"), daemon=True)
                self.stdout_thread.start()
                self.stderr_thread.start()

                time.sleep(2) 

                if self.process.poll() is not None:
                    exit_code = self.process.returncode
                    time.sleep(0.5) # Allow logs to flush
                    self._stop_logging_event.set()
                    if self.log_handler_thread and self.log_handler_thread.is_alive(): self.log_handler_thread.join(timeout=1)
                    logger.error(f"Bot process exited prematurely with code {exit_code}. Check logs for BOT_STDOUT/BOT_STDERR.")
                    self.process = None
                    return False, f"Bot failed to start (exit code {exit_code}). See server logs for bot output."
                
                logger.info(f"Bot started with PID: {self.process.pid}. Output is being monitored.")
                return True, self.process.pid

            except Exception as e:
                logger.error(f"Exception starting bot: {e}", exc_info=True)
                if self.process: 
                    try:
                        if self.process.poll() is None: self.process.kill()
                        self.process.communicate(timeout=1) 
                    except Exception as e_cleanup: logger.error(f"Error during cleanup of failed bot start: {e_cleanup}")
                self.process = None
                self._stop_logging_event.set()
                if self.log_handler_thread and self.log_handler_thread.is_alive(): self.log_handler_thread.join(timeout=1)
                return False, f"Error starting bot: {str(e)}"

    def stop(self):
        with self.lock:
            if self.process is None or self.process.poll() is not None:
                logger.info("Stop command: Bot not running or already stopped.")
                self._ensure_logging_stopped()
                return False, "Bot is not running"

            pid_to_kill = self.process.pid
            logger.info(f"Attempting to stop bot process PID: {pid_to_kill}")
            
            pgid_to_kill = None
            if sys.platform != 'win32':
                try: pgid_to_kill = os.getpgid(pid_to_kill)
                except ProcessLookupError:
                    logger.warning(f"Process {pid_to_kill} for pgid lookup vanished. Assuming stopped.")
                    self._ensure_logging_stopped()
                    self.process = None
                    return True, "Bot process vanished before stop."

            stopped_gracefully = False
            try:
                if sys.platform == 'win32':
                    os.kill(pid_to_kill, signal.CTRL_BREAK_EVENT)
                else:
                    os.killpg(pgid_to_kill, signal.SIGTERM)
                self.process.wait(timeout=10)
                stopped_gracefully = True
                logger.info(f"Bot PID {pid_to_kill} terminated gracefully.")
            except subprocess.TimeoutExpired: logger.warning(f"Bot PID {pid_to_kill} timed out graceful stop.")
            except ProcessLookupError: stopped_gracefully = True; logger.info(f"Bot PID {pid_to_kill} vanished during graceful stop.")
            except Exception as e: logger.error(f"Error during graceful stop (PID {pid_to_kill}): {e}")

            if not stopped_gracefully:
                try:
                    if self.process.poll() is None: # Check if still running
                        logger.info(f"Force killing bot PID {pid_to_kill}...")
                        if sys.platform == 'win32':
                            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid_to_kill)], check=False, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
                        else:
                            os.killpg(pgid_to_kill if pgid_to_kill else os.getpgid(pid_to_kill), signal.SIGKILL)
                        self.process.wait(timeout=5)
                    logger.info(f"Bot PID {pid_to_kill} force kill sequence complete.")
                except subprocess.TimeoutExpired: logger.error(f"Bot PID {pid_to_kill} force kill timed out.")
                except ProcessLookupError: logger.info(f"Bot PID {pid_to_kill} vanished during force kill.")
                except Exception as e: logger.error(f"Error during force kill (PID {pid_to_kill}): {e}")
            
            self._ensure_logging_stopped() # Signal and wait for logging threads
            
            # Final check on process
            final_poll = self.process.poll() if self.process else "N/A (cleared)"
            self.process = None # Clear process attribute
            
            if final_poll is not None or stopped_gracefully: # If it's confirmed dead or was stopped gracefully
                return True, f"Bot PID {pid_to_kill} stopped."
            else:
                return False, f"Bot PID {pid_to_kill} stop status uncertain."


    def _ensure_logging_stopped(self):
        self._stop_logging_event.set()
        # Threads should see event and exit. Pipes will close when process dies.
        if self.stdout_thread and self.stdout_thread.is_alive():
            try: self.stdout_thread.join(timeout=1)
            except Exception: pass
        if self.stderr_thread and self.stderr_thread.is_alive():
            try: self.stderr_thread.join(timeout=1)
            except Exception: pass
        if self.log_handler_thread and self.log_handler_thread.is_alive():
            try: self.log_handler_thread.join(timeout=2) # Give log handler more time
            except Exception: pass
        logger.debug("Logging threads cleanup attempted.")


    def is_running(self):
        with self.lock:
            return self.process is not None and self.process.poll() is None

    def cleanup(self):
        logger.info("Bot manager cleanup initiated.")
        if self.is_running():
            logger.info("Server shutting down. Stopping bot process if running...")
            self.stop()
        else:
            self._ensure_logging_stopped() # Ensure loggers are stopped even if bot wasn't "running" by poll
        logger.info("Bot manager cleanup finished.")


bot_manager = BotProcess()

class SettingsHandler(http.server.SimpleHTTPRequestHandler):
    HTML_CONTENT = ""
    JS_CONTENT = ""

    def __init__(self, *args, **kwargs):
        self.html_dir = os.path.dirname(HTML_PATH)
        super().__init__(*args, directory=self.html_dir, **kwargs)
        
    def log_message(self, format, *args):
        pass # Suppress default SimpleHTTPRequestHandler logging

    def do_GET(self):
        parsed_path = urlparse(self.path)
        path_only = parsed_path.path

        if path_only == "/" or path_only == "/lazy.html" or path_only == f"/{os.path.basename(HTML_PATH)}":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            self.wfile.write(SettingsHandler.HTML_CONTENT.encode('utf-8'))
            return

        elif path_only == "/lazy_loader.js":
            self.send_response(200)
            self.send_header("Content-type", "application/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            self.wfile.write(SettingsHandler.JS_CONTENT.encode('utf-8'))
            return

        elif path_only == "/api/settings":
            try:
                with settings_lock:
                    with open(SETTINGS_PATH, "r", encoding='utf-8') as f:
                        settings_data = f.read()
                json.loads(settings_data) 
                self.send_response(200)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(settings_data.encode('utf-8'))
            except FileNotFoundError:
                self.send_response(200) 
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"{}")
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in settings file: {e}. Sending empty JSON to client.")
                self.send_response(200) 
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"{}")
            except Exception as e:
                logger.error(f"Error reading settings: {e}. Sending empty JSON to client.")
                self.send_response(500)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Error reading settings: {e}"}).encode('utf-8'))
            return

        elif path_only == "/api/bot/status":
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"running": bot_manager.is_running()}).encode('utf-8'))
            return

        elif path_only == "/api/shutdown":
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Server shutting down...")
            shutdown_event.set()
            return
        
        super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length)

        if self.path.startswith("/api/settings"):
            try:
                new_settings_data = json.loads(post_body.decode('utf-8'))
                if not isinstance(new_settings_data, dict):
                    raise ValueError("Invalid settings format: must be a JSON object.")
                
                with settings_lock:
                    if os.path.exists(SETTINGS_PATH):
                        backup_path = SETTINGS_PATH + ".bak"
                        try:
                            os.replace(SETTINGS_PATH, backup_path)
                        except Exception: # Fallback for cross-device link error, etc.
                            import shutil
                            shutil.copy2(SETTINGS_PATH, backup_path) # copy2 preserves metadata
                            os.remove(SETTINGS_PATH) # Then remove original before writing new one
                    
                    with open(SETTINGS_PATH, "w", encoding='utf-8') as f:
                        json.dump(new_settings_data, f, indent=4, ensure_ascii=False)
                
                self.send_response(200)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Settings saved."}).encode('utf-8'))
            except Exception as e:
                logger.error(f"Error saving settings: {e}", exc_info=True)
                self.send_response(500)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": f"Error saving settings: {e}"}).encode('utf-8'))
            return

        elif self.path == "/api/update_token":
            try:
                token_data = json.loads(post_body.decode('utf-8'))
                token_key = token_data.get('token_key')
                token_value = token_data.get('token_value')

                if not token_key or not isinstance(token_key, str) or token_value is None: 
                    raise ValueError("Missing or invalid 'token_key'. 'token_value' can be empty to clear.")
                
                if not all(c.isalnum() or c == '_' for c in token_key): # Basic validation for .env key
                    raise ValueError(f"Invalid token_key format: {token_key}. Only alphanumeric and underscores allowed.")

                os.makedirs(SRC_DIR, exist_ok=True)
                
                env_vars = {}
                if os.path.exists(ENV_FILE_PATH):
                    with open(ENV_FILE_PATH, 'r', encoding='utf-8') as f_env:
                        for line in f_env:
                            line = line.strip()
                            if line and '=' in line and not line.startswith('#'): # Basic .env line parsing
                                key_val_pair = line.split('=', 1)
                                if len(key_val_pair) == 2:
                                    env_vars[key_val_pair[0]] = key_val_pair[1]
                
                env_vars[token_key] = str(token_value) # Ensure value is string for .env

                with open(ENV_FILE_PATH, 'w', encoding='utf-8') as f_env:
                    for k, v in env_vars.items():
                        f_env.write(f"{k}={v}\n") # Write consistently
                
                logger.info(f"Updated {token_key} in {ENV_FILE_PATH}")
                self.send_response(200)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "updated_token_key": token_key, "message": f"{token_key} updated in .env"}).encode('utf-8'))

            except Exception as e:
                logger.error(f"Error updating token: {e}", exc_info=True)
                self.send_response(500)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": f"Error updating token: {e}"}).encode('utf-8'))
            return

        elif self.path == "/api/bot/start":
            success, result = bot_manager.start(SETTINGS_PATH)
            response_data = {"running": bot_manager.is_running()}
            if success:
                response_data["success"] = True; response_data["pid"] = result; response_data["message"] = f"Bot started with PID {result}."
                self.send_response(200)
            else:
                response_data["success"] = False; response_data["error"] = result; response_data["message"] = f"Failed to start bot: {result}"
                self.send_response(400 if "already running" in str(result).lower() else 500)
            
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return

        elif self.path == "/api/bot/stop":
            success, result_msg = bot_manager.stop()
            response_data = {"running": bot_manager.is_running()} 
            response_status_code = 200
            
            if success:
                response_data["success"] = True
                response_data["message"] = result_msg
            else:
                response_data["success"] = False
                response_data["error"] = result_msg
                response_data["message"] = result_msg 
                if "not running" not in str(result_msg).lower() and "not found" not in str(result_msg).lower() and "vanished" not in str(result_msg).lower():
                    response_status_code = 500 

            self.send_response(response_status_code)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return

        else:
            self.send_response(404)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"POST endpoint not found.")

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def run_server():
    js_file_path = os.path.join(os.path.dirname(HTML_PATH), "lazy_loader.js")

    if os.path.exists(HTML_PATH):
        try:
            with open(HTML_PATH, "r", encoding='utf-8') as f:
                SettingsHandler.HTML_CONTENT = f.read()
            logger.info(f"Loaded HTML UI from {HTML_PATH}")
        except Exception as e:
            logger.error(f"Failed to load HTML UI {HTML_PATH}: {e}")
            SettingsHandler.HTML_CONTENT = "<html><body><h1>Error loading UI. Check server logs.</h1></body></html>"
    else:
        logger.error(f"HTML UI file not found at {HTML_PATH}")
        SettingsHandler.HTML_CONTENT = "<html><body><h1>UI HTML file not found.</h1><p>Expected at: "+HTML_PATH+"</p></body></html>"

    if os.path.exists(js_file_path):
        try:
            with open(js_file_path, "r", encoding='utf-8') as f:
                SettingsHandler.JS_CONTENT = f.read()
            logger.info(f"Loaded JS from {js_file_path}")
        except Exception as e:
            logger.error(f"Failed to load JS file {js_file_path}: {e}")
            SettingsHandler.JS_CONTENT = "console.error('Failed to load lazy_loader.js');"
    else:
        logger.error(f"JavaScript file not found at {js_file_path}")
        SettingsHandler.JS_CONTENT = "console.error('lazy_loader.js not found at expected path.');"

    try:
        server = ThreadedHTTPServer(("", PORT), SettingsHandler)
    except OSError as e:
        logger.error(f"Could not start server on port {PORT}: {e}")
        sys.exit(1)

    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    logger.info(f"Settings editor server started at http://localhost:{PORT}")
    logger.info(f"Settings JSON path: {SETTINGS_PATH}")
    logger.info("Press Ctrl+C to shut down the server.")

    if "Error loading UI" not in SettingsHandler.HTML_CONTENT and "UI HTML file not found" not in SettingsHandler.HTML_CONTENT :
        webbrowser.open_new_tab(f"http://localhost:{PORT}")

    try:
        while not shutdown_event.is_set():
            shutdown_event.wait(0.5)
    except KeyboardInterrupt:
        logger.info("Ctrl+C received, shutting down server...")
    finally:
        logger.info("Initiating server shutdown sequence...")
        bot_manager.cleanup() # This will stop the bot and its logging threads
        server.shutdown()
        server.server_close()
        logger.info("Settings editor server stopped.")

if __name__ == "__main__":
    run_server()