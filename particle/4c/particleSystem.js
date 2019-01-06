/* Particle system based on http://www.zen-sign.com/experiments/jsemitter2/
   Patrick H. Lauke / November 2013 */

function Emitter(canvas) {
	this.canvas = canvas;
	this.size = 20;
	this.sizeLimit = 10;
	this.particles = [];
	this.canvasContext = this.canvas.getContext("2d");
	
	this.createParticle = function(x,y,size,h,s,l) {
		var particle = new Particle();
		particle.x = x;
		particle.y = y;
		particle.size = size;
		particle.h = h;
		particle.s = s;
		particle.l = l;
		this.particles.push(particle);
	}
	
	this.react = function(e) {
		var x = e.offsetX;
		var	y = e.offsetY;

		for(var i = 0; i < this.particles.length; i++)
		{
			
			this.particles[i].size=this.size - (Math.sqrt(Math.pow(this.particles[i].x-x,2)+Math.pow(this.particles[i].y-y,2)) / 30);
			if (this.particles[i].size < this.sizeLimit) { this.particles[i].size=this.sizeLimit; }
			this.particles[i].s = 100 - (Math.sqrt(Math.pow(this.particles[i].x-x,2)+Math.pow(this.particles[i].y-y,2))/2);
			if (this.particles[i].s < 0) { this.particles[i].s = 0; }
			this.particles[i].h += 1;
			
		}
		var that = this;
		window.requestAnimationFrame(function() { that.draw(); });
	}
	
	this.draw = function() {
		this.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
		
		for(var i = 0; i < this.particles.length; i++)
		{
			this.canvasContext.fillStyle = 'hsl('+this.particles[i].h+', '+this.particles[i].s+'%, '+this.particles[i].l+'%)';
			this.canvasContext.beginPath();
			this.canvasContext.arc(this.particles[i].x, this.particles[i].y, this.particles[i].size, 0, Math.PI*2, true);
			this.canvasContext.fill();
		}
	}

	this.init = function() {
		this.reset();
		var that = this;
		var debouncedReact = debounce(function(e) { that.react(e); }, 5, true);
		this.canvas.addEventListener('pointermove', debouncedReact, false);
		this.canvas.addEventListener('MSPointerMove', debouncedReact, false);
		var debouncedReset = debounce(function() { that.reset(); }, 10, true);
		window.addEventListener('resize', debouncedReset);
	}
	
	this.reset = function(e) {
		this.canvas.width = window.innerWidth-30;
		this.canvas.height = window.innerHeight-100;
		this.particles = [];
		var j = Math.floor(canvas.width/(this.size*2));
		var k = Math.floor(canvas.height/(this.size*2));
		var h = Math.round(Math.random()*359);
		for(var i = 0; i < j*k; i++) {
			this.createParticle((i%j)*(this.size*2)+this.size,Math.floor(i/j)*(this.size*2)+this.size,this.sizeLimit,(h += Math.round(Math.random()*30-15)),0,Math.round(Math.random()*50)+25);
		}
		this.draw();
	}
}

function Particle() {
	this.x = 0;
	this.y = 0;
	this.size = 0;
	this.h = 0;
	this.s = 0;
	this.l = 0;
}