node ../../vulcanize/vulcan.js --csp -i index.html -o imports.html
@del app.html
@ren index-vulcanized.html app.html