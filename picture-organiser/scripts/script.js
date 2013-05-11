function gestureHandler(element) {
	// define a data structure to store our touchpoints in
	this.coords = function(x,y) {
		this.x = x;
		this.y = y;
	};
	this.element = element;
	this.store = [];
	this.store[0] = new this.coords(-1,-1);
	this.store[1] = new this.coords(-1,-1);
	this.dx = 0;
	this.dy = 0;
	this.angle = 0;
	this.size = 0.5;
	var that = this;
	this.element.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); that.init(); that.gesture(e); }, true);
		this.element.addEventListener('touchmove', function(e) { e.preventDefault(); e.stopPropagation(); that.gesture(e); }, true);
	
	this.init = function() {
		// reset stored values
		this.store[0].x = this.store[0].y = this.store[1].x = this.store[1].y = -1;
		// naive way of working out highest z-index?
		var zIndex = 0; // just using positive indices
		var images = document.getElementsByTagName('img');
		for (var i = 0; i<images.length; i++) {
			if (parseInt(images[i].style.zIndex,10) >= zIndex) {
				zIndex = parseInt(images[i].style.zIndex,10) + 1;
			}
		}
		this.element.style.zIndex = zIndex;
	};

	this.gesture = function(e) {
		var x1 = 0;
		var x2 = 0;
		var y1 = 0;
		var y2 = 0;
		var i = 0;
		var angle = 0;
		var size = 0;
		if (e.targetTouches) {
			if (e.targetTouches.length>=2) {
				
				// two (or more) fingers
				x1=e.targetTouches[0].pageX-e.target.offsetLeft;
				y1=e.targetTouches[0].pageY-e.target.offsetTop;
				x2=e.targetTouches[1].pageX-e.target.offsetLeft;
				y2=e.targetTouches[1].pageY-e.target.offsetTop;
				if (this.store[0].x!=-1) {
					angle = Math.atan((y2-y1)/(x2-x1)) - Math.atan((this.store[1].y-this.store[0].y)/(this.store[1].x-this.store[0].x));
					if (Math.abs(angle)>=3) { // jumped 180 degrees due to my poor math skills
						angle = angle-Math.PI;
					}
					size = Math.sqrt(Math.pow((x1-x2),2)+Math.pow((y1-y2),2)) - Math.sqrt(Math.pow((this.store[0].x-this.store[1].x),2)+Math.pow((this.store[0].y-this.store[1].y),2));
					this.twofinger(size,angle);
				}
				// store the values for later comparison
				this.store[0].x = x1;
				this.store[0].y = y1;
				this.store[1].x = x2;
				this.store[1].y = y2;
				
			} else if (e.targetTouches.length == 1) {

				// one finger
				x1=e.targetTouches[0].pageX;
				y1=e.targetTouches[0].pageY;
				// check if user went from two fingers to one finger - otherwise movement offset is wrong depending on which finger was lifted
				if (this.store[1].x!=-1) {
					// treat the two-to-one change as a completely new gesture
					this.init();
				}
				if (this.store[0].x!=-1) {
					this.onefinger(x1-this.store[0].x,y1-this.store[0].y);
				}
				// store the values for later comparison
				this.store[0].x = x1;
				this.store[0].y = y1;
			}
		}
	};
		this.twofinger = function(size,angle) {
		var that = this;
		var size_ratio = ((that.element.width*that.size)+size)/(that.element.width*that.size);
		that.size *= size_ratio;
		if (that.size < 0.5) { that.size = 0.5; }
		if (that.size > 1) { that.size = 1; }
		that.angle += angle;
		that.element.style.OTransform = that.element.style.MozTransform = that.element.style.webkitTransform = that.element.style.transform = 'rotate('+that.angle+'rad) scale('+that.size+')';
	};
	
	this.onefinger = function(dx,dy) {
		var that = this;
		that.element.style.left = that.element.offsetLeft+dx+'px';
		that.element.style.top = that.element.offsetTop+dy+'px';
	};

}

window.addEventListener('load',function() {
	var images = document.getElementsByTagName('img');
	for (var i = 0; i<images.length; i++) {
		// attach the handler
		var gh = new gestureHandler(images[i]);
		// randomise the position
		images[i].style.left = Math.random()*(window.innerWidth-images[i].clientWidth)+'px';
		images[i].style.top = Math.random()*(window.innerHeight-images[i].clientHeight)+'px';
		images[i].style.zIndex = i;
	}
	window.addEventListener('touchmove',function(e) { e.preventDefault(); },false);
	/* known (intentional) issue: this last statement prevents scrolling, so on small screen devices the SD panel will be cut off and non-scrollable */
}, false);