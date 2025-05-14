'''
WARNING: AI Slop UI component

Exists mainly to help users create a settings.json
Once you get your settings.json and .env, look it over to make sure its correct cause I did not code most of the UI stuff

You can run the bot from this UI but its probably better to just run from src/bot.py directly but w/e
To keep the bot running 24/7 you will need to keep your pc on 24/7 or run from cloud service -> see _upload.sh 


'''

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
from urllib.parse import urlparse


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SettingsServer")

parser = argparse.ArgumentParser(description='Run a local settings editor server.')
parser.add_argument('--port', type=int, default=8090, help='Port to run the server on')
parser.add_argument('--settings-path', type=str, default="src/settings/settings.json", help='Path to the settings JSON file')
parser.add_argument('--html-path', type=str, default="lazy.html", help='Path to the HTML UI file')
args = parser.parse_args()

PORT = args.port
SETTINGS_PATH = args.settings_path
print(SETTINGS_PATH)
HTML_PATH = args.html_path
shutdown_event = threading.Event()
settings_lock = threading.Lock()
bot_process = None
bot_process_lock = threading.Lock()

os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)

if not os.path.exists(SETTINGS_PATH):
    try:
        with open(SETTINGS_PATH, 'w') as f:
            json.dump({"Bot": {"prompt_settings": {}, "llm_settings": {}, "bot_settings": {}}}, f, indent=4)
        logger.info(f"Created new settings file at {SETTINGS_PATH}")
    except Exception as e:
        logger.error(f"Failed to create settings file: {e}")
        sys.exit(1)

class BotProcess:
    def __init__(self):
        self.process = None
        self.lock = threading.Lock()
    
    def start(self, settings_path):
        with self.lock:
            if self.process is not None and self.process.poll() is None:
                return False, "Bot is already running"
            
            if not os.path.exists(settings_path):
                logger.error(f"Settings file not found at {settings_path}")
                return False, f"Settings file not found at {settings_path}"
            
            project_root = os.path.dirname(os.path.abspath(__file__))
            src_dir = os.path.join(project_root, "src")
            bot_py_path = os.path.join(src_dir, "bot.py")
            
            if not os.path.exists(bot_py_path):
                logger.error(f"Bot file not found at {bot_py_path}")
                return False, f"Bot file not found at {bot_py_path}"
            
            settings_abs_path = os.path.abspath(settings_path)
            
            try:
                logger.info(f"Starting bot with: python {bot_py_path} {settings_abs_path}")
                
                env_path = os.path.join(src_dir, ".env")
                env_vars = os.environ.copy()
                
                if os.path.exists(env_path):
                    logger.info(f"Loading environment variables from {env_path}")
                    with open(env_path, 'r') as f:
                        for line in f:
                            if '=' in line and not line.startswith('#'):
                                key, value = line.strip().split('=', 1)
                                env_vars[key] = value
                
                if sys.platform == 'win32':
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE
                    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP
                    
                    self.process = subprocess.Popen(
                        [sys.executable, bot_py_path, settings_abs_path],
                        cwd=src_dir,
                        env=env_vars,
                        creationflags=creation_flags,
                        startupinfo=startupinfo
                    )
                else:
                    self.process = subprocess.Popen(
                        [sys.executable, bot_py_path, settings_abs_path],
                        cwd=src_dir,
                        env=env_vars,
                        preexec_fn=os.setsid  # Create a new process group
                    )
                
                time.sleep(1)
                
                if self.process.poll() is not None:
                    exit_code = self.process.poll()
                    logger.error(f"Bot process exited immediately with code {exit_code}")
                    
                    self.process = None
                    return False, f"Bot failed to start (exit code {exit_code})"
                
                logger.info(f"Bot started with PID: {self.process.pid}")
                return True, self.process.pid
                
            except Exception as e:
                logger.error(f"Exception starting bot: {e}")
                self.process = None
                return False, f"Error starting bot: {str(e)}"
    
    def stop(self):
        with self.lock:
            if self.process is None or self.process.poll() is not None:
                return False, "Bot is not running"
            
            logger.info(f"Stopping bot with PID: {self.process.pid}")
            try:
                if sys.platform == 'win32':
                    os.kill(self.process.pid, signal.CTRL_BREAK_EVENT)
                else:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.warning("Bot didn't terminate gracefully, force killing...")
                    if sys.platform == 'win32':
                        self.process.kill()
                    else:
                        os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                    
                    self.process.wait(timeout=2)
                
                logger.info("Bot stopped successfully")
                self.process = None
                return True, None
            except Exception as e:
                logger.error(f"Error stopping bot: {e}")
                self.process = None
                return False, f"Error stopping bot: {str(e)}"
    
    def is_running(self):
        with self.lock:
            return self.process is not None and self.process.poll() is None
    
    def cleanup(self):
        with self.lock:
            if self.process is not None and self.process.poll() is None:
                logger.info("Stopping bot before shutting down server...")
                try:
                    if sys.platform == 'win32':
                        os.kill(self.process.pid, signal.CTRL_BREAK_EVENT)
                    else:
                        os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                    
                    self.process.wait(timeout=5)
                except (subprocess.TimeoutExpired, Exception) as e:
                    logger.warning(f"Error gracefully stopping bot: {e}, force killing...")
                    try:
                        if sys.platform == 'win32':
                            self.process.kill()
                        else:
                            os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                        self.process.wait(timeout=2)
                    except Exception as e:
                        logger.error(f"Failed to kill bot process: {e}")

bot_manager = BotProcess()

class SettingsHandler(http.server.SimpleHTTPRequestHandler):
    HTML_CONTENT = ""
    
    def log_message(self, format, *args):
        if args and (
            (isinstance(args[0], str) and args[0].startswith('2')) or
            (isinstance(args[0], http.HTTPStatus) and str(args[0].value).startswith('2'))
        ):
            return
        super().log_message(format, *args)

    def do_GET(self):
        global SETTINGS_PATH
        
        if self.path.startswith("/api/settings"):
            print(f"API SETTINGS REQUEST USING PATH: {SETTINGS_PATH}")
            logger.info(f"API SETTINGS REQUEST USING PATH: {SETTINGS_PATH}")
        
        if self.path == "/" or self.path.startswith("/?"):
            self.send_response(200)
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            
            if not self.HTML_CONTENT:
                self.wfile.write(b"<html><body><h1>Error: UI HTML file not found</h1></body></html>")
                return
                
            self.wfile.write(self.HTML_CONTENT.encode('utf-8'))
            return
                
        elif self.path.startswith("/api/settings"):
            try:
                with settings_lock:
                    with open(SETTINGS_PATH, "r") as f:
                        print(f"ACTUALLY READING FROM: {os.path.abspath(SETTINGS_PATH)}")
                        settings_data = f.read()
                
                json.loads(settings_data)
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(settings_data.encode())
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in settings file: {e}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid JSON in settings file: {str(e)}"}).encode())
            except Exception as e:
                logger.error(f"Error reading settings: {e}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
                
        elif self.path.startswith("/api/bot/status"):
            try:
                is_running = bot_manager.is_running()
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"running": is_running}).encode())
            except Exception as e:
                logger.error(f"Error checking bot status: {e}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
                
        elif self.path.startswith("/api/shutdown"):
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Server shutting down...")
            
            shutdown_event.set()
            return
        
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path.startswith("/api/settings"):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                new_settings = json.loads(post_data)
                
                if not isinstance(new_settings, dict) or len(new_settings) == 0:
                    raise ValueError("Settings must contain at least one model")
                
                with settings_lock:
                    if os.path.exists(SETTINGS_PATH):
                        backup_path = SETTINGS_PATH + ".bak"
                        try:
                            with open(SETTINGS_PATH, "r") as src:
                                backup_content = src.read()
                            
                            with open(backup_path, "w") as dst:
                                dst.write(backup_content)
                            
                            logger.info(f"Created backup at {backup_path}")
                        except Exception as e:
                            logger.error(f"Error creating backup: {e}")
                    
                    with open(SETTINGS_PATH, "w") as f:
                        json.dump(new_settings, f, indent=4)
                
                logger.info("Settings saved successfully")
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON data received: {e}")
                self.send_response(400)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid JSON format: {str(e)}"}).encode())
            except Exception as e:
                logger.error(f"Error saving settings: {e}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
                    
        elif self.path == "/api/bot/start":
            try:
                with settings_lock:
                    current_settings = {}
                    with open(SETTINGS_PATH, "r") as f:
                        current_settings = json.load(f)
                    temp_settings_path = SETTINGS_PATH + ".temp"
                    with open(temp_settings_path, "w") as f:
                        json.dump(current_settings, f, indent=4)
                
                success, result = bot_manager.start(temp_settings_path)
                
                if success:
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": True, 
                        "running": True, 
                        "pid": result
                    }).encode())
                else:
                    self.send_response(400 if "already running" in str(result) else 500)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": str(result), 
                        "running": bot_manager.is_running()
                    }).encode())
                
            except Exception as e:
                logger.error(f"Error starting bot: {e}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": str(e), 
                    "running": bot_manager.is_running()
                }).encode())
        
        elif self.path == "/api/bot/stop":
            try:
                success, result = bot_manager.stop()
                
                if success:
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": True, 
                        "running": False
                    }).encode())
                else:
                    is_running = bot_manager.is_running()
                    status_code = 400 if is_running else 200
                    self.send_response(status_code)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": str(result) if result else "Unknown error", 
                        "running": is_running,
                        "success": not is_running  # If it's not running, consider it a success even if there was an error
                    }).encode())
                
            except Exception as e:
                logger.error(f"Error stopping bot: {e}")
                is_running = bot_manager.is_running()
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": str(e), 
                    "running": is_running
                }).encode())
        
        elif self.path == "/api/update_token":
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length).decode('utf-8')
                token_data = json.loads(post_data)
                
                if 'model_name' not in token_data or 'token' not in token_data:
                    raise ValueError("Missing required fields: model_name and token")
                
                model_name = token_data['model_name']
                token = token_data['token']
                
                src_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
                env_path = os.path.join(src_dir, ".env")
                
                os.makedirs(src_dir, exist_ok=True)
                
                env_content = {}
                if os.path.exists(env_path):
                    with open(env_path, 'r') as f:
                        for line in f:
                            if '=' in line and not line.startswith('#'):
                                key, value = line.strip().split('=', 1)
                                env_content[key] = value
                
                token_key = f"{model_name.upper()}_BOT_TOKEN"
                token_key = ''.join(c if c.isalnum() or c == '_' else '_' for c in token_key)
                
                env_content[token_key] = token
                with open(env_path, 'w') as f:
                    for key, value in env_content.items():
                        f.write(f"{key}={value}\n")
                
                logger.info(f"Updated token for {model_name} in .env file")
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "token_key": token_key}).encode())
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON data received: {e}")
                self.send_response(400)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid JSON format: {str(e)}"}).encode())
            except Exception as e:
                logger.error(f"Error updating token: {e}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

def run_server():
    if os.path.exists(HTML_PATH):
        with open(HTML_PATH, "r", encoding='utf-8') as f:
            SettingsHandler.HTML_CONTENT = f.read()
        logger.info(f"Loaded HTML UI from {HTML_PATH}")
    else:
        logger.warning(f"HTML UI file not found at {HTML_PATH}")
    
    try:
        server = ThreadedHTTPServer(("", PORT), SettingsHandler)
    except OSError as e:
        if hasattr(e, 'errno') and e.errno == 98:
            logger.error(f"Port {PORT} is already in use. Try a different port with --port.")
            sys.exit(1)
        else:
            logger.error(f"Error binding to port {PORT}: {e}")
            sys.exit(1)
    
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    logger.info(f"Server started at http://localhost:{PORT}")
    logger.info(f"Press Ctrl+C to exit")
    
    if SettingsHandler.HTML_CONTENT:
        webbrowser.open(f"http://localhost:{PORT}")
    
    try:
        while not shutdown_event.is_set():
            shutdown_event.wait(0.5)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    finally:
        bot_manager.cleanup()
        
        logger.info("Shutting down server...")
        server.shutdown()
        server.server_close()
        logger.info("Server stopped")

if __name__ == "__main__":
    run_server()