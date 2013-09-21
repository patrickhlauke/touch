(function(scope){

var Parser = function(tokens) {
  return this.parse(tokens);
}

Parser.prototype = {
  parse: function(tokens) {
    // remove ws for easier debugging
    var filtered = [];
    var it = new Iterator(tokens);
    while (it.next()) {
      if (it.value.kind !== "ws") {
        filtered.push(it.value);
      }
    }
    // parse the filtered token stream
    it = new Iterator(filtered);
    return this.walk(it);
  },
  combine: function(inNodes) {
    var r = '';
    for (var i=0, n; (n=inNodes[i]); i++) {
      r += n.token;
    }
    return r;
  },
  walk: function(it, inState) {
    if (this.debug) {
      this.logMethodEntry(it, "inState " + inState + " >>" + JSON.stringify(it.value) + "<<");
    }
    var nodes = [], node;
    try {
      while (it.next()) {
        node = it.value;
        if (this.debug) {
          this.logProcessing(it, node);
        }
        //
        if (node.kind == "ws") {
          continue;
        }
        else if (node.kind == "comment") {
          node.kind = "comment";
        }
        //
        else if (inState == "array") {
          if (node.kind == "terminal") {
            continue;
          }
          // we haven't actually used it.value yet, but we are about to initiate another walk, which will advance the stream pointer
          // put it.value back so we don't lose it
          it.prev();
          var saved = it.value;
          // we collect each element as an object
          node = {
            kind: "element",
            token: "expr",
            children: this.walk(it, "expression")
          };
          // if the token that terminated the expression was a ']', close the array
          // Do the same if we couldn't parse the children, for whatever reason (usually, a syntax error)
          if ((it.value && it.value.token == "]") || (it.value && it.value === saved)) {
            if (node.children.length) { // only push the node if it's got children
              nodes.push(node);
            }
            if (this.debug) {
              this.logMethodExit(it);
            }
            return nodes;
          }
        }
        else if (node.token == "[") {
          node.kind = "array";
          node.children = this.walk(it, node.kind);
          if (it.value) {
            node.end = it.value.end;
          } else {
            if (this.debug) {
              this.logIterMsg(it, "No end token for array?");
            }
          }
        }
        else if (inState == "expression" && node.token == "]") {
          if (this.debug) {
            this.logMethodExit(it);
          }
          return nodes;
        }
        //
        else if (node.token == "var") {
          node.kind = "var";
          node.children = this.walk(it, "expression");
        }
        //
        // terminals (; or ,)
        else if (node.kind == "terminal" && (inState == "expression" || inState == "var")) {
          if (this.debug) {
            this.logMethodExit(it);
          }
          return nodes;
        }
        else if (node.kind == "terminal") {
          continue;
        }
        //
        // block
        else if (node.token == "{") {
          node.kind = "block";
          if (this.debug) {
            this.logIterMsg(it, "PROCESS BLOCK - START");
          }
          node.children = this.walk(it, node.kind);
          if (this.debug) {
            this.logIterMsg(it, "PROCESS BLOCK - END");
          }
          if (it.value) {
            node.end = it.value.end;
          } else {
            if (this.debug) {
              this.logIterMsg(it, "No end token for block?");
            }
          }
          // Check if the block is terminated by a comma			NB: Does not change the iterator
          node.commaTerminated = this.isCommaTerminated(it);

          if (inState == "expression" || inState == "function") {
            // a block terminates an expression
            nodes.push(node);
            if (this.debug) {
              this.logMethodExit(it);
            }
            return nodes;
          }
        }
        // close block during expression processing
        else if (inState == "expression" && (node.token == "}" || node.token == ")")) {
          // put the token back so the calling context can use it
          it.prev();
          if (this.debug) {
            this.logMethodExit(it);
          }
          return nodes;
        }
        // close block during block processing
        else if (inState == "block" && node.token == "}") {
          if (this.debug) {
            this.logMethodExit(it);
          }
          return nodes;
        }
        //
        // assignment
        else if (node.token == "=" || (node.token == ":" && inState != "expression")) {
          var prev = nodes.pop();
          if (prev.kind == "identifier") {
            prev.op = node.token;
            prev.kind = "assignment";
            prev.children = this.walk(it, "expression");
            // if our expression hit a terminal, don't consume it
            if (it.value && it.value.kind == "terminal") {
              prev.commaTerminated = (it.value.token === ',');
              it.prev();
            }
            node = prev;
          } else {
            nodes.push(prev);
          }
        }
        // association
        else if (node.token == "(") {
          node.kind = "association";
          node.children = this.walk(it, node.kind);
        }
        else if (inState == "association" && node.token == ")") {
          if (this.debug) {
            this.logMethodExit(it);
          }
          return nodes;
        }
        // function keyword
        else if (node.token == "function") {
          node.kind = "function";
          if (this.debug) {
            this.logIterMsg(it, "PROCESS FUNCTION - START");
          }
          node.children = this.walk(it, node.kind);
          if (this.debug) {
            this.logIterMsg(it, "PROCESS FUNCTION - END");
          }

          if (it.value && it.value.kind === "symbol" && it.value.token === "}") {
            // Nothing to to
          } else {
            if (this.debug) {
              this.logIterMsg(it, "No end token for function?");
            }
          }

          // if we are not processing an expression, this is an anonymous function or it is using "C-style" naming syntax
          // "function <name>(){..}"
          if (inState !== "expression" && node.children && node.children.length && node.children[0].kind == "identifier") {
            if (this.debug) {
              this.logIterMsg(it, "C-Style function");
            }
            // tag the function with a name property
            node.name = node.children[0].token;
            node.children.shift();
            // optionally convert this function to be an assignment node in the AST
            var neo = {
              kind: "assignment",
              token: node.name,
              children: [node]
            };
            node = neo;
          }
          if (inState == "expression" || inState == "function") {
            // Determine if the function is followed by a comma       NB: Does not change the iterator
            node.commaTerminated = this.isCommaTerminated(it);

            // a function terminates an expression
            nodes.push(node);
            if (this.debug) {
              this.logMethodExit(it);
            }
            return nodes;
          }
        }
        if (this.debug) {
          this.logIterMsg(it, "PUSH NODE");
        }
        nodes.push(node);
      }
    } catch(x) {
      window.console.error(x);
    }
    if (this.debug) {
      this.logMethodExit(it);
    }
    return nodes;
  },
  isCommaTerminated: function(it) {
    /*
     * This function read the next value
     * Check if it's a comma
     * Put back the value in the iterator
     */
    var commaPresent = false;
    var item = it.next(); // Get next token to check if it's a comma
    if (item) {
      commaPresent = (item.kind === 'terminal' && item.token === ',');
    }
    it.prev(); // put the token back so the calling context can use it
    return commaPresent;
  }
};

// exports

scope.Parser = Parser;

})(window);