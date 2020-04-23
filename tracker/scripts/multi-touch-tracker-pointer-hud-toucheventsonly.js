/* multi-touch tracker with touch events support and a hacky HUD */

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

		pressure = points[i].pressure || points[i].force || points[i].webkitForce|| 0.1;
		rotationAngle = points[i].rotationAngle || 0;
		if ((points[i].radiusX) && (points[i].radiusY)) {
			radiusX = points[i].radiusX;
			radiusY = points[i].radiusY;
		} else if ((points[i].width) && (points[i].width != 0) && (points[i].height) && (points[i].height != 0))  {
			radiusX = points[i].width / 2;
			radiusY = points[i].height / 2;
		} else {
			radiusX = radiusY = 40;
		}
		radiusX += pressure * 35;
		radiusY += pressure * 35;

		/* draw all circles */
		c.beginPath();
		c.ellipse(points[i].clientX, points[i].clientY, radiusX, radiusY, rotationAngle * Math.PI/180, 0, Math.PI*2, true);
		c.stroke();

		// HUD (hacky)
		var hud_props = [];
		switch(points[i].type) {
			case undefined:
				hud_props = ['touch', 'identifier: '+points[i].identifier];
				if (points[i].touchType !== undefined) {
					hud_props.push('touchType: '+points[i].touchType);
				}
				hud_props.push('clientX: '+points[i].clientX.toFixed(5)+' clientY: '+points[i].clientY.toFixed(5));
				if ((points[i].radiusX !== undefined) && (points[i].radiusY !== undefined)) {
					hud_props.push('radiusX: '+points[i].radiusX.toFixed(5)+' radiusY: '+points[i].radiusY.toFixed(5));
				}
				if (points[i].rotationAngle !== undefined ) {
					hud_props.push('rotationAngle: '+points[i].rotationAngle.toFixed(5));
				}
				if ((points[i].altitudeAngle !== undefined) && (points[i].azimuthAngle !== undefined)) {
					hud_props.push('altitudeAngle: '+points[i].altitudeAngle.toFixed(5)+ ' azimuthAngle: '+points[i].azimuthAngle.toFixed(5));
				}
				if ((points[i].force !== undefined) || (points[i].webkitForce !== undefined)) {
					hud_props.push('force: '+((points[i].force !== undefined) ? points[i].force.toFixed(5) : points[i].webkitForce.toFixed(5)));
				}
				break;
			case 'mousedown':				
			case 'mousemove':
			case 'mouseup':
				hud_props = ['mouse','clientX: '+points[i].clientX+' clientY: '+points[i].clientY];
				if ((points[i].force !== undefined) || (points[i].webkitForce !== undefined)) {
					hud_props.push( ((points[i].force !== undefined) ? 'force: '+points[i].force.toFixed(5) : 'webkitForce: '+points[i].webkitForce.toFixed(5)) );
				}
				break;
		}
		c.font = "30px Arial";
		c.fillStyle = "#fff";
		c.fillText(hud_props[0], points[i].clientX + radiusX + 20, points[i].clientY);
		c.fillStyle = "#aaa";
		c.font = "10px Arial";
		for (var h_i = 1, h_j = hud_props.length; h_i<h_j; h_i++) {
			c.fillText(hud_props[h_i], points[i].clientX + radiusX + 20, points[i].clientY + (h_i + 1) * 12);
		}


	}

}

function positionHandler(e) {
	if ((e.type == 'mousemove') || (e.type == 'mouseout')) {
		// remove previous mouse entry from the array (assumes only a single mouse is ever present)
		for (var i = 0, l = points.length; i<l; i++) {
			if (points[i].type == 'mousemove') {
				points.splice(i,1);
			}
		}
		if (e.type == 'mousemove') {
			// add new mouse event entry
			points.push(e);
		}
	} else if ((e.type == 'touchstart')||(e.type == 'touchmove')||(e.type == 'touchend')||(e.type == 'touchcancel')) {
		// remove any points except for mouse (to allow possibility of simultaneous mouse and touch - Chromebook Pixel?)
		for (var i = 0, l = points.length; i<l; i++) {
			if (points[i].type != 'mousemove') {
				points.splice(i,1);
				i--;
				l--;
			}
		}
		// add in all entries from the array-like targetTouches
		for (var i = 0, l = e.targetTouches.length; i<l; i++) {
			points.push(e.targetTouches[i]);
		}
		// prevent mouse compat events
		e.preventDefault();
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
	// use debounced function for better performance on older/underpowered devices (e.g. Nexus 10)
	var debouncedPositionHandler = debounce(positionHandler, 5, true);
	var events = [];
	/* feature detect */
	events = ['mouseover', 'mousedown', 'mousemove', 'mouseup', 'mouseout',
		          'touchstart', 'touchmove', 'touchend', 'touchcancel'];

	for (var i=0, l=events.length; i<l; i++) {
		if ((events[i] == 'mousemove')||(events[i] == 'touchmove')) {
			canvas.addEventListener(events[i],  debouncedPositionHandler, false );
		} else {
			canvas.addEventListener(events[i],  positionHandler, false );
		}
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