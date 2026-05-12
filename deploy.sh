#!/bin/bash
# PromptZero - Auto Deploy Script (Mac/Linux)

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}   PROMPTZERO - AUTO DEPLOY TO CLOUDFLARE WORKERS${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo -e "${YELLOW}[INFO]${NC} Project folder: $(pwd)"
echo ""

echo -e "${YELLOW}[1/3]${NC} Pulling latest changes from GitHub..."
echo "------------------------------------------------------------"
git pull origin main
echo -e "${GREEN}[OK]${NC} Pull successful!"
echo ""

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[2/3]${NC} Installing dependencies..."
    echo "------------------------------------------------------------"
    npm install
else
    echo -e "${YELLOW}[2/3]${NC} Dependencies already installed, skipping."
fi
echo ""

echo -e "${YELLOW}[3/3]${NC} Building and deploying to Cloudflare Workers..."
echo "------------------------------------------------------------"
npm run deploy

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   DEPLOY SUCCESSFUL!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "   Live URL:  https://tanstack-start-app.tahsinwap.workers.dev"
echo "   Custom:    https://promptzero.lovable.app"
echo ""
read -p "Press Enter to close..."