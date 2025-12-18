#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
EXECUTION_DIR="$(pwd)"

# Detect OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    OS="unix"
fi

# Read SERVER_MODE and PORT from .env file
ENV_FILE="$EXECUTION_DIR/packages/server/.env"
if [[ -f "$ENV_FILE" ]]; then
    SERVER_MODE=$(grep "^SERVER_MODE=" "$ENV_FILE" | cut -d '=' -f2)
    PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d '=' -f2)
else
    SERVER_MODE=""
    PORT=3030  # Default port if .env not found
fi

# Print functions
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_status() { echo -e "${BLUE}🔄 $1${NC}"; }

stop_docker() {
    print_status "Stopping Docker containers..."
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed or not in PATH"
        return
    fi
    
    # Stop docker-compose if it exists
    if command -v docker-compose &> /dev/null; then
        if [[ -f "docker-compose.yml" ]]; then
            print_status "Stopping docker-compose..."
            docker-compose down 2>/dev/null || true
        elif [[ -f "docker/docker-compose.yml" ]]; then
            print_status "Stopping docker-compose from docker directory..."
            cd docker
            docker-compose down 2>/dev/null || true
            cd ..
        fi
    fi
    
    # Find and stop containers using the configured port
    local containers=$(docker ps --format "{{.ID}}\t{{.Ports}}" | grep ":$PORT" | awk '{print $1}' 2>/dev/null || true)
    if [[ -n "$containers" ]]; then
        for container in $containers; do
            if [[ -n "$container" ]]; then
                print_status "Stopping Docker container $container on port $PORT"
                docker stop $container 2>/dev/null || true
                docker rm $container 2>/dev/null || true
            fi
        done
    else
        print_info "No Docker containers found on port $PORT"
    fi
    
    print_success "Docker processes stopped"
}

stop_pm2() {
    print_status "Stopping PM2 processes..."
    
    if ! command -v pm2 &> /dev/null; then
        print_warning "PM2 is not installed or not in PATH"
        return
    fi
    
    pm2 stop agentic-server 2>/dev/null || true
    pm2 delete agentic-server 2>/dev/null || true
    
    print_success "PM2 processes stopped"
}

stop_node() {
    print_status "Stopping Node.js processes on port $PORT..."
    
    if [[ "$OS" == "windows" ]]; then
        # Windows: Use netstat and taskkill
        print_status "Checking for processes on port $PORT (Windows)..."
        local pids=$(netstat -ano | grep ":$PORT " | awk '{print $5}' | sort -u)
        if [[ -n "$pids" ]]; then
            for pid in $pids; do
                if [[ "$pid" != "0" && "$pid" != "" ]]; then
                    print_status "Stopping process $pid on port $PORT"
                    taskkill //F //PID $pid 2>/dev/null || true
                fi
            done
        else
            print_info "No processes found on port $PORT"
        fi
    else
        # Unix-like systems: Use lsof
        print_status "Checking for processes on port $PORT (Unix)..."
        local pids=$(lsof -ti:$PORT 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            for pid in $pids; do
                print_status "Stopping process $pid on port $PORT"
                kill -TERM $pid 2>/dev/null || true
                sleep 2
                if kill -0 $pid 2>/dev/null; then
                    print_warning "Process $pid still running, force killing..."
                    kill -KILL $pid 2>/dev/null || true
                fi
            done
        else
            print_info "No processes found on port $PORT"
        fi
    fi
    
    print_success "Node.js processes stopped"
}

stop_existing_processes() {
    print_status "Stopping processes based on SERVER_MODE: $SERVER_MODE"
    
    case "$SERVER_MODE" in
        "docker")
            stop_docker
            ;;
        "pm2")
            stop_pm2
            stop_node  # Also stop any direct node processes on the port
            ;;
        "nodejs")
            stop_node
            ;;
        *)
            print_warning "Unknown SERVER_MODE '$SERVER_MODE', stopping all processes..."
            stop_docker
            stop_pm2
            stop_node
            ;;
    esac
    
    print_success "All processes stopped"
}

# Main execution
echo ""
print_info "🛑 Stopping server..."
print_info "   SERVER_MODE: ${SERVER_MODE:-'not set'}"
print_info "   PORT: $PORT"
echo ""

stop_existing_processes

echo ""
print_success "✅ Stop operation completed!"
echo ""

