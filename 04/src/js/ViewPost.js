// ViewPost.js

var GL = bongiovi.GL;
var gl;

function ViewPost() {
	bongiovi.View.call(this, null, "assets/shaders/post.frag");
}

var p = ViewPost.prototype = new bongiovi.View();
p.constructor = ViewPost;


p._init = function() {
	gl = GL.gl;
	this.mesh = bongiovi.MeshUtils.createPlane(2, 2, 1);
};

p.render = function(texture, textureBg) {
	if(!this.shader.isReady() ) return;

	this.shader.bind();
	this.shader.uniform("texture", "uniform1i", 0);
	this.shader.uniform("textureBg", "uniform1i", 1);
	texture.bind(0);
	textureBg.bind(1);
	GL.draw(this.mesh);
};

module.exports = ViewPost;