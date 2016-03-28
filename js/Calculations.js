function LocationOnEdge(point, route, tolerance) {
    var onEdge = false;
    var path = route.getPath();
    for (var i = 0; i < path.length && !onEdge; i++) {
        var polyPoint = path.getAt(i);
        var dx = point.lat() - polyPoint.lat();
        var dy = point.lng() - polyPoint.lng();
        var distance2 = dx * dx + dy * dy;
        var tolerance2 = tolerance * tolerance;
        if (distance2 <= tolerance2) {
            onEdge = true;
        }
    }
    return onEdge;
}

function PolygonCenter(coordinates) {
    var maxLat, minLat, maxLong, minLong;

    maxLong = minLong = coordinates[0][0][0];
    maxLat = minLat = coordinates[0][0][1];

    for (var i = 1; i < coordinates[0].length; i++) {
        if (coordinates[0][i][0] < minLong) {
            minLong = coordinates[0][i][0]
        }
        if (coordinates[0][i][0] > maxLong) {
            maxLong = coordinates[0][i][0]
        }
        if (coordinates[0][i][1] < minLat) {
            minLat = coordinates[0][i][1]
        }
        if (coordinates[0][i][1] > maxLat) {
            maxLat = coordinates[0][i][1]
        }
    }

    var center = { lat: (maxLat + minLat) / 2, lng: (maxLong + minLong) / 2 };

    return center;
}

function HeatMap(minimum, maximum, value) {
    var ratio = 2 * (value - minimum) / (maximum - minimum);
    var b = Math.max(0, 255 * (1 - ratio));
    var r = Math.max(0, 255 * (ratio - 1));
    var g = 255 - b - r;
    return rgb(r, g, b);
}

function rgb(r, g, b) {
    r = Math.floor(r);
    g = Math.floor(g);
    b = Math.floor(b);
    return ["rgb(", r, ",", g, ",", b, ")"].join("");
}

function HeatMapRG(minimum, maximum, value) {
    var ratio = 1 * (value - minimum) / (maximum - minimum);
    var b = 0;
    var r = Math.max(0, 255 * (ratio - 1));
    var g = Math.max(0, 255 * (1 - ratio));
    return rgb(r, g, b);
}

function AccidentRate(totalAccidents, studyYears, averageAnnualDailyTraffice, sectionLength) {
    var rate = 0;

    if (totalAccidents > 0 && studyYears > 0 && averageAnnualDailyTraffice > 0 && sectionLength > 0) {
        rate = totalAccidents * 1e6 / (365 * studyYears * averageAnnualDailyTraffice * sectionLength);
    }
    else {
        console.log("AccidentRate incorrect paramters totalAccidents:" + totalAccidents + " studyYears:" + studyYears + " averageAnnualDailyTraffice:" + averageAnnualDailyTraffice + " sectionLength:" + sectionLength);
    }

    return rate;
}

function AddFeatureBounds(geoJson) {
    for (var iFeature = 0; iFeature < geoJson.features.length; iFeature++) {
        var feature = geoJson.features[iFeature];
        
        var pt = feature.geometry.coordinates[0][0];
        var bounds = [[pt[0], pt[1]], [pt[0], pt[1]]];
        for (var iCoordinates = 0; iCoordinates < feature.geometry.coordinates.length; iCoordinates++) {
            var coordinate = feature.geometry.coordinates[iCoordinates];
            for (var iCoordinate = 0; iCoordinate < coordinate.length; iCoordinate++) {
                pt = coordinate[iCoordinate];
                
                if (pt[0] < bounds[0][0]) {
                    bounds[0][0] = pt[0];
                }
                if (pt[1] < bounds[0][1]) {
                    bounds[0][1] = pt[1];
                }
                if (pt[0] > bounds[1][0]) {
                    bounds[1][0] = pt[0];
                }
                if (pt[1] > bounds[1][1]) {
                    bounds[1][1] = pt[1];
                }
            }
        }
        feature.properties.bounds = bounds;
    }
}

function WithnBounds(location, bounds) {
    var withinBounds = false;
    if (location[0] >= bounds[0][0]) {
        if (location[0] <= bounds[1][0]) {
            if (location[1] >= bounds[0][1]) {
                if (location[1] <= bounds[1][1]) {
                    withinBounds = true;
                }
            }
        }
    }
    return withinBounds;
}

function WithinPolygon(location, grid) {
    var polygon = GridJsonToPolygon(grid);
    var loc = new google.maps.LatLng(location[1], location[0]);
    var within = google.maps.geometry.poly.containsLocation(loc, polygon);
    return within;
}

function FindGridIndex(location, grids) {
    var gridIndex;
    
    for (var iGrid = 0; !gridIndex && iGrid < grids.features.length; iGrid++) {
        var grid = grids.features[iGrid];
        if (WithnBounds(location, grid.properties.bounds)) {
            if (WithinPolygon(location, grid)) {
                gridIndex = iGrid;
            }
        }
    }
    return gridIndex;
}

function GridJsonToPolygon(grid) {
    var paths = [];
    var exteriorDirection;
    var interiorDirection;
    for (var i = 0; i < grid.geometry.coordinates.length; i++) {
        var path = [];
        for (var j = 0; j < grid.geometry.coordinates[i].length; j++) {
            var ll = new google.maps.LatLng(grid.geometry.coordinates[i][j][1], grid.geometry.coordinates[i][j][0]);
            path.push(ll);
        }
        paths.push(path);
    }
    
    googleObj = new google.maps.Polygon({ paths: paths });
    if (grid.properties) {
        googleObj.set("geojsonProperties", grid.properties);
    }
    return googleObj;
}
