#!/bin/bash
# set -euxo pipefail

# # Always start from the repo root in Xcode Cloud
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"
cd "$REPO_ROOT"

# # Install Volta (Node toolchain manager) and add to PATH
# export VOLTA_HOME="$HOME/.volta"
# export PATH="$VOLTA_HOME/bin:$PATH"

# curl https://get.volta.sh | bash -s -- --skip-setup
# "$VOLTA_HOME/bin/volta" install node@20 yarn@1 pnpm@9
#!/bin/sh
set -e

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
export HOMEBREW_NO_AUTO_UPDATE=1

# Install Node 20
brew install node@20
brew link node@20 --force --overwrite
export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"

# Install package managers
npm install -g yarn@1 pnpm@9
# Show versions (debugging)
node -v
yarn -v || true
pnpm -v || true
npm -v

# Install JS deps from repo root (not inside ios/)
if [ -f yarn.lock ]; then
  yarn install --frozen-lockfile
elif [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
elif [ -f package-lock.json ]; then
  npm ci
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
