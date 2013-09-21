(function(scope) {

  function register(name, extnds, proto, templates) {
    if (window.ShadowDOMPolyfill) {
      shim(templates, name, extnds);
    }
    var ctor = document.register(name, {
      prototype: Object.create(proto, {
        createdCallback: {
          value: function() {
            if (templates) {
              templates.forEach(function(t) {
                var template = document.querySelector('#' + t);
                if (template) {
                  this.createShadowRoot().appendChild(template.createInstance());
                }
              }, this);
            }
          }
        }
      })
    });
    return ctor;
  }
  
  function shim(templates, name, extnds) {
    if (templates) {
      var id = templates[templates.length - 1];
      var template = document.querySelector('#' + id);
      if (template) {
          Platform.ShadowCSS.shimStyling(template.content, name, extnds);
        }
    }
  }
  
  scope.register = register;

})(window);

