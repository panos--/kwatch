#!/bin/sh

npx terminalizer render -o demo.gif demo.yml
gifsicle -b -O3 --colors=16 demo.gif
