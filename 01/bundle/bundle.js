(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// app.js
require("./libs/bongiovi-min.js");

Model = {};
Model.params = {
	numParticles:64
};

(function() {

	var SceneSound = require("./SceneSound");

	Main = function() {
		document.addEventListener("DOMContentLoaded", this._init.bind(this));
	}

	var p = Main.prototype;

	p._init = function() {
		bongiovi.SimpleImageLoader.load([
			"assets/images/bg.jpg"
			],this, this._onImageLoaded);
	};

	p._onImageLoaded = function(img) {
		Model.images = img;
		console.log("Images Loaded : ", Model.images);

		this.canvas = document.createElement("canvas");
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		document.body.appendChild(this.canvas);
		this.canvas.className = "main-canvas";
		bongiovi.GL.init(this.canvas);

		this._scene = new SceneSound();
		bongiovi.Scheduler.addEF(this, this._loop);
		bongiovi.Scheduler.addEF(this, this._loop);
	};

	p._loop = function() {
		this._scene.loop();
	};
})();

new Main();
},{"./SceneSound":2,"./libs/bongiovi-min.js":5}],2:[function(require,module,exports){
// SceneSound.js

var GL = bongiovi.GL;
var random = function(min, max) { return min + Math.random() * (max - min);	}

//	IMPORTS
var GLTexture = bongiovi.GLTexture;
var FrameBuffer = bongiovi.FrameBuffer;
var ViewCopy = bongiovi.ViewCopy;
var ViewSave = require("./ViewSave.js");
var ViewRender = require("./ViewRender.js");

function SceneSound() {
	this._initParticles();
	this.frequencies = [];
	this._initSound();

	bongiovi.Scene.call(this);
}

var p = SceneSound.prototype = new bongiovi.Scene();
p.constructor = SceneSound;

p._initSound = function() {
	var that = this;
	this.sound = Sono.load({
	    url: ['assets/audio/japan.mp3'],
	    volume: 0.0,
	    loop: true,
	    onComplete: function(sound) {
	    	console.debug("Sound Loaded");
	    	that.analyser = sound.effect.analyser(64);
	    	sound.play();
	    }
	});
};


p._initParticles = function() {
	var total = Model.params.numParticles * Model.params.numParticles;
	console.log("Total amount of particeles : ", total);

	this._particles = [];
	var i =0;
	var range = 300;

	while(i++ < total) {
		var p = [ random(-range, range), random(-range, range), random(-range, range)];
		this._particles.push(p);
	}
};


p._initTextures = function() {
	this._textureBg = new GLTexture(Model.images.bg);
};


p._initViews = function() {
	this._vCopy   = new ViewCopy();
	this._vSave   = new ViewSave(this._particles);
	this._vRender = new ViewRender(this._particles);

	this._hasSaved = false;
	this._fbo = new FrameBuffer(Model.params.numParticles, Model.params.numParticles, {minFilter:GL.gl.NEAREST, magFilter:GL.gl.NEAREST});
};


p.render = function() {
	this._getSoundData();

	if(!this._hasSaved) {
		if(this._vSave.shader.isReady()) {
			GL.setMatrices(this.cameraOtho);
			GL.rotate(this.rotationFront);
			console.debug("Saving Particles data to Image");
			GL.setViewport(0, 0, this._fbo.width, this._fbo.height);
			
			this._fbo.bind();
			GL.clear(0, 0, 0, 0);
			this._vSave.render();
			this._fbo.unbind();
			GL.setViewport(0, 0, GL.canvas.width, GL.canvas.height);
			this._hasSaved = true;
		}
	}

	// GL.setMatrices(this.cameraOtho);
	// GL.rotate(this.rotationFront);
	// this._vCopy.render(this._fbo.getTexture() ) ;
	if(!this._hasSaved) return;

	GL.setMatrices(this.camera);
	GL.rotate(this.sceneRotation.matrix);
	// GL.enableAdditiveBlending();
	GL.gl.disable(GL.gl.DEPTH_TEST);
	this._vRender.render(this._fbo.getTexture() );
};


p._getSoundData = function() {
	if(this.analyser) {
		this.frequencies = this.analyser.getFrequencies();
	}
};


module.exports = SceneSound;
},{"./ViewRender.js":3,"./ViewSave.js":4}],3:[function(require,module,exports){
// ViewRender.js

var GL = bongiovi.GL;
var gl;

function ViewRender(mParticles) {
	this._particles = mParticles;
	bongiovi.View.call(this, "assets/shaders/map.vert", "assets/shaders/map.frag");
}

var p = ViewRender.prototype = new bongiovi.View();
p.constructor = ViewRender;


p._init = function() {
	gl = GL.gl;
	var positions = [];
	var coords = [];
	var indices = []; 
	var num = Model.params.numParticles;

	for(var i=0; i<this._particles.length; i++) {
		positions.push([0, 0, 0]);
		var tx = (i % num) / num;
		var ty = Math.floor(i / num) / num;
		coords.push([tx, ty]);
		indices.push(i);
	}

	this.mesh = new bongiovi.Mesh(positions.length, indices.length, GL.gl.POINTS);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};

p.render = function(texture) {
	if(!this.shader.isReady() ) return;
	
	this.shader.bind();
	this.shader.uniform("texture", "uniform1i", 0);
	texture.bind(0);
	GL.draw(this.mesh);
};

module.exports = ViewRender;
},{}],4:[function(require,module,exports){
// ViewSave.js

var GL = bongiovi.GL;
var gl;

function ViewSave(mParticles) {
	this._particles = mParticles;
	bongiovi.View.call(this, "assets/shaders/save.vert", "assets/shaders/save.frag");
}

var p = ViewSave.prototype = new bongiovi.View();
p.constructor = ViewSave;


p._init = function() {
	var params = Model.params;
	gl = GL.gl;
	var positions = [];
	var coords = [];
	var indices = []; 
	var tx, ty, x, y, z;
	var offset = 1.0 / params.numParticles;
	console.log(this._particles.length);

	for(var i=0; i<this._particles.length; i++) {
		x = this._particles[i][0];
		y = this._particles[i][1];
		z = this._particles[i][2];

		tx = (i % params.numParticles) / params.numParticles;
		ty = Math.floor(i/params.numParticles)/params.numParticles;
		tx = (tx - .5) * 2.0 + offset;
		ty = (ty - .5) * 2.0 + offset;

		positions.push([x, y, z]);
		coords.push([tx, ty]);
		indices.push(i);
	}

	this.mesh = new bongiovi.Mesh(positions.length, indices.length, GL.gl.POINTS);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};

p.render = function() {
	if(!this.shader.isReady() ) return;

	this.shader.bind();
	GL.draw(this.mesh);
};

module.exports = ViewSave;
},{}],5:[function(require,module,exports){
(function(c){var f;"undefined"==typeof exports?"function"==typeof define&&"object"==typeof define.amd&&define.amd?(f={},define(function(){return f})):f="undefined"!=typeof window?window:c:f=exports;(function(c){if(!e)var e=1E-6;if(!k)var k="undefined"!=typeof Float32Array?Float32Array:Array;if(!m)var m=Math.random;var f={setMatrixArrayType:function(a){k=a}};"undefined"!=typeof c&&(c.glMatrix=f);var p=Math.PI/180;f.toRadian=function(a){return a*p};var r={create:function(){var a=new k(2);return a[0]=
0,a[1]=0,a},clone:function(a){var b=new k(2);return b[0]=a[0],b[1]=a[1],b},fromValues:function(a,b){var d=new k(2);return d[0]=a,d[1]=b,d},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a},set:function(a,b,d){return a[0]=b,a[1]=d,a},add:function(a,b,d){return a[0]=b[0]+d[0],a[1]=b[1]+d[1],a},subtract:function(a,b,d){return a[0]=b[0]-d[0],a[1]=b[1]-d[1],a}};r.sub=r.subtract;r.multiply=function(a,b,d){return a[0]=b[0]*d[0],a[1]=b[1]*d[1],a};r.mul=r.multiply;r.divide=function(a,b,d){return a[0]=b[0]/
d[0],a[1]=b[1]/d[1],a};r.div=r.divide;r.min=function(a,b,d){return a[0]=Math.min(b[0],d[0]),a[1]=Math.min(b[1],d[1]),a};r.max=function(a,b,d){return a[0]=Math.max(b[0],d[0]),a[1]=Math.max(b[1],d[1]),a};r.scale=function(a,b,d){return a[0]=b[0]*d,a[1]=b[1]*d,a};r.scaleAndAdd=function(a,b,d,h){return a[0]=b[0]+d[0]*h,a[1]=b[1]+d[1]*h,a};r.distance=function(a,b){var d=b[0]-a[0],h=b[1]-a[1];return Math.sqrt(d*d+h*h)};r.dist=r.distance;r.squaredDistance=function(a,b){var d=b[0]-a[0],h=b[1]-a[1];return d*
d+h*h};r.sqrDist=r.squaredDistance;r.length=function(a){var b=a[0];a=a[1];return Math.sqrt(b*b+a*a)};r.len=r.length;r.squaredLength=function(a){var b=a[0];a=a[1];return b*b+a*a};r.sqrLen=r.squaredLength;r.negate=function(a,b){return a[0]=-b[0],a[1]=-b[1],a};r.normalize=function(a,b){var d=b[0],h=b[1],d=d*d+h*h;return 0<d&&(d=1/Math.sqrt(d),a[0]=b[0]*d,a[1]=b[1]*d),a};r.dot=function(a,b){return a[0]*b[0]+a[1]*b[1]};r.cross=function(a,b,d){b=b[0]*d[1]-b[1]*d[0];return a[0]=a[1]=0,a[2]=b,a};r.lerp=function(a,
b,d,h){var t=b[0];b=b[1];return a[0]=t+h*(d[0]-t),a[1]=b+h*(d[1]-b),a};r.random=function(a,b){b=b||1;var d=2*m()*Math.PI;return a[0]=Math.cos(d)*b,a[1]=Math.sin(d)*b,a};r.transformMat2=function(a,b,d){var h=b[0];b=b[1];return a[0]=d[0]*h+d[2]*b,a[1]=d[1]*h+d[3]*b,a};r.transformMat2d=function(a,b,d){var h=b[0];b=b[1];return a[0]=d[0]*h+d[2]*b+d[4],a[1]=d[1]*h+d[3]*b+d[5],a};r.transformMat3=function(a,b,d){var h=b[0];b=b[1];return a[0]=d[0]*h+d[3]*b+d[6],a[1]=d[1]*h+d[4]*b+d[7],a};r.transformMat4=function(a,
b,d){var h=b[0];b=b[1];return a[0]=d[0]*h+d[4]*b+d[12],a[1]=d[1]*h+d[5]*b+d[13],a};r.forEach=function(){var a=r.create();return function(b,d,h,t,H,c){var g;d||(d=2);h||(h=0);for(t?g=Math.min(t*d+h,b.length):g=b.length;h<g;h+=d)a[0]=b[h],a[1]=b[h+1],H(a,a,c),b[h]=a[0],b[h+1]=a[1];return b}}();r.str=function(a){return"vec2("+a[0]+", "+a[1]+")"};"undefined"!=typeof c&&(c.vec2=r);var n={create:function(){var a=new k(3);return a[0]=0,a[1]=0,a[2]=0,a},clone:function(a){var b=new k(3);return b[0]=a[0],b[1]=
a[1],b[2]=a[2],b},fromValues:function(a,b,d){var h=new k(3);return h[0]=a,h[1]=b,h[2]=d,h},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a},set:function(a,b,d,h){return a[0]=b,a[1]=d,a[2]=h,a},add:function(a,b,d){return a[0]=b[0]+d[0],a[1]=b[1]+d[1],a[2]=b[2]+d[2],a},subtract:function(a,b,d){return a[0]=b[0]-d[0],a[1]=b[1]-d[1],a[2]=b[2]-d[2],a}};n.sub=n.subtract;n.multiply=function(a,b,d){return a[0]=b[0]*d[0],a[1]=b[1]*d[1],a[2]=b[2]*d[2],a};n.mul=n.multiply;n.divide=function(a,b,d){return a[0]=
b[0]/d[0],a[1]=b[1]/d[1],a[2]=b[2]/d[2],a};n.div=n.divide;n.min=function(a,b,d){return a[0]=Math.min(b[0],d[0]),a[1]=Math.min(b[1],d[1]),a[2]=Math.min(b[2],d[2]),a};n.max=function(a,b,d){return a[0]=Math.max(b[0],d[0]),a[1]=Math.max(b[1],d[1]),a[2]=Math.max(b[2],d[2]),a};n.scale=function(a,b,d){return a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d,a};n.scaleAndAdd=function(a,b,d,h){return a[0]=b[0]+d[0]*h,a[1]=b[1]+d[1]*h,a[2]=b[2]+d[2]*h,a};n.distance=function(a,b){var d=b[0]-a[0],h=b[1]-a[1],t=b[2]-a[2];return Math.sqrt(d*
d+h*h+t*t)};n.dist=n.distance;n.squaredDistance=function(a,b){var d=b[0]-a[0],h=b[1]-a[1],t=b[2]-a[2];return d*d+h*h+t*t};n.sqrDist=n.squaredDistance;n.length=function(a){var b=a[0],d=a[1];a=a[2];return Math.sqrt(b*b+d*d+a*a)};n.len=n.length;n.squaredLength=function(a){var b=a[0],d=a[1];a=a[2];return b*b+d*d+a*a};n.sqrLen=n.squaredLength;n.negate=function(a,b){return a[0]=-b[0],a[1]=-b[1],a[2]=-b[2],a};n.normalize=function(a,b){var d=b[0],h=b[1],t=b[2],d=d*d+h*h+t*t;return 0<d&&(d=1/Math.sqrt(d),
a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d),a};n.dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]};n.cross=function(a,b,d){var h=b[0],t=b[1];b=b[2];var H=d[0],c=d[1];d=d[2];return a[0]=t*d-b*c,a[1]=b*H-h*d,a[2]=h*c-t*H,a};n.lerp=function(a,b,d,h){var t=b[0],H=b[1];b=b[2];return a[0]=t+h*(d[0]-t),a[1]=H+h*(d[1]-H),a[2]=b+h*(d[2]-b),a};n.random=function(a,b){b=b||1;var d=2*m()*Math.PI,h=2*m()-1,t=Math.sqrt(1-h*h)*b;return a[0]=Math.cos(d)*t,a[1]=Math.sin(d)*t,a[2]=h*b,a};n.transformMat4=function(a,b,
d){var h=b[0],t=b[1];b=b[2];return a[0]=d[0]*h+d[4]*t+d[8]*b+d[12],a[1]=d[1]*h+d[5]*t+d[9]*b+d[13],a[2]=d[2]*h+d[6]*t+d[10]*b+d[14],a};n.transformMat3=function(a,b,d){var h=b[0],t=b[1];b=b[2];return a[0]=h*d[0]+t*d[3]+b*d[6],a[1]=h*d[1]+t*d[4]+b*d[7],a[2]=h*d[2]+t*d[5]+b*d[8],a};n.transformQuat=function(a,b,d){var h=b[0],t=b[1],H=b[2];b=d[0];var c=d[1],g=d[2];d=d[3];var e=d*h+c*H-g*t,k=d*t+g*h-b*H,f=d*H+b*t-c*h,h=-b*h-c*t-g*H;return a[0]=e*d+h*-b+k*-g-f*-c,a[1]=k*d+h*-c+f*-b-e*-g,a[2]=f*d+h*-g+e*
-c-k*-b,a};n.rotateX=function(a,b,d,h){var t=[],c=[];return t[0]=b[0]-d[0],t[1]=b[1]-d[1],t[2]=b[2]-d[2],c[0]=t[0],c[1]=t[1]*Math.cos(h)-t[2]*Math.sin(h),c[2]=t[1]*Math.sin(h)+t[2]*Math.cos(h),a[0]=c[0]+d[0],a[1]=c[1]+d[1],a[2]=c[2]+d[2],a};n.rotateY=function(a,b,d,h){var t=[],c=[];return t[0]=b[0]-d[0],t[1]=b[1]-d[1],t[2]=b[2]-d[2],c[0]=t[2]*Math.sin(h)+t[0]*Math.cos(h),c[1]=t[1],c[2]=t[2]*Math.cos(h)-t[0]*Math.sin(h),a[0]=c[0]+d[0],a[1]=c[1]+d[1],a[2]=c[2]+d[2],a};n.rotateZ=function(a,b,d,h){var t=
[],c=[];return t[0]=b[0]-d[0],t[1]=b[1]-d[1],t[2]=b[2]-d[2],c[0]=t[0]*Math.cos(h)-t[1]*Math.sin(h),c[1]=t[0]*Math.sin(h)+t[1]*Math.cos(h),c[2]=t[2],a[0]=c[0]+d[0],a[1]=c[1]+d[1],a[2]=c[2]+d[2],a};n.forEach=function(){var a=n.create();return function(b,d,h,t,c,g){var e;d||(d=3);h||(h=0);for(t?e=Math.min(t*d+h,b.length):e=b.length;h<e;h+=d)a[0]=b[h],a[1]=b[h+1],a[2]=b[h+2],c(a,a,g),b[h]=a[0],b[h+1]=a[1],b[h+2]=a[2];return b}}();n.str=function(a){return"vec3("+a[0]+", "+a[1]+", "+a[2]+")"};"undefined"!=
typeof c&&(c.vec3=n);var q={create:function(){var a=new k(4);return a[0]=0,a[1]=0,a[2]=0,a[3]=0,a},clone:function(a){var b=new k(4);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b},fromValues:function(a,b,d,h){var t=new k(4);return t[0]=a,t[1]=b,t[2]=d,t[3]=h,t},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a},set:function(a,b,d,h,t){return a[0]=b,a[1]=d,a[2]=h,a[3]=t,a},add:function(a,b,d){return a[0]=b[0]+d[0],a[1]=b[1]+d[1],a[2]=b[2]+d[2],a[3]=b[3]+d[3],a},subtract:function(a,
b,d){return a[0]=b[0]-d[0],a[1]=b[1]-d[1],a[2]=b[2]-d[2],a[3]=b[3]-d[3],a}};q.sub=q.subtract;q.multiply=function(a,b,d){return a[0]=b[0]*d[0],a[1]=b[1]*d[1],a[2]=b[2]*d[2],a[3]=b[3]*d[3],a};q.mul=q.multiply;q.divide=function(a,b,d){return a[0]=b[0]/d[0],a[1]=b[1]/d[1],a[2]=b[2]/d[2],a[3]=b[3]/d[3],a};q.div=q.divide;q.min=function(a,b,d){return a[0]=Math.min(b[0],d[0]),a[1]=Math.min(b[1],d[1]),a[2]=Math.min(b[2],d[2]),a[3]=Math.min(b[3],d[3]),a};q.max=function(a,b,d){return a[0]=Math.max(b[0],d[0]),
a[1]=Math.max(b[1],d[1]),a[2]=Math.max(b[2],d[2]),a[3]=Math.max(b[3],d[3]),a};q.scale=function(a,b,d){return a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d,a[3]=b[3]*d,a};q.scaleAndAdd=function(a,b,d,h){return a[0]=b[0]+d[0]*h,a[1]=b[1]+d[1]*h,a[2]=b[2]+d[2]*h,a[3]=b[3]+d[3]*h,a};q.distance=function(a,b){var d=b[0]-a[0],h=b[1]-a[1],t=b[2]-a[2],c=b[3]-a[3];return Math.sqrt(d*d+h*h+t*t+c*c)};q.dist=q.distance;q.squaredDistance=function(a,b){var d=b[0]-a[0],h=b[1]-a[1],t=b[2]-a[2],c=b[3]-a[3];return d*d+h*h+t*
t+c*c};q.sqrDist=q.squaredDistance;q.length=function(a){var b=a[0],d=a[1],h=a[2];a=a[3];return Math.sqrt(b*b+d*d+h*h+a*a)};q.len=q.length;q.squaredLength=function(a){var b=a[0],d=a[1],h=a[2];a=a[3];return b*b+d*d+h*h+a*a};q.sqrLen=q.squaredLength;q.negate=function(a,b){return a[0]=-b[0],a[1]=-b[1],a[2]=-b[2],a[3]=-b[3],a};q.normalize=function(a,b){var d=b[0],h=b[1],t=b[2],c=b[3],d=d*d+h*h+t*t+c*c;return 0<d&&(d=1/Math.sqrt(d),a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d,a[3]=b[3]*d),a};q.dot=function(a,b){return a[0]*
b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]};q.lerp=function(a,b,d,h){var t=b[0],c=b[1],g=b[2];b=b[3];return a[0]=t+h*(d[0]-t),a[1]=c+h*(d[1]-c),a[2]=g+h*(d[2]-g),a[3]=b+h*(d[3]-b),a};q.random=function(a,b){return b=b||1,a[0]=m(),a[1]=m(),a[2]=m(),a[3]=m(),q.normalize(a,a),q.scale(a,a,b),a};q.transformMat4=function(a,b,d){var h=b[0],t=b[1],c=b[2];b=b[3];return a[0]=d[0]*h+d[4]*t+d[8]*c+d[12]*b,a[1]=d[1]*h+d[5]*t+d[9]*c+d[13]*b,a[2]=d[2]*h+d[6]*t+d[10]*c+d[14]*b,a[3]=d[3]*h+d[7]*t+d[11]*c+d[15]*b,a};q.transformQuat=
function(a,b,d){var h=b[0],t=b[1],c=b[2];b=d[0];var g=d[1],e=d[2];d=d[3];var k=d*h+g*c-e*t,f=d*t+e*h-b*c,m=d*c+b*t-g*h,h=-b*h-g*t-e*c;return a[0]=k*d+h*-b+f*-e-m*-g,a[1]=f*d+h*-g+m*-b-k*-e,a[2]=m*d+h*-e+k*-g-f*-b,a};q.forEach=function(){var a=q.create();return function(b,d,h,t,c,g){var e;d||(d=4);h||(h=0);for(t?e=Math.min(t*d+h,b.length):e=b.length;h<e;h+=d)a[0]=b[h],a[1]=b[h+1],a[2]=b[h+2],a[3]=b[h+3],c(a,a,g),b[h]=a[0],b[h+1]=a[1],b[h+2]=a[2],b[h+3]=a[3];return b}}();q.str=function(a){return"vec4("+
a[0]+", "+a[1]+", "+a[2]+", "+a[3]+")"};"undefined"!=typeof c&&(c.vec4=q);f={create:function(){var a=new k(4);return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a},clone:function(a){var b=new k(4);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a},transpose:function(a,b){if(a===b){var d=b[1];a[1]=b[2];a[2]=d}else a[0]=b[0],a[1]=b[2],a[2]=b[1],a[3]=b[3];return a},invert:function(a,b){var d=
b[0],h=b[1],t=b[2],c=b[3],g=d*c-t*h;return g?(g=1/g,a[0]=c*g,a[1]=-h*g,a[2]=-t*g,a[3]=d*g,a):null},adjoint:function(a,b){var d=b[0];return a[0]=b[3],a[1]=-b[1],a[2]=-b[2],a[3]=d,a},determinant:function(a){return a[0]*a[3]-a[2]*a[1]},multiply:function(a,b,d){var h=b[0],t=b[1],c=b[2];b=b[3];var g=d[0],e=d[1],k=d[2];d=d[3];return a[0]=h*g+c*e,a[1]=t*g+b*e,a[2]=h*k+c*d,a[3]=t*k+b*d,a}};f.mul=f.multiply;f.rotate=function(a,b,d){var h=b[0],t=b[1],c=b[2];b=b[3];var g=Math.sin(d);d=Math.cos(d);return a[0]=
h*d+c*g,a[1]=t*d+b*g,a[2]=h*-g+c*d,a[3]=t*-g+b*d,a};f.scale=function(a,b,d){var h=b[1],t=b[2],c=b[3],g=d[0];d=d[1];return a[0]=b[0]*g,a[1]=h*g,a[2]=t*d,a[3]=c*d,a};f.str=function(a){return"mat2("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+")"};f.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2))};f.LDU=function(a,b,d,h){return a[2]=h[2]/h[0],d[0]=h[0],d[1]=h[1],d[3]=h[3]-a[2]*d[1],[a,b,d]};"undefined"!=typeof c&&(c.mat2=f);f={create:function(){var a=new k(6);
return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a[4]=0,a[5]=0,a},clone:function(a){var b=new k(6);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[4]=b[4],a[5]=b[5],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a[4]=0,a[5]=0,a},invert:function(a,b){var d=b[0],h=b[1],t=b[2],c=b[3],g=b[4],e=b[5],k=d*c-h*t;return k?(k=1/k,a[0]=c*k,a[1]=-h*k,a[2]=-t*k,a[3]=d*k,a[4]=(t*e-c*g)*k,a[5]=(h*g-d*e)*k,a):null},determinant:function(a){return a[0]*
a[3]-a[1]*a[2]},multiply:function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4];b=b[5];var f=d[0],m=d[1],A=d[2],u=d[3],N=d[4];d=d[5];return a[0]=h*f+g*m,a[1]=c*f+e*m,a[2]=h*A+g*u,a[3]=c*A+e*u,a[4]=h*N+g*d+k,a[5]=c*N+e*d+b,a}};f.mul=f.multiply;f.rotate=function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4];b=b[5];var f=Math.sin(d);d=Math.cos(d);return a[0]=h*d+g*f,a[1]=c*d+e*f,a[2]=h*-f+g*d,a[3]=c*-f+e*d,a[4]=k,a[5]=b,a};f.scale=function(a,b,d){var h=b[1],c=b[2],g=b[3],e=b[4],k=b[5],f=d[0];d=d[1];
return a[0]=b[0]*f,a[1]=h*f,a[2]=c*d,a[3]=g*d,a[4]=e,a[5]=k,a};f.translate=function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4];b=b[5];var f=d[0];d=d[1];return a[0]=h,a[1]=c,a[2]=g,a[3]=e,a[4]=h*f+g*d+k,a[5]=c*f+e*d+b,a};f.str=function(a){return"mat2d("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+", "+a[4]+", "+a[5]+")"};f.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+1)};"undefined"!=typeof c&&(c.mat2d=f);var x={create:function(){var a=
new k(9);return a[0]=1,a[1]=0,a[2]=0,a[3]=0,a[4]=1,a[5]=0,a[6]=0,a[7]=0,a[8]=1,a},fromMat4:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[4],a[4]=b[5],a[5]=b[6],a[6]=b[8],a[7]=b[9],a[8]=b[10],a},clone:function(a){var b=new k(9);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b[6]=a[6],b[7]=a[7],b[8]=a[8],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],a[8]=b[8],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=
0,a[3]=0,a[4]=1,a[5]=0,a[6]=0,a[7]=0,a[8]=1,a},transpose:function(a,b){if(a===b){var d=b[1],h=b[2],c=b[5];a[1]=b[3];a[2]=b[6];a[3]=d;a[5]=b[7];a[6]=h;a[7]=c}else a[0]=b[0],a[1]=b[3],a[2]=b[6],a[3]=b[1],a[4]=b[4],a[5]=b[7],a[6]=b[2],a[7]=b[5],a[8]=b[8];return a},invert:function(a,b){var d=b[0],h=b[1],c=b[2],g=b[3],e=b[4],k=b[5],f=b[6],m=b[7],A=b[8],u=A*e-k*m,N=-A*g+k*f,v=m*g-e*f,l=d*u+h*N+c*v;return l?(l=1/l,a[0]=u*l,a[1]=(-A*h+c*m)*l,a[2]=(k*h-c*e)*l,a[3]=N*l,a[4]=(A*d-c*f)*l,a[5]=(-k*d+c*g)*l,a[6]=
v*l,a[7]=(-m*d+h*f)*l,a[8]=(e*d-h*g)*l,a):null},adjoint:function(a,b){var d=b[0],h=b[1],c=b[2],g=b[3],e=b[4],k=b[5],f=b[6],m=b[7],A=b[8];return a[0]=e*A-k*m,a[1]=c*m-h*A,a[2]=h*k-c*e,a[3]=k*f-g*A,a[4]=d*A-c*f,a[5]=c*g-d*k,a[6]=g*m-e*f,a[7]=h*f-d*m,a[8]=d*e-h*g,a},determinant:function(a){var b=a[3],d=a[4],h=a[5],c=a[6],g=a[7],e=a[8];return a[0]*(e*d-h*g)+a[1]*(-e*b+h*c)+a[2]*(g*b-d*c)},multiply:function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4],f=b[5],m=b[6],A=b[7];b=b[8];var u=d[0],l=d[1],v=d[2],
n=d[3],r=d[4],q=d[5],p=d[6],s=d[7];d=d[8];return a[0]=u*h+l*e+v*m,a[1]=u*c+l*k+v*A,a[2]=u*g+l*f+v*b,a[3]=n*h+r*e+q*m,a[4]=n*c+r*k+q*A,a[5]=n*g+r*f+q*b,a[6]=p*h+s*e+d*m,a[7]=p*c+s*k+d*A,a[8]=p*g+s*f+d*b,a}};x.mul=x.multiply;x.translate=function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4],f=b[5],m=b[6],A=b[7];b=b[8];var u=d[0];d=d[1];return a[0]=h,a[1]=c,a[2]=g,a[3]=e,a[4]=k,a[5]=f,a[6]=u*h+d*e+m,a[7]=u*c+d*k+A,a[8]=u*g+d*f+b,a};x.rotate=function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4],f=b[5],
m=b[6],A=b[7];b=b[8];var u=Math.sin(d);d=Math.cos(d);return a[0]=d*h+u*e,a[1]=d*c+u*k,a[2]=d*g+u*f,a[3]=d*e-u*h,a[4]=d*k-u*c,a[5]=d*f-u*g,a[6]=m,a[7]=A,a[8]=b,a};x.scale=function(a,b,d){var h=d[0];d=d[1];return a[0]=h*b[0],a[1]=h*b[1],a[2]=h*b[2],a[3]=d*b[3],a[4]=d*b[4],a[5]=d*b[5],a[6]=b[6],a[7]=b[7],a[8]=b[8],a};x.fromMat2d=function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=0,a[3]=b[2],a[4]=b[3],a[5]=0,a[6]=b[4],a[7]=b[5],a[8]=1,a};x.fromQuat=function(a,b){var d=b[0],h=b[1],c=b[2],g=b[3],e=d+d,k=h+h,
f=c+c,d=d*e,m=h*e,h=h*k,A=c*e,u=c*k,c=c*f,e=g*e,k=g*k,g=g*f;return a[0]=1-h-c,a[3]=m-g,a[6]=A+k,a[1]=m+g,a[4]=1-d-c,a[7]=u-e,a[2]=A-k,a[5]=u+e,a[8]=1-d-h,a};x.normalFromMat4=function(a,b){var d=b[0],h=b[1],c=b[2],g=b[3],e=b[4],k=b[5],f=b[6],m=b[7],A=b[8],u=b[9],l=b[10],v=b[11],n=b[12],r=b[13],q=b[14],p=b[15],s=d*k-h*e,y=d*f-c*e,z=d*m-g*e,B=h*f-c*k,w=h*m-g*k,x=c*m-g*f,E=A*r-u*n,F=A*q-l*n,A=A*p-v*n,G=u*q-l*r,u=u*p-v*r,l=l*p-v*q;return(v=s*l-y*u+z*G+B*A-w*F+x*E)?(v=1/v,a[0]=(k*l-f*u+m*G)*v,a[1]=(f*A-
e*l-m*F)*v,a[2]=(e*u-k*A+m*E)*v,a[3]=(c*u-h*l-g*G)*v,a[4]=(d*l-c*A+g*F)*v,a[5]=(h*A-d*u-g*E)*v,a[6]=(r*x-q*w+p*B)*v,a[7]=(q*z-n*x-p*y)*v,a[8]=(n*w-r*z+p*s)*v,a):null};x.str=function(a){return"mat3("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+", "+a[4]+", "+a[5]+", "+a[6]+", "+a[7]+", "+a[8]+")"};x.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+Math.pow(a[6],2)+Math.pow(a[7],2)+Math.pow(a[8],2))};"undefined"!=typeof c&&
(c.mat3=x);var w={create:function(){var a=new k(16);return a[0]=1,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=1,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=1,a[11]=0,a[12]=0,a[13]=0,a[14]=0,a[15]=1,a},clone:function(a){var b=new k(16);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b[6]=a[6],b[7]=a[7],b[8]=a[8],b[9]=a[9],b[10]=a[10],b[11]=a[11],b[12]=a[12],b[13]=a[13],b[14]=a[14],b[15]=a[15],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],
a[8]=b[8],a[9]=b[9],a[10]=b[10],a[11]=b[11],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=1,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=1,a[11]=0,a[12]=0,a[13]=0,a[14]=0,a[15]=1,a},transpose:function(a,b){if(a===b){var d=b[1],h=b[2],c=b[3],g=b[6],e=b[7],k=b[11];a[1]=b[4];a[2]=b[8];a[3]=b[12];a[4]=d;a[6]=b[9];a[7]=b[13];a[8]=h;a[9]=g;a[11]=b[14];a[12]=c;a[13]=e;a[14]=k}else a[0]=b[0],a[1]=b[4],a[2]=b[8],a[3]=b[12],a[4]=b[1],a[5]=b[5],a[6]=
b[9],a[7]=b[13],a[8]=b[2],a[9]=b[6],a[10]=b[10],a[11]=b[14],a[12]=b[3],a[13]=b[7],a[14]=b[11],a[15]=b[15];return a},invert:function(a,b){var d=b[0],h=b[1],c=b[2],g=b[3],e=b[4],k=b[5],f=b[6],m=b[7],l=b[8],u=b[9],n=b[10],v=b[11],r=b[12],q=b[13],p=b[14],s=b[15],w=d*k-h*e,y=d*f-c*e,z=d*m-g*e,B=h*f-c*k,x=h*m-g*k,I=c*m-g*f,E=l*q-u*r,F=l*p-n*r,G=l*s-v*r,J=u*p-n*q,K=u*s-v*q,L=n*s-v*p,D=w*L-y*K+z*J+B*G-x*F+I*E;return D?(D=1/D,a[0]=(k*L-f*K+m*J)*D,a[1]=(c*K-h*L-g*J)*D,a[2]=(q*I-p*x+s*B)*D,a[3]=(n*x-u*I-v*B)*
D,a[4]=(f*G-e*L-m*F)*D,a[5]=(d*L-c*G+g*F)*D,a[6]=(p*z-r*I-s*y)*D,a[7]=(l*I-n*z+v*y)*D,a[8]=(e*K-k*G+m*E)*D,a[9]=(h*G-d*K-g*E)*D,a[10]=(r*x-q*z+s*w)*D,a[11]=(u*z-l*x-v*w)*D,a[12]=(k*F-e*J-f*E)*D,a[13]=(d*J-h*F+c*E)*D,a[14]=(q*y-r*B-p*w)*D,a[15]=(l*B-u*y+n*w)*D,a):null},adjoint:function(a,b){var d=b[0],h=b[1],c=b[2],g=b[3],e=b[4],k=b[5],f=b[6],m=b[7],l=b[8],u=b[9],n=b[10],v=b[11],r=b[12],q=b[13],p=b[14],s=b[15];return a[0]=k*(n*s-v*p)-u*(f*s-m*p)+q*(f*v-m*n),a[1]=-(h*(n*s-v*p)-u*(c*s-g*p)+q*(c*v-g*
n)),a[2]=h*(f*s-m*p)-k*(c*s-g*p)+q*(c*m-g*f),a[3]=-(h*(f*v-m*n)-k*(c*v-g*n)+u*(c*m-g*f)),a[4]=-(e*(n*s-v*p)-l*(f*s-m*p)+r*(f*v-m*n)),a[5]=d*(n*s-v*p)-l*(c*s-g*p)+r*(c*v-g*n),a[6]=-(d*(f*s-m*p)-e*(c*s-g*p)+r*(c*m-g*f)),a[7]=d*(f*v-m*n)-e*(c*v-g*n)+l*(c*m-g*f),a[8]=e*(u*s-v*q)-l*(k*s-m*q)+r*(k*v-m*u),a[9]=-(d*(u*s-v*q)-l*(h*s-g*q)+r*(h*v-g*u)),a[10]=d*(k*s-m*q)-e*(h*s-g*q)+r*(h*m-g*k),a[11]=-(d*(k*v-m*u)-e*(h*v-g*u)+l*(h*m-g*k)),a[12]=-(e*(u*p-n*q)-l*(k*p-f*q)+r*(k*n-f*u)),a[13]=d*(u*p-n*q)-l*(h*p-
c*q)+r*(h*n-c*u),a[14]=-(d*(k*p-f*q)-e*(h*p-c*q)+r*(h*f-c*k)),a[15]=d*(k*n-f*u)-e*(h*n-c*u)+l*(h*f-c*k),a},determinant:function(a){var b=a[0],d=a[1],h=a[2],c=a[3],g=a[4],e=a[5],k=a[6],f=a[7],m=a[8],l=a[9],n=a[10],p=a[11],v=a[12],q=a[13],r=a[14];a=a[15];return(b*e-d*g)*(n*a-p*r)-(b*k-h*g)*(l*a-p*q)+(b*f-c*g)*(l*r-n*q)+(d*k-h*e)*(m*a-p*v)-(d*f-c*e)*(m*r-n*v)+(h*f-c*k)*(m*q-l*v)},multiply:function(a,b,d){var h=b[0],c=b[1],g=b[2],e=b[3],k=b[4],f=b[5],m=b[6],l=b[7],n=b[8],p=b[9],q=b[10],r=b[11],s=b[12],
w=b[13],x=b[14];b=b[15];var C=d[0],y=d[1],z=d[2],B=d[3];return a[0]=C*h+y*k+z*n+B*s,a[1]=C*c+y*f+z*p+B*w,a[2]=C*g+y*m+z*q+B*x,a[3]=C*e+y*l+z*r+B*b,C=d[4],y=d[5],z=d[6],B=d[7],a[4]=C*h+y*k+z*n+B*s,a[5]=C*c+y*f+z*p+B*w,a[6]=C*g+y*m+z*q+B*x,a[7]=C*e+y*l+z*r+B*b,C=d[8],y=d[9],z=d[10],B=d[11],a[8]=C*h+y*k+z*n+B*s,a[9]=C*c+y*f+z*p+B*w,a[10]=C*g+y*m+z*q+B*x,a[11]=C*e+y*l+z*r+B*b,C=d[12],y=d[13],z=d[14],B=d[15],a[12]=C*h+y*k+z*n+B*s,a[13]=C*c+y*f+z*p+B*w,a[14]=C*g+y*m+z*q+B*x,a[15]=C*e+y*l+z*r+B*b,a}};w.mul=
w.multiply;w.translate=function(a,b,d){var h=d[0],c=d[1];d=d[2];var g,e,k,f,m,l,n,p,q,r,s,w;return b===a?(a[12]=b[0]*h+b[4]*c+b[8]*d+b[12],a[13]=b[1]*h+b[5]*c+b[9]*d+b[13],a[14]=b[2]*h+b[6]*c+b[10]*d+b[14],a[15]=b[3]*h+b[7]*c+b[11]*d+b[15]):(g=b[0],e=b[1],k=b[2],f=b[3],m=b[4],l=b[5],n=b[6],p=b[7],q=b[8],r=b[9],s=b[10],w=b[11],a[0]=g,a[1]=e,a[2]=k,a[3]=f,a[4]=m,a[5]=l,a[6]=n,a[7]=p,a[8]=q,a[9]=r,a[10]=s,a[11]=w,a[12]=g*h+m*c+q*d+b[12],a[13]=e*h+l*c+r*d+b[13],a[14]=k*h+n*c+s*d+b[14],a[15]=f*h+p*c+w*
d+b[15]),a};w.scale=function(a,b,d){var h=d[0],c=d[1];d=d[2];return a[0]=b[0]*h,a[1]=b[1]*h,a[2]=b[2]*h,a[3]=b[3]*h,a[4]=b[4]*c,a[5]=b[5]*c,a[6]=b[6]*c,a[7]=b[7]*c,a[8]=b[8]*d,a[9]=b[9]*d,a[10]=b[10]*d,a[11]=b[11]*d,a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15],a};w.rotate=function(a,b,d,h){var c=h[0],g=h[1];h=h[2];var k=Math.sqrt(c*c+g*g+h*h),f,m,l,n,p,q,r,s,w,x,M,C,y,z,B,P,I,E,F,G,J,K,L,D;return Math.abs(k)<e?null:(k=1/k,c*=k,g*=k,h*=k,f=Math.sin(d),m=Math.cos(d),l=1-m,n=b[0],p=b[1],q=b[2],r=
b[3],s=b[4],w=b[5],x=b[6],M=b[7],C=b[8],y=b[9],z=b[10],B=b[11],P=c*c*l+m,I=g*c*l+h*f,E=h*c*l-g*f,F=c*g*l-h*f,G=g*g*l+m,J=h*g*l+c*f,K=c*h*l+g*f,L=g*h*l-c*f,D=h*h*l+m,a[0]=n*P+s*I+C*E,a[1]=p*P+w*I+y*E,a[2]=q*P+x*I+z*E,a[3]=r*P+M*I+B*E,a[4]=n*F+s*G+C*J,a[5]=p*F+w*G+y*J,a[6]=q*F+x*G+z*J,a[7]=r*F+M*G+B*J,a[8]=n*K+s*L+C*D,a[9]=p*K+w*L+y*D,a[10]=q*K+x*L+z*D,a[11]=r*K+M*L+B*D,b!==a&&(a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a)};w.rotateX=function(a,b,d){var c=Math.sin(d);d=Math.cos(d);var g=b[4],
e=b[5],k=b[6],f=b[7],m=b[8],l=b[9],n=b[10],p=b[11];return b!==a&&(a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a[4]=g*d+m*c,a[5]=e*d+l*c,a[6]=k*d+n*c,a[7]=f*d+p*c,a[8]=m*d-g*c,a[9]=l*d-e*c,a[10]=n*d-k*c,a[11]=p*d-f*c,a};w.rotateY=function(a,b,d){var c=Math.sin(d);d=Math.cos(d);var g=b[0],e=b[1],k=b[2],f=b[3],m=b[8],l=b[9],n=b[10],p=b[11];return b!==a&&(a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a[0]=g*d-m*c,
a[1]=e*d-l*c,a[2]=k*d-n*c,a[3]=f*d-p*c,a[8]=g*c+m*d,a[9]=e*c+l*d,a[10]=k*c+n*d,a[11]=f*c+p*d,a};w.rotateZ=function(a,b,d){var c=Math.sin(d);d=Math.cos(d);var g=b[0],e=b[1],k=b[2],f=b[3],m=b[4],l=b[5],n=b[6],p=b[7];return b!==a&&(a[8]=b[8],a[9]=b[9],a[10]=b[10],a[11]=b[11],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a[0]=g*d+m*c,a[1]=e*d+l*c,a[2]=k*d+n*c,a[3]=f*d+p*c,a[4]=m*d-g*c,a[5]=l*d-e*c,a[6]=n*d-k*c,a[7]=p*d-f*c,a};w.fromRotationTranslation=function(a,b,d){var c=b[0],g=b[1],e=b[2],k=b[3],
f=c+c,m=g+g,l=e+e;b=c*f;var n=c*m,c=c*l,p=g*m,g=g*l,e=e*l,f=k*f,m=k*m,k=k*l;return a[0]=1-(p+e),a[1]=n+k,a[2]=c-m,a[3]=0,a[4]=n-k,a[5]=1-(b+e),a[6]=g+f,a[7]=0,a[8]=c+m,a[9]=g-f,a[10]=1-(b+p),a[11]=0,a[12]=d[0],a[13]=d[1],a[14]=d[2],a[15]=1,a};w.fromQuat=function(a,b){var d=b[0],c=b[1],g=b[2],e=b[3],k=d+d,f=c+c,m=g+g,d=d*k,l=c*k,c=c*f,n=g*k,p=g*f,g=g*m,k=e*k,f=e*f,e=e*m;return a[0]=1-c-g,a[1]=l+e,a[2]=n-f,a[3]=0,a[4]=l-e,a[5]=1-d-g,a[6]=p+k,a[7]=0,a[8]=n+f,a[9]=p-k,a[10]=1-d-c,a[11]=0,a[12]=0,a[13]=
0,a[14]=0,a[15]=1,a};w.frustum=function(a,b,d,c,g,e,k){var f=1/(d-b),m=1/(g-c),l=1/(e-k);return a[0]=2*e*f,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=2*e*m,a[6]=0,a[7]=0,a[8]=(d+b)*f,a[9]=(g+c)*m,a[10]=(k+e)*l,a[11]=-1,a[12]=0,a[13]=0,a[14]=k*e*2*l,a[15]=0,a};w.perspective=function(a,b,d,c,g){b=1/Math.tan(b/2);var e=1/(c-g);return a[0]=b/d,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=b,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=(g+c)*e,a[11]=-1,a[12]=0,a[13]=0,a[14]=2*g*c*e,a[15]=0,a};w.ortho=function(a,b,d,c,g,e,k){var f=1/(b-
d),m=1/(c-g),l=1/(e-k);return a[0]=-2*f,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=-2*m,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=2*l,a[11]=0,a[12]=(b+d)*f,a[13]=(g+c)*m,a[14]=(k+e)*l,a[15]=1,a};w.lookAt=function(a,b,d,c){var g,k,f,m,l,n,p,q,r,s,x=b[0],O=b[1];b=b[2];var Q=c[0],M=c[1];c=c[2];var C=d[0],y=d[1];d=d[2];return Math.abs(x-C)<e&&Math.abs(O-y)<e&&Math.abs(b-d)<e?w.identity(a):(p=x-C,q=O-y,r=b-d,s=1/Math.sqrt(p*p+q*q+r*r),p*=s,q*=s,r*=s,g=M*r-c*q,k=c*p-Q*r,f=Q*q-M*p,s=Math.sqrt(g*g+k*k+f*f),s?(s=1/s,g*=s,k*=
s,f*=s):(g=0,k=0,f=0),m=q*f-r*k,l=r*g-p*f,n=p*k-q*g,s=Math.sqrt(m*m+l*l+n*n),s?(s=1/s,m*=s,l*=s,n*=s):(m=0,l=0,n=0),a[0]=g,a[1]=m,a[2]=p,a[3]=0,a[4]=k,a[5]=l,a[6]=q,a[7]=0,a[8]=f,a[9]=n,a[10]=r,a[11]=0,a[12]=-(g*x+k*O+f*b),a[13]=-(m*x+l*O+n*b),a[14]=-(p*x+q*O+r*b),a[15]=1,a)};w.str=function(a){return"mat4("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+", "+a[4]+", "+a[5]+", "+a[6]+", "+a[7]+", "+a[8]+", "+a[9]+", "+a[10]+", "+a[11]+", "+a[12]+", "+a[13]+", "+a[14]+", "+a[15]+")"};w.frob=function(a){return Math.sqrt(Math.pow(a[0],
2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+Math.pow(a[6],2)+Math.pow(a[6],2)+Math.pow(a[7],2)+Math.pow(a[8],2)+Math.pow(a[9],2)+Math.pow(a[10],2)+Math.pow(a[11],2)+Math.pow(a[12],2)+Math.pow(a[13],2)+Math.pow(a[14],2)+Math.pow(a[15],2))};"undefined"!=typeof c&&(c.mat4=w);var s={create:function(){var a=new k(4);return a[0]=0,a[1]=0,a[2]=0,a[3]=1,a}};s.rotationTo=function(){var a=n.create(),b=n.fromValues(1,0,0),d=n.fromValues(0,1,0);return function(c,g,
e){var k=n.dot(g,e);return-0.999999>k?(n.cross(a,b,g),1E-6>n.length(a)&&n.cross(a,d,g),n.normalize(a,a),s.setAxisAngle(c,a,Math.PI),c):0.999999<k?(c[0]=0,c[1]=0,c[2]=0,c[3]=1,c):(n.cross(a,g,e),c[0]=a[0],c[1]=a[1],c[2]=a[2],c[3]=1+k,s.normalize(c,c))}}();s.setAxes=function(){var a=x.create();return function(b,d,c,g){return a[0]=c[0],a[3]=c[1],a[6]=c[2],a[1]=g[0],a[4]=g[1],a[7]=g[2],a[2]=-d[0],a[5]=-d[1],a[8]=-d[2],s.normalize(b,s.fromMat3(b,a))}}();s.clone=q.clone;s.fromValues=q.fromValues;s.copy=
q.copy;s.set=q.set;s.identity=function(a){return a[0]=0,a[1]=0,a[2]=0,a[3]=1,a};s.setAxisAngle=function(a,b,d){d*=0.5;var c=Math.sin(d);return a[0]=c*b[0],a[1]=c*b[1],a[2]=c*b[2],a[3]=Math.cos(d),a};s.add=q.add;s.multiply=function(a,b,d){var c=b[0],g=b[1],e=b[2];b=b[3];var k=d[0],f=d[1],m=d[2];d=d[3];return a[0]=c*d+b*k+g*m-e*f,a[1]=g*d+b*f+e*k-c*m,a[2]=e*d+b*m+c*f-g*k,a[3]=b*d-c*k-g*f-e*m,a};s.mul=s.multiply;s.scale=q.scale;s.rotateX=function(a,b,d){d*=0.5;var c=b[0],g=b[1],e=b[2];b=b[3];var k=Math.sin(d);
d=Math.cos(d);return a[0]=c*d+b*k,a[1]=g*d+e*k,a[2]=e*d-g*k,a[3]=b*d-c*k,a};s.rotateY=function(a,b,d){d*=0.5;var c=b[0],g=b[1],e=b[2];b=b[3];var k=Math.sin(d);d=Math.cos(d);return a[0]=c*d-e*k,a[1]=g*d+b*k,a[2]=e*d+c*k,a[3]=b*d-g*k,a};s.rotateZ=function(a,b,d){d*=0.5;var c=b[0],g=b[1],e=b[2];b=b[3];var k=Math.sin(d);d=Math.cos(d);return a[0]=c*d+g*k,a[1]=g*d-c*k,a[2]=e*d+b*k,a[3]=b*d-e*k,a};s.calculateW=function(a,b){var d=b[0],c=b[1],g=b[2];return a[0]=d,a[1]=c,a[2]=g,a[3]=-Math.sqrt(Math.abs(1-
d*d-c*c-g*g)),a};s.dot=q.dot;s.lerp=q.lerp;s.slerp=function(a,b,d,c){var g=b[0],e=b[1],k=b[2];b=b[3];var f=d[0],m=d[1],l=d[2];d=d[3];var n,p,q,r,s;return p=g*f+e*m+k*l+b*d,0>p&&(p=-p,f=-f,m=-m,l=-l,d=-d),1E-6<1-p?(n=Math.acos(p),q=Math.sin(n),r=Math.sin((1-c)*n)/q,s=Math.sin(c*n)/q):(r=1-c,s=c),a[0]=r*g+s*f,a[1]=r*e+s*m,a[2]=r*k+s*l,a[3]=r*b+s*d,a};s.invert=function(a,b){var d=b[0],c=b[1],g=b[2],e=b[3],k=d*d+c*c+g*g+e*e,k=k?1/k:0;return a[0]=-d*k,a[1]=-c*k,a[2]=-g*k,a[3]=e*k,a};s.conjugate=function(a,
b){return a[0]=-b[0],a[1]=-b[1],a[2]=-b[2],a[3]=b[3],a};s.length=q.length;s.len=s.length;s.squaredLength=q.squaredLength;s.sqrLen=s.squaredLength;s.normalize=q.normalize;s.fromMat3=function(a,b){var d=b[0]+b[4]+b[8];if(0<d)d=Math.sqrt(d+1),a[3]=0.5*d,d=0.5/d,a[0]=(b[7]-b[5])*d,a[1]=(b[2]-b[6])*d,a[2]=(b[3]-b[1])*d;else{var c=0;b[4]>b[0]&&(c=1);b[8]>b[3*c+c]&&(c=2);var g=(c+1)%3,e=(c+2)%3,d=Math.sqrt(b[3*c+c]-b[3*g+g]-b[3*e+e]+1);a[c]=0.5*d;d=0.5/d;a[3]=(b[3*e+g]-b[3*g+e])*d;a[g]=(b[3*g+c]+b[3*c+g])*
d;a[e]=(b[3*e+c]+b[3*c+e])*d}return a};s.str=function(a){return"quat("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+")"};"undefined"!=typeof c&&(c.quat=s)})(f)})(this);bongiovi=window.bongiovi||{};
(function(){SimpleImageLoader=function(){this._imgs={};this._toLoadCount=this._loadedCount=0;this._callbackProgress=this._callback=this._scope=void 0};var c=SimpleImageLoader.prototype;c.load=function(c,g,e,k){this._imgs={};this._loadedCount=0;this._toLoadCount=c.length;this._scope=g;this._callback=e;this._callbackProgress=k;var m=this;for(g=0;g<c.length;g++){e=new Image;e.onload=function(){m._onImageLoaded()};k=c[g];var l=k.split("/"),l=l[l.length-1].split(".")[0];this._imgs[l]=e;e.src=k}};c._onImageLoaded=
function(){this._loadedCount++;if(this._loadedCount==this._toLoadCount)this._callback.call(this._scope,this._imgs);else{var c=this._loadedCount/this._toLoadCount;this._callbackProgress&&this._callbackProgress.call(this._scope,c)}}})();bongiovi.SimpleImageLoader=new SimpleImageLoader;bongiovi.Utils={};
(function(){var c=function(c,e){this._easing=e||0.1;this._targetValue=this._value=c;bongiovi.Scheduler.addEF(this,this._update)},f=c.prototype;f._update=function(){this._checkLimit();this._value+=(this._targetValue-this._value)*this._easing};f.setTo=function(c){this._targetValue=this._value=c};f.add=function(c){this._targetValue+=c};f.limit=function(c,e){this._min=c;this._max=e;this._checkLimit()};f._checkLimit=function(){void 0!=this._min&&this._targetValue<this._min&&(this._targetValue=this._min);
void 0!=this._max&&this._targetValue>this._max&&(this._targetValue=this._max)};f.__defineGetter__("value",function(){return this._value});f.__defineGetter__("targetValue",function(){return this._targetValue});f.__defineSetter__("value",function(c){this._targetValue=c});bongiovi.EaseNumber=c})();bongiovi=window.bongiovi||{};void 0==window.requestAnimFrame&&(window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(c){window.setTimeout(c,1E3/60)}}());
(function(){var c=function(){this.FRAMERATE=60;this._delayTasks=[];this._nextTasks=[];this._deferTasks=[];this._highTasks=[];this._usurpTask=[];this._enterframeTasks=[];this._idTable=0;requestAnimFrame(this._loop.bind(this))},f=c.prototype;f._loop=function(){requestAnimFrame(this._loop.bind(this));this._process()};f._process=function(){for(var c=0;c<this._enterframeTasks.length;c++){var e=this._enterframeTasks[c];null!=e&&void 0!=e&&e.func.apply(e.scope,e.params)}for(;0<this._highTasks.length;)e=
this._highTasks.pop(),e.func.apply(e.scope,e.params);for(var k=(new Date).getTime(),c=0;c<this._delayTasks.length;c++)e=this._delayTasks[c],k-e.time>e.delay&&(e.func.apply(e.scope,e.params),this._delayTasks.splice(c,1));k=(new Date).getTime();for(c=1E3/this.FRAMERATE;0<this._deferTasks.length;){var e=this._deferTasks.shift(),f=(new Date).getTime();if(f-k<c)e.func.apply(e.scope,e.params);else{this._deferTasks.unshift(e);break}}k=(new Date).getTime();for(c=1E3/this.FRAMERATE;0<this._usurpTask.length;)if(e=
this._usurpTask.shift(),f=(new Date).getTime(),f-k<c)e.func.apply(e.scope,e.params);else break;this._highTasks=this._highTasks.concat(this._nextTasks);this._nextTasks=[];this._usurpTask=[]};f.addEF=function(c,e,k){k=k||[];var f=this._idTable;this._enterframeTasks[f]={scope:c,func:e,params:k};this._idTable++;return f};f.removeEF=function(c){void 0!=this._enterframeTasks[c]&&(this._enterframeTasks[c]=null);return-1};f.delay=function(c,e,k,f){var l=(new Date).getTime();this._delayTasks.push({scope:c,
func:e,params:k,delay:f,time:l})};f.defer=function(c,e,k){this._deferTasks.push({scope:c,func:e,params:k})};f.next=function(c,e,k){this._nextTasks.push({scope:c,func:e,params:k})};f.usurp=function(c,e,k){this._usurpTask.push({scope:c,func:e,params:k})};bongiovi.Scheduler=new c})();bongiovi=window.bongiovi||{};
(function(){var c=null,f=function(){this.aspectRatio=window.innerWidth/window.innerHeight;this.fieldOfView=45;this.zNear=5;this.zFar=3E3;this.gl=this.canvas=null;this.H=this.W=0;this.shaderProgram=this.shader=null},g=f.prototype;g.init=function(c){this.canvas=c;this.gl=this.canvas.getContext("experimental-webgl",{antialias:!0});this.resize();this.gl.getParameter(this.gl.SAMPLES);this.gl.getContextAttributes();this.gl.viewport(0,0,this.gl.viewportWidth,this.gl.viewportHeight);this.gl.enable(this.gl.DEPTH_TEST);
this.gl.enable(this.gl.CULL_FACE);this.gl.enable(this.gl.BLEND);this.gl.clearColor(0,0,0,1);this.gl.clearDepth(1);this.matrix=mat4.create();mat4.identity(this.matrix);this.depthTextureExt=this.gl.getExtension("WEBKIT_WEBGL_depth_texture");this.floatTextureExt=this.gl.getExtension("OES_texture_float");this.floatTextureLinearExt=this.gl.getExtension("OES_texture_float_linear");this.enableAlphaBlending();var g=this;window.addEventListener("resize",function(){g.resize()})};g.getGL=function(){return this.gl};
g.setShader=function(c){this.shader=c};g.setShaderProgram=function(c){this.shaderProgram=c};g.setViewport=function(c,g,f,l){this.gl.viewport(c,g,f,l)};g.setMatrices=function(c){this.camera=c};g.rotate=function(c){mat4.copy(this.matrix,c)};g.render=function(){null!=this.shaderProgram&&(this.setViewport(0,0,this.W,this.H),this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA))};g.enableAlphaBlending=function(){this.gl.blendFunc(this.gl.SRC_ALPHA,
this.gl.ONE_MINUS_SRC_ALPHA)};g.enableAdditiveBlending=function(){this.gl.blendFunc(this.gl.ONE,this.gl.ONE)};g.clear=function(c,g,f,l){this.gl.clearColor(c,g,f,l);this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT)};g.draw=function(c){function g(c,e,k){void 0==e.cacheAttribLoc&&(e.cacheAttribLoc={});void 0==e.cacheAttribLoc[k]&&(e.cacheAttribLoc[k]=c.getAttribLocation(e,k));return e.cacheAttribLoc[k]}if(this.shaderProgram){this.gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform,!1,
this.camera.getMatrix());this.gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform,!1,this.matrix);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,c.vBufferPos);var f=g(this.gl,this.shaderProgram,"aVertexPosition");this.gl.vertexAttribPointer(f,c.vBufferPos.itemSize,this.gl.FLOAT,!1,0,0);this.gl.enableVertexAttribArray(f);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,c.vBufferUV);f=g(this.gl,this.shaderProgram,"aTextureCoord");this.gl.vertexAttribPointer(f,c.vBufferUV.itemSize,this.gl.FLOAT,!1,0,0);this.gl.enableVertexAttribArray(f);
this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,c.iBuffer);for(f=0;f<c.extraAttributes.length;f++){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,c.extraAttributes[f].buffer);var l=g(this.gl,this.shaderProgram,c.extraAttributes[f].name);this.gl.vertexAttribPointer(l,c.extraAttributes[f].itemSize,this.gl.FLOAT,!1,0,0);this.gl.enableVertexAttribArray(l)}c.drawType==this.gl.POINTS?this.gl.drawArrays(c.drawType,0,c.vertexSize):this.gl.drawElements(c.drawType,c.iBuffer.numItems,this.gl.UNSIGNED_SHORT,0)}else console.warn("Shader program not ready yet")};
g.resize=function(){this.W=window.innerWidth;this.H=window.innerHeight;this.canvas.width=this.W;this.canvas.height=this.H;this.gl.viewportWidth=this.W;this.gl.viewportHeight=this.H;this.gl.viewport(0,0,this.W,this.H);this.aspectRatio=window.innerWidth/window.innerHeight;this.render()};f.getInstance=function(){null==c&&(c=new f);return c};bongiovi.GL=f.getInstance();bongiovi.GLTool=f.getInstance()})();bongiovi=window.bongiovi||{};
(function(){var c=function(c){void 0==c&&(c=document);this._isRotateZ=0;this.matrix=mat4.create();this.m=mat4.create();this._vZaxis=vec3.clone([0,0,0]);this._zAxis=vec3.clone([0,0,-1]);this.preMouse={x:0,y:0};this.mouse={x:0,y:0};this._isMouseDown=!1;this._rotation=quat.clone([0,0,1,0]);this.tempRotation=quat.clone([0,0,0,0]);this._currDiffY=this._currDiffX=this.diffY=this.diffX=this._rotateZMargin=0;this._offset=0.0040;this._easing=0.1;this._slerp=-1;this._isLocked=!1;var e=this;c.addEventListener("mousedown",
function(c){e._onMouseDown(c)});c.addEventListener("touchstart",function(c){e._onMouseDown(c)});c.addEventListener("mouseup",function(c){e._onMouseUp(c)});c.addEventListener("touchend",function(c){e._onMouseUp(c)});c.addEventListener("mousemove",function(c){e._onMouseMove(c)});c.addEventListener("touchmove",function(c){e._onMouseMove(c)})},f=c.prototype;f.inverseControl=function(c){this._isInvert=void 0==c?!0:c};f.lock=function(c){this._isLocked=void 0==c?!0:c};f.getMousePos=function(c){var e;void 0!=
c.changedTouches?(e=c.changedTouches[0].pageX,c=c.changedTouches[0].pageY):(e=c.clientX,c=c.clientY);return{x:e,y:c}};f._onMouseDown=function(c){if(!this._isLocked&&!this._isMouseDown){c=this.getMousePos(c);var e=quat.clone(this._rotation);this._updateRotation(e);this._rotation=e;this._isMouseDown=!0;this._isRotateZ=0;this.preMouse={x:c.x,y:c.y};if(c.y<this._rotateZMargin||c.y>window.innerHeight-this._rotateZMargin)this._isRotateZ=1;else if(c.x<this._rotateZMargin||c.x>window.innerWidth-this._rotateZMargin)this._isRotateZ=
2;this._currDiffY=this.diffY=this._currDiffX=this.diffX=0}};f._onMouseMove=function(c){this._isLocked||(c.touches&&c.preventDefault(),this.mouse=this.getMousePos(c))};f._onMouseUp=function(c){!this._isLocked&&this._isMouseDown&&(this._isMouseDown=!1)};f.setCameraPos=function(c,e){this._easing=e=e||this._easing;if(!(0<this._slerp)){var k=quat.clone(this._rotation);this._updateRotation(k);this._rotation=quat.clone(k);this._currDiffY=this.diffY=this._currDiffX=this.diffX=0;this._isMouseDown=!1;this._isRotateZ=
0;this._targetQuat=quat.clone(c);this._slerp=1}};f.resetQuat=function(){this._rotation=quat.clone([0,0,1,0]);this.tempRotation=quat.clone([0,0,0,0]);this._targetQuat=void 0;this._slerp=-1};f.update=function(){mat4.identity(this.m);void 0==this._targetQuat?(quat.set(this.tempRotation,this._rotation[0],this._rotation[1],this._rotation[2],this._rotation[3]),this._updateRotation(this.tempRotation)):(this._slerp+=0.1*(0-this._slerp),0.0010>this._slerp?(quat.set(this._rotation,this._targetQuat[0],this._targetQuat[1],
this._targetQuat[2],this._targetQuat[3]),this._targetQuat=void 0,this._slerp=-1):(quat.set(this.tempRotation,0,0,0,0),quat.slerp(this.tempRotation,this._targetQuat,this._rotation,this._slerp)));vec3.transformQuat(this._vZaxis,this._vZaxis,this.tempRotation);mat4.fromQuat(this.matrix,this.tempRotation)};f._updateRotation=function(c){this._isMouseDown&&!this._isLocked&&(this.diffX=-(this.mouse.x-this.preMouse.x),this.diffY=this.mouse.y-this.preMouse.y,this._isInvert&&(this.diffX=-this.diffX),this._isInvert&&
(this.diffY=-this.diffY));this._currDiffX+=(this.diffX-this._currDiffX)*this._easing;this._currDiffY+=(this.diffY-this._currDiffY)*this._easing;if(0<this._isRotateZ){if(1==this._isRotateZ)var e=-this._currDiffX*this._offset,e=e*(this.preMouse.y<this._rotateZMargin?-1:1),k=quat.clone([0,0,Math.sin(e),Math.cos(e)]);else e=-this._currDiffY*this._offset,e*=this.preMouse.x<this._rotateZMargin?1:-1,k=quat.clone([0,0,Math.sin(e),Math.cos(e)]);quat.multiply(quat,c,k)}else e=vec3.clone([this._currDiffX,this._currDiffY,
0]),k=vec3.create(),vec3.cross(k,e,this._zAxis),vec3.normalize(k,k),e=vec3.length(e)*this._offset,k=quat.clone([Math.sin(e)*k[0],Math.sin(e)*k[1],Math.sin(e)*k[2],Math.cos(e)]),quat.multiply(c,k,c)};bongiovi.SceneRotation=c})();(function(){var c=function(){this.gl=bongiovi.GLTool.gl;this._children=[];this._init()},f=c.prototype;f._init=function(){this.camera=new bongiovi.SimpleCamera;this.camera.setPerspective(45*Math.PI/180,window.innerWidth/window.innerHeight,5,3E3);this.camera.lockRotation();var c=vec3.clone([0,0,500]),e=vec3.create(),k=vec3.clone([0,-1,0]);this.camera.lookAt(c,e,k);this.sceneRotation=new bongiovi.SceneRotation;this.rotationFront=mat4.create();mat4.identity(this.rotationFront);this.cameraOtho=new bongiovi.Camera;
this._initTextures();this._initViews();window.addEventListener("resize",this._onResize.bind(this))};f._initTextures=function(){};f._initViews=function(){};f.loop=function(){this.update();this.render()};f.update=function(){this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);this.sceneRotation.update();bongiovi.GLTool.setMatrices(this.camera);bongiovi.GLTool.rotate(this.sceneRotation.matrix)};f.render=function(){};f._onResize=function(c){this.camera.resize&&this.camera.resize(window.innerWidth/
window.innerHeight)};bongiovi.Scene=c})();bongiovi=window.bongiovi||{};(function(){var c=function(){this.matrix=mat4.create();mat4.identity(this.matrix);this.position=vec3.create()},f=c.prototype;f.lookAt=function(c,e,k){vec3.copy(this.position,c);mat4.identity(this.matrix);mat4.lookAt(this.matrix,c,e,k)};f.getMatrix=function(){return this.matrix};bongiovi.Camera=c})();bongiovi=window.bongiovi||{};
(function(){var c=bongiovi.Camera,f=function(){c.call(this);this.projection=mat4.create();this.mtxFinal=mat4.create()},g=f.prototype=new c;g.setPerspective=function(c,g,f,l){this._fov=c;this._near=f;this._far=l;mat4.perspective(this.projection,c,g,f,l)};g.getMatrix=function(){mat4.multiply(this.mtxFinal,this.projection,this.matrix);return this.mtxFinal};g.resize=function(c){mat4.perspective(this.projection,this._fov,c,this._near,this._far)};bongiovi.CameraPerspective=f})();(function(){var c=function(c){this._listenerTarget=c||window;bongiovi.CameraPerspective.call(this);this._isLocked=!1;this._init()},f=c.prototype=new bongiovi.CameraPerspective,g=bongiovi.CameraPerspective.prototype,e=bongiovi.EaseNumber;f._init=function(){this.radius=new e(500);this.position[2]=this.radius.value;this.center=vec3.create();this.up=vec3.clone([0,-1,0]);this.lookAt(this.position,this.center,this.up);this._mouse={};this._preMouse={};this._isMouseDown=!1;this._rx=new e(0);this._rx.limit(-Math.PI/
2,Math.PI/2);this._ry=new e(0);this._preRY=this._preRX=0;this._isInvert=this._isLockRotation=this._isLocked=!1;this._listenerTarget.addEventListener("mousewheel",this._onWheel.bind(this));this._listenerTarget.addEventListener("DOMMouseScroll",this._onWheel.bind(this));this._listenerTarget.addEventListener("mousedown",this._onMouseDown.bind(this));this._listenerTarget.addEventListener("touchstart",this._onMouseDown.bind(this));this._listenerTarget.addEventListener("mousemove",this._onMouseMove.bind(this));
this._listenerTarget.addEventListener("touchmove",this._onMouseMove.bind(this));window.addEventListener("mouseup",this._onMouseUp.bind(this));window.addEventListener("touchend",this._onMouseUp.bind(this))};f.inverseControl=function(c){this._isInvert=void 0==c?!0:c};f.lock=function(c){this._isLocked=void 0==c?!0:c};f.lockRotation=function(c){this._isLockRotation=void 0==c?!0:c};f._onMouseDown=function(c){this._isLockRotation||this._isLocked||(this._isMouseDown=!0,k(c,this._mouse),k(c,this._preMouse),
this._preRX=this._rx.targetValue,this._preRY=this._ry.targetValue)};f._onMouseMove=function(c){this._isLockRotation||this._isLocked||(k(c,this._mouse),c.touches&&c.preventDefault(),this._isMouseDown&&(c=this._mouse.x-this._preMouse.x,this._isInvert&&(c*=-1),this._ry.value=this._preRY-0.01*c,c=this._mouse.y-this._preMouse.y,this._isInvert&&(c*=-1),this._rx.value=this._preRX-0.01*c,this._rx.targetValue>0.5*Math.PI&&(this._rx.targetValue=Math)))};f._onMouseUp=function(c){this._isLockRotation||this._isLocked||
(this._isMouseDown=!1)};f._onWheel=function(c){if(!this._isLocked){var g=c.wheelDelta;c=c.detail;this.radius.add(5*-(c?g?0<g/c/40*c?1:-1:-c/3:g/120))}};f.getMatrix=function(){this._updateCameraPosition();this.lookAt(this.position,this.center,this.up);return g.getMatrix.call(this)};f._updateCameraPosition=function(){this.position[2]=this.radius.value;this.position[1]=Math.sin(this._rx.value)*this.radius.value;var c=Math.cos(this._rx.value)*this.radius.value;this.position[0]=Math.cos(this._ry.value+
0.5*Math.PI)*c;this.position[2]=Math.sin(this._ry.value+0.5*Math.PI)*c};var k=function(c,g){var e=g||{};c.touches?(e.x=c.touches[0].pageX,e.y=c.touches[0].pageY):(e.x=c.clientX,e.y=c.clientY);return e};f.__defineGetter__("rx",function(){return this._rx.targetValue});f.__defineSetter__("rx",function(c){this._rx.value=c});f.__defineGetter__("ry",function(){return this._ry.targetValue});f.__defineSetter__("ry",function(c){this._ry.value=c});bongiovi.SimpleCamera=c})();(function(){var c=function(c,e,k){this.gl=bongiovi.GLTool.gl;this.vertexSize=c;this.indexSize=e;this.drawType=k;this.extraAttributes=[];this._floatArrayVertex=this.vBufferPos=void 0;this._init()},f=c.prototype;f._init=function(){};f.bufferVertex=function(c,e){for(var k=[],f=e?this.gl.DYNAMIC_DRAW:this.gl.STATIC_DRAW,l=0;l<c.length;l++)for(var p=0;p<c[l].length;p++)k.push(c[l][p]);void 0==this.vBufferPos&&(this.vBufferPos=this.gl.createBuffer());this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vBufferPos);
if(void 0==this._floatArrayVertex)this._floatArrayVertex=new Float32Array(k);else if(c.length!=this._floatArrayVertex.length)this._floatArrayVertex=new Float32Array(k);else for(l=0;l<c.length;l++)this._floatArrayVertex[l]=c[l];this.gl.bufferData(this.gl.ARRAY_BUFFER,this._floatArrayVertex,f);this.vBufferPos.itemSize=3};f.bufferTexCoords=function(c){for(var e=[],k=0;k<c.length;k++)for(var f=0;f<c[k].length;f++)e.push(c[k][f]);this.vBufferUV=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,
this.vBufferUV);this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(e),this.gl.STATIC_DRAW);this.vBufferUV.itemSize=2};f.bufferData=function(c,e,k,f){var l=-1;f=f?this.gl.DYNAMIC_DRAW:this.gl.STATIC_DRAW;for(var p=0;p<this.extraAttributes.length;p++)if(this.extraAttributes[p].name==e){this.extraAttributes[p].data=c;l=p;break}for(var r=[],p=0;p<c.length;p++)for(var n=0;n<c[p].length;n++)r.push(c[p][n]);if(-1==l)p=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,p),l=new Float32Array(r),
this.gl.bufferData(this.gl.ARRAY_BUFFER,l,f),this.extraAttributes.push({name:e,data:c,itemSize:k,buffer:p,floatArray:l});else{p=this.extraAttributes[l].buffer;this.gl.bindBuffer(this.gl.ARRAY_BUFFER,p);l=this.extraAttributes[l].floatArray;for(p=0;p<r.length;p++)l[p]=r[p];this.gl.bufferData(this.gl.ARRAY_BUFFER,l,f)}};f.bufferIndices=function(c){this.iBuffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.iBuffer);this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(c),
this.gl.STATIC_DRAW);this.iBuffer.itemSize=1;this.iBuffer.numItems=c.length};bongiovi.Mesh=c})();(function(){var c=function(c,e){this.gl=bongiovi.GL.gl;this.idVertex=c;this.idFragment=e;this.parameters=[];this.uniformTextures=[];this.fragmentShader=this.vertexShader=void 0;this._isReady=!1;this._loadedCount=0;void 0==c&&this.createVertexShaderProgram("precision highp float;attribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec2 vTextureCoord;void main(void) {    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);    vTextureCoord = aTextureCoord;}");
void 0==e&&this.createFragmentShaderProgram("precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;void main(void) {    gl_FragColor = texture2D(texture, vTextureCoord);}");this.init()};c.defaultVertexShader="precision highp float;attribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec2 vTextureCoord;void main(void) {    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);    vTextureCoord = aTextureCoord;}";
c.defaultFragmentShader="precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;void main(void) {    gl_FragColor = texture2D(texture, vTextureCoord);}";var f=c.prototype;f.init=function(){this.idVertex&&-1<this.idVertex.indexOf("main(void)")?this.createVertexShaderProgram(this.idVertex):this.getShader(this.idVertex,!0);this.idFragment&&-1<this.idFragment.indexOf("main(void)")?this.createFragmentShaderProgram(this.idFragment):this.getShader(this.idFragment,!1)};f.getShader=function(c,
e){if(c){var f=new XMLHttpRequest;f.hasCompleted=!1;var m=this;f.onreadystatechange=function(c){4==c.target.readyState&&(e?m.createVertexShaderProgram(c.target.responseText):m.createFragmentShaderProgram(c.target.responseText))};f.open("GET",c,!0);f.send(null)}};f.createVertexShaderProgram=function(c){if(this.gl){var e=this.gl.createShader(this.gl.VERTEX_SHADER);this.gl.shaderSource(e,c);this.gl.compileShader(e);if(!this.gl.getShaderParameter(e,this.gl.COMPILE_STATUS))return console.warn("Error in Vertex Shader : ",
this.idVertex,":",this.gl.getShaderInfoLog(e)),console.log(c),null;this.vertexShader=e;void 0!=this.vertexShader&&void 0!=this.fragmentShader&&this.attachShaderProgram();this._loadedCount++}};f.createFragmentShaderProgram=function(c){if(this.gl){var e=this.gl.createShader(this.gl.FRAGMENT_SHADER);this.gl.shaderSource(e,c);this.gl.compileShader(e);if(!this.gl.getShaderParameter(e,this.gl.COMPILE_STATUS))return console.warn("Error in Fragment Shader: ",this.idFragment,":",this.gl.getShaderInfoLog(e)),
console.log(c),null;this.fragmentShader=e;void 0!=this.vertexShader&&void 0!=this.fragmentShader&&this.attachShaderProgram();this._loadedCount++}};f.attachShaderProgram=function(){this._isReady=!0;this.shaderProgram=this.gl.createProgram();this.gl.attachShader(this.shaderProgram,this.vertexShader);this.gl.attachShader(this.shaderProgram,this.fragmentShader);this.gl.linkProgram(this.shaderProgram)};f.bind=function(){this._isReady&&(this.gl.useProgram(this.shaderProgram),void 0==this.shaderProgram.pMatrixUniform&&
(this.shaderProgram.pMatrixUniform=this.gl.getUniformLocation(this.shaderProgram,"uPMatrix")),void 0==this.shaderProgram.mvMatrixUniform&&(this.shaderProgram.mvMatrixUniform=this.gl.getUniformLocation(this.shaderProgram,"uMVMatrix")),bongiovi.GLTool.setShader(this),bongiovi.GLTool.setShaderProgram(this.shaderProgram),this.uniformTextures=[])};f.isReady=function(){return this._isReady};f.uniform=function(c,e,f){if(this._isReady){"texture"==e&&(e="uniform1i");for(var m=!1,l,p=0;p<this.parameters.length;p++)if(l=
this.parameters[p],l.name==c){l.value=f;m=!0;break}m?this.shaderProgram[c]=l.uniformLoc:(this.shaderProgram[c]=this.gl.getUniformLocation(this.shaderProgram,c),this.parameters.push({name:c,type:e,value:f,uniformLoc:this.shaderProgram[c]}));if(-1==e.indexOf("Matrix"))this.gl[e](this.shaderProgram[c],f);else this.gl[e](this.shaderProgram[c],!1,f);"uniform1i"==e&&(this.uniformTextures[f]=this.shaderProgram[c])}};f.unbind=function(){};bongiovi.GLShader=c})();(function(){var c,f,g=function(e,g,l){l=l||{};c=bongiovi.GL.gl;f=bongiovi.GL;if(g)this.texture=e;else{this._source=e;this.texture=c.createTexture();this._isVideo="VIDEO"==e.tagName;this.magFilter=l.magFilter||c.LINEAR;this.minFilter=l.minFilter||c.LINEAR_MIPMAP_NEAREST;this.wrapS=l.wrapS||c.MIRRORED_REPEAT;this.wrapT=l.wrapT||c.MIRRORED_REPEAT;g=e.width||e.videoWidth;l=e.height||e.videoHeight;if(g){if(0==g||g&g-1||0==l||l&l-1)this.wrapS=this.wrapT=c.CLAMP_TO_EDGE,this.minFilter==c.LINEAR_MIPMAP_NEAREST&&
(this.minFilter=c.LINEAR),console.log(this.minFilter,c.LINEAR_MIPMAP_NEAREST,c.LINEAR)}else this.wrapS=this.wrapT=c.CLAMP_TO_EDGE,this.minFilter==c.LINEAR_MIPMAP_NEAREST&&(this.minFilter=c.LINEAR);c.bindTexture(c.TEXTURE_2D,this.texture);c.pixelStorei(c.UNPACK_FLIP_Y_WEBGL,!0);c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,e);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,this.magFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,this.minFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,
this.wrapS);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,this.wrapT);this.minFilter==c.LINEAR_MIPMAP_NEAREST&&c.generateMipmap(c.TEXTURE_2D);c.bindTexture(c.TEXTURE_2D,null)}},e=g.prototype;e.updateTexture=function(e){e&&(this._source=e);c.bindTexture(c.TEXTURE_2D,this.texture);c.pixelStorei(c.UNPACK_FLIP_Y_WEBGL,!0);c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,this._source);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,this.magFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,
this.minFilter);this.minFilter==c.LINEAR_MIPMAP_NEAREST&&c.generateMipmap(c.TEXTURE_2D);c.bindTexture(c.TEXTURE_2D,null)};e.bind=function(e,g){void 0==e&&(e=0);f.shader&&(c.activeTexture(c.TEXTURE0+e),c.bindTexture(c.TEXTURE_2D,this.texture),c.uniform1i(f.shader.uniformTextures[e],e),this._bindIndex=e)};e.unbind=function(){c.bindTexture(c.TEXTURE_2D,null)};bongiovi.GLTexture=g})();(function(){var c=function(c,e){this.shader=new bongiovi.GLShader(c,e);this._init()},f=c.prototype;f._init=function(){};f.render=function(){};bongiovi.View=c})();(function(){var c=bongiovi.View,f=function(e,f){c.call(this,e,f)},g=f.prototype=new c;g._init=function(){this.mesh=bongiovi.MeshUtils.createPlane(2,2,1)};g.render=function(c){this.shader.isReady()&&(this.shader.bind(),this.shader.uniform("texture","uniform1i",0),c.bind(0),bongiovi.GLTool.draw(this.mesh))};bongiovi.ViewCopy=f})();(function(){var c,f,g=bongiovi.GLTexture,e=function(e,g,k){f=bongiovi.GL;c=f.gl;k=k||{};this.width=e;this.height=g;this.magFilter=k.magFilter||c.LINEAR;this.minFilter=k.minFilter||c.LINEAR;this.wrapS=k.wrapS||c.MIRRORED_REPEAT;this.wrapT=k.wrapT||c.MIRRORED_REPEAT;if(0==e||e&e-1||0==g||g&g-1)this.wrapS=this.wrapT=c.CLAMP_TO_EDGE,this.minFilter==c.LINEAR_MIPMAP_NEAREST&&(this.minFilter=c.LINEAR);this._init()},k=e.prototype;k._init=function(){this.texture=c.createTexture();this.glTexture=new g(this.texture,
!0);this.frameBuffer=c.createFramebuffer();c.bindFramebuffer(c.FRAMEBUFFER,this.frameBuffer);this.frameBuffer.width=this.width;this.frameBuffer.height=this.height;c.bindTexture(c.TEXTURE_2D,this.texture);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,this.magFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,this.minFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE);f.depthTextureExt?c.texImage2D(c.TEXTURE_2D,
0,c.RGBA,this.frameBuffer.width,this.frameBuffer.height,0,c.RGBA,c.FLOAT,null):c.texImage2D(c.TEXTURE_2D,0,c.RGBA,this.frameBuffer.width,this.frameBuffer.height,0,c.RGBA,c.UNSIGNED_BYTE,null);this.minFilter==c.LINEAR_MIPMAP_NEAREST&&c.generateMipmap(c.TEXTURE_2D);c.framebufferTexture2D(c.FRAMEBUFFER,c.COLOR_ATTACHMENT0,c.TEXTURE_2D,this.texture,0);if(null==f.depthTextureExt){var e=c.createRenderbuffer();c.bindRenderbuffer(c.RENDERBUFFER,e);c.renderbufferStorage(c.RENDERBUFFER,c.RGBA4,this.frameBuffer.width,
this.frameBuffer.height)}else this.depthTexture=c.createTexture(),this.glDepthTexture=new g(this.depthTexture,!0),c.bindTexture(c.TEXTURE_2D,this.depthTexture),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,c.NEAREST),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,c.NEAREST),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE),c.texImage2D(c.TEXTURE_2D,0,c.DEPTH_COMPONENT,this.width,this.height,0,c.DEPTH_COMPONENT,c.UNSIGNED_SHORT,
null),c.framebufferTexture2D(c.FRAMEBUFFER,c.DEPTH_ATTACHMENT,c.TEXTURE_2D,this.depthTexture,0);c.bindTexture(c.TEXTURE_2D,null);c.bindRenderbuffer(c.RENDERBUFFER,null);c.bindFramebuffer(c.FRAMEBUFFER,null)};k.bind=function(){c.bindFramebuffer(c.FRAMEBUFFER,this.frameBuffer)};k.unbind=function(){c.bindFramebuffer(c.FRAMEBUFFER,null)};k.getTexture=function(){return this.glTexture};k.getDepthTexture=function(){return this.glDepthTexture};bongiovi.FrameBuffer=e})();(function(){var c,f=function(e,f,g){c=bongiovi.GL;void 0!=e&&(this.view="string"==typeof e?new bongiovi.ViewCopy(null,e):e,this.width=void 0==f?512:f,this.height=void 0==g?512:g,this._init())},g=f.prototype;g._init=function(){this.fbo=new bongiovi.FrameBuffer(this.width,this.height);this.fbo.bind();c.setViewport(0,0,this.fbo.width,this.fbo.height);c.clear(0,0,0,0);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height)};g.render=function(e){this.fbo.bind();c.setViewport(0,0,this.fbo.width,
this.fbo.height);c.clear(0,0,0,0);this.view.render(e);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height);return this.fbo.getTexture()};g.getTexture=function(){return this.fbo.getTexture()};bongiovi.Pass=f})();(function(c){c=function(){this._passes=[]};var f=c.prototype=new bongiovi.Pass;f.addPass=function(c){this._passes.push(c)};f.render=function(c){this.texture=c;for(c=0;c<this._passes.length;c++)this.texture=this._passes[c].render(this.texture);return this.texture};f.getTexture=function(){return this.texture};bongiovi.EffectComposer=c})();(function(){bongiovi.MeshUtils={};bongiovi.MeshUtils.createPlane=function(c,f,g){var e=[],k=[],m=[],l=c/g,p=f/g,r=1/g,n=0;c=0.5*-c;f=0.5*-f;for(var q=0;q<g;q++)for(var x=0;x<g;x++){var w=l*q+c,s=p*x+f;e.push([w,s,0]);e.push([w+l,s,0]);e.push([w+l,s+p,0]);e.push([w,s+p,0]);w=q/g;s=x/g;k.push([w,s]);k.push([w+r,s]);k.push([w+r,s+r]);k.push([w,s+r]);m.push(4*n+0);m.push(4*n+1);m.push(4*n+2);m.push(4*n+0);m.push(4*n+2);m.push(4*n+3);n++}g=new bongiovi.Mesh(e.length,m.length,bongiovi.GLTool.gl.TRIANGLES);
g.bufferVertex(e);g.bufferTexCoords(k);g.bufferIndices(m);return g};bongiovi.MeshUtils.createSphere=function(c,f){for(var g=[],e=[],k=[],m=0,l=1/f,p=function(e,g){var a=e/f*Math.PI-0.5*Math.PI,b=g/f*Math.PI*2,d=[];d[1]=Math.sin(a)*c;a=Math.cos(a)*c;d[0]=Math.cos(b)*a;d[2]=Math.sin(b)*a;return d},r=0;r<f;r++)for(var n=0;n<f;n++){g.push(p(r,n));g.push(p(r+1,n));g.push(p(r+1,n+1));g.push(p(r,n+1));var q=n/f,x=r/f;e.push([1-q,x]);e.push([1-q,x+l]);e.push([1-q-l,x+l]);e.push([1-q-l,x]);k.push(4*m+0);k.push(4*
m+1);k.push(4*m+2);k.push(4*m+0);k.push(4*m+2);k.push(4*m+3);m++}m=new bongiovi.Mesh(g.length,k.length,bongiovi.GLTool.gl.TRIANGLES);m.bufferVertex(g);m.bufferTexCoords(e);m.bufferIndices(k);return m};bongiovi.MeshUtils.createCube=function(c,f){}})();

},{}]},{},[1]);
