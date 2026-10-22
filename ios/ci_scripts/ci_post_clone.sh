#!/bin/bash
set -euxo pipefail

# Always start from the repo root in Xcode Cloud
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"
cd "$REPO_ROOT"

# Install Volta (Node toolchain manager) and add to PATH
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

curl https://get.volta.sh | bash -s -- --skip-setup

# Xcode Cloud can occasionally return a truncated Node archive from the
# Volta download endpoint. Retry after clearing only Volta's temp files.
for attempt in 1 2 3; do
  if "$VOLTA_HOME/bin/volta" install node@20 yarn@1 pnpm@9; then
    break
  fi

  if [ "$attempt" -eq 3 ]; then
    echo "Volta toolchain installation failed after 3 attempts" >&2
    exit 1
  fi

  rm -rf "$VOLTA_HOME/tmp"
  echo "Volta toolchain installation failed; retrying (attempt $((attempt + 1))/3)" >&2
done

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
