var _DEBUG_CONTROL_POSITIONS = false;

function rectsToTransformValues(desired, current, origin, ignoreScale) {
  var sx = (ignoreScale ? 1 : desired.width / current.width);
  var sy = (ignoreScale ? 1 : desired.height / current.height);
  return {
    tx: desired.left - current.left - origin.x * (1 - sx),
    ty: desired.top - current.top - origin.y * (1 - sy),
    sx: sx,
    sy: sy
  };
}

function transformValuesToCss(values, ignoreScale) {
  return "translate3d(" + values.tx + "px, " + values.ty + "px, 0px)" + (ignoreScale ? "" : 
         " scale(" + values.sx + ", " + values.sy + ")");
}

function rectsToCss(desired, current, origin, ignoreScale) {
  return transformValuesToCss(rectsToTransformValues(desired, current, origin, ignoreScale), ignoreScale);
}

function rectToClip(rect) {
  return "rect(0px, " + rect.width + "px, " + rect.height + "px, 0px)";
} 

function setPosition(target, rect, name) {
  target[name] = rect;
}

function fixTiming(timing) {
  if (typeof timing == "number") {
    timing = {duration: timing};
  }
  timing.fillMode = _DEBUG_CONTROL_POSITIONS ? 'both' : 'none';
  if (_DEBUG_CONTROL_POSITIONS) {
    timing.startDelay = 2;
  }
  return timing;
}

var classNum=0;

function setupShadowContainer(target, root) {
  var parent = root.parentElement;
  var shadowRoot = parent.webkitShadowRoot;
  if (shadowRoot == null) {
    shadowRoot = parent.webkitCreateShadowRoot();
    shadowRoot.applyAuthorStyles = true;
    for (var i = 0; i < parent.children.length; i++) {
      var content = document.createElement("content");
      content.setAttribute("select", ".scflt_" + classNum);
      content.classList.add("scflt_" + classNum);
      parent.children[i].classList.add("scflt_" + classNum);
      var opacDiv = document.createElement("div");
      opacDiv.appendChild(content);
      var div = document.createElement("div");
      div.appendChild(opacDiv);
      div.classList.add("scflt_" + classNum);
      shadowRoot.appendChild(div);
      if (parent.children[i] == target) {
        var newSel = ".scflt_" + classNum;
      }
      classNum ++;
    }
  } else {
    for (var i = 0; i < target.classList.length; i++) {
      if (target.classList[i].substring(0, 6) == "scflt_") {
        var newSel = '.' + target.classList[i];
        break;
      }
    }
  }


  if (target != root) {
    var newSel = ".scflt_" + classNum;
    classNum ++;

    var content = document.createElement("div");
    var contentChild = document.createElement("content");
    contentChild.setAttribute("select", newSel);
    content.appendChild(contentChild);
    target.classList.add(newSel);
    var parentDiv = document.createElement("div");
    parentDiv.appendChild(content);
    parentDiv.classList.add(newSel.substring(1));
    shadowRoot.appendChild(parentDiv);
  } else {
    console.log(newSel);
    content = shadowRoot.querySelector('content' + newSel).parentElement;
    parentDiv = content.parentElement;
  }

  target.shadow = {root: shadowRoot, parent: parentDiv, content: content};
  return target.shadow;
}

function createShadowPlaceholder(shadow, target, rect) {
  var div = document.createElement("div");
  var replacement = boundingRectToReplacementRect(target, rect);
  div.style.width = replacement.width + 'px';
  div.style.height = replacement.height + 'px';
  shadow.parent.appendChild(div);
  return div;
}
 
function animationToPositionLayout(target, positions, current, timing, isContents) {
  timing = fixTiming(timing);
  
  if (isContents) {
    var from = target.shadow.fromContents;
  } else {
    var from = target.shadow.from;
  }

  var mkPosList = function(property, list) {
    return list.map(function(input) {
      contentRect = boundingRectToContentRect(target, input);
      var out = {offset: input.offset};
      out.value = contentRect[property] + 'px';
      return out;
    });
  }

  // copy style from initial state to final state. This tries to capture CSS transitions.
  sourceStyle = window.getComputedStyle(from);
  targetStyle = window.getComputedStyle(target);
  for (var i = 0; i < targetStyle.length; i++) {
    var prop = targetStyle[i];
    if (sourceStyle[prop] != targetStyle[prop]) {
      if (["-webkit-transform-origin", "-webkit-perspective-origin", "top", "position", "left", "width", "height"].indexOf(prop) == -1) {
        if (!isContents || prop.indexOf('background') == -1) {
          from.style[prop] = targetStyle[prop];
        }
      }
    }
  }
  if (isContents) {
    from.style.borderColor = "rgba(0, 0, 0, 0)";
  }

  return new Animation(from, {position: ["absolute", "absolute"],
                                left: mkPosList('left', positions),
                                top: mkPosList('top', positions),
                                width: mkPosList('width', positions), 
                                height: mkPosList('height', positions)}, 
                       timing);
}

function origin(str) {
  var arr = str.split('px');
  return {x: Number(arr[0]), y: Number(arr[1])};
}

function animationToPositionTransform(target, positions, current, timing, isContents) {
  if (isContents) {
    var from = target.shadow.fromContents;
  } else {
    var from = target.shadow.from;
  }

  var transOrig = origin(from.style.webkitTransformOrigin);
  var cssList = positions.map(function(position) {
    var str = rectsToCss(position, current, transOrig);
    return {offset: position.offset, value: str};
  });

  timing = fixTiming(timing);

  return new Animation(from, {transform: cssList}, timing);
}

function animationToPositionNone(target, positions, current, timing, isContents) {
  if (isContents) {
    var from = target.shadow.fromContents;
  } else {
    var from = target.shadow.from;
  }

  var transOrig = origin(from.style.webkitTransformOrigin);
  var cssList = positions.map(function(position) {
    var str = rectsToCss(position, current, transOrig, true);
    return { offset: position.offset, value: str};
  });

  timing = fixTiming(timing);
  
  return new Animation(from, {transform: cssList,
                                position: ["absolute", "absolute"]}, timing);
}

function animationToPositionClip(target, positions, current, timing, isContents) {
  if (isContents) {
    var from = target.shadow.fromContents;
  } else {
    var from = target.shadow.from
  }
  timing = fixTiming(timing);
  
  var transOrig = origin(from.style.webkitTransformOrigin);
  var cssList = positions.map(function(position) {
    var str = rectsToCss(position, current, transOrig, true);
    return { offset: position.offset, value: str };
  });

  var clipList = positions.map(function(position) {
    var str = rectToClip(position);
    return { offset: position.offset, value: str };
  });

  return new Animation(from, {transform: cssList, clip: clipList, position: ["absolute", "absolute"]}, timing);
}

function animationToPositionFadeOutIn(outTo, inFrom, clip) {
  return function(target, positions, current, timing, isContents) {
    if (isContents) {
      var from = target.shadow.fromContents;
    } else {
      var from = target.shadow.from;
    }
    timing = fixTiming(timing);
    var opacityTiming = {};
    for (d in timing) {
      opacityTiming[d] = timing[d];
    }
    opacityTiming.duration = timing.duration * outTo;
    opacityTiming.fillMode = 'forwards';

    var transOrig = origin(from.style.webkitTransformOrigin);
    var cssList = positions.map(function(position) {
      var str = rectsToCss(position, positions[0], transOrig, true);
      return { offset: position.offset, value: str};
    });
  
    if (clip) {
      var clipList = positions.map(function(position) {
        var str = rectToClip(position);
        return { offset: position.offset, value: str};
      });
      var fromAnim = new Animation(from, {transform: cssList, clip: clipList,
            position: ["absolute", "absolute"]}, timing);
    } else { 
      var fromAnim = new Animation(from, {transform: cssList,
            position: ["absolute", "absolute"]}, timing);
    }
    var fromOpacAnim = new Animation(from, {opacity: ["1", "0"]}, opacityTiming);

    opacityTiming.duration = timing.duration * (1 - inFrom);
    if (opacityTiming.startDelay == undefined) {
      opacityTiming.startDelay = 0;
    }
    opacityTiming.startDelay += timing.duration * inFrom;  
    opacityTiming.fillMode = 'backwards';

    if (isContents) {
      if (!target.shadow.toContents) { 
        var toPosition = boundingRectToContentRect(target, positions[positions.length - 1]);
        var to = cloneToSize(target, toPosition, true);
        target.shadow.toContents = extractContents(to);
        target.shadow.parent.appendChild(target.shadow.toContents);
        to.parentElement.removeChild(to);
      }
      var to = target.shadow.toContents;
    } else {
      var toPosition = boundingRectToContentRect(target, positions[positions.length - 1]);
      var to = cloneToSize(target, toPosition, true);
      target.shadow.to = to;
    }

    transOrig = origin(getComputedStyle(to).webkitTransformOrigin);
    var cssList = positions.map(function(position) {
      var str = rectsToCss(position, positions[positions.length - 1], transOrig, true);
      return { offset: position.offset, value: str};
    });

    if (clip) {
      var toAnim = new Animation(to, {transform: cssList, clip: clipList,
                position: ["absolute", "absolute"]}, timing);
    } else {
      var toAnim = new Animation(to, {transform: cssList,
                position: ["absolute", "absolute"]}, timing);
    }
    var toOpacAnim = new Animation(to, {opacity: ["0", "1"]}, opacityTiming);

    timing.fillMode = 'forwards';
    var cleanupAnimation = new Animation(null, new Cleaner(function() {
      to.parentElement.removeChild(to);
    }), timing);
    
    return new ParGroup([fromAnim, toAnim, cleanupAnimation, 
      new ParGroup([fromOpacAnim, toOpacAnim], {fillMode: 'none'})]);
  }
}

function animationToPositionTransfade(target, positions, current, timing, isContents) {
  if (isContents) {
    var from = target.shadow.fromContents;
  } else {
    var from = target.shadow.from;
  }
  timing = fixTiming(timing);

  var transOrig = origin(from.style.webkitTransformOrigin);
  var cssList = positions.map(function(position) {
    var str = rectsToCss(position, positions[0], transOrig);
    return { offset: position.offset, value: str};
  });
   
  var fromAnim = new Animation(from, {transform: cssList,
          position: ["absolute", "absolute"]}, timing);
  var fromOpacAnim = new Animation(from, {opacity: ["1", "0"]}, timing);

  if (isContents) {
    if (!target.shadow.toContents) { 
      var toPosition = boundingRectToContentRect(target, positions[positions.length - 1]);
      var to = cloneToSize(target, toPosition, true);
      target.shadow.toContents = extractContents(to);
      target.shadow.parent.appendChild(target.shadow.toContents);
      to.parentElement.removeChild(to);
    }
    var to = target.shadow.toContents;
  } else {
    var toPosition = boundingRectToContentRect(target, positions[positions.length - 1]);
    var to = cloneToSize(target, toPosition, true);
    target.shadow.to = to;
  }

  transOrig = origin(getComputedStyle(to).webkitTransformOrigin);
  var cssList = positions.map(function(position) {
    var str = rectsToCss(position, positions[positions.length - 1], transOrig);
    return { offset: position.offset, value: str};
  });

  var toAnim = new Animation(to, {transform: cssList,
            position: ["absolute", "absolute"]}, timing);
  var toOpacAnim = new Animation(to, {opacity: ["0", "1"]}, timing);

  timing.fillMode = 'forwards';
  var cleanupAnimation = new Animation(null, new Cleaner(function() {
    to.parentElement.removeChild(to);
  }), timing);
    
  return new ParGroup([fromAnim, toAnim, cleanupAnimation, 
    new ParGroup([fromOpacAnim, toOpacAnim], {fillMode: 'none'})]);
}

function extractContents(container, copyContents) {
  var fromContents = document.createElement("div");
  fromContents.style.width = container.style.width;
  fromContents.style.height = container.style.height;
  fromContents.style.top = container.style.top;
  fromContents.style.left = container.style.left;
  fromContents.style.position = "absolute";
  fromContents.innerHTML = container.innerHTML;
  if (!copyContents) {
    container.innerHTML = "";
  }
  var targetStyle = container.style;
  for (var i = 0; i < targetStyle.length; i++) {
    var prop = targetStyle[i];
    if (["-webkit-transform-origin", "-webkit-perspective-origin", "top", "position", "left", 
            "width", "height"].indexOf(prop) == -1) {
      if (prop.indexOf("background") == -1) {
        fromContents.style[prop] = targetStyle[prop];
      }
    }
  }
  fromContents.style.borderColor = "rgba(0, 0, 0, 0)";

  return fromContents; 
}

function animationForHybridTransition(container, contents) {
  return function(target, positions, current, timing) {
    var fromContents = extractContents(target.shadow.from);
    target.shadow.parent.appendChild(fromContents);
    target.shadow.fromContents = fromContents;

    var containerAnimation = animationGenerator(container)(target, positions, current, timing);

    if (target.shadow.to) {
      var toContents = extractContents(target.shadow.to);
      target.shadow.parent.appendChild(toContents);
      target.shadow.toContents = toContents;
    }

    return new ParGroup([containerAnimation,
      animationGenerator(contents)(target, positions, current, timing, true)]);
  }
}

function animationGenerator(effect) {
  switch(effect) {
    case 'transform':
      return animationToPositionTransform;
    case 'none':
      return animationToPositionNone;
    case 'crossfade':
      return animationToPositionFadeOutIn(1, 0, false);
    case 'transfade':
      return animationToPositionTransfade;
    case 'clip':
      return animationToPositionClip;
    case 'clipfade':
      return animationToPositionFadeOutIn(1, 0, true);
    case 'layout':
      return animationToPositionLayout;
    default:
      var result = /fade-out-in\(([0-9.]+)%, ([0-9.]+)%(, (clip))?\)/.exec(effect);
      if (result != null) {
        return animationToPositionFadeOutIn(Number(result[1])/100, Number(result[2])/100, result[4] == null ? false : true);
      } 
  }
}

function cloneToSize(node, rect, hide) {
  var div = document.createElement("div");
  var nodeStyle = window.getComputedStyle(node);
  div.setAttribute("style", nodeStyle.cssText);
  if (hide) {
    div.style.opacity = "0";
  }
  div.style.position = "absolute";
  div.style.left = rect.left + 'px';
  div.style.top = rect.top + 'px';
  div.style.width = rect.width + 'px';
  div.style.height = rect.height + 'px';
  div.innerHTML = node.innerHTML;
  if (hide) {
    // NB: This is a hacky way to put to containers before from contents.
    node.shadow.parent.insertBefore(div, node.shadow.parent.children[2]);
  } else {
    console.log(node.shadow);
    node.shadow.parent.appendChild(div);
  }
  return div;
}

function Cleaner(action) {
  this.fired = false;
  this.action = action;
  this.sample = function(t) {
    if (t == 1 && !this.fired) {
      this.action();
      this.fired = true;
    }
  }.bind(this);
}

function cleaner(action, timing) {
  return new Animation(null, new Cleaner(action), timing);
}

//========================

var layoutKeyframes = {};

var transitionable = [];

function registerLayoutKeyframes(name, keyframes) {
  layoutKeyframes[name] = keyframes;
}

function LayoutTransition() {
  this.name = undefined;
  this.duration = 0;
  this.inner = "none";
  this.outer = "layout";
}

LayoutTransition.prototype = {
  setName: function(name) {
    this.name = name;
  },
  setDuration: function(duration) {
    if (duration) {
      this.duration = duration;
    } else {
      this.duration = 0;
    }
  },
  setLayout: function(outer, inner) {
    if (outer == undefined) {
      outer = "layout";
    }
    if (inner == undefined) {
      inner = outer;
    }
    this.outer = outer;
    this.inner = inner;
  }
}

function setLayoutTransition(target, name, duration) {
  if (target.length !== undefined) {
    for (var i = 0; i < target.length; i++) {
      setLayoutTransition(target[i], name, duration);
    }
    return;
  }
  if (target._layout == undefined) {
    target._layout = new LayoutTransition();
  }
  target._layout.setName(name);
  target._layout.setDuration(duration);
  if (transitionable.indexOf(target) == -1) {
    transitionable.push(target);
  }
}

function setLayoutEffect(target, outer, inner) {
  if (target.length !== undefined) {
    for (var i = 0; i < target.length; i++) {
      setLayoutEffect(target[i], outer, inner);
    }
    return;
  }
  if (target._layout == undefined) {
    target._layout = new LayoutTransition();
  }
  target._layout.setLayout(outer, inner);
}

function cloneRect(rect) {
  var result = {};
  result.left = rect.left;
  result.top = rect.top;
  result.width = rect.width;
  result.height = rect.height;
  return result;
}

function rectEquals(rectA, rectB) {
  return rectA.left == rectB.left && rectA.top == rectB.top && rectA.width == rectB.width && rectA.height == rectB.height;
}

function setPositions(target, name) {
  if (target.length !== undefined) {
    for (var i = 0; i < target.length; i++) {
      setPositions(target[i], name);
    }
    return;
  }
  
  var rect = cloneRect(target.getBoundingClientRect());
  var parent = target.parentElement;
  while (parent) {
    var style = getComputedStyle(parent);
    if (style.position == 'absolute' || style.position == 'relative') {
      break;
    }  
    parent = parent.parentElement;
  }
  if (parent) {
    var parentRect = parent.getBoundingClientRect();
    rect.top -= parentRect.top;
    rect.left -= parentRect.left;
  }
  setPosition(target, rect, name);
}

// Convert CSS Strings to numbers.
// Maybe its time to think about exposing some of the core CSS emulation functionality of Web Animations?
function v(s) {
  return Number(s.substring(0, s.length - 2));
}

function boundingRectToContentRect(element, rect) {
  var style = window.getComputedStyle(element);
  var width = rect.width - v(style.borderLeftWidth) - v(style.borderRightWidth) - v(style.paddingLeft) - v(style.paddingRight);
  var height = rect.height - v(style.borderTopWidth) - v(style.borderBottomWidth) - v(style.paddingTop) - v(style.paddingBottom);
  var left = rect.left - v(style.marginLeft);
  var top = rect.top - v(style.marginTop);
  return {width: width, top: top, left: left, height: height};
}

function boundingRectToReplacementRect(element, rect) {
  var style = window.getComputedStyle(element);
  var width = rect.width + v(style.marginLeft) + v(style.marginRight);
  var height = rect.height + v(style.marginTop) + v(style.marginBottom);
  var left = rect.left - v(style.marginLeft);
  var top = rect.top - v(style.marginTop);
  return {width: width, top: top, left: left, height: height}; 
}

function forceToPosition(element, rect) {
  var shadow = element.shadow; //setupShadowContainer(element);
  var div = createShadowPlaceholder(shadow, element, element._transitionAfter);
  element.placeholder = div;
  
  rect = boundingRectToContentRect(element, rect);
  element.style.left = rect.left + 'px';
  element.style.top = rect.top + 'px';
  element.style.width = rect.width + 'px';
  element.style.height = rect.height + 'px';
  element.style.position = "absolute";
}

function findMovedElements(list) {
  return list.filter(function(listItem) {
    listItem.shadow.placeholder = createShadowPlaceholder(listItem.shadow, listItem, listItem._transitionAfter);
    if (listItem.shadow.content.parentElement) {
      listItem.shadow.parent.removeChild(listItem.shadow.content);
    }
    listItem.shadow.content.style.opacity = "1";
    if (rectEquals(listItem._transitionBefore, listItem._transitionAfter)) {
      return false;
    }
    return true;
  });
}

function walkTrees(element, copy, fun) {
  var treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT,
    { acceptNode: function(node) { return NodeFilter.FILTER_ACCEPT; } }, false);
  var copyWalker = document.createTreeWalker(copy, NodeFilter.SHOW_ELEMENT,
    { acceptNode: function(node) { return NodeFilter.FILTER_ACCEPT; } }, false);

  while (treeWalker.nextNode()) {
    copyWalker.nextNode();
    fun(treeWalker.currentNode, copyWalker.currentNode);
  }
}

function createCopy(element, root) {
  var shadow = setupShadowContainer(element, root);
  var fromPosition = boundingRectToContentRect(element, element._transitionBefore);
  if (element != root) {
    var parent = element.parentElement;
    while (parent != root.parentElement) {
      var style = getComputedStyle(parent);
      if (style.position == "relative" || style.position == "absolute") {
        fromPosition.left += v(style.left);
        fromPosition.top += v(style.top);
      }
      parent = parent.parentElement;
    } 
  }
  var from = cloneToSize(element, fromPosition);
  from.classList.add("fromStateCopy");
  element.shadow.from = from;
  element.shadow.content.style.opacity = "0";
} 

function createCopies(tree) {
  function createCopiesWithRoot(item, root) {
    createCopy(item, root);
    if (item._transitionChildren) {
      item._transitionChildren.forEach(function(child) { createCopiesWithRoot(child, root); });
    }
  }
  tree.forEach(function(root) { createCopiesWithRoot(root, root); });
}

function buildTree(list) {
  var roots = [];
  for (var i = 0; i < list.length; i++) {
    var current = list[i];
    for (var p = current.parentElement; p != null; p = p.parentElement) {
      if (list.indexOf(p) != -1) {
        current._transitionParent = p;
        if (p._transitionChildren == undefined) {
          p._transitionChildren = [];
        }
        p._transitionChildren.push(current);
        break;
      }
    }
    if (p == null) {
      roots.push(current);
    }
  }
  return roots;
}


function cleanup() {
  for (var i = 0; i < transitionable.length; i++) {
    transitionable[i]._transitionBefore = undefined;
    transitionable[i]._transitionAfter = undefined;
    transitionable[i]._transitionChildren = undefined;
    transitionable[i]._transitionParent = undefined;
  }
}

function positionListFromKeyframes(keyframes, element) {
  var positions = keyframes.slice();
  positions.sort(function(a, b) {
    if (a.offset > b.offset) {
      return 1;
    }
    if (a.offset < b.offset) {
      return -1;
    }
    return 0;
  });
  if (positions[0].offset != 0) {
    throw "NoOffsetAt0";
  }
  if (positions[positions.length - 1].offset != 1) {
    throw "NoOffsetAt1";
  }

  var before = element._transitionBefore;
  var after = element._transitionAfter;

  var properties = ["left", "top", "width", "height"];

  for (var i = 0; i < positions.length; i++) {
    for (var j = 0; j < properties.length; j++) {
      var property = properties[j];
      var layoutProperty = 'layout' + properties[j][0].toUpperCase() + properties[j].slice(1);
      if (positions[i].properties[layoutProperty] == "from()") {
        positions[i][property] = before[property];
      } else if (positions[i].properties[layoutProperty] == "to()") {
        positions[i][property] = after[property];
      } else {
        positions[i][property] = v(positions[i].properties[layoutProperty]);
      }
    }
  }

  return positions;
}

function makePositionListRelative(list, parentList) {
  var result = []
  for (var i = 0; i < list.length; i++) {
    result.push({
      top: list[i].top + parentList[i].top,
      left: list[i].left + parentList[i].left,
      width: list[i].width,
      height: list[i].height,
      offset: list[i].offset});
  }
  return result;
}

// Transition the provided action.
//
// Overview:
// All potentially transitionable content is stored in the transitionable list.
// Each element in this list has initial position marked and a copy created.
// Additionally, a shadow DOM tree is created for each container of a transitionable
// element. Details of this tree are stored on the transitionable elements themselves,
// in a member variable called shadow:
// {
//   root: root of the shadow DOM tree
//   parent: root of the element's tree
//   content: root of the element's content exposure
//   from: initial created copy
// }
// The initial position is stored in a member variable called _transitionBefore
// TODO: Is the initial position needed any more?
// As part of the process of creating a copy, the content is hidden by setting
// a wrapping div in the shadow DOM to opacity: 0.
//
// The action is then executed. This updates the content to its new position,
// but the change is not visible on-screen. The new position is captured into
// element._transitionAfter, and a list of moved elements is generated.
// Additionally, the content node is removed from the shadow DOM to prevent 
// further interaction from the actual content.
//
// Each different transition type has a different approach to generating the
// transition effect, but essentially transform, layout and none operate on the
// created copy, while transfade and crossfade need to create an aditional copy
// of the to state. This is performed in the animation generation functions directly.
function transitionThis(action) {
  // record positions before action
  setPositions(transitionable, '_transitionBefore');
  // construct transition tree  
  var tree = buildTree(transitionable);
  // duplicate divs before action
  createCopies(tree);
  // move to new position
  action();
  // record positions after action
  setPositions(transitionable, '_transitionAfter');
  // put everything back
  // note that we don't need to do this for all transition types, but
  // by doing it here we avoid a layout flicker.
  movedList = findMovedElements(transitionable);

  // construct animations

  var parGroup = new ParGroup();

  function processList(list) {
    if (!list) {
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var keyframes = layoutKeyframes[list[i]._layout.name];
      var positionList = positionListFromKeyframes(keyframes, list[i]);
     
      if (list[i]._transitionParent) {
        positionList = makePositionListRelative(positionList, list[i]._transitionParent._transitionPositionList);
      }

      list[i]._transitionPositionList = [];
      for (var j = 0; j < positionList.length; j++) {
        list[i]._transitionPositionList.push({left: positionList[j].left, top: positionList[j].top});
      }
      
      walkTrees(list[i], list[i].shadow.from, function(child, copy) {
        if (child._transitionParent == list[i]) {
          copy.style.opacity = "0";
        }
      });

      if (list[i]._layout.outer == list[i]._layout.inner) {
        generator = animationGenerator(list[i]._layout.outer);
      } else {
        generator = animationForHybridTransition(list[i]._layout.outer, list[i]._layout.inner);
      }

      parGroup.add(
          generator(list[i], positionList, list[i]._transitionBefore, list[i]._layout.duration));
      
      processList(list[i]._transitionChildren);
    }
  }

  processList(tree);

  document.timeline.play(new SeqGroup([
    parGroup,
    new Animation(undefined, new Cleaner(function() {
      for (var i = 0; i < tree.length; i++) {
        // workaround because we can't build animations that transition to empty values
        tree[i].style.left = "";
        tree[i].style.top = "";
        tree[i].style.width = "";
        tree[i].style.height = "";
        tree[i].style.position = "";
        // tree[i].shadow.parent.removeChild(tree[i].placeholder);
        // tree[i].shadow.parent.removeChild(tree[i]._transitionStartCopy);
        // tree[i].shadow.root.innerHTML = "";
        tree[i].placeholder = undefined; 
      }
      for (var i = 0; i < transitionable.length; i++) {
        for (var j = transitionable[i].shadow.parent.children.length - 1; j >= 0; j--) {
          if (transitionable[i].shadow.parent.children[j].tagName != 'CONTENT') {
            transitionable[i].shadow.parent.removeChild(transitionable[i].shadow.parent.children[j]);
          } else {
            var foundContent = true;
          } 
        }
        if (!foundContent) {
          transitionable[i].shadow.parent.appendChild(transitionable[i].shadow.content);
        }
        transitionable[i].style.opacity = "";
        transitionable[i].shadow = undefined;
        transitionable[i]._transitionStartCopy = undefined;
      }
    }), 0)]));

  // get rid of all the junk
  cleanup();
}
