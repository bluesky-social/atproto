#!/bin/sh
set -e

echo "Copying code from /mnt/code to /app..."
rm -rf /app/*
rsync -a \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist'  \
    --exclude='.' \
    /mnt/code/ \
    /app/
