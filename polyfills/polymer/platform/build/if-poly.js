// prepoulate window.Platform.flags for default controls
window.Platform = window.Platform || {};
// prepopulate window.logFlags if necessary
window.logFlags = window.logFlags || {};
// process flags
(function(scope){
  // import
  var flags = scope.flags || {};
  // populate flags from location
  location.search.slice(1).split('&').forEach(function(o) {
    o = o.split('=');
    o[0] && (flags[o[0]] = o[1] || true);
  });
  // If any of these flags match 'native', then force native ShadowDOM; any
  // other truthy value, or failure to detect native
  // ShadowDOM, results in polyfill 
  flags.shadow = (flags.shadow || flags.shadowdom || flags.polyfill);
  if (flags.shadow === 'native') {
    flags.shadow = false;
  } else {
    flags.shadow = flags.shadow || !HTMLElement.prototype.createShadowRoot
        && 'polyfill';
  }



  // export
  scope.flags = flags;
})(Platform);
// select ShadowDOM impl
if (Platform.flags.shadow === 'polyfill') {