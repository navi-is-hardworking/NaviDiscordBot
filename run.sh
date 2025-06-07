#!/bin/bash

echo -e "\033[0;32mDiscord Bot Setup\033[0m"
echo "Starting setup process..."

ORIGINAL_DIR=$(pwd)

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "Checking Python installation..."
if command_exists python3; then
    python3 --version
elif command_exists python; then
    python --version
    PYTHON_CMD="python"
else
    echo "Python not found"
    echo "Installing Python..."
    
    if command_exists apt-get; then
        sudo apt-get update
        sudo apt-get install -y python3 python3-pip python3-venv
    elif command_exists yum; then
        sudo yum install -y python3 python3-pip
    elif command_exists dnf; then
        sudo dnf install -y python3 python3-pip
    elif command_exists pacman; then
        sudo pacman -S python python-pip
    elif command_exists zypper; then
        sudo zypper install python3 python3-pip
    else
        echo "Could not detect package manager. Please install Python 3 manually."
        echo "Then restart this script."
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    echo "Please restart this script after Python installation completes."
    read -p "Press Enter to exit..."
    exit 1
fi

if command_exists python3; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
else
    PYTHON_CMD="python"
    PIP_CMD="pip"
fi

echo "Setting up virtual environment..."
if [ ! -d "venv" ]; then
    $PYTHON_CMD -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

if [ ! -f "src/.env" ]; then
    echo "Creating .env file..."
    mkdir -p src
    echo "API_KEY=" > src/.env
    echo "BOT_TOKEN=" >> src/.env
fi

echo "Installing requirements..."
pip install discord.py aiohttp python-dotenv json5 httpx

echo "Files in current directory:"
ls -la

if [ ! -f "lazy_ui.py" ]; then
    echo "ERROR: lazy_ui.py not found in current directory!"
    echo "Current directory: $(pwd)"
    ls -la
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Starting lazy_ui.py..."
python lazy_ui.py

echo "You can try running these commands manually:"
echo "cd $ORIGINAL_DIR"
echo "source venv/bin/activate"
echo "python lazy_ui.py"
read -p "Press Enter to exit..."