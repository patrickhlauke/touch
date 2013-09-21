(function(scope){

var Documentor = function(tokens) {
  this.comment = [];
  return this.parse(tokens);
};

var statics = {
  indexByProperty: function(inObjects, inProperty, inValue) {
    for (var i=0, o; (o=inObjects[i]); i++) {
      if (o[inProperty] == inValue) {
        return i;
      }
    }
    return -1;
  },
  findByProperty: function(inObjects, inProperty, inValue) {
    return inObjects[this.indexByProperty(inObjects, inProperty, inValue)];
  },
  indexByName: function(inObjects, inName) {
    return this.indexByProperty(inObjects, "name", inName);
  },
  findByName: function(inObjects, inName) {
    return inObjects[this.indexByName(inObjects, inName)];
  },
  stripQuotes: function(inString) {
    var c0 = inString.charAt(0);
    var s = (c0 == '"' || c0 == "'") ? 1 : 0;
    var cl = inString.charAt(inString.length - 1);
    var e = (cl == '"' || cl == "'") ? -1 : 0;
    return (s || e) ? inString.slice(s, e) : inString;
  },
  // Remove leading indent so markdown spacing is intact.
  // Assumes first non-empty line in comment is block-left.
  removeIndent: function(inString) {
    var indent = 0;
    var lines = inString.split(/\r?\n/);
    var i, l;
    for (i=0; (l=lines[i]) != null; i++) {
      if (l.length > 0) {
        indent = l.search(/\S/);
        if (indent < 0) {
          indent = l.length;
        }
        break;
      }
    }
    if (indent) {
      for (i=0; (l=lines[i]) != null; i++) {
        lines[i] = l.slice(indent);
      }
    }
    return lines.join("\n");
  }
};

for (var n in statics) {
  Documentor[n] = statics[n];
};

Documentor.prototype = {
  group: "public",
  parse: function(inTokens) {
    var it = new Iterator(inTokens);
    return this.walk(it);
  },
  walk: function(it, inState) {
    var objects = [], node, obj;
    if (this.debug) {
      this.logMethodEntry(it, "inState " + inState + " >>" + JSON.stringify(it.value) + "<<");
    }
    while (it.next()) {
      node = it.value;
      if (this.debug) {
        this.logProcessing(it, node);
      }
      if (node.kind == "comment") {
        this.cook_comment(node.token);
      }
      else if (node.token == "enyo.kind" && it.future.kind == "association") {
        obj = this.cook_kind(it);
      }
      else if (node.kind == "assignment") {
        obj = this.cook_assignment(it);
      }
      else if (node.kind == "association") {
        // closure? [( [function] [()] [{...}] [()]) ]
        if (node.children && node.children.length == 1 && node.children[0].kind == "function") {
          // closure
          var fn = node.children[0];
          if (fn.children && fn.children.length == 2) {
            var body = fn.children[1];
            var objs = this.walk(new Iterator(body.children));
            // add whatever was in the closure to the main object list
            objects = objects.concat(objs);
          }
          // skip the closure invocation [()]
          it.next();
        }
      }
      if (obj) {
        objects.push(obj);
        obj = null;
      }
    }
    if (this.debug) {
      this.logMethodExit(it);
    }
    return objects;
  },
  cook_kind: function(it) {
    if (this.debug) {
      this.logMethodEntry(it, ">>" + JSON.stringify(it.value) + "<<");
    }
    // Get inProps[name].value[0].token
    var val = function(inProps, inName) {
      var i = Documentor.indexByName(inProps, inName), p;
      if (i >= 0) {
        p = inProps[i];
        inProps.splice(p, 1);
      }
      return p && p.value && p.value.length && p.value[0].token;
    };
    /*
    // Set inProps[name].properties to inProps[name].value[0].properties
    var flatten = function(inProps, inName) {
      var p = Documentor.findByName(inProps, inName);
      var v = p && p.value && p.value.length && p.value[0];
      if (v) {
        p.properties = p.value[0].properties;
      }
    };
    */
    //
    var obj = this.make("kind", it.value);
    // arguments
    it.next();
    // kind takes one argument
    var args = it.value.children;
    // if it's a block
    if (args && args[0] && args[0].kind == "block") {
      // these are the properties
      obj.properties = this.cook_block(args[0].children);
      // process special properties
      obj.name = Documentor.stripQuotes(val(obj.properties, "name") || "");
      obj.superkind = Documentor.stripQuotes(val(obj.properties, "kind") || "enyo.Control");
      if (obj.superkind == "null") {
        obj.superkind = null;
      }
      // Store block information for the kind
      obj.block = { start: args[0].start, end: args[0].end };
      // remove excess value nodes
      //flatten(obj.properties, "published");
    }
    if (this.debug) {
      this.logMethodExit(it);
    }
    return obj;
  },
  cook_block: function(inNodes) {
    if (this.debug) {
      this.logMethodEntry();
    }
    var props = [];
    for (var i=0, n; (n=inNodes[i]); i++) {
      if (this.debug) {
        this.logProcessing(null, n);
      }
      if (n.kind == "comment") {
        this.cook_comment(n.token);
      }
      else if (n.kind == "assignment") {
        var prop = this.make("property", n);
        if (n.children) {
          prop.value = [this.walkValue(new Iterator(n.children))];
          if (n.commaTerminated === undefined) {
            prop.commaTerminated = n.children[0].commaTerminated || false;
            if (n.children[0].commaTerminated === undefined) {
              if (this.debug) {
                this.logMsg("NO COMMA TERMINATED INFO");
              }
            }
          } else {
            prop.commaTerminated = n.commaTerminated;
          }
        }
        props.push(prop);
      }
    }
    if (this.debug) {
      this.logMethodExit();
    }
    return props;
  },
  walkValue: function(it, inState) {
    if (this.debug) {
      this.logMethodEntry(it, "inState: " + inState + " >>" + JSON.stringify(it.value) + "<<");
    }
    while (it.next()) {
      var node = it.value, obj;
      if (this.debug) {
        this.logProcessing(it, node);
      }
      if (node.kind == "comment") {
        this.cook_comment(node.token);
      }
      else if (node.kind == "block") {
        obj = this.make("block", node);
        obj.properties = this.cook_block(node.children);
        if (this.debug) {
          this.logMethodExit(it, "inState: " + inState + " >>" + JSON.stringify(it.value) + "<<");
        }
        return obj;
      }
      else if (node.kind == "array") {
        obj = this.cook_array(it);
        if (this.debug) {
          this.logMethodExit(it);
        }
        return obj;
      }
      else if (node.kind == "function") {
        obj = this.cook_function(it);
        if (this.debug) {
          this.logMethodExit(it, "inState: " + inState + " >>" + JSON.stringify(it.value) + "<<");
        }
        return obj;
      }
      else {
        obj = this.make("expression", node);
        var t = node.token;
        while (it.next()) {
          t += it.value.token;
        }
        obj.token = t;
        if (this.debug) {
          this.logMethodExit(it);
        }
        return obj;
      }
    }
    if (this.debug) {
      this.logMethodExit(it);
    }
  },
  cook_function: function(it) {
    if (this.debug) {
      this.logMethodEntry(it, ">>" + JSON.stringify(it.value) + "<<");
    }
    var node = it.value;
    var obj = this.make("expression", node);
    obj.commaTerminated = node.commaTerminated;
    obj['arguments'] = Array.prototype.map.call(node.children[0].children, function(n) { return n.token; });
    if (this.debug) {
      this.logMethodExit(it);
    }
    return obj;
  },
  cook_array: function(it) {
    if (this.debug) {
      this.logMethodEntry(it, ">>" + JSON.stringify(it.value) + "<<");
    }
    var node = it.value;
    var obj = this.make("array", node);
    var nodes = node.children;
    if (nodes) {
      var elts = [];
      for (var i=0, n, v; (n=nodes[i]); i++) {
        if (n.children) {   // Skip nodes without children such as comments
          v = this.walkValue(new Iterator(n.children));
          if (v) {
            elts.push(v);
          }
        }
      }
      obj.properties = elts;
    }
    if (this.debug) {
      this.logMethodExit(it);
    }
    return obj;
  },
  cook_assignment: function(it) {
    if (this.debug) {
      this.logMethodEntry(it, ">>" + JSON.stringify(it.value) + "<<");
    }
    var node = it.value;
    var obj = this.make("global", node);
    if (node.children) {
      if (node.children[0] && node.children[0].token == "function") {
        obj.type = "function";
      }
      obj.value = [this.walkValue(new Iterator(node.children))];
    }
    if (this.debug) {
      this.logMethodExit();
    }
    return obj;
  },
  make: function(inType, inNode) {
    return {
      line: inNode.line,
      start: inNode.start,
      end: inNode.end,
      height: inNode.height,
      token: inNode.token,
      //
      name: inNode.token,
      type: inType,
      group: this.group,
      comment: this.consumeComment()
      //
      //kind: inType,
      //node: inNode
    };
  },
  // matches "/** [multi-line comment] */" and "//* single line comment"
  commentRx: /\/\*\*([\s\S]*)\*\/|\/\/\*(.*)/m,
  // comments that match a special format are instructions for this parser
  // * some are pragmas are read and acted on
  // * other comments are collected and attached to the next emitted node
  cook_comment: function(inToken) {
    if (this.debug) {
      this.logMethodEntry();
    }
    var m = inToken.match(this.commentRx);
    if (m) {
      m = m[1] ? m[1] : m[2];
      // separate pragmas from doc comments
      var p = this.extractPragmas(m);
      // act on pragmas
      this.honorPragmas(p);
    }
    if (this.debug) {
      this.logMethodExit();
    }
  },
  extractPragmas: function(inString) {
    var pragmaRx = /^[*\s]*@[\S\s]*/g,
      pragmas = [],
      s = inString;
    if (s.length) {
      s = inString.replace(pragmaRx, function(m) {
        var p = m.slice(2);
        //console.log("found pragma: [" + p + "]");
        pragmas.push(p);
        return "";
      });
      // if there is non-pragma content left, add it to comments
      if (s.length) {
        this.comment.push(s);
      }
    }
    return pragmas;
  },
  honorPragmas: function(inPragmas) {
    var groups = {'protected': 1, 'public': 1};
    for (var i=0, p; (p=inPragmas[i]); i++) {
      if (groups[p]) {
        //console.log(p);
        this.group = p;
      }
    }
  },
  consumeComment: function() {
    var comment = this.comment.join(" ");
    // clear Comment
    this.comment = [];
    // Remove leading indent so markdown spacing is intact.
    // Assumes first non-empty line in comment is block-left.
    var md = Documentor.removeIndent(comment);
    //md = md.replace("<", "&lt;");
    return md;
  }
};

// exports

scope.Documentor = Documentor;

})(window);