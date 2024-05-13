var utils = new WebGLUtils();
var canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var gl = utils.getGLContext(canvas);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

//Step1:
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

var fragmentShader = `#version 300 es
precision mediump float;
in vec2 textureCoords;
uniform sampler2D uImage, uCode;
uniform float activeIndex;
out vec4 color;
void main() {
    vec4 tex1 = texture(uImage, textureCoords);
    color = tex1;
}
`;

//Step2
var program = utils.getProgram(gl, vertexShader, fragmentShader);

//Step3
//initializing variables for Moving Textures
var currSX = -1.0, currSY = -1.0, currEX = 1.0 , currEY = 1.0;//Current Start X, Current End X, etc
var lastSX = -1.0, lastSY = -1.0, lastEX = 1.0 , lastEY = 1.0;
var vertices = utils.prepareRectVec2(currSX, currSY, currEX, currEY);
var textureCoordinates = utils.prepareRectVec2(0.0, 0.0, 1.0, 1.0);

// Create and bind buffer for vertices
var buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
// Create and bind buffer for texture coordinates
var texBuffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(textureCoordinates));

var mix = document.getElementById('mix');
gl.useProgram(program);
mix.onclick = () => {
    render();
};

// Function to get coordinates 
var getCoords = () => {
    var obj = {
        startX : AR.x1, startY : AR.y1, endX : AR.x2, endY : AR.y2
    };
    return utils.getGPUCoords(obj); //-1 to +1
};

// Load the image
var texture;
var image = new Image();
image.src = '../assets/rome.jpg';

var AR = null;
//event handler onload. When the first image is loaded, get aspect ratio, get coordinates, create and bind a texture
image.onload = () => {
    AR = utils.getAspectRatio(gl, image);
    var v = getCoords();
    vertices = utils.prepareRectVec2(v.startX, v.startY, v.endX, v.endY);
    buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
    texture = utils.createAndBindTexture(gl, image);
    render();
};

// Get the uniform locations for the textures
var uImage = gl.getUniformLocation(program, 'uImage');
var uCode = gl.getUniformLocation(program, 'uCode');

// Set the texture units for the uniforms
gl.uniform1i(uImage, 0);
gl.uniform1i(uCode, 1);

var render = () => {
    //Step4
    // Link vertex positions to the GPU
    utils.linkGPUAndCPU({ program: program, buffer: buffer, dims: 2, gpuVariable: 'position' }, gl);
    // Link texture coordinates to the GPU
    utils.linkGPUAndCPU({ program: program, buffer: texBuffer, dims: 2, gpuVariable: 'texCoords' }, gl);
    // Activate the texture unit and bind the first texture
    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    //Step5
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length/2);
};

//Calculates the differences between two sets of coordinates
var getDiff = (startX, startY, endX, endY) => {
    var obj = {
        startX : startX, startY : startY, endX : endX, endY
    };
    var v = utils.getGPUCoords(obj); //-1 to +1
    v = utils.getGPUCoords0To2(v); //0 to 2
    var diffX = v.endX - v.startX;
    var diffY = v.endY - v.startY;
    
    // Return an object containing the differences in x and y coordinates
    return {
        x : diffX, y : diffY
    };  
};

// Initialize events related to WebGL context
initializeEvents(gl,
    // Callback function for the start of an event (e.g., mouse click or touch start)
    (startX, startY, endX, endY) => {
        // Calculate the difference between start and end positions
        var diff = getDiff(startX, startY, endX, endY);
    
        // Update current start and end coordinates based on the difference
        currSX += diff.x;
        currSY += diff.y;
        currEX += diff.x;
        currEY += diff.y;
    
        // Prepare vertices for a rectangle using the updated coordinates
        vertices = utils.prepareRectVec2(currSX, currSY, currEX, currEY);
    
        // Create and bind buffer with the new vertices
        buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
    
        // Render the scene
        render();
    
        // Reset current start and end coordinates to last start and end coordinates
        currSX = lastSX;
        currSY = lastSY;
        currEX = lastEX;
        currEY = lastEY;
    },
    
    // Callback function for the end of an event (e.g., mouse release or touch end)
    (startX, startY, endX, endY) => {
    
        // Calculate the difference between the current and previous coordinates
        var diff = getDiff(startX, startY, endX, endY);
    
        // Update last start and end coordinates based on the difference
        lastSX += diff.x;
        lastSY += diff.y;
        lastEX += diff.x;
        lastEY += diff.y;

        // Update current start and end coordinates to last start and end coordinates
        currSX = lastSX; currSY = lastSY; currEX = lastEX; currEY = lastEY;
    },
    
    // Callback triggered when there is a zoom operation (scrolling)
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
        
    // Prepare new vertices for the rectangle based on updated positions   
    vertices = utils.prepareRectVec2(currSX, currSY, currEX, currEY);
        
    // Create and bind buffer with the new vertices
    buffer = utils.createAndBindBuffer(gl.ARRAY_BUFFER, gl.STATIC_DRAW, new Float32Array(vertices));
    
    // Render the scene
    render();
    }
);