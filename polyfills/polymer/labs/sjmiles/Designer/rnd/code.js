/*
* Copyright 2012 The Polymer Authors. All rights reserved.
* Use of this source code is governed by a BSD-style
* license that can be found in the LICENSE file.
*/
$ = function(inId) {
  return document.getElementById(inId);
};

var dpy = $("droppy");

var dragstart = function(inEvent) {
  inEvent.dataTransfer.setData("Text", inEvent.target.id)
};

var dragover = function(inEvent) {
  var t = inEvent.target;
  if (t.parentNode.id == "flexy") {

    //console.log(t.offsetWidth, inEvent.clientX);
    //
    var lx = inEvent.clientX - t.getBoundingClientRect().left - t.clientLeft + t.scrollLeft;
    var ly = inEvent.clientY - t.getBoundingClientRect().top - t.clientTop + t.scrollTop;
    //
    var dx = lx / t.offsetWidth;
    var dy = ly / t.offsetHeight;
    //
    //console.log(lx, t.offsetWidth, " ... ", ly, t.offsetHeight);
    //
    var mx = (dx > 0.5) ? (1.0 - dx) : dx;
    var my = (dy > 0.5) ? (1.0 - dy) : dy;
    //
    //console.log(dx, dy, mx, my);
    //
    //if (inEvent.clientX > t.offsetWidth / 2) {
    if (mx < my) {
      if (dx > 0.5) {
        dpy.className = "righty";
      } else {
        dpy.className = "lefty";
      }
    } else {
      if (dy > 0.5) {
        dpy.className = "bottomy";
      } else {
        dpy.className = "topy";
      }
    }
    t.appendChild(dpy);
    //
    //t.parentNode.insertBefore(div, t);
    //$("flexy").insertBefore(div, $("flexy").childNodes[2]);
  } else {
    var p = dpy.parentNode;
    if (p) {
      p.removeChild(dpy);
    }
  }
  /*
  $("droppy").className = "hidey";
  if (inEvent.clientX < 16) {
    $("droppy").className = "lefty";
  }
  */
  inEvent.preventDefault();
};

var drop = function(inEvent) {
  var t = inEvent.target;
  if (t.parentNode.id == "flexy") {
    //console.log(t.offsetWidth, inEvent.clientX);
    //
    var div = document.createElement("div");
    div.className = "boxey";
    div.innerText = "Dropped";
    //
    var p = t.parentNode;
    if (inEvent.clientX > t.offsetWidth / 2) {
      t = t.nextSibling;
    }
    if (t) {
      p.insertBefore(div, t);
    } else {
      p.appendChild(div);
    }
    //
    //t.parentNode.insertBefore(div, t);
    //$("flexy").insertBefore(div, $("flexy").childNodes[2]);
  }
  var p = dpy.parentNode;
  if (p) {
    p.removeChild(dpy);
  }
};
document.addEventListener("dragover", dragover);
document.addEventListener("drop", drop);

var selected;
var select = function(inTarget) {
  if (selected) {
    selected.className = selected._className;
  }
  selected = inTarget;
  if (selected) {
    selected._className = selected.className;
    selected.className += " selected";
  }
};
var click = function(inEvent) {
  var t = inEvent.target;
  if (t.className == "boxey") {
    select(t);
  }
  //console.log("click", t.className);
};
document.addEventListener("click", click);

setFlex = function(inEvent){
  if (selected) {
    selected.style["-webkit-flex"] = $("flex").value;
  }
};

