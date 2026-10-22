#!/bin/bash
set -euxo pipefail

# Always start from the repo root in Xcode Cloud
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"
cd "$REPO_ROOT"

# Show versions (debugging)
node -v
npm -v

# Install JS deps from repo root (not inside ios/)
if [ -f package-lock.json ]; then
  npm ci
elif [ -f yarn.lock ]; then
  yarn install --frozen-lockfile
elif [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  npm install --no-audit --no-fund
fi

# Now handle iOS dependencies
cd ios

# If you use Bundler, prefer it for reproducible pods
if [ -f "../Gemfile" ] || [ -f "Gemfile" ]; then
  gem install bundler --no-document
  bundle install
  bundle exec pod repo update
  bundle exec pod install
else
  pod repo update
  pod install
fi
