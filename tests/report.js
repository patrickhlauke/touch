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
	'click',
	'webkitmouseforcewillbegin',
	'webkitmouseforcedown',
	'webkitmouseforceup',
	'webkitmouseforcechanged'
	];
	var b = document.getElementById('b');
	var o = document.getElementById('o'),
	report = function(e) {
		/* Hack - would normally use e.timeStamp but it's whack in Fx/Android
		   As a result, the timings will be slightly inflated due to processing*/
		var now = new Date().getTime();
		var delta = now-t;
		var s;
		s = e.type;
                if (e.type == 'click') {
                        s += ' (detail=' + (e.detail) + ')';
                }
		if (t>0) {
			if ((now-t)>150) {
				s += ' (<strong>' + (delta) + 'ms</strong>)';
			} else {
				s += ' (' + (delta) + 'ms)';
			}
		}
		t=now;
		s += '<br>';
		if (e.type == 'click') {
			t=0;
		}
		setTimeout(function() { delayedInnerHTML(s) }, 100);
	}

	/* Hack to work around new iOS8 behavior where innerHTML counts as a content change - previously, it was safe to use, see http://www.quirksmode.org/blog/archives/2014/02/the_ios_event_c.html */
	delayedInnerHTML = function(s) {
		o.innerHTML += s;
	}

	for (var i=0; i<events.length; i++) {
		b.addEventListener(events[i], report, false);
	}
}, true);