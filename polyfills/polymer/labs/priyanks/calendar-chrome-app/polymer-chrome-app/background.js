chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('polymer-chrome-app/index.html', {
    bounds: {
      width: 700,
      height: 700
    }
  });
});
