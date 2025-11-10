/*
 * Script to draw a face that can be translated, scaled
 * and rotated around a pivot
 *
 * Diego Córdova Rodríguez, A01781166
 * 2025-11-14
 */


'use strict';

import * as twgl from 'twgl-base.js';
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

// Structure for the global data of all objects
// This data will be modified by the UI and used by the renderer
const objects = {
    pivot: {
        transforms: {
            t: {
                x: 0,
                y: 0,
                z: 0,
            },
            rr: {
                x: 0,
                y: 0,
                z: 0,
            },
            s: {
                x: 1,
                y: 1,
                z: 1,
            }
        },
        color: [0.3, 0.3, 0.3, 1], // Dark Gray
    },
    face: {
        transforms: {
            t: {
                x: 0,
                y: 0,
                z: 0,
            },
            rr: {
                x: 0,
                y: 0,
                z: 0,
            },
            s: {
                x: 1,
                y: 1,
                z: 1,
            }
        },
        color: [1, 0.73, 0, 1], // Yellow
    },
    others: {
        transforms: {
            t: {
                x: 0,
                y: 0,
                z: 0,
            },
            rr: {
                x: 0,
                y: 0,
                z: 0,
            },
            s: {
                x: 1,
                y: 1,
                z: 1,
            }
        },
        color: [0.5, 0.2, 0.2, 1], // Dark Red
    }
}

// Function to generate the arrays used to draw a face
// Includes the back, face, eyes and mouth
// Returns an object with the arrays for each part of the face
function generateFaceData() {

    // Face
    const faceSides = 30;
    const backRadius = 110;
    const faceRadius = 100;
    let back = generateData(faceSides, backRadius, 0, 0);
    let face = generateData(faceSides, faceRadius, 0, 0);

    // Eyes
    const eyeSides = 10;
    const eyeRadius = 10;
    let leftEye = generateData(eyeSides, eyeRadius, -35, -20);
    let rightEye = generateData(eyeSides, eyeRadius, 35, -20);

    // Mouth
    let mouth = generateMouthData();

    return { back, face, leftEye, rightEye, mouth };
}

// Create the data for the vertices of the polyton, as an object with two arrays
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

    console.log(arrays);
    return arrays;
}

// Function to generate the pivot data
// Returns array with positions, colors and indexes
function generatePivotData(size) {
    let arrays = {
        a_position: {
            numComponents: 2,
            data: [
                // A diamond shape
                size, 0,
                0, size,
                -size, 0,
                0, -size,
            ]
        },
        a_color: {
            numComponents: 4,
            data: [
                // Gray color
                0.3, 0.3, 0.3, 1,
                0.3, 0.3, 0.3, 1,
                0.3, 0.3, 0.3, 1,
                0.3, 0.3, 0.3, 1,
            ]
        },
        indices: {
            numComponents: 3,
            data: [
                // Front face
                0, 1, 2,
                2, 3, 0,
            ]
        }
    };

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

    // Set initial positions

    // Pivot
    objects.pivot.transforms.t.x = (gl.canvas.width / 10) * 4; // 4/10 of width
    objects.pivot.transforms.t.y = gl.canvas.height / 2;
    
    // Face
    objects.face.transforms.t.x = (gl.canvas.width / 10) * 6; // 6/10 of width
    objects.face.transforms.t.y = gl.canvas.height / 2;

    setupUI(gl);

    const programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    // Face arrays
    const arrays = generateFaceData();
    const backArrays = arrays.back;
    const faceArrays = arrays.face;
    const leftEyeArrays = arrays.leftEye;
    const rightEyeArrays = arrays.rightEye;
    const mouthArrays = arrays.mouth;

    // Pivot arrays
    const pivotArrays = generatePivotData(30);

    // List of all renderable objects
    // Used to generate buffers and vaos, and to draw the scene in loop
    const renderables = [
        {
            name: 'back',
            arrays: backArrays,
            color: objects.others.color,
        },
        {
            name: 'face',
            arrays: faceArrays,
            color: objects.face.color,
        },
        {
            name: 'leftEye',
            arrays: leftEyeArrays,
            color: objects.others.color,
        },
        {
            name: 'rightEye',
            arrays: rightEyeArrays,
            color: objects.others.color,
        },
        {
            name: 'mouth',
            arrays: mouthArrays,
            color: objects.others.color,
        },
        {
            name: 'pivot',
            arrays: pivotArrays,
            color: objects.pivot.color,
        },
    ];

    // Generate buffer and vao for each renderable
    renderables.forEach(object => {
        object.bufferInfo = twgl.createBufferInfoFromArrays(gl, object.arrays);
        object.vao = twgl.createVAOFromBufferInfo(gl, programInfo, object.bufferInfo);
    });

    drawScene(gl, programInfo, renderables);
}

// Function to do the actual display of the objects
function drawScene(gl, programInfo, renderables) {

    let translate = [objects.face.transforms.t.x, objects.face.transforms.t.y];
    let angle_radians = objects.face.transforms.rr.z;
    let scale = [objects.face.transforms.s.x, objects.face.transforms.s.y];
    let pivot = [objects.pivot.transforms.t.x, objects.pivot.transforms.t.y];

    // Create transform matrices
    const scaMat = M3.scale(scale);
    const rotMat = M3.rotation(angle_radians);
    const traMat = M3.translation(translate);

    /*
    // Create a composite matrix
    let transforms = M3.identity();
    transforms = M3.multiply(scaMat, transforms);
    transforms = M3.multiply(rotMat, transforms);
    transforms = M3.multiply(traMat, transforms);
    */

    gl.useProgram(programInfo.program);

    // Draw each object
    renderables.forEach(object => {
        // Create a composite matrix
        let transforms = M3.identity();

        if (object.name === 'pivot') {
            // Only translation for the pivot
            transforms = M3.multiply(M3.translation(pivot), transforms);
        } else {
            // Apply scale and translation
            transforms = M3.multiply(scaMat, transforms);
            transforms = M3.multiply(traMat, transforms);

            // Move pivot to the origin
            transforms = M3.multiply(M3.translation([-pivot[0], -pivot[1]]), transforms);
            // Apply rotation
            transforms = M3.multiply(rotMat, transforms);
            // Move pivot back to its position
            transforms = M3.multiply(M3.translation(pivot), transforms);
        }

        let uniforms = {
            u_resolution: [gl.canvas.width, gl.canvas.height],
            u_transforms: transforms,
            u_color: object.color,
        }
        
        twgl.setUniforms(programInfo, uniforms);
        gl.bindVertexArray(object.vao);
        twgl.drawBufferInfo(gl, object.bufferInfo);
    });

    requestAnimationFrame(() => drawScene(gl, programInfo, renderables));
}

// Setup the UI using lil-gui
// Adding custom names: https://lil-gui.georgealways.com/#Controller#name
function setupUI(gl) {
    const gui = new GUI();

    // Face controls
    const faceFolder = gui.addFolder('Face');
    
    // Face Translation
    const traFolder = faceFolder.addFolder('Translation');
    traFolder.add(objects.face.transforms.t, 'x', 0, gl.canvas.width);
    traFolder.add(objects.face.transforms.t, 'y', 0, gl.canvas.height);

    // Face Rotation
    const rotFolder = faceFolder.addFolder('Rotation');
    rotFolder.add(objects.face.transforms.rr, 'z', -Math.PI * 2, Math.PI * 2);

    // Face Scale
    const scaFolder = faceFolder.addFolder('Scale');
    scaFolder.add(objects.face.transforms.s, 'x', -5, 5);
    scaFolder.add(objects.face.transforms.s, 'y', -5, 5);

    // Face Colors
    const faceColorFolder = faceFolder.addFolder('Colors');
    faceColorFolder.addColor(objects.face, 'color').name('Face');
    faceColorFolder.addColor(objects.others, 'color').name('Eyes/Mouth');

    // Pivot controls
    const pivotFolder = gui.addFolder('Pivot');
    const pivotTraFolder = pivotFolder.addFolder('Translation');
    pivotTraFolder.add(objects.pivot.transforms.t, 'x', 0, gl.canvas.width);
    pivotTraFolder.add(objects.pivot.transforms.t, 'y', 0, gl.canvas.height);

    // Color controls
    const colorFolder = gui.addFolder('Colors');
    colorFolder.addColor(objects.pivot, 'color').name('Pivot Color');
}

main()