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

function InitArray(size, value)
{
    var ary = [];

    for(var i=0; i<size; i++)
    {
        ary.push(value);
    }
    return ary;
}

function Multiply(vector, scaler) {
    var product = [];
    
    for (var i = 0; i < vector.length; i++) {
        product[i] = vector[i] * scaler;
    }
    return product;
}

function Sum(array1, array2)
{
    var ary = [];
    var length = Math.min(array1.length, array2.length);

    for(var i=0; i<length; i++)
    {
        ary[i] = array1[i] + array2[i];
    }
    return ary;
}

function ElementSum(array, start, end)
{
    start = typeof start !== 'undefined' ? start : 0;
    end = typeof end !== 'undefined' ? end : array.length;
    console.assert(start < array.length);
    console.assert(end <= array.length);
    console.assert(start < end);
    var sum = 0;
    for (var i = start; i < end; i++) {
        sum += array[i];
    }
    return sum;
}

function ElementProduct(array1, array2)
{
    var ary = [];
    var length = Math.min(array1.length, array2.length);
    
    for(var i=0; i<length; i++)
    {
        ary[i] = array1[i] * array2[i];
    }
    return ary;
}

function Advance(array)
{
    var ary = [array[0]]; // First element is undefined.  Assume constant
    for(var i=0; i<array.length-1; i++){
        ary.push(array[i]);
    }
    return ary;
}

function ProgressStudents(students, progression, years)
{
    console.assert(students.length == progression.length);

    var finalStudents = students;
    for(var i=0; i<years; i++)
    {
        finalStudents = Advance(ElementProduct(finalStudents, progression));
    }
    return finalStudents;
}

function Year(dateStr) {
    var d = Date.parse(dateStr);
    var minutes = 1000 * 60;
    var hours = minutes * 60;
    var days = hours * 24;
    var years = days * 365;
    var y = Math.trunc(1970 + d / years);
    return y;
}

function HSStudents(students) {
    return ElementSum(students, 9, 13);
}

function SchoolToId(school) {
    switch (school) {
        case "Aloha High School":
        case "Aloha HS":
        case "Aloha":
            return 1186;
        case "Aloha-Huber Park School":
        case "Aloha-Huber Park":
        case "Aloha Huber Park":
        case "Aloha-Huber Park K8":
        case "Aloha Huber Park K8":
            return 1153;
        case "Arco Iris Spanish Immersion School":
        case "Arco Iris":
            return 4805;
        case "Arts and Communication Magnet Academy":
        case "Arts and Communication":
            return 1304;
        case "Barnes Elementary School":
        case "Barnes ES":
        case "Barnes":
            return 1154;
        case "Beaver Acres Elementary School":
        case "Beaver Acres ES":
        case "Beaver Acres":
            return 1155;
        case "Beaverton High School":
        case "Beaverton HS":
        case "Beaverton":
            return 1187;
        case "Bethany Elementary School":
        case "Bethany ES":
        case "Bethany":
            return 1156;
        case "Bonny Slope Elementary School":
        case "Bonny Slope ES":
        case "Bonny Slope":
            return 4671;
        case "Cedar Mill Elementary School":
        case "Cedar Mill ES":
        case "Cedar Mill":
            return 1158;
        case "Cedar Park Middle School":
        case "Cedar Park MS":
        case "Cedar Park":
            return 1180;
        case "Chehalem Elementary School":
        case "Chehalem ES":
        case "Chehalem":
            return 1159;
        case "Community School":
            return 1305;
        case "Conestoga Middle School":
        case "Conestoga MS":
        case "Conestoga":
            return 1319;
        case "Cooper Mountain Elementary School":
        case "Cooper Mountain ES":
        case "Cooper Mountain":
            return 1160;
        case "Elmonica Elementary School":
        case "Elmonica ES":
        case "Elmonica":
            return 1162;
        case "Errol Hassell Elementary School":
        case "Errol Hassell ES":
        case "Errol Hassell":
            return 1161;
        case "Findley Elementary School":
        case "Findley ES":
        case "Findley":
            return 1370;
        case "Fir Grove Elementary School":
        case "Fir Grove ES":
        case "Fir Grove":
            return 1163;
        case "Five Oaks Middle School":
        case "Five Oaks MS":
        case "Five Oaks":
            return 1181;
        case "Greenway Elementary School":
        case "Greenway ES":
        case "Greenway":
            return 1157;
        case "Hazeldale Elementary School":
        case "Hazeldale ES":
        case "Hazeldale":
            return 1164;
        case "Health & Science School":
            return 4638;
        case "Highland Park Middle School":
        case "Highland Park MS":
        case "Highland Park":
            return 1184;
        case "Hiteon Elementary School":
        case "Hiteon ES":
        case "Hiteon":
            return 1165;
        case "Hope Chinese Charter School":
            return 4867;
        case "International School of Beaverton":
        case "ISB":
            return 4474;
        case "Jacob Wismer Elementary School":
        case "Jacob Wismer ES":
        case "Jacob Wismer":
            return 3437;
        case "Kinnaman Elementary School":
        case "Kinnaman ES":
        case "Kinnaman":
            return 1166;
        case "McKay Elementary School":
        case "McKay ES":
        case "McKay":
            return 1168;
        case "McKinley Elementary School":
        case "McKinley ES":
        case "McKinley":
            return 1169;
        case "Meadow Park Middle School":
        case "Meadow Park MS":
        case "Meadow Park":
            return 1182;
        case "Montclair Elementary School":
        case "Montclair ES":
        case "Montclair":
            return 1170;
        case "Mountain View Middle School":
        case "Mountain View MS":
        case "Mountain View":
            return 1183;
        case "Nancy Ryles Elementary School":
        case "Nancy Ryles ES":
        case "Nancy Ryles":
            return 1303;
        case "Oak Hills Elementary School":
        case "Oak Hills ES":
        case "Oak Hills":
            return 1171;
        case "Raleigh Hills Elementary School":
        case "Raleigh Hills ES":
        case "Raleigh Hills":
            return 1172;
        case "Raleigh Park Elementary School":
        case "Raleigh Park ES":
        case "Raleigh Park":
            return 1173;
        case "Ridgewood Elementary School":
        case "Ridgewood ES":
        case "Ridgewood":
            return 1174;
        case "Rock Creek Elementary School":
        case "Rock Creek ES":
        case "Rock Creek":
            return 1175;
        case "Scholls Heights Elementary School":
        case "Scholls Heights ES":
        case "Scholls Heights":
            return 2781;
        case "School of Science & Technology":
            return 1314;
        case "Sexton Mountain Elementary School":
        case "Sexton Mountain ES":
        case "Sexton Mountain":
            return 1270;
        case "Southridge High School":
        case "Southridge HS":
        case "Southridge":
            return 2783;
        case "Springville K-8 School":
        case "Springville K8":
        case "Springville":
            return 4712;
        case "Stoller Middle School":
        case "Stoller MS":
        case "Stoller":
            return 2782;
        case "Sunset High School":
        case "Sunset HS":
        case "Sunset":
            return 1188;
        case "Terra Linda Elementary School":
        case "Terra Linda ES":
        case "Terra Linda":
            return 1176;
        case "Vose Elementary School":
        case "Vose ES":
        case "Vose":
            return 1177;
        case "West Tualatin View Elementary School":
        case "West Tualatin View ES":
        case "West Tualatin View":
        case "West TV":
            return 1178;
        case "Westview High School":
        case "Westview HS":
        case "Westview":
            return 1320;
        case "Whitford Middle School":
        case "Whitford MS":
        case "Whitford":
            return 1185;
        case "William Walker Elementary School":
        case "William Walker ES":
        case "William Walker":
            return 1179;
        case "South Cooper Mountain High School":
        case "South Cooper Mountain HS":
        case "South Cooper Mountain":
            return 1179;
    }
    return null;
}

function Centroid(locations) {
    var centroidLocation = [0, 0];
    
    if (locations != null && locations.length > 1) {
        for (var i = 0; i < locations.length - 1; i++) {
            centroidLocation[0] += locations[i][0];
            centroidLocation[1] += locations[i][1];
        }
        centroidLocation[0] /= (locations.length - 1);
        centroidLocation[1] /= (locations.length - 1);
    }
    return centroidLocation
}
