#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
EXECUTION_DIR="$(pwd)"
NPMFLAG=false
START_APP=true

# Detect OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    OS="unix"
fi


# Print functions
print_error() { echo -e "${RED} $1${NC}"; }
print_success() { echo -e "${GREEN} $1${NC}"; }
print_warning() { echo -e "${YELLOW}  $1${NC}"; }
print_info() { echo -e "${BLUE}  $1${NC}"; }
print_status() { echo -e "${BLUE} $1${NC}"; }

# Verify .env for server
verify_env_file() {
    if [[ -f "$EXECUTION_DIR/packages/server/.env" ]]; then
        print_info "✓ .env file exists in packages/server/"
    else
        print_warning ".env missing in packages/server/ (required to start server)"
        exit 1
    fi
}

stop_existing_processes() {
    print_status "Stopping existing processes..."
    
    # Stop PM2 processes
    if command -v pm2 &> /dev/null; then
        pm2 stop agentic-server 2>/dev/null || true
        pm2 delete agentic-server 2>/dev/null || true
    fi
    
    # # Stop Docker containers
    # if command -v docker-compose &> /dev/null && [[ -f "docker-compose.yml" ]]; then
    #     docker-compose down 2>/dev/null || true
    # fi
    
    # # Stop Node.js processes
    # if [[ "$OS" == "windows" ]]; then
    #     # Windows: Use taskkill instead of pkill
    #     taskkill //F //IM node.exe 2>/dev/null || true
    # else
    #     # Unix-like systems: Use pkill
    #     pkill -f "node dist/main.js" 2>/dev/null || true
    # fi
    
    # Kill processes using the configured port
    if [[ "$OS" == "windows" ]]; then
        # Windows: Use netstat and taskkill
        local pids=$(netstat -ano | grep ":$PORT " | awk '{print $5}' | sort -u)
        if [[ -n "$pids" ]]; then
            for pid in $pids; do
                if [[ "$pid" != "0" && "$pid" != "" ]]; then
                    print_status "Stopping process $pid on port $PORT"
                    taskkill //F //PID $pid 2>/dev/null || true
                fi
            done
        fi
    else
        # Unix-like systems: Use lsof
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
        fi
    fi
    
    print_success "Existing processes stopped"
}

start_pm2() {
    print_status "Starting application with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    print_success "Application started with PM2!"
}

start_docker() {
    print_status "Starting application with Docker..."
    
    # Check if docker-compose.yml exists
    if [[ -f "docker-compose.yml" ]]; then
        print_status "Starting docker-compose..."
        docker-compose up -d
        print_success "Docker containers started! Kodivian server will start automatically."
    elif [[ -f "docker/docker-compose.yml" ]]; then
        print_status "Starting docker-compose from docker directory..."
        cd docker
        docker-compose up -d
        cd ..
        print_success "Docker containers started! Kodivian server will start automatically."
    else
        print_error "Docker start failed."
    fi
}

start_others() {
    print_info "Starting Kodivian..."
    
    # Backup .kodivian directory
    KODIVIAN_DIR="$EXECUTION_DIR/packages/server/.kodivian"
    timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
    BACKUP_DIR="$EXECUTION_DIR/backups"

    if [[ -d "$KODIVIAN_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        cp -r "$KODIVIAN_DIR" "$BACKUP_DIR/$timestamp.kodivian"
        print_info "✓ Backed up .kodivian directory → $BACKUP_DIR/$timestamp.kodivian"
    else
        print_warning "No .kodivian directory to back up"    
fi

# Function to show final status
show_status() {
    SERVER_MODE=$(grep "^SERVER_MODE=" "$EXECUTION_DIR/packages/server/.env" | cut -d '=' -f2)
    HOST=$(grep "^SERVER_HOST=" "$EXECUTION_DIR/packages/server/.env" | cut -d '=' -f2)
    INSTANCES=$(grep "^SERVER_INSTANCES=" "$EXECUTION_DIR/packages/server/.env" | cut -d '=' -f2)
    PORT=$(grep "^PORT=" "$EXECUTION_DIR/packages/server/.env" | cut -d '=' -f2)

    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    print_info "📋 Deployment Summary:"
    echo "  • Target Directory: $EXECUTION_DIR"
    echo "  • Mode: $MODE"
    if [[ "$MODE" == "pm2" ]]; then
        if [[ "$CLUSTER_MODE" == true && "$INSTANCES" -gt 1 ]]; then
            echo "  • PM2 Mode: Cluster ($INSTANCES instances)"
        else
            echo "  • PM2 Mode: Single"
        fi
    fi
    echo "  • Server URL: http://$HOST:$PORT"
    echo "  • API Documentation: http://$HOST:$PORT/api/docs"
    echo "  • Organization ID: $ORG_ID"
    echo ""
    
    if [[ "$START_APP" == true ]]; then
        print_info "🚀 Application Status:"
        case "$MODE" in
            "pm2")
                echo "  • PM2 Status: $(pm2 list | grep agentic-server || echo 'Not running')"
                ;;
            "docker")
                echo "  • Docker Status: $(docker-compose ps | grep -E 'Up|running' || echo 'Not running')"
                ;;
            *)
                if [[ "$OS" == "windows" ]]; then
                    echo "  • Node.js Status: $(tasklist | grep node.exe || echo 'Not running')"
                else
                    echo "  • Node.js Status: $(ps aux | grep 'node dist/main.js' | grep -v grep || echo 'Not running')"
                fi
                ;;
        esac
    else
        print_info "⏸️  Application not started (use --no-start to prevent starting)"
    fi
    
    echo ""
    print_info "📁 Important Files:"
    echo "  • Configuration: $EXECUTION_DIR/package.server/.env"
    echo "  • Logs: $EXECUTION_DIR/logs/"
    echo "  • PM2 Config: $EXECUTION_DIR/ecosystem.config.js"
    echo ""
    print_info "🔧 Management Commands:"
    echo "  • View Logs: pm2 logs agentic-server"
    echo "  • Restart: pm2 restart agentic-server"
    echo "  • Stop: pm2 stop agentic-server"
    echo "  • Status: pm2 status"
}

# Verify required files
verify_env_file

# Install dependencies if missing
    pnpm install

# Build project
print_status "Building project..."
pnpm build

print_success "Build completed successfully!"
SERVER_MODE=$(grep "^SERVER_MODE=" "$EXECUTION_DIR/packages/server/.env" | cut -d '=' -f2)
PORT=$(grep "^PORT=" "$EXECUTION_DIR/packages/server/.env" | cut -d '=' -f2)
echo "Mode = $MODE"
echo "Server Mode = $SERVER_MODE"
echo "Port = $PORT"
# Start application if requested
if [[ "$START_APP" == true ]]; then
    # Stop existing processes first (consistent across all modes)
    stop_existing_processes
    
    case "$SERVER_MODE" in
        "pm2")
            start_pm2
            ;;
        "docker")
            start_docker
            ;;
        "nodejs")
            start_nodejs
            ;;
        *)
            print_warning "Unknown mode '$SERVER_MODE', starting with PM2"
            start_pm2
            ;;
    esac
fi

# Show final status
show_status