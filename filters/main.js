// Import the WebGLUtils library and create a canvas element
var utils = new WebGLUtils();
var canvas = document.getElementById('canvas');

// Set the canvas dimensions to match the window size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Get the WebGL context for the canvas and set the clear color
var gl = utils.getGLContext(canvas);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

// Define the convolution kernels
var kernels = {
    edgeEnhancement: [-1, -1, -1, -1, 10, -1, -1, -1, -1],
    sobelHorizontal: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
    sobelVertical: [-1, 0, 1, -2, 0, 2, -1, 0, 1]
};

//Step1:
// Define the vertex shader
var vertexShader = `#version 300 es
precision mediump float;
in vec2 position;//vertices : WebGL vertex coordinates
in vec2 texCoords;// Texture coordinates
out vec2 textureCoords; //Take input from vertex shader and serve to fragment shader
void main () {
    gl_Position = vec4(position.x, position.y * -1.0, 0.0, 1.0);
    textureCoords = texCoords;
}
`;

// Define the fragment shader
var fragmentShader = `#version 300 es
precision mediump float;
in vec2 textureCoords;
uniform sampler2D uImage;
uniform float activeIndex, uKernel[9], kernelWeight;
out vec4 color;
uniform bool isGrayscale, isInverse, isKernel;

// Function to apply convolution kernel
vec4 applyKernel () {
    // Retrieve the dimensions of the texture
    ivec2 dims = textureSize(uImage, 0); //textureSize is available in WehGL2 but not in WebGL
    
    // Calculate the factor by which to move between adjacent pixels
    vec2 pixelJumpFactor = 1.0/vec2(dims);
    
    // Apply the convolution kernel to each pixel in the neighborhood
    vec4 values =
        texture(uImage, textureCoords + pixelJumpFactor * vec2(-1, -1)) * uKernel[0] +
        texture(uImage, textureCoords + pixelJumpFactor * vec2(0, -1)) * uKernel[1] + 
        texture(uImage, textureCoords + pixelJumpFactor * vec2(1, -1)) * uKernel[2] + 
        texture(uImage, textureCoords + pixelJumpFactor * vec2(-1,  0)) * uKernel[3] +
        texture(uImage, textureCoords + pixelJumpFactor * vec2(0,  0)) * uKernel[4] + 
        texture(uImage, textureCoords + pixelJumpFactor * vec2(1,  0)) * uKernel[5] + 
        texture(uImage, textureCoords + pixelJumpFactor * vec2(-1,  1)) * uKernel[6] + 
        texture(uImage, textureCoords + pixelJumpFactor * vec2(0,  1)) * uKernel[7] + 
        texture(uImage, textureCoords  + pixelJumpFactor * vec2(1,  1)) * uKernel[8];
    
    // Normalize the result by the kernel weight and return
    vec4 updatedPixels = vec4(vec3((values/kernelWeight).rgb), 1.0);
    return updatedPixels;
}

void main() {
    vec4 tex1 = texture(uImage, textureCoords);
    if (isGrayscale) {
        // Convert to grayscale
        float newPixelVal = tex1.r * 0.59 +  tex1.g * 0.30 +  tex1.b * 0.11;
        tex1 = vec4(vec3(newPixelVal), 1.0);
    } else if (isInverse) {
        // Invert colors
        tex1 = vec4(1.0 - tex1.rgb, 1.0);
    } else if (isKernel) {
        // Apply convolution kernel
        tex1 = applyKernel();
    }
    color = tex1;
}
`;

//Step2
// Create the shader program
var program = utils.getProgram(gl, vertexShader, fragmentShader);

//Step3
// Define variables and buffers
var currSX = -1.0, currSY = -1.0, currEX = 1.0 , currEY = 1.0;
var lastSX = -1.0, lastSY = -1.0, lastEX = 1.0 , lastEY = 1.0;
var vertices = utils.prepareRectVec2(currSX, currSY, currEX, currEY);
var textureCoordinates = utils.prepareRectVec2(0.0, 0.0, 1.0, 1.0);

var buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
var texBuffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(textureCoordinates));

// Function to get GPU coordinates
var getCoords = () => {
    var obj = {
        startX : AR.x1, startY : AR.y1, endX : AR.x2, endY : AR.y2
    };
    return utils.getGPUCoords(obj); //-1 to +1
};

// Load image and set up texture
var texture;
var image = new Image();
var AR = null;
image.src = '../4KSample.jpg';
image.onload = () => {
    AR = utils.getAspectRatio(gl, image);
    var v = getCoords();
    vertices = utils.prepareRectVec2(v.startX, v.startY, v.endX, v.endY);
    buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
    texture = utils.createAndBindTexture(gl, image);
    render();
};
gl.useProgram(program);
var uImage = gl.getUniformLocation(program, 'uImage');
gl.uniform1i(uImage, 0);

// Render function
var render = () => {
    //Step4
    utils.linkGPUAndCPU({program : program, buffer : buffer, dims : 2, gpuVariable : 'position'}, gl);
    utils.linkGPUAndCPU({program : program, buffer : texBuffer, dims : 2, gpuVariable : 'texCoords'}, gl);
    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    //Step5
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length/2);
};

// Function to calculate difference in coordinates
var getDiff = (startX, startY, endX, endY) => {
    var obj = {
        startX : startX, startY : startY, endX : endX, endY
    };
    var v = utils.getGPUCoords(obj); //-1 to +1
    v = utils.getGPUCoords0To2(v); //0 to 2
    var diffX = v.endX - v.startX;
    var diffY = v.endY - v.startY;
    return {
        x : diffX, y : diffY
    };  
};

// Initialize mouse events for interaction
initializeEvents(gl,
    // Callback for moving or resizing start
    (startX, startY, endX, endY) => {
    var diff = getDiff(startX, startY, endX, endY);
    currSX += diff.x; currSY += diff.y;
    currEX += diff.x; currEY += diff.y;
    vertices = utils.prepareRectVec2(currSX, currSY, currEX, currEY);
    buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
    render();
    currSX = lastSX; currSY = lastSY; currEX = lastEX; currEY = lastEY;
    },
    // Callback for moving or resizing end
    (startX, startY, endX, endY) => {
    var diff = getDiff(startX, startY, endX, endY);
    lastSX += diff.x; lastSY += diff.y;
    lastEX += diff.x; lastEY += diff.y;
    currSX = lastSX; currSY = lastSY; currEX = lastEX; currEY = lastEY;
    },
    // Callback for zooming
    (deltaY) => {
    if (deltaY > 0) {
        //zoom out
        currSX -= currSX * 0.10; currEX -= currEX * 0.10; 
        currSY -= currSY * 0.10; currEY -= currEY * 0.10; 
    } else {
        //zoom in
        currSX += currSX * 0.10; currEX += currEX * 0.10; 
        currSY += currSY * 0.10; currEY += currEY * 0.10; 
    }
    vertices = utils.prepareRectVec2(currSX, currSY, currEX, currEY);
    buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
    render();
});

// Event handlers for buttons
var grayscale = document.getElementById('grayscale');
var inverse = document.getElementById('inverse');
var reset = document.getElementById('reset');
var kernel = document.getElementById('kernel');

// Get uniform locations for shader variables controlling image processing
var isGrayscale = gl.getUniformLocation(program, 'isGrayscale');
var isInverse = gl.getUniformLocation(program, 'isInverse');
var isKernel = gl.getUniformLocation(program, 'isKernel');

// Function to handle grayscale button click
grayscale.onclick = () => {
    var v1 = performance.now();
    gl.uniform1f(isKernel, 0.0);
    gl.uniform1f(isInverse, 0.0);
    gl.uniform1f(isGrayscale, 1.0);
    render();
    var v2 = performance.now();
    console.log(v2 - v1);
};

// Function to handle kernel button click
kernel.onclick = () => {
    gl.uniform1f(isKernel, 1.0);
    gl.uniform1f(isInverse, 0.0);
    gl.uniform1f(isGrayscale, 0.0);
    var kernelWeight = gl.getUniformLocation(program, 'kernelWeight');
    var ker = gl.getUniformLocation(program, 'uKernel[0]');
    //Calculates the sum of all the elements in the edgeEnhancement convolution kernel array, and the result is passed to the kernelWeight uniform in the shader program using gl.uniform1f.
    gl.uniform1f(kernelWeight, kernels.edgeEnhancement.reduce((a, b) => a + b));  
    gl.uniform1fv(ker, kernels.edgeEnhancement);
    render();
};

// Function to handle inverse button click
inverse.onclick = () => {
    var v1 = performance.now();
    gl.uniform1f(isKernel, 0.0);
    gl.uniform1f(isGrayscale, 0.0);
    gl.uniform1f(isInverse, 1.0);
    render();
    var v2 = performance.now();
    console.log(v2 - v1);
};

// Function to handle reset button click
reset.onclick = () => {
    gl.uniform1f(isKernel, 0.0);
    gl.uniform1f(isInverse, 0.0);
    gl.uniform1f(isGrayscale, 0.0);
    render();
};