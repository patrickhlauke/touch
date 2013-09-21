#!/bin/sh
node ../../vulcanize/vulcan.js -v --csp -i index.html -o imports.html
mv index-vulcanized.html app.html
