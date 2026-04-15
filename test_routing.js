const turf = require('@turf/turf');
const fs = require('fs');
const path = require('path');

const filePath = path.join('c:/Users/Lenovo/Desktop/VMS', 'public', 'geojson', 'vietnam-coastline.json');
const coastlineStr = fs.readFileSync(filePath, 'utf8');
const coastline = JSON.parse(coastlineStr);

const start = turf.point([108.0, 10.5]); // Somewhere near sea
const end = turf.point([107.5, 9.5]); // Another point

try {
  console.log("Computing shortest path...");
  const options = {
    obstacles: coastline, // FeatureCollection is accepted
    resolution: 50 // lower is faster but less accurate, default is 100
  };
  const pathData = turf.shortestPath(start, end, options);
  console.log("Success! Path length:", pathData.geometry.coordinates.length);
} catch (e) {
  console.log("Error:", e);
}
