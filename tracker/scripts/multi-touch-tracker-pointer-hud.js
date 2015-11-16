/* multi-touch tracker with pointer events support and a hacky HUD */

var canvas,
	c, // c is the canvas' context 2D
	devicePixelRatio,
	container;

var points = [];

function draw() {
	var radiusX, radiusY, rotationAngle, pressure;
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * devicePixelRatio) {
		resetCanvas();
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}
	c.strokeStyle = "#eee";
	c.lineWidth = "10";

	for (var i = 0, l = points.length; i<l; i++) {
		/* if pressure property is present and not 0, set radius, otherwise default */
		if (typeof(points[i].pressure) != 'undefined' && points[i].pressure != null) {
			radius = 35 + (points[i].pressure * 25);
		} else if (typeof(points[i].force) != 'undefined' && points[i].force != null) {
			radius = 35 + (points[i].force * 25);
		} else if (typeof(points[i].webkitForce) != 'undefined' && points[i].webkitForce != null) {
			radius = 35 + (points[i].webkitForce * 25);
		} else {
			radius = 50;
		}

		pressure = points[i].pressure || points[i].force || points[i].webkitForce || 0.5;
		rotationAngle = points[i].rotationAngle || 0;
		radiusX = points[i].radiusX || 50;
		radiusY = points[i].radiusY || 50;
		radiusX += (0.2 + pressure) * 30;
		radiusY += (0.2 + pressure) * 30;

		/* draw all circles */
		c.beginPath();
		c.ellipse(points[i].clientX, points[i].clientY, radiusX, radiusY, rotationAngle * Math.PI/180, 0, Math.PI*2, true);
		c.stroke();

		// for pointer events, add extra circle to denote a primary pointer
		if(points[i].isPrimary) {
			c.beginPath();
			c.ellipse(points[i].clientX, points[i].clientY, radiusX+15, radiusY+15, rotationAngle * Math.PI/180, 0, Math.PI*2, true);
			c.stroke();
		}

		// HUD (hacky)
		var hud_props = [];
		switch(points[i].type) {
			case undefined:
				hud_props = ['touch', 'identifier: '+points[i].identifier, 'clientX: '+points[i].clientX+' clientY: '+points[i].clientY];
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
			case 'pointerover':
			case 'pointerdown':
			case 'pointermove':
			case 'pointerup':
			case 'MSPointerOver':
			case 'MSPointerDown':
			case 'MSPointerMove':
			case 'MSPointerUp':
				hud_props = ['pointer ('+points[i].pointerType+')'+((points[i].isPrimary === true) ? ' primary' : ''), 'pointerType: '+points[i].pointerType, 'isPrimary: '+points[i].isPrimary, 'pointerId: '+points[i].pointerId, 'clientX: '+points[i].x+' clientY: '+points[i].y, 'tiltX: '+points[i].tiltX+' tiltY: '+points[i].tiltY, 'pressure: '+points[i].pressure];
				break;
			case 'mousedown':				
			case 'mousemove':
			case 'mouseup':
				hud_props = ['mouse','clientX: '+points[i].clientX+' clientY: '+points[i].clientY];
				if ((points[i].force !== undefined) || (points[i].webkitForce !== undefined)) {
					hud_props.push( ((points[i].force !== undefined) ? 'force: '+points[i].force : 'webkitForce: '+points[i].webkitForce) );
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
		// remove previous mouse entry from the array (assumes only a single mouse is ever present)
		for (var i = 0, l = points.length; i<l; i++) {
			if (points[i].type == 'mousemove') {
				points.splice(i,1);
			}
		}
		points.push(e);
	} else if (e.type == 'mouseout') {
		// remove previous mouse entry from the array (assumes only a single mouse is ever present)
		for (var i = 0, l = points.length; i<l; i++) {
			if (points[i].type == 'mousemove') {
				points.splice(i,1);
			}
		}
	} else if ((e.type == 'touchstart')||(e.type == 'touchmove')||(e.type == 'touchend')||(e.type == 'touchcancel')) {
		// remove all previous touch events from the array
		for (var i = 0, l = points.length; i<l; i++) {
			if (points[i].type == undefined) {
				points.splice(i,1);
				i--;
			}
		}
		// merge in targetTouches array (this works because each event has a "global" view of *all* touches)
		Array.prototype.push.apply(points, e.targetTouches);
		// prevent mouse compat events
		e.preventDefault();
	} else {
		/* fairly ugly, unoptimised approach of manually replicating the targetTouches array */
		switch (e.type) {
			case 'pointerdown':
			case 'pointermove':
			case 'MSPointerDown':
			case 'MSPointerMove':
				for (var i = 0, found = false, l = points.length; i<l; i++) {
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
			case 'pointerout':
			case 'pointercancel':
			case 'MSPointerUp':
			case 'MSPointerOut':
			case 'MSPointerCancel':
				for (var i = 0, l = points.length; i<l; i++) {
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
	var events = [];
	/* feature detect - in this case not dangerous, as pointer is not exclusively touch */
	if ((window.PointerEvent)||(window.navigator.pointerEnabled)||(window.navigator.msPointerEnabled)) {
		events = ['pointerover', 'pointerdown', 'pointermove', 'pointerup', 'pointerout', 'pointercancel',
		          'MSPointerOver', 'MSPointerDown', 'MSPointerMove', 'MSPointerUp', 'MSPointerOut', 'MSPointerCancel'];
	} else {
		events = ['mouseover', 'mousedown', 'mousemove', 'mouseup', 'mouseout',
		          'touchstart', 'touchmove', 'touchend', 'touchcancel'];
	}

	for (var i=0, l=events.length; i<l; i++) {
		canvas.addEventListener(events[i],  positionHandler, false );
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