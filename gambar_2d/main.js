// Create a WebGLUtils object
var utils = new WebGLUtils();

// Get the canvas element and set its dimensions to match the window size
var canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Get the WebGL context
var gl = utils.getGLContext(canvas);

// Set the clear color to black
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

// Step 1: Define vertex and fragment shaders
var vertexShader = `#version 300 es
precision mediump float;
in vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = 2.0;
}`;

var fragmentShader = `#version 300 es
precision mediump float;
out vec4 color;
uniform vec3 inputColor;
void main () {
    color = vec4(inputColor, 1.0);
}`;

// Step 2: Create shader program
var program = utils.getProgram(gl, vertexShader, fragmentShader);

// Step 3: Create buffers for different shapes (circle, seconds hand, minute hand, hour hand)
var circleVertices = utils.getCircleCoordinates(0.0, 0.0, 0.3, 500); // For outer circle
var buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(circleVertices));

// Define an empty array to store vertices for the seconds hand
var secondsVertices = [];

// Loop through 60 times to generate vertices for each second
for (var i = 0; i < 60; i++) {
    // Calculate the angle (theta) for the current second
    var theta = (i / 60) * (2 * Math.PI);

    // Calculate the x and y coordinates of the current vertex
    var x = 0.27 * Math.cos(theta);
    var y = 0.27 * Math.sin(theta);

    // Calculate the angle (nextTheta) for the next second
    var nextTheta = ((i + 1) / 60) * (2 * Math.PI);

    // Calculate the x and y coordinates of the next vertex
    var nextX = 0.27 * Math.cos(nextTheta);
    var nextY = 0.27 * Math.sin(nextTheta);

    // Push the coordinates of the current vertex and the next vertex to the array
    secondsVertices.push(0.0, 0.0, x, y, nextX, nextY);
}

var secondsBuffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(utils.getCircleCoordinates(0.0, 0.0, 0.27, 60, true)));

var minuteBuffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(utils.getCircleCoordinates(0.0, 0.0, 0.24, 60, true)));

var hourBuffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(utils.getCircleCoordinates(0.0, 0.0, 0.18, 60, true)));       

// Step 4: Define functions to calculate line coordinates based on time
var getLineCoords = (input) => {
    var index = 0;
    var start = 15;
    if (input < start) {
        index = start - input;
    } else {
        index = 60 - input + start;
    }
    return index * 2;
};

// Step 5: Render loop, updating every second
setInterval( () => {
    var d = new Date();
    var hours = d.getHours() > 12 ? (d.getHours() - 12) : d.getHours();
    var minutes = d.getMinutes();
    var seconds = d.getSeconds();
    gl.useProgram(program);
   
    // Draw the outer circle
    utils.linkGPUAndCPU({
        program : program,
        buffer : buffer, 
        dims : 2,
        gpuVariable : 'position'
    }, gl);
    var inputCol = gl.getUniformLocation(program, 'inputColor');
    gl.uniform3fv(inputCol, [0.0, 0.0, 0.0]);
    gl.drawArrays(gl.POINTS, 0, circleVertices.length/2);

    // Draw the seconds hand
    gl.uniform3fv(inputCol, [0.5, 0.7, 1.0]); // Blue color
    utils.linkGPUAndCPU({
        program: program,
        buffer: secondsBuffer,
        dims: 2,
        gpuVariable: 'position'
    }, gl);
    gl.drawArrays(gl.TRIANGLES, 0, secondsVertices.length / 2);


    // Draw the seconds hand as a line
    gl.uniform3fv(inputCol, [1.0, 0.0, 0.0]); // Red color
    utils.linkGPUAndCPU({
        program : program,
        buffer : secondsBuffer, 
        dims : 2,
        gpuVariable : 'position'
    }, gl);
    gl.drawArrays(gl.LINES, getLineCoords(seconds), 2);
    
    // Draw the minute hand
    utils.linkGPUAndCPU({
        program : program,
        buffer : minuteBuffer, 
        dims : 2,
        gpuVariable : 'position'
    }, gl);
    gl.drawArrays(gl.LINES, getLineCoords(minutes), 2);

    // Draw the hour hand
    utils.linkGPUAndCPU({
        program : program,
        buffer : hourBuffer, 
        dims : 2,
        gpuVariable : 'position'
    }, gl);
    gl.drawArrays(gl.LINES, getLineCoords(hours * 5 + Math.floor(minutes/60)), 2);
}, 1000); // Update every second
