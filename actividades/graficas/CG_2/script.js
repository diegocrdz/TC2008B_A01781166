/*
 * CG_2
 * 
 * This script is capable of generating 3D models in OBJ format using
 * different parameters, with the purpose of using it to generate
 * buildings with basic geometric shapes and multiple levels.
 * 
 * This script receives the following input parameters:
 * - Number of sides of the circle (integer between 3 and 36)
 * - Height of the building (positive float)
 * - Radius of the circle at the base (positive float)
 * - Radius of the circle at the top (positive float)
 * - Number of additional levels (integer >= 0)
 * - For each level:
 *   - Level height
 *   - Level base radius
 *   - Level top radius
 * 
 * These arguments must be passed when executing the script:
 * node script.js <numSides> <height> <baseRadius> <topRadius>
 *                <numLevels>
 *                <level 1 Height> <level 1 BaseRadius> <level 1 TopRadius>
 *                <level 2 Height> <level 2 BaseRadius> <level 2 TopRadius>
 *                ...
 * 
 * Ejemplos de ejecución:
 * node script.js 8  0.4 2 1  5  3 1 1.2  2 0.9 0.8  1 1.2 1.8  0.2 1.8 1.2  3 0.05 0.05
 * node script.js 6  10 6 5.5  6  9 4.5 4  8 3 2.5  7 1.5 1  10 0.05 0.05  1 0.05 1  1 1 0.05
 * 
 * Diego Córdova Rodríguez, A01781166
 * 2025-11-15
 */

'use strict';

import fs from 'fs'; // Module to handle files
import { V3 } from './A01781166-3d-lib.js';

// Function to get input parameters from command line
// Ref: https://www.geeksforgeeks.org/node-js/how-to-parse-command-line-arguments-in-node-js/#method-1-using-processargv// Ref: https://www.geeksforgeeks.org/node-js/how-to-parse-command-line-arguments-in-node-js/#method-1-using-processargv
function getInputs() {
    // Skip first two default arguments (node) and (script.js)
    const args = process.argv.slice(2);

    let numSides = args[0] ? parseInt(args[0]) : 8;
    let height = args[1] ? parseFloat(args[1]) : 6;
    let baseRadius = args[2] ? parseFloat(args[2]) : 1;
    let topRadius = args[3] ? parseFloat(args[3]) : 0.8;
    let numLevels = args[4] ? parseInt(args[4]) : 0;

    // Validate input parameters
    if (numSides < 3 || numSides > 36) {
        console.error("Invalid number of sides");
        process.exit(1);
    }
    if (height <= 0 || baseRadius <= 0 || topRadius <= 0) {
        console.error("Height and radius must be positive values");
        process.exit(1);
    }

    // Build levels array
    const levels = [];
    // Add base level
    levels.push({
        height: height,
        baseRadius: baseRadius,
        topRadius: topRadius
    });

    // Add additional levels if specified
    if (numLevels > 0) {

        // Check if enough arguments are provided
        if (args.length > 5 + numLevels * 3) {
            console.error("Too many arguments for the specified number of levels");
            process.exit(1);
        }

        // Get parameters for each level
        for (let i = 0; i < numLevels; i++) {
            const levelHeight = args[5 + i * 3] ? parseFloat(args[5 + i * 3]) : height;
            const levelBaseRadius = args[6 + i * 3] ? parseFloat(args[6 + i * 3]) : baseRadius;
            const levelTopRadius = args[7 + i * 3] ? parseFloat(args[7 + i * 3]) : topRadius;

            if (levelHeight <= 0 || levelBaseRadius <= 0 || levelTopRadius <= 0) {
                console.error("Height and radius for levels must be positive values");
                process.exit(1);
            }

            levels.push({
                height: levelHeight,
                baseRadius: levelBaseRadius,
                topRadius: levelTopRadius
            });
        }
    }

    return { numSides, height, baseRadius, topRadius, numLevels, levels };
}

// Function to check if a ring is unique in the rings array
// This is used to avoid duplicate rings, which would create overlapping vertices
// Causing normals with values of (0,0,0)
function isUniqueRing(rings, y, r) {
    for (let ring of rings) {
        if (ring.y === y && ring.r === r) {
            return false;
        }
    }
    return true;
}

// Function to build rings from levels
// Each ring represents a circle that divides the model into sections
// Each ring has a y position and a radius
function buildRings(levels) {
    const rings = [];
    let currentY = 0;
    
    // Add rings for each level
    for (let level of levels) {
        // Lower ring
        if (isUniqueRing(rings, currentY, level.baseRadius)) {
            rings.push({ y: currentY, r: level.baseRadius });
        }
        currentY += level.height;
        // Upper ring
        if (!rings.some(ring => ring.y === currentY && ring.r === level.topRadius)) {
            rings.push({ y: currentY, r: level.topRadius });
        }
    }

    return rings;
}

// Function to generate vertices for the model
// Returns an array with all vertices, each in format [x, y, z]
function vertices(numSides, levels) {
    const rings = buildRings(levels);
    const vertices = [];

    // Get total height of the model
    const height  = rings[rings.length - 1].y;

    // Add center vertices for base and top
    vertices.push([0, 0, 0]);
    vertices.push([0, height, 0]);

    // Angle step between each side
    let angleStep = (2 * Math.PI) / numSides;

    // Generate vertices for each ring
    for (let ring of rings) {
        const y = ring.y;
        const r = ring.r;

        for (let i = 0; i < numSides; i++) {
            let angle = i * angleStep;

            let x = Math.cos(angle) * r;
            let z = Math.sin(angle) * r;
            vertices.push([x, y, z]);
        }
    }

    return { vertices, rings };
}

// Function to generate faces for the model
// Each face is oriented counter clockwise
// Returns an object with arrays for base, top and side faces
// Each face in format [v1, v2, v3]
function faces(numSides, rings) {
    // Indexes for faces (1-based for OBJ format)
    // The first 2 vertices are the centers of base and top
    const centerBaseIdx = 1;
    const centerTopIdx = 2;
    
    // Base of the model starts at index 3
    const baseStart = 3;

    const numRings = rings.length;
    const bottomRing = 0;
    const topRing = numRings - 1;

    // Calculate faces
    const facesBase = [];
    const facesTop = [];
    const facesSides = [];

    // Generate base and top faces
    for (let i = 0; i < numSides; i++) {

        // Get current and next vertex indexes for base
        const baseCurrent = baseStart + bottomRing * numSides + i;
        // If we are at the last vertex, return to the first
        const baseNext = baseStart + bottomRing * numSides + ((i + 1) % numSides);

        // Create triangles for the base
        // The indexes were created clockwise
        // So we have to reverse the order to make the normal point downwards
        // Face: center, next, current
        facesBase.push([centerBaseIdx, baseNext, baseCurrent]);

        // Get current and next vertex indexes for top
        const topCurrent = baseStart + topRing * numSides + i;
        const topNext = baseStart + topRing * numSides + ((i + 1) % numSides);

        // Create triangles for the top
        // The indexes were created clockwise
        // So we can use the order as is to make the normal point upwards
        // Face: center, current, next
        facesTop.push([centerTopIdx, topCurrent, topNext]);
    }

    // Generate side faces between each pair of rings
    for (let j = 0; j < numRings - 1; j++) {
        const lower = j;
        const upper = j + 1;

        // Create side faces between ring lower and upper
        for (let i = 0; i < numSides; i++) {
            const baseCurrent = baseStart + lower * numSides + i;
            const baseNext = baseStart + lower * numSides + ((i + 1) % numSides);
            const topCurrent = baseStart + upper * numSides + i;
            const topNext = baseStart + upper * numSides + ((i + 1) % numSides);

            // Create two triangles for each side face
            // First triangle: baseCurrent, baseNext, topNext
            facesSides.push([baseCurrent, baseNext, topNext]);
            // Second triangle: baseCurrent, topNext, topCurrent
            facesSides.push([baseCurrent, topNext, topCurrent]);
        }
    }

    return { facesBase, facesTop, facesSides };
}

// Function to generate normals for the model
// Returns an object with the normals array and indexes for base, top and sides
// This is done to not repeat normals in the OBJ file
function normals(numSides, vertices, rings) {
    const normals = [];

    // Indexes for vertices
    const baseStart = 3;
    const numRings = rings.length;

    // Base normals (pointing downwards)
    normals.push([0.0, -1.0, 0.0]);
    const baseNormalIdx = normals.length; // 1

    // Top normals (pointing upwards)
    normals.push([0.0, 1.0, 0.0]);
    const topNormalIdx = normals.length; // 2

    const sideNormalIdx = []; // To store side normal indexes

    // For each pair of rings, calculate side normals
    for (let j = 0; j < numRings - 1; j++) {
        const lower = j;
        const upper = j + 1;
        
        // Side normals (1 per triangle)
        for (let i = 0; i < numSides; i++) {
            // Base and top vertex indexes
            const baseCurrent = baseStart + lower * numSides + i;
            const baseNext = baseStart + lower * numSides + ((i + 1) % numSides);
            const topNext  = baseStart + upper * numSides + ((i + 1) % numSides);
            
            // Take first triangle of the side face
            const v1 = vertices[baseCurrent - 1];
            const v2 = vertices[baseNext - 1];
            const v3 = vertices[topNext - 1];

            // Get the vectors of the face
            const v12 = V3.subtract(v2, v1); // From v1 to v2
            const v13 = V3.subtract(v3, v1); // From v1 to v3

            // Calculate the normal using cross product
            let normal = V3.cross(v12, v13);

            // Normalize
            normal = V3.normalize(normal);

            // Add to normals list
            normals.push(normal);
            sideNormalIdx.push(normals.length);
        }
    }

    return { normals, baseNormalIdx, topNormalIdx, sideNormalIdx };
}

// Function to create OBJ file
function createOBJ(
    fileName,
    vertices, normals,
    facesBase, facesTop, facesSides,
    baseNormalIdx, topNormalIdx, sideNormalIdx
) {
    // Array to hold lines of the OBJ file
    const fileLines = [];

    // Initial comments
    fileLines.push(`# OBJ file ${fileName}`);

    // Write vertices
    fileLines.push(`# ${vertices.length} vertices`);

    for (let v of vertices) {
        // toFixed(4) to only consider 4 decimal places
        // Format: v x y z
        fileLines.push(`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`);
    }

    // Write normals
    fileLines.push(`# ${normals.length} normals`);

    for (let n of normals) {
        // Format: vn x y z
        fileLines.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
    }

    // Write faces
    const facesLength = facesBase.length + facesTop.length + facesSides.length;
    fileLines.push(`# ${facesLength} faces`);

    // Base faces
    for (let face of facesBase) {
        // Format: f v1//n1 v2//n2 v3//n3
        fileLines.push(
            `f ${face[0]}//${baseNormalIdx} ${face[1]}//${baseNormalIdx} ${face[2]}//${baseNormalIdx}`
        );
    }

    // Top faces
    for (let face of facesTop) {
        fileLines.push(
            `f ${face[0]}//${topNormalIdx} ${face[1]}//${topNormalIdx} ${face[2]}//${topNormalIdx}`
        );
    }

    // Side faces
    for (let i = 0; i < facesSides.length; i++) {
        const face = facesSides[i];
        // Each side has two triangles, so we use floor(i/2) to get the side index
        const sideIdx = Math.floor(i / 2);
        const normalIdx = sideNormalIdx[sideIdx];
        fileLines.push(
            `f ${face[0]}//${normalIdx} ${face[1]}//${normalIdx} ${face[2]}//${normalIdx}`
        );
    }

    // Write to file
    fs.writeFileSync(fileName, fileLines.join('\n'));
    console.log(`OBJ file "${fileName}" generated`);
}

// Main function
function main() {
    // Get input parameters
    const { numSides, height, baseRadius, topRadius, numLevels, levels } = getInputs();

    // Generate vertices
    const { vertices: v, rings } = vertices(numSides, levels);

    // Generate faces
    const { facesBase, facesTop, facesSides } = faces(numSides, rings);

    // Generate normals
    const { normals: n, baseNormalIdx, topNormalIdx, sideNormalIdx } = normals(numSides, v, rings);

    // Create OBJ file
    const fileName = `building_${numSides}_${height}_${baseRadius}_${topRadius}_${numLevels}lvl.obj`;
    createOBJ(fileName, v, n, facesBase, facesTop, facesSides, baseNormalIdx, topNormalIdx, sideNormalIdx);
}

main();