/*
 * CG_2
 * 
 * This script is capable of generating 3D models in OBJ format using
 * different parameters, with the purpose of using it to generate
 * buildings with basic geometric shapes.
 * 
 * This script receives the following input parameters:
 * - Number of sides of the circle (integer between 3 and 36)
 * - Height of the building (positive float)
 * - Radius of the circle at the base (positive float)
 * - Radius of the circle at the top (positive float)
 * 
 * These arguments must be passed when executing the script:
 * node script.js <numSides> <height> <baseRadius> <topRadius>
 * 
 * Diego Córdova Rodríguez, A01781166
 * 2025-11-15
 */

'use strict';

import fs from 'fs'; // Module to handle files
import { V3 } from './A01781166-3d-lib.js';

// Function to get input parameters from command line
function getInputs() {
    // Ref: https://www.geeksforgeeks.org/node-js/how-to-parse-command-line-arguments-in-node-js/#method-1-using-processargv
    const args = process.argv.slice(2); // Skip first two default arguments (node) and (script.js)

    let numSides = args[0] ? parseInt(args[0]) : 8;
    let height = args[1] ? parseFloat(args[1]) : 6;
    let baseRadius = args[2] ? parseFloat(args[2]) : 1;
    let topRadius = args[3] ? parseFloat(args[3]) : 0.8;

    // Validate input parameters
    if (numSides < 3 || numSides > 36) {
        console.error("Invalid number of sides");
        process.exit(1);
    }
    if (height <= 0 || baseRadius <= 0 || topRadius <= 0) {
        console.error("Height and radius must be positive values");
        process.exit(1);
    }

    return { numSides, height, baseRadius, topRadius };
}

// Function to generate vertices for the model
// Returns an array with all vertices, each in format [x, y, z]
function vertices(numSides, height, baseRadius, topRadius) {
    const vertices = [];

    // Add center vertices for base and top
    vertices.push([0, 0, 0]);
    vertices.push([0, height, 0]);

    // Angle step between each side
    let angleStep = (2 * Math.PI) / numSides;

    // Generate vertices for base and top circles
    for (let i = 0; i < numSides; i++) {

        let angle = i * angleStep;
        
        let xBase = Math.cos(angle) * baseRadius;
        let zBase = Math.sin(angle) * baseRadius;
        vertices.push([xBase, 0, zBase]);

        let xTop = Math.cos(angle) * topRadius;
        let zTop = Math.sin(angle) * topRadius;
        vertices.push([xTop, height, zTop]);
    }

    return vertices
}

// Function to generate faces for the model
// Each face is oriented counter clockwise
// Returns an object with arrays for base, top and side faces
// Each face in format [v1, v2, v3]
function faces(numSides) {
    // Indexes for faces (1-based for OBJ format)
    // The first 2 vertices are the centers
    const centerBaseIdx = 1;
    const centerTopIdx = 2;

    // Base vertices start at index 3
    const baseStart = 3;
    // Top vertices start at index 4
    const topStart = 4;
    
    // Calculate faces
    const facesBase = [];
    const facesTop = [];
    const facesSides = [];

    for (let i = 0; i < numSides; i++) {

        // Get current and next vertex indexes for base
        const baseCurrent = baseStart + (2 * i); // 3, 5, 7, ...
        // If we are at the last vertex, return to the first
        const baseNext = (i === numSides - 1) ? baseStart : baseCurrent + 2; // 5, 7, 9, ...

        // Create triangles for the base
        // The indexes were created clockwise
        // So we have to reverse the order to make the normal point downwards
        // Face: center, next, current
        facesBase.push([centerBaseIdx, baseNext, baseCurrent]);

        // Get current and next vertex indexes for top
        const topCurrent = topStart + (2 * i); // 4, 6, 8, ...
        // If we are at the last vertex, return to the first
        const topNext = (i === numSides - 1) ? topStart : topCurrent + 2; // 6, 8, 10, ...

        // Create triangles for the top
        // The indexes were created clockwise
        // So we can use the order as is to make the normal point upwards
        // Face: center, current, next
        facesTop.push([centerTopIdx, topCurrent, topNext]);

        // Create two triangles for each side face
        // First triangle: baseCurrent, baseNext, topNext
        facesSides.push([baseCurrent, baseNext, topNext]);
        // Second triangle: baseCurrent, topNext, topCurrent
        facesSides.push([baseCurrent, topNext, topCurrent]);
    }

    return { facesBase, facesTop, facesSides };
}

// Function to generate normals for the model
// Returns an object with the normals array and indexes for base, top and sides
// This is done to not repeat normals in the OBJ file
function normals(numSides, vertices) {
    const normals = [];

    // Indexes for vertices
    const baseStart = 1;
    const topStart = 2;

    // Base normals (pointing downwards)
    normals.push([0.0, -1.0, 0.0]);
    const baseNormalIdx = normals.length; // 1

    // Top normals (pointing upwards)
    normals.push([0.0, 1.0, 0.0]);
    const topNormalIdx = normals.length; // 2

    const sideNormalIdx = []; // To store side normal indexes

    // Side normals (1 per triangle)
    for (let i = 0; i < numSides; i++) {
        // Base vertex indexes
        const baseCurrent = baseStart + (2 * i); // 3, 5, 7, ...
        const baseNext = (i === numSides - 1) ? baseStart : baseCurrent + 2; // 5, 7, 9, ...

        // Top vertex indexes
        const topCurrent = topStart + (2 * i); // 4, 6, 8, ...
        const topNext = (i === numSides - 1) ? topStart : topCurrent + 2; // 6, 8, 10, ...

        // Take first triangle of the side face
        const v1 = vertices[baseCurrent - 1];
        const v2 = vertices[baseNext - 1];
        const v3 = vertices[topNext - 1];

        // Get the vectors of the face
        const v12 = V3.subtract(v2, v1); // From v1 to v2
        const v23 = V3.subtract(v3, v2); // From v2 to v3

        // Calculate the normal using cross product
        let normal = V3.cross(v12, v23);
        
        // Normalize
        normal = V3.normalize(normal);

        // Add to normals list
        normals.push(normal);
        sideNormalIdx.push(normals.length); // Store index
    }
    
    return { normals, baseNormalIdx, topNormalIdx, sideNormalIdx };
}

// Function to create OBJ file
function createOBJ(fileName, vertices, normals, facesBase, facesTop, facesSides, baseNormalIdx, topNormalIdx, sideNormalIdx) {
    const fileLines = []; // Array to hold lines of the OBJ file

    // Initial comments
    fileLines.push(`# OBJ file ${fileName}`);

    // Write vertices
    fileLines.push(`# ${vertices.length} vertices`);

    for (let v of vertices) {
        // 4 decimals
        fileLines.push(`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`);
    }

    // Write normals
    fileLines.push(`# ${normals.length} normals`);

    for (let n of normals) {
        // 4 decimals
        fileLines.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
    }

    // Write faces
    const facesLength = facesBase.length + facesTop.length + facesSides.length;
    fileLines.push(`# ${facesLength} faces`);

    // Base faces
    for (let face of facesBase) {
        fileLines.push(`f ${face[0]}//${baseNormalIdx} ${face[1]}//${baseNormalIdx} ${face[2]}//${baseNormalIdx}`);
    }

    // Top faces
    for (let face of facesTop) {
        fileLines.push(`f ${face[0]}//${topNormalIdx} ${face[1]}//${topNormalIdx} ${face[2]}//${topNormalIdx}`);
    }

    // Side faces
    for (let i = 0; i < facesSides.length; i++) {
        const face = facesSides[i];
        // Each side has two triangles, so we use floor(i/2) to get the side index
        const sideIdx = Math.floor(i / 2);
        const normalIdx = sideNormalIdx[sideIdx];
        fileLines.push(`f ${face[0]}//${normalIdx} ${face[1]}//${normalIdx} ${face[2]}//${normalIdx}`);
    }

    // Write to file
    fs.writeFileSync(fileName, fileLines.join('\n'));
    console.log(`OBJ file "${fileName}" generated`);
}

// Main function
function main() {
    // Get input parameters
    const { numSides, height, baseRadius, topRadius } = getInputs();

    // Generate vertices
    const verts = vertices(numSides, height, baseRadius, topRadius);

    // Generate faces
    const { facesBase, facesTop, facesSides } = faces(numSides);

    // Generate normals
    const { normals: norms, baseNormalIdx, topNormalIdx, sideNormalIdx } = normals(numSides, verts);

    // Create OBJ file
    const fileName = `building_${numSides}_${height}_${baseRadius}_${topRadius}.obj`;
    createOBJ(fileName, verts, norms, facesBase, facesTop, facesSides, baseNormalIdx, topNormalIdx, sideNormalIdx);
}

main();