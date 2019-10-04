#!/bin/bash

cd ..

rm -f ~/.config/kwatch/state.json
kubectl config use-context do-fra1-k8s-dev-do01-admin-tw >/dev/null

clear

node dist/demo.js

clear
