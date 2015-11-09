/* multi-touch tracker with pointer events support and a hacky HUD */

var canvas,
	c, // c is the canvas' context 2D
	devicePixelRatio,
	container;

var points = [];

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * devicePixelRatio) {
		resetCanvas();
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}
	c.strokeStyle = "#eee";
	c.lineWidth = "10";

	for (var i = 0, j = points.length; i<j; i++) {
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

		// HUD (hacky)
		var hud_props = [];
		switch(points[i].type) {
			case undefined:
				hud_props = ['touch', 'clientX: '+points[i].clientX+' clientY: '+points[i].clientY];
				if (points[i].radiusX && points[i].radiusY) {
					hud_props.push('radiusX: '+points[i].radiusX+' radiusY: '+points[i].radiusY);
				}
				if (points[i].rotationAngle) {
					hud_props.push('rotationAngle: '+points[i].rotationAngle);
				}
				if ((points[i].force !== undefined) || (points[i].webkitForce !== undefined)) {
					hud_props.push('force: '+((points[i].force !== undefined) ? points[i].force : points[i].webkitForce));
				}
				break;
			case 'pointerdown':
			case 'MSPointerDown':
			case 'pointermove':
			case 'MSPointerMove':
				hud_props = ['pointer ('+points[i].pointerType+')'+((points[i].isPrimary === true) ? ' primary' : ''), 'pointerType: '+points[i].pointerType,'isPrimary: '+points[i].isPrimary,'clientX: '+points[i].x+' clientY: '+points[i].y,'tiltX: '+points[i].tiltX+' tiltY: '+points[i].tiltY,'pressure: '+points[i].pressure];
				break;
			case 'mousemove':
				hud_props = ['mouse','clientX: '+points[i].clientX+' clientY: '+points[i].clientY];
				if ((points[i].force !== undefined) || (points[i].webkitForce !== undefined)) {
					hud_props.push('force: '+((points[i].force !== undefined) ? points[i].force : points[i].webkitForce));
				}
				break;
		}
		c.font = "30px Arial";
		c.fillStyle = "#fff";
		c.fillText(hud_props[0], points[i].clientX + 70, points[i].clientY);
		c.fillStyle = "#aaa";
		c.font = "10px Arial";
		for (var h_i = 1, h_j = hud_props.length; h_i<h_j; h_i++) {
			c.fillText(hud_props[h_i], points[i].clientX + 70, points[i].clientY + (h_i + 1) * 12);
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
	resetCanvas();
	container.appendChild(canvas);
	document.body.appendChild( container );
		
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

function resetCanvas() {
    // HiDPI canvas adapted from http://www.html5rocks.com/en/tutorials/canvas/hidpi/
	devicePixelRatio = window.devicePixelRatio || 1;
	canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    c.scale(devicePixelRatio, devicePixelRatio);
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);