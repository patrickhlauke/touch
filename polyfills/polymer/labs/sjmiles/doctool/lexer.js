(function(scope){

AbstractLexer = function(text) {
  if (text) {
    this.start(text);
    this.finish();
    return this.r;
  }
}

AbstractLexer.prototype = {
  p0: 0,
  p: 0,
  start: function(inS) {
    this.s = inS;
    this.l = this.s.length;
    this.r = [ ];
    this.d = '';
    this.p0 = 0;
    this.p = 0;
    this.n = 0;
    this.analyze();
  },
  //
  // analyze() is abstract
  //
  search: function(inRegEx) {
    // make sure inRegEx has global flag
    var r = inRegEx.global ? inRegEx : new RegExp(inRegEx.source, "g");
    // install our search position
    r.lastIndex = this.p;
    // accumulate characters until we match some delimiter
    this.m = r.exec(this.s);
    // m.index is the 0-based index of the match
    this.p = this.m ? this.m.index : -1;
    // p0 marks the start of unconsumed characters
    // p marks the start of the new delimeter
    //   <token><delimeter>
    // p0<----->p
    // d is the first character of <delimeter>, return d, or null if no matches
    return (r.lastIndex != this.p0) && (this.d = this.s.charAt(this.p));
  },
  // examine the character inCount ahead of the current position
  lookahead: function(inCount) {
    return this.s.charAt(this.p + inCount);
  },
  // extract the token between positions p0 and p1
  getToken: function() {
    return this.s.slice(this.p0, this.p);
  },
  // move the position (p) by inCount characters (i.e. add inCount characters to token)
  tokenize: function(inCount) {
    this.p += inCount || 0;
  },
  // push a token with kind: inKind
  // inD (optional) specifies a number of characters to add to the token before pushing
  // inAllowEmpty: unless true, 0 length tokens are a no-op
  pushToken: function(inKind, inCount, inAllowEmpty) {
    // move the position (p) by inCount characters (i.e. add inCount characters to token)
    this.tokenize(inCount);
    // copy the token between p0 and p
    var token = this.getToken();
    // if the token is empty string, immediately return an empty object
    if (!token && !inAllowEmpty) {
      return {};
    }
    // counting newlines?
    var nLines = (token.match(/\n/g) || []).length;
    // make a token object with lots of meta-data
    var mToken = { kind: inKind, token: token, start: this.p0, end: this.p, line: this.n, height: nLines };
    // push the token descriptor onto the result stack
    this.r.push(mToken);
    // accumulate line count
    this.n += nLines;
    // bump the starting position pointer
    this.p0 = this.p;
    // return the token descriptor
    return mToken;
  },
  // inD (optional) specifies a number of characters to add to the token before tossing
  tossToken: function(inCount) {
    // move the position (p) by inCount characters (i.e. add inCount characters to token)
    this.tokenize(inCount);
    // bump the starting position pointer
    this.p0 = this.p;
  },
  finish: function() {
    // FIXME: what did this do?
    //this.t += this.s;
    // FIXME: if there is left over text, push it as 'gah' type
    this.pushToken("gah");
  }
};

// JS Lexer

Lexer = function(text) {
  this.buildPattern();
  return AbstractLexer.apply(this, arguments);
};

Lexer.prototype = {
  symbols: "(){}[];,:<>+-=*/&",
  operators: [ "++", "--", "+=", "-=", "==", "!=", "<=", ">=", "===", "&&", "||", '"', "'"],
  keywords: [ "function", "new", "return", "if", "else", "while", "do", "break", "continue", "switch", "case", "var" ],
  buildPattern: function() {
    // match an inline regex
    //var rregex = "/[^*/](?:\\/|[^/])+?/";
    //
    // matches double-quoted string that may contain escaped double-quotes
    var rstring1 = '"(?:\\\\"|[^"])*?"';
    // matches single-quoted string that may contain escaped single-quotes
    var rstring2 = "'(?:\\\\'|[^'])*?'";
    // matches either type of string
    var rstring = rstring1 + "|" + rstring2;
    //
    // matches any of the keywords (\b only matches on word boundaries)
    var rkeys = '\\b(?:' + this.keywords.join('|') + ')\\b';
    //
    // match symbols and operators (code here escapes the symbol characters for use in regex)
    var rsymbols = '[\\' + this.symbols.split('').join('\\') + ']';
    var rops = [];
    for (var i=0, o; (o=this.operators[i]); i++) {
      rops.push('\\' + o.split('').join('\\'));
    }
    rops = rops.join('|');
    //rsymbols += '|' + rops;
    // match rops first (greedy, "<=" instead of "<", "=")
    rsymbols = rops + "|" + rsymbols;
    //console.log(rsymbols);
    //
    // these are all the patterns to match
    //var matches = [rstring1, rstring2, rkeys, '\\/\\/', '\\/\\*', /*rregex,*/ rsymbols, "'\"", '\\s'];
    // these are the matching methods corresponding to the patterns above
    //this.matchers = ["doString", "doString", "doKeyword", "doLineComment", "doCComment", /*"doRegExp",*/ "doSymbol", "doLiteral", "doWhitespace"];
    //
    // these are the patterns to match
    // match escape sequences \" and \/ first to help defray confusion
    var matches = ["\\\\\"|\\\\/", rstring, rkeys, '\\/\\/', '\\/\\*', rsymbols, "\\s"];
    // these are the matching methods corresponding to the patterns above
    this.matchers = ["doSymbol", "doString", "doKeyword", "doLineComment", "doCComment", "doSymbol", "doWhitespace"];
    //
    //
    // construct the master regex as a union of the patterns above
    this.pattern = '(' + matches.join(')|(') + ')';
    //console.log(this.pattern);
  },
  analyze: function() {
    var regex = new RegExp(this.pattern, "gi");
    while (this.search(regex)) {
      // any characters between where we were and the latest delimeter we call an identifier
      this.pushToken("identifier");
      // process the input stream based on the matched delimeter
      this.process(this.matchers);
      // any characters between where we were and the latest delimeter we call an identifier
      this.pushToken("identifier");
    }
  },
  process: function(inMatchers) {
    for (var i=0, f; (f=inMatchers[i]); i++) {
      if (this.m[i+1] && this[f]) {
        this[f].apply(this);
        return;
      }
    }
    this.doSymbol();
  },
  doWhitespace: function() {
    // we saw at least one ws character, so consume it
    this.tokenize(1);
    // consume any additional whitespace (i.e. all characters up to the first non-ws [\S])
    this.search(/\S/g);
    // push all such characters as a ws token
    this.pushToken('ws');
    // remove the actual token (don't capture whitespace)
    this.r.pop();
  },
  doEscape: function() {
    this.tokenize(2);
  },
  doLiteral: function() {
    this.tossToken(1);
    var delim = this.d;
    var rx = new RegExp("\\" + delim + "|\\\\", "g");
    while (this.search(rx)) {
      switch (this.d) {
      case '\\':
        this.doEscape();
        break;
      default:
        this.pushToken('literal', 0, true).delimiter = delim;
        this.tossToken(1);
        return;
      }
    }
  },
  doSymbol: function() {
    this.pushToken((this.d==';' || this.d==',') ? "terminal" : "symbol", this.m[0].length);
  },
  doKeyword: function() {
    this.pushToken("keyword", this.m[0].length);
  },
  doLineComment: function() {
    this.tokenize(2);
    if (this.search(/[\r\n]/g)) {
      this.tokenize(0);
    }
    this.pushToken("comment");
  },
  doCComment: function() {
    this.tokenize(2);
    var n = 1;
    // searching for /* | */
    while (n && (this.search(/\/\*|\*\//g))) {
      // if we see /* add one to the nesting level,
      // if we see */ substract one from the nesting level
      n += (this.d == "/" ? 1 : (this.d == "*" ? -1 : 0));
      // in either case, add the two characters to the token
      this.tokenize(2);
    }
    this.pushToken("comment");
  },
  doString: function() {
    this.pushToken("string", this.m[0].length);
  }
};

// extend AbstractLexer

var p = Object.create(AbstractLexer.prototype);
for (var n in Lexer.prototype) {
  p[n] = Lexer.prototype[n];
}
Lexer.prototype = p;

// exports

scope.Lexer = Lexer;

})(window);