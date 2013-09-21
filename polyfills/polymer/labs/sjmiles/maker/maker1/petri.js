var fs = require('fs');
var express = require('express');
var app = express();

/*
app.get('*', function(req, res){
  var body = 'Hello World';
  res.type('test/plain');
  //res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', body.length);
  res.end(body);
});
*/

app.use(express.bodyParser());

app.post('/project/*', function(req, res) {
  console.log('POST');
  //console.log(req.body.html);
  console.log(req.route);
  fs.writeFile('project/' + req.route.params[0], req.body.html, function(err) {
    res.end();
  });
});

app.get('/project/listing', function(req, res) {
  fs.readdir('project', function(err, files) {
    res.send(files);
    res.end();
  });
});

app.use('', express.static(__dirname + '/dev/index.html'));

//app.use('/index.html', express.static(__dirname + '/dev/index.html'));
app.use('/polymer', express.static(__dirname + '../../../../../'));
app.use('/project', express.static(__dirname + '/project'));
//app.use('/', express.static(__dirname + '../../../../'));
app.use('/', express.static(__dirname + '/dev'));

app.listen(3000);
console.log('Listening on port 3000');