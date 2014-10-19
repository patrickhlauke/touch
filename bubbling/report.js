window.addEventListener('load', function() {
	var t = 0;
	var events = [
	'MSPointerDown',
	'MSPointerUp',
	'MSPointerCancel',
	'MSPointerMove',
	'MSPointerOver',
	'MSPointerOut',
	'MSPointerEnter',
	'MSPointerLeave',
	'MSGotPointerCapture',
	'MSLostPointerCapture',
	'pointerdown',
	'pointerup',
	'pointercancel',
	'pointermove',
	'pointerover',
	'pointerout',
	'pointerenter',
	'pointerleave',
	'gotpointercapture',
	'lostpointercapture',
	'touchstart',
	'touchmove',
	'touchend',
	'touchenter',
	'touchleave',
	'touchcancel',
	'mouseover',
	'mousemove',
	'mouseout',
	'mouseenter',
	'mouseleave',
	'mousedown',
	'mouseup',
	'focus',
	'blur',
	'click'
	];
	var b = document.getElementById('b');
	var o = document.getElementById('o'),
	report = function(e) {
		if (e.target!=b) { return; }
		var s = e.type + '<br>';
		setTimeout(function() { delayedInnerHTML(s) }, 100);
	}

	/* Hack to work around new iOS8 behavior where innerHTML counts as a content change - previously, it was safe to use, see http://www.quirksmode.org/blog/archives/2014/02/the_ios_event_c.html */
	delayedInnerHTML = function(s) {
		o.innerHTML += s;
	}

	/* attach listeners to the body to test bubbling/event delegation */
	for (var i=0; i<events.length; i++) {
		document.body.addEventListener(events[i], report, false);
	}
}, true);