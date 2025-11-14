/*
 * Script to draw a face that can be translated, scaled
 * and rotated around a pivot
 * 
 * Each object is independently defined and drawn.
 * Face transformations are applied to all face objects
 * except the pivot.
 * 
 * Diego Córdova Rodríguez, A01781166
 * 2025-11-14
 */

'use strict';

import * as twgl from 'twgl-base.js/dist/5.x/twgl.js';
import { M3 } from './A01781166-2d-libs.js';
import GUI from 'lil-gui';

// Define the shader code, using GLSL 3.00

const vsGLSL = `#version 300 es
in vec2 a_position;

uniform vec2 u_resolution;
uniform mat3 u_transforms;

void main() {
    // Multiply the matrix by the vector, adding 1 to the vector to make
    // it the correct size. Then keep only the two first components
    vec2 position = (u_transforms * vec3(a_position, 1)).xy;

    // Convert the position from pixels to 0.0 - 1.0
    vec2 zeroToOne = position / u_resolution;

    // Convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // Convert from 0->2 to -1->1 (clip space)
    vec2 clipSpace = zeroToTwo - 1.0;

    // Invert Y axis
    //gl_Position = vec4(clipSpace[0], clipSpace[1] * -1.0, 0, 1);
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}
`;

const fsGLSL = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 outColor;

void main() {
    outColor = u_color;
}
`;

// Class to create 2D objects and store their data
class Object2D {
    constructor(
        id,
        position=[0, 0],
        rotation=[0, 0, 0],
        scale=[1, 1],
        color=[Math.random(), Math.random(), Math.random(), 1.0],
        arrays = {
            a_position: { numComponents: 2, data: [] },
            a_color: { numComponents: 4, data: [] },
            indices: { numComponents: 3, data: [] }
        }) {

        this.id = id;
        
        // Initial transformations
        this.position = {
            x: position[0],
            y: position[1],
        };
        this.rotDeg = {
            x: rotation[0],
            y: rotation[1],
            z: rotation[2],
        };
        this.rotRad = {
            x: rotation[0] * Math.PI / 180,
            y: rotation[1] * Math.PI / 180,
            z: rotation[2] * Math.PI / 180,
        };
        this.scale = {
            x: scale[0],
            y: scale[1],
        };

        this.matrix = M3.identity();

        // Materials and colors
        this.color = color;

        // Properties for rendering in WebGL
        this.arrays = arrays;
        this.bufferInfo = undefined;
        this.vao = undefined;
    }

    setPosition(position) {
        this.position = {
            x: position[0],
            y: position[1],
        };
    }

    setRotation(rotation) {
        this.rotDeg = rotation;
        this.rotRad = rotation * Math.PI / 180;
    }

    setScale(scale) {
        this.scale = {
            x: scale[0],
            y: scale[1],
        };
    }

    // Return the position as an array
    get posArray() {
        return [this.position.x, this.position.y];
    }

    // Return the scale as an array
    get scaArray() {
        return [this.scale.x, this.scale.y];
    }

    // Set up the WebGL components for an object
    prepareVAO(gl, programInfo, arrays) {
        this.arrays = arrays;
        this.bufferInfo = twgl.createBufferInfoFromArrays(gl, this.arrays);
        this.vao = twgl.createVAOFromBufferInfo(gl, programInfo, this.bufferInfo);
    }

    // Copy an existing vao
    // This should be used when multiple objects share the same model
    setVAO(vao, bufferInfo) {
        this.vao = vao;
        this.bufferInfo = bufferInfo;
    }
};

// Structure for the global data of all objects
// This data will be modified by the UI and used by the renderer
const objects = {
    back: new Object2D(
        'back',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [0.5, 0.2, 0.2, 1] // Dark Red
    ),
    face: new Object2D(
        'face',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [1, 0.8, 0.3, 1], // Yellow
    ),
    leftEye: new Object2D(
        'leftEye',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [0.5, 0.2, 0.2, 1] // Dark Red
    ),
    rightEye: new Object2D(
        'rightEye',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [0.5, 0.2, 0.2, 1] // Dark Red
    ),
    blushLeft: new Object2D(
        'blushLeft',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [1, 0.5, 0.5, 1] // Light Red
    ),
    blushRight: new Object2D(
        'blushLeft',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [1, 0.5, 0.5, 1] // Light Red
    ),
    mouth: new Object2D(
        'mouth',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [0.5, 0.2, 0.2, 1] // Dark Red
    ),
    pivot: new Object2D(
        'pivot',
        [0, 0],
        [0, 0, 0],
        [1, 1],
        [0.3, 0.3, 0.3, 1], // Dark Gray
    ),
}

// Function to generate the arrays used to draw a face
// Includes the back, face, eyes and mouth
// Returns an object with the arrays for each part of the face
function generateFaceData(faceSides, faceRadius, eyeSides, eyeRadius) {

    // Face
    const innerRadius = faceRadius * 0.9; // Slightly smaller than the back
    let back = generateData(faceSides, faceRadius, 0, 0);
    let face = generateData(faceSides, innerRadius, 0, 0);

    // Eyes
    let leftEye = generateData(eyeSides, eyeRadius, -35, -20);
    let rightEye = generateData(eyeSides, eyeRadius, 35, -20);

    // Blushes
    // (Using the same data as the eyes, just changing position)
    let blushLeft = generateData(eyeSides, eyeRadius * 1.5, -60, 5);
    let blushRight = generateData(eyeSides, eyeRadius * 1.5, 60, 5);

    // Mouth
    let mouth = generateMouthData();

    return { back, face, leftEye, rightEye, blushLeft, blushRight, mouth };
}

// Create the data for the vertices of the polyton, as an object with two arrays
// Returns array with positions, colors and indexes
function generateData(sides, radius, centerX, centerY) {

    // The arrays are initially empty
    let arrays = {
        // Two components for each position in 2D
        a_position: { numComponents: 2, data: [] },
        // Four components for a color (RGBA)
        a_color:    { numComponents: 4, data: [] },
        // Three components for each triangle, the 3 vertices
        indices:  { numComponents: 3, data: [] }
    };

    // Initialize the center vertex, at the origin and with white color
    arrays.a_position.data.push(centerX);
    arrays.a_position.data.push(centerY);
    arrays.a_color.data.push(1);
    arrays.a_color.data.push(1);
    arrays.a_color.data.push(1);
    arrays.a_color.data.push(1);

    // Angle step between each side
    let angleStep = 2 * Math.PI / sides;

    // Loop over the sides to create the rest of the vertices
    for (let s=0; s<sides; s++) {
        let angle = angleStep * s;

        // Generate the coordinates of the vertex
        // Add center to move it to the desired position
        // Multiply by radius to set the size
        let x = centerX + Math.cos(angle) * radius;
        let y = centerY + Math.sin(angle) * radius;
        arrays.a_position.data.push(x);
        arrays.a_position.data.push(y);

        // Color
        arrays.a_color.data.push(1);
        arrays.a_color.data.push(1);
        arrays.a_color.data.push(1);
        arrays.a_color.data.push(1);

        // Define the triangles, in counter clockwise order
        arrays.indices.data.push(0);
        arrays.indices.data.push(s + 1);
        arrays.indices.data.push(((s + 2) <= sides) ? (s + 2) : 1);
    }
    return arrays;
}

// Function to generate the mouth data for the face
// Returns array with positions, colors and indexes
function generateMouthData() {
    let arrays = {
        a_position: {
            numComponents: 2,
            data: [
                // Left side
                -45, 20,
                -30, 40,
                -10, 35,
                // Center
                0, 50,
                // Right side
                10, 35,
                30, 40,
                45, 20,
            ]
        },
        a_color: {
            numComponents: 4,
            data: [
                // Black
                0, 0, 0, 1,
                0, 0, 0, 1,
                0, 0, 0, 1,
                0, 0, 0, 1,
                0, 0, 0, 1,
                0, 0, 0, 1,
            ]
        },
        indices: {
            numComponents: 3,
            data: [
                0, 1, 2,
                1, 2, 3,
                2, 3, 4,
                3, 4, 5,
                4, 5, 6,
            ]
        },
    };
    return arrays;
}

// Initialize the WebGL environmnet
function main() {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Generate arrays for the objects
    const faceData = generateFaceData(30, 110, 10, 10);
    const pivotArrays = generateData(4, 30, 0, 0);

    // Assign arrays to each object
    objects.pivot.arrays = pivotArrays;
    objects.back.arrays = faceData.back;
    objects.face.arrays = faceData.face;
    objects.leftEye.arrays = faceData.leftEye;
    objects.rightEye.arrays = faceData.rightEye;
    objects.blushLeft.arrays = faceData.blushLeft;
    objects.blushRight.arrays = faceData.blushRight;
    objects.mouth.arrays = faceData.mouth;

    // Set initial positions
    objects.pivot.setPosition([(gl.canvas.width / 10) * 4, gl.canvas.height / 2]);
    objects.face.setPosition([(gl.canvas.width / 10) * 6, gl.canvas.height / 2]);
    
    // Other objects have position relative to the face
    objects.back.setPosition(objects.face.posArray);
    objects.leftEye.setPosition(objects.face.posArray);
    objects.rightEye.setPosition(objects.face.posArray);
    objects.mouth.setPosition(objects.face.posArray);

    setupUI(gl);

    const programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);
    
    // Generate buffer and vao for each object
    for (const object of Object.values(objects)) {
        object.prepareVAO(gl, programInfo, object.arrays);
    }

    drawScene(gl, programInfo);
}

// Function to do the actual display of the objects
function drawScene(gl, programInfo) {
    gl.useProgram(programInfo.program);

    // Draw each object
    for (const object of Object.values(objects)) {
        let transforms = M3.identity();

        if (object.id === 'pivot') {
            // Only translation for the pivot
            transforms = M3.multiply(M3.translation(object.posArray), transforms);
        } else {
            // Apply scale and translation
            // Based on the face object, since its the "parent" of the others
            transforms = M3.multiply(M3.scale(objects.face.scaArray), transforms);
            transforms = M3.multiply(M3.translation(objects.face.posArray), transforms);

            // Move pivot to the origin
            transforms = M3.multiply(M3.translation([-objects.pivot.position.x, -objects.pivot.position.y]), transforms);
            // Apply rotation
            transforms = M3.multiply(M3.rotation(objects.face.rotRad.z), transforms);
            // Move pivot back to its position
            transforms = M3.multiply(M3.translation(objects.pivot.posArray), transforms);
        }

        let uniforms = {
            u_resolution: [gl.canvas.width, gl.canvas.height],
            u_transforms: transforms,
            u_color: object.color,
        }
        
        twgl.setUniforms(programInfo, uniforms);
        gl.bindVertexArray(object.vao);
        twgl.drawBufferInfo(gl, object.bufferInfo);
    }

    requestAnimationFrame(() => drawScene(gl, programInfo));
}

// Setup the UI using lil-gui
// Adding custom names: https://lil-gui.georgealways.com/#Controller#name
function setupUI(gl) {
    const gui = new GUI();

    // Face controls
    const faceFolder = gui.addFolder('Face');
    
    // Face Translation
    const traFolder = faceFolder.addFolder('Translation');
    traFolder.add(objects.face.position, 'x', 0, gl.canvas.width);
    traFolder.add(objects.face.position, 'y', 0, gl.canvas.height);

    // Face Rotation
    const rotFolder = faceFolder.addFolder('Rotation');
    rotFolder.add(objects.face.rotRad, 'z', -Math.PI * 2, Math.PI * 2).name('z');

    // Face Scale
    const scaFolder = faceFolder.addFolder('Scale');
    scaFolder.add(objects.face.scale, 'x', -5, 5);
    scaFolder.add(objects.face.scale, 'y', -5, 5);

    // Face Colors
    const faceColorFolder = faceFolder.addFolder('Colors');
    faceColorFolder.addColor(objects.face, 'color').name('Face');
    faceColorFolder.addColor(objects.leftEye, 'color').name('Others').onChange((value) => {
        objects.rightEye.color = value;
        objects.mouth.color = value;
        objects.back.color = value;
    });
    faceColorFolder.addColor(objects.blushLeft, 'color').name('Blush').onChange((value) => {
        objects.blushRight.color = value;
    });

    // Pivot controls
    const pivotFolder = gui.addFolder('Pivot');
    const pivotTraFolder = pivotFolder.addFolder('Translation');
    pivotTraFolder.add(objects.pivot.position, 'x', 0, gl.canvas.width);
    pivotTraFolder.add(objects.pivot.position, 'y', 0, gl.canvas.height);

    // Color controls
    const colorFolder = pivotFolder.addFolder('Colors');
    colorFolder.addColor(objects.pivot, 'color').name('Pivot Color');
}

main()