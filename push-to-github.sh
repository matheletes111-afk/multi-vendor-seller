#!/bin/bash

# Script to push code to GitHub
# This requires authentication

echo "🚀 Pushing code to GitHub..."
echo ""
echo "You'll be prompted for credentials:"
echo "  - Username: matheletes111-afk"
echo "  - Password: Use a Personal Access Token (not your GitHub password)"
echo ""
echo "To create a token: https://github.com/settings/tokens"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo "📦 Repository: https://github.com/matheletes111-afk/multi-vendor-seller"
    echo ""
    echo "Next step: Deploy to Vercel"
    echo "See DEPLOYMENT.md for detailed instructions"
else
    echo ""
    echo "❌ Push failed. Please check:"
    echo "  1. Repository exists at: https://github.com/matheletes111-afk/multi-vendor-seller"
    echo "  2. You have access to the repository"
    echo "  3. You're using a Personal Access Token for authentication"
fi

