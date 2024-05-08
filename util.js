class WebGLUtils {
    getGLContext = (canvas) => { // takes a canvas element as input 
        var gl = canvas.getContext('webgl2');
        //0.0 -> 1.0
        gl.clearColor(1.0, 1.0, 1.0, 1.0); //sets the clear color for the context to white 
        gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT); //clears the color and depth buffers to ensure a clean slate for drawing the next scene.
        return gl; //returns a WebGL rendering context
    }

    getShader = (gl, shaderSource, shaderType) => { //compiles a shader from the provided source code and shader type (vertex or fragment)
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
        }
        return shader; //returns the compiled shader object.
    }

    getProgram = (gl, vertexShaderSource, fragmentShaderSource) => { //creates a shader program by compiling and linking the provided vertex and fragment shaders
        var vs = this.getShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        var fs = this.getShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);        
        var program = gl.createProgram();//creating a shader program object
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
        }
        return program; //returns the compiled program object.
    }

    createAndBindBuffer = (bufferType, typeOfDrawing, data) => { 
        var buffer = gl.createBuffer(); //creates a buffer object for storing data on the GPU
        gl.bindBuffer(bufferType, buffer); //binds a buffer object 
        gl.bufferData(bufferType, data, typeOfDrawing); //fills the buffer with the provided data 
        gl.bindBuffer(bufferType, null);//To release the memory
        return buffer; //returns the buffer object.
    }

    createAndBindTexture = (gl, image) => { 
        var texture = gl.createTexture(); //creates a texture object for storing image data on the GPU
        gl.bindTexture(gl.TEXTURE_2D, texture); //binds a target texture object
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);//Send image from CPU to GPU. This is a heavy call. 6 Parameter (Target, Level, Internal Format, Format, Data Type, The Data itself)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);//3 Parameter (Target, Parameter Name, Parameter Value)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);//3 Parameter (Target, Parameter Name, Parameter Value)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);//3 Parameter (Target, Parameter Name, Parameter Value). CLAMP_TO_EDGE is going to stretch your image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);//3 Parameter (Target, Parameter Name, Parameter Value). CLAMP_TO_EDGE is going to stretch your image.
        gl.bindTexture(gl.TEXTURE_2D, null);//To release the memory
        return texture; //returns the texture object.
    }

    createAndBindFramebuffer = (gl, image) => {
        var texture = this.createAndBindTexture(gl, image);// creates and binds a texture to be used as the color attachment for the framebuffer.
        var framebuffer = gl.createFramebuffer(); //creates a framebuffer object for offscreen rendering
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); //binds a framebuffer object
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
            texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return {fb : framebuffer, tex : texture};
    }

    linkGPUAndCPU = (obj, gl) => {
        var position = gl.getAttribLocation(obj.program, obj.gpuVariable);
        gl.enableVertexAttribArray(position);
        gl.bindBuffer(obj.channel || gl.ARRAY_BUFFER, obj.buffer);
        gl.vertexAttribPointer(position, obj.dims, obj.dataType || gl.FLOAT, //sets up the vertex attribute pointer.
            obj.normalize || gl.FALSE, obj.stride || 0, obj.offset || 0);
        return position;
    }

    //-1.0 -> 1.0 -> 0.0->1.0
    //0.0->1.0 -> 0.0->2.0
    //1.0 -> -1.0->1.0
    getGPUCoords = (obj) => { //converts screen coordinates to normalized device coordinates (-1.0 to 1.0)
        return {
            startX : -1.0 + obj.startX/gl.canvas.width * 2,
            startY : -1.0 + obj.startY/gl.canvas.height * 2,
            endX : -1.0 + obj.endX/gl.canvas.width * 2,
            endY : -1.0 + obj.endY/gl.canvas.height * 2
        };
    };

    //Input -> -1.0 -> 1.0
    //Output -> 0.0 -> 2.0
    getGPUCoords0To2 = (obj) => { //converts screen coordinates to texture coordinates (0.0 to 2.0).
        return {
            startX : 1.0 + obj.startX,
            startY : 1.0 + obj.startY,
            endX : 1.0 + obj.endX,
            endY : 1.0 + obj.endY
        };
    };

    getTextureColor = (obj) => { //converts screen coordinates to color values for texture sampling
        return {
            red : obj.startX/gl.canvas.width,
            green : obj.startY/gl.canvas.height,
            blue : obj.endX/gl.canvas.width,
            alpha : obj.endY/gl.canvas.height
        };
    };

    getCircleCoordinates = (centerX, centerY, radiusX, numOfPoints, isLine) => { //calculates the coordinates of points on a circle
        var circleCoords = [];
        var radiusY = radiusX/gl.canvas.height * gl.canvas.width;
        for (var i = 0; i < numOfPoints; i++) {
            //2*Math.PI*r
            var circumference = 2 * Math.PI * (i/numOfPoints);
            var x = centerX + radiusX * Math.cos(circumference);
            var y = centerY + radiusY * Math.sin(circumference);
            if (isLine) { //If isLine is true, it adds additional points to draw lines between consecutive points.
                circleCoords.push(centerX, centerY);  
            }
            circleCoords.push(x, y);
        }
        return circleCoords;
    };

    prepareRectVec2 = (startX, startY, endX, endY) => { //prepares vertex coordinates for drawing a rectangle.
        return [startX, startY, endX, startY, startX, endY, 
            startX, endY, endX, endY, endX, startY];
    };

    getAspectRatio = (gl, img) => { //calculates the aspect ratio of an image and adjusts its rendering position and size to fit within the canvas while preserving aspect ratio.
        var cols = img.width;
        var rows = img.height;
        var imageAR = cols/rows;
        var canvasAR = gl.canvas.width/gl.canvas.height;
        var startX, startY, renderableW, renderableH;
        if (imageAR < canvasAR) {
            renderableH = gl.canvas.height;
            renderableW = cols * (renderableH/rows);
            startX = (gl.canvas.width - renderableW)/2;
            startY = 0;
        } else if (imageAR > canvasAR) {
            renderableW = gl.canvas.width;
            renderableH = rows * (renderableW/cols);
            startX = 0;
            startY = (gl.canvas.height - renderableH)/2;
        } else {
            startX = 0; startY = 0;
            renderableW = gl.canvas.width;
            renderableH = gl.canvas.height;
        }
        return {
            x1 : startX, y1 : startY,
            x2 : startX + renderableW, y2 : startY + renderableH
        }
    };


}