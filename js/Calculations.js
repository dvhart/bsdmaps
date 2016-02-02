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