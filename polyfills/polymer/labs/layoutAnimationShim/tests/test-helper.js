var realPlayFunction = document.timeline.play.bind(document.timeline);

var players = [];

document.timeline.play = function(anim) {
  var player = realPlayFunction(anim);
  players.push(player);
  return player;
}

function at(time, test, message) {
  // TODO: remove setTimeout. Why do we need this?
  errored = false;
  
  requestAnimationFrame(function() {
    for (var i = 0; i < players.length; i++) {
      players[i].currentTime = time;
      players[i].playbackRate = 0;
    }
    var div = document.createElement('div');
    try {
      test();
      if (!errored) {
        div.innerHTML = '<span class="pass">PASS</span>: ' + message + '<br>';
      }
    } catch (e) {
      div.innerHTML = '<span class="error">EXCEPTION</span>: ' + message + ': ' +
          e.toString() + '<br>' + e.stack;
    }
    log.appendChild(div);
  });
}

var style = document.createElement('style');
document.documentElement.appendChild(style);
var log = document.createElement('div');
document.documentElement.appendChild(log);

var styleText =
  '.error {' +
  '  color: red;' +
  '} ' +
  '.pass {' +
  '  color: green;' +
  '}';

style.textContent = styleText;

var errored = false;

function check(cond, message) {
  if (!cond) {
    var div = document.createElement('div');
    div.innerHTML = '<span class="error">FAIL</span>: ' + message + '<br>';
    errored = true;
    log.appendChild(div);
  }

  return cond;
}

function checkEquals(actual, expected, message) {
  return check(actual == expected, message + '. Expected: ' + expected + ' got: ' + actual);
}

function checkNotEqual(actual, expected, message) {
  return check(actual != expected, message + '. Expected: !' + expected + ' got: ' + actual);
}

function checkLarger(actual, expected, message) {
  return check(actual > expected, message + '. ' + actual + ' !> ' + expected);
}

function checkSmaller(actual, expected, message) {
  return check(actual < expected, message + '. ' + actual + ' !< ' + expected);
}

function getCopiesInPlay(element) {
  return dictFilter(element._copyCache, function(copy) {
    return copy.parentElement;
  });
}

function dictCount(dict) {
  var count = 0;
  for (var i in dict) {
    count++;
  }
  return count;
}

function dictFilter(dict, f) {
  var result = {};
  for (var i in dict) {
    if (f(dict[i])) {
      result[i] = dict[i];
    }
  }
  return result;
}

function dictForEach(dict, f) {
  var p = 0;
  for (var i in dict) {
    f(dict[i], p);
    p++;
  }
}

function pxToNum(px) {
  checkEquals(px.substring(px.length - 2), 'px', 'not a px value');
  return Number(px.substring(0, px.length - 2));
}

function strToMtrx(str) {
  var matrix = /matrix\((-?[0-9.]*), (-?[0-9.]*), (-?[0-9.]*), (-?[0-9.]*), (-?[0-9.]*), (-?[0-9.]*)\)/.exec(str);
  if (matrix) {
    return matrix.slice(1, 7).map(Number); 
  }

  var translateScale = /translate3d\((-?[0-9.]*)px, (-?[0-9.]*)px, 0px\) scale\((-?[0-9.]*), (-?[0-9.]*)\)/.exec(str);  
  if (translateScale) {    
    console.log(translateScale);
    return [translateScale[3], 0, 0, translateScale[4], translateScale[1], translateScale[2]].map(Number);
  }
  
  var translate = /translate3d\((-?[0-9.]*)px, (-?[0-9.]*)px, 0px\)/.exec(str);
  if (translate) {
    return [1, 0, 0, 1, translate[1], translate[2]].map(Number);
  }

  return undefined;
}

function forEachVisibleCopy(element, f) {
  var copies = getCopiesInPlay(element);
  var visibleCopies = dictFilter(copies, function(copy) {
    return copy.style.opacity != '0';
  });

  dictForEach(visibleCopies, function(copy, position) {
    // There should only be at most 2 visible copies
    checkSmaller(position, 2, 'more than 2 copies visible');
    f(copy, position);
  });  

}

// Checks that the provided element is being actively controlled
// by a layout transition.
function checkLaidOut(element) {
  checkEquals(element.style.opacity, '0', 'element must be invisible');
  check(element._copyCache, 'element must have copy cache');
  var copies = getCopiesInPlay(element);
  checkLarger(dictCount(copies), 0, 'element must have at least one copy in play');
}

function checkLayoutPosition(element, x, y) {
  forEachVisibleCopy(element, function(copy) {
    var style = getComputedStyle(copy);
    var left = pxToNum(style.left);
    var top = pxToNum(style.top);
    var matrix = strToMtrx(style.webkitTransform);
    if (!matrix) {
      matrix = strToMtrx(copy.style.webkitTransform);
    }
    if (matrix) {
      var width = pxToNum(style.width);
      var height = pxToNum(style.height);
      left += matrix[4]  - (matrix[0] - 1) * width / 2;
      top += matrix[5] - (matrix[3] - 1) * height / 2;
    }
    checkEquals(left, x, "element doesn't match layout left position");
    checkEquals(top, y, "element doesn't match layout top position");
  });
}

function checkLayoutScale(element, x, y, x2, y2) {
  forEachVisibleCopy(element, function(copy, position) {
    var style = getComputedStyle(copy);
    var matrix = strToMtrx(style.webkitTransform);
    if (position == 1 && x2 !== undefined) {
      checkEquals(matrix[0], x2, "element doesn't match layout width scale");
      checkEquals(matrix[3], y2, "element doesn't match layout height scale");
    } else {
      checkEquals(matrix[0], x, "element doesn't match layout width scale");
      checkEquals(matrix[3], y, "element doesn't match layout height scale");
    }
  });  
}

function checkLayoutSize(element, x, y, x2, y2) {
  forEachVisibleCopy(element, function(copy, position) {
    var style = getComputedStyle(copy);
    var width = pxToNum(style.width);
    var height = pxToNum(style.height);
    var matrix = strToMtrx(style.webkitTransform);
    width *= matrix[0];
    height *= matrix[3];
    if (position == 1 && x2 !== undefined) {
      checkEquals(width, x2, "element doesn't match layout width size");
      checkEquals(height, y2, "element doesn't match layout height size");
    } else {
      checkEquals(width, x, "element doesn't match layout width size");
      checkEquals(height, y, "element doesn't match layout height size");
    }
  });  
}

function checkLayoutOpacity(element) { 
  var opacities = [].slice.call(arguments, 1);
  var copies = getCopiesInPlay(element);

  var names = [];
  for (var name in copies) {
    if (name != '_transitionBefore' && name != '_transitionAfter') {
      names.push(name);
    }
  }

  // TODO: sort names list according to effect order

  checkEquals(copies['_transitionBefore'].style.opacity, opacities[0],
    'before state opacity mismatch');
  for (var i = 1; i < opacities.length - 1; i++) {
    checkEquals(copies[names[i -1]].style.opacity, opacities[i], 
      'state ' + names[i - 1] + ' opacity mismatch')
  }
  if (opacities.length > 1) {
    checkEquals(copies['_transitionAfter'].style.opacity, opacities[opacities.length - 1],
      'after state opacity mismatch');
  }
}

function checkLayoutClip(element, x, y) {
  forEachVisibleCopy(element, function(copy) {
    var style = getComputedStyle(copy);
    if (checkNotEqual(style.clip, 'auto', 'no clip data is present')) {
      var clipData = style.clip.split(' ');
      checkEquals(pxToNum(clipData[1]), x, "element doesn't match layout clip width");
      checkEquals(pxToNum(clipData[2]), y, "element doesn't match layout clip height");
    }
  });   
}

function checkLayoutNoClip(element) {
  forEachVisibleCopy(element, function(copy) {
    var style = getComputedStyle(copy);
    checkEquals(style.clip, 'auto', 'clip data is present')
  });
}
