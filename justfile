# List available recipes by default.
default:
    @just --list

# Run Jest tests.
[group('quality')]
test:
    npm run test

# Run web-ext lint checks.
[group('quality')]
lint:
    npm run lint

# Build extension package.
[group('release')]
build:
    npm run build

# Sync package version into manifest.
[group('release')]
sync-version:
    npm run sync-version

# Run extension in default browser target.
[group('dev')]
run:
    npm run run

# Run extension in Firefox profile.
[group('dev')]
start-firefox:
    npm run start-firefox

# Run extension in Chromium profile.
[group('dev')]
start-chromium:
    npm run start-chromium

# Run the core validation pipeline.
[group('quality')]
check:
    npm run lint && npm run test && npm run build

# Run all QA checks for CI.
[group('quality')]
ci:
    just check
