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

function main() {

}

main();