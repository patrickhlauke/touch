var fs = require('fs');
var express = require('express');
var wrench = require('wrench');

var app = express();
app.use(express.bodyParser());

app.get('/:name/dev/listing', function(req, res) {
  var project = 'projects/' + req.route.params.name;
  if (!fs.existsSync(project)) {
    wrench.copyDirSyncRecursive('dev/default', project);
    //fs.mkdirSync(project);
    //fs.closeSync(fs.openSync(project + '/index.html', 'w'));
    //fs.closeSync(fs.openSync(project + '/elements.html', 'w'));
  }
  fs.readdir(project, function(err, files) {
    res.send(files);
    res.end();
  });
});

app.get('/:name/dev/:path', function(req, res, next) {
  res.sendfile(req.params.path, {root: __dirname + '/dev/'});
});

app.get('/:name/dev/', function(req, res, next) {
  res.sendfile('index.html', {root: __dirname + '/dev/'});
});

app.use('/polymer', express.static(__dirname + '/../../../../'));
app.use('/', express.static(__dirname + '/projects'));

var nextEdition = 0;

app.post('/:name/*', function(req, res) {
  //console.log(req.route);
  var project = req.route.params.name;
  if (nextEdition < Date.now()) {
    nextEdition = Date.now() + 1000 * 60 * 5; // 5 minutes
    var edition = 'editions/' + project + '-' + Date.now() + '/';
    console.log('dumping edition:', edition);
    wrench.copyDirSyncRecursive('projects/' + project, edition);
  }
  var file = req.route.params[0];
  console.log('saving file: ' + 'projects/' + project + '/' + file);
  fs.writeFile('projects/' + project + '/' + file, req.body.html, function(err) {
    res.end();
  });
});

app.listen(3003);

console.log('Listening on port 3003');
