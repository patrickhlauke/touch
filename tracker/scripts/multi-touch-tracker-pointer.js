/* multi-touch tracker with pointer events support */

var canvas,
	c, // c is the canvas' context 2D
	container,
	ratio;

var points = [];

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * ratio) {
		canvas.width = window.innerWidth * ratio;
		canvas.height = window.innerHeight * ratio;
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}

	for (var i = 0; i<points.length; i++) {
		/* if pressure property is present and not 0, set radius, otherwise default */
		if (typeof(points[i].pressure) != 'undefined' && points[i].pressure != null) {
			radius = 35 + (points[i].pressure * 25);
		} else {
			radius = 50;
		}

		/* draw all circles */
		c.beginPath();
		c.arc(points[i].clientX, points[i].clientY, radius, 0, Math.PI*2, true);
		c.stroke();

		// for pointer events, add extra circle to denote a primary pointer
		if(points[i].isPrimary) {
			c.beginPath();
			c.arc(points[i].clientX, points[i].clientY, radius + 15, 0, Math.PI*2, true);
			c.stroke();
		}
		
	}

}

function positionHandler(e) {
	if (e.type == 'mousemove') {
		points = [e];
	} else if ((e.type == 'touchstart')||(e.type == 'touchmove')||(e.type == 'touchend')) {
		points = e.targetTouches;
		e.preventDefault();
	} else {
		/* fairly ugly, unoptimised approach of manually replicating the targetTouches array */
		switch (e.type) {
			case 'pointerdown':
			case 'MSPointerDown':
			case 'pointermove':
			case 'MSPointerMove':
				for (var i = 0, found = false; i<points.length; i++) {
					if (points[i].pointerId == e.pointerId) {
						points[i] = e;
						found = true;
						break;
					}
				}
				if (!found) {
					points.push(e);
				}
				break;
			case 'pointerup':
			case 'MSPointerUp':
			case 'pointercancel':
			case 'MSPointerCancel':
			case 'pointerout':
			case 'MSPointerOut':
				for (var i = 0; i<points.length; i++) {
					if (points[i].pointerId == e.pointerId) {
						points.splice(i,1);
						break;
					}
				}
				break;
		}
	}
	window.requestAnimationFrame(draw);
}

function init() {
	canvas = document.createElement( 'canvas' );
	c = canvas.getContext( '2d' );
	container = document.createElement( 'div' );
	container.className = "container";
	// HiDPI canvas http://www.html5rocks.com/en/tutorials/canvas/hidpi/
	devicePixelRatio = window.devicePixelRatio || 1,
	backingStoreRatio = c.webkitBackingStorePixelRatio ||
	                    c.mozBackingStorePixelRatio ||
	                    c.msBackingStorePixelRatio ||
	                    c.oBackingStorePixelRatio ||
	                    c.backingStorePixelRatio || 1,

	ratio = devicePixelRatio / backingStoreRatio;
	canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
	// upscale the canvas if the two ratios don't match
    if (devicePixelRatio !== backingStoreRatio) {

        var oldWidth = canvas.width;
        var oldHeight = canvas.height;

        canvas.width = oldWidth * ratio;
        canvas.height = oldHeight * ratio;

        canvas.style.width = oldWidth + 'px';
        canvas.style.height = oldHeight + 'px';

        // now scale the context to counter
        // the fact that we've manually scaled
        // our canvas element
        c.scale(ratio, ratio);

    }
	container.appendChild(canvas);
	document.body.appendChild( container );
	c.strokeStyle = "#eee";
	c.lineWidth = "10";
	
	/* feature detect - in this case not dangerous, as pointer is not exclusively touch */
	if ((window.PointerEvent)||(window.navigator.pointerEnabled)||(window.navigator.msPointerEnabled)) {
		canvas.addEventListener('pointerdown',  positionHandler, false );
		canvas.addEventListener('pointermove',  positionHandler, false );
		canvas.addEventListener('pointerup',  positionHandler, false );
		canvas.addEventListener('pointercancel',  positionHandler, false );
		canvas.addEventListener('pointerover',  positionHandler, false );
		canvas.addEventListener('pointerout',  positionHandler, false );
		canvas.addEventListener('MSPointerDown',  positionHandler, false );
		canvas.addEventListener('MSPointerMove',  positionHandler, false );
		canvas.addEventListener('MSPointerUp',  positionHandler, false );
		canvas.addEventListener('MSPointerCancel',  positionHandler, false );
		canvas.addEventListener('MSPointerOver',  positionHandler, false );
		canvas.addEventListener('MSPointerOut',  positionHandler, false );
	} else {
		canvas.addEventListener('mousemove',  positionHandler, false );
		canvas.addEventListener('touchstart', positionHandler, false );
		canvas.addEventListener('touchmove',  positionHandler, false );
		canvas.addEventListener('touchend',  positionHandler, false );
	}

	// suppress context menu
	canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); }, false)
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);