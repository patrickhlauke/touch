var xhr = {
  async: true,
  bust: false,
  ok: function(req) {
    return (req.status >= 200 && req.status < 300)
        || (req.status === 304)
        || (req.status === 0);
  },
  load: function(url, next, nextContext) {
    var req = new XMLHttpRequest();
    if (xhr.bust) {
      url += '?' + Math.random();
    }
    req.open('GET', url, xhr.async);
    req.addEventListener('readystatechange', function(e) {
      if (req.readyState === 4) {
        next.call(nextContext, !xhr.ok(req) && req, req.response, url);
      }
    });
    req.send();
  }
};

window.addEventListener('message', function(e) {
  xhr.bust = e.data.bust;
  xhr.load(e.data.url, function(err, resource) {
    e.source.postMessage({
      url: e.data.url,
      err: err,
      resource: resource
    }, '*');
  });
});
