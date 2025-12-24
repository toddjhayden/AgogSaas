#!/bin/bash
# Unix/Linux/Mac shell script to spawn Value Chain Expert Agent

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/spawn-value-chain-expert.js" "$@"
