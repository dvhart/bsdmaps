var app = angular.module('BoundaryEntry', ['chart.js']);
var map;
var directionsService;
var directionsDisplay;
var geocoder;
var infowindow;
var panel;
var selectedGrid; // selected feature object
var selectedFeature; //  JSON selected grid
var results;
var milePerMeter = 0.000621371;
var sections = [];
var routes = [];
var overlapPolylines = [];
var newRoute;
var maxAccidentRate = 20;
var minAccidentRate = 0;

var countyId = 34;
var districtId = 2243;


app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "schools":{},
        "district": {},
        "high": [],
        "plotData": [],
        "grids": {},
        "students": {},
        "construction": {},
        "schools": {}
    };
    
    $scope.onClick = function (points, evt) {
        console.log(points, evt);
    };
    
    $scope.PlotChange = function ()
    {
        if ($scope.data.plotData) {
            LoadDistrictData($scope.data, $scope.data.plotData[0]);
        }
    }
    
    $scope.ComputeEnrollment = function ()
    {
        StudentsToGrids($scope.data.students, $scope.data.grids);
        ConstructionToGrids($scope.data.construction, $scope.data.grids);
        BSD2020Estimate($scope.data.construction, $scope.data.grids);
    }

    function init() {
        
        SchoolInit($http, $scope.data);

        // Initialise the map.
        var myLatLng = { lat: 45.498, lng: -122.82 };
        //var mapProp = {
        //    center: myLatLng,
        //    zoom: 12,
        //    mapTypeId: google.maps.MapTypeId.ROADMAP
        //};
        
        //map = new google.maps.Map(document.getElementById('map-holder'), mapProp);
        //directionsService = new google.maps.DirectionsService;
        //var renderOptions = { preserveViewport: true };
        //directionsDisplay = new google.maps.DirectionsRenderer(renderOptions);
        //geocoder = new google.maps.Geocoder;
        //infowindow = new google.maps.InfoWindow;
       
        // NOTE: This uses cross-domain XHR, and may not work on older browsers.
        LoadGeoJson($http, $scope, map);
    };

    init();
});


function SchoolInit( $http, data)
{
    LoadSchools($http, function (schoolsObj) {
        data.schools = schoolsObj;

        FindHigh(data);

        LoadDistrictData(data, 34);
    });
}

function LoadDistrictData(data, schoolId)
{
    if (data.schools && data.schools[schoolId]) {
        data.district = { "enrollment": [], "grade": ["k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [] };
        
        for (var date in data.schools[schoolId].enrollment) {
            data.district.year.push(date);
            var enrolement = data.schools[schoolId].enrollment[date];
            data.district.enrollment.push(enrolement.grade);
        }

    }
}

function FindHigh(data) {
    if (data.schools) {
        
        for (var schoolId in data.schools) {
            var hsStudents = false;
            var school = data.schools[schoolId];
            
            var keys = Object.keys(school.enrollment);
            var isHs = false;
            for (var iKey = 0; iKey < keys.length && !isHs; iKey++) {
                var numHsStudents = Number(school.enrollment[keys[iKey]].StudCnt912);
                if (numHsStudents > 0) {
                    isHs = true;
                }
            }
            if (isHs) {
                data.high.push([schoolId, school.displayName]);
            }
        }
    }
}

function YearHigh(data) {
    if (data.schools) {
        
        var schoolKeys = Object.keys(data.schools);

        for (var schoolId in data.schools) {
            var hsStudents = false;
            var school = data.schools[schoolId];
            
            var keys = Object.keys(school.enrollment);
            var isHs = false;
            for (var iKey = 0; iKey < keys.length && !isHs; iKey++) {
                var numHsStudents = Number(school.enrollment[keys[iKey]].StudCnt912);
                if (numHsStudents > 0) {
                    isHs = true;
                }
            }
            if (isHs) {
                data.high.push([schoolId, school.displayName]);
            }
        }
    }
}

function LoadGeoJson($http, $scope, map) {
    var gridCodes = "GridCode.geojson";
    var construction = "ResDevProjects.geojson";
    var students = "BSDStudents2014.geojson";
    var schools = "Schools.geojson";

    $http.get(gridCodes).success(function (gridsJson) {
        $http.get(construction).success(function (constructionJson) {
            $http.get(students).success(function (studentsJson) {
                $http.get(schools).success(function (schoolsJson) {

                    // Add geometry limits to speed matching
                    GeomLimits(gridsJson);
                    GeomLimits(constructionJson);

                    $scope.data.grids = gridsJson;
                    $scope.data.construction = constructionJson;                    
                    $scope.data.students = studentsJson;
                    $scope.data.schools = schoolsJson;
                                        
                    //var newData = new google.maps.Data({ map: map });
                    //newData.addGeoJson(gridsJson);
                    ///newData.addGeoJson(constructionJson);
                    //newData.addGeoJson(studentsJson);
                    //newData.addGeoJson(schoolsJson);
                    
                    // No error means GeoJSON was valid!
                    //map.data.setMap(null);
                    //map.data = newData;
                    
                    //Configure($scope);
                });

            });
        });
    });
}

function GeomLimits(geoJson)
{
    geoJson.features.forEach(function(feature){
        var pt = feature.geometry.coordinates[0][0];
        var bounds = [[pt[0], pt[1]], [pt[0], pt[1]]];
        for(var iCoordinates=0; iCoordinates <  feature.geometry.coordinates.length; iCoordinates++)
        {
            var coordinate = feature.geometry.coordinates[iCoordinates];
            for(var iCoordinate=0;iCoordinate<coordinate.length;iCoordinate++)
            {
                pt = coordinate[iCoordinate];
                
                if(pt[0] < bounds[0][0])
                {
                    bounds[0][0] = pt[0];
                }
                if(pt[1] < bounds[0][1])
                {
                    bounds[0][1] = pt[1];
                }
                if(pt[0] > bounds[1][0])
                {
                    bounds[1][0] = pt[0];
                }
                if(pt[1] > bounds[1][1])
                {
                    bounds[1][1] = pt[1];
                }                
            }
        }
        feature.properties.bounds = bounds;
    });
}

function Configure($scope) {
    // Initialise the map.
    //map.data.setControls(['LineString', 'Polygon']);
    
    map.data.setStyle(function (feature) {
        var highSchool = feature.getProperty('HIGH_DESC');
        var gc = Number(feature.getProperty('PA_NUMBER'));
        var color = 'grey';
        
        //if ($scope.data.colorMap == 'Proposed') {
        //    var school = FindSchool(highSchool, schoolData);
        //    if (school) {
        //        color = school.color;
        //    }
        //} 
        //else if ($scope.data.colorMap == 'Distance') {
        //    for (var i = 0; i < schoolData.hs.length; i++) {
        //        if (highSchool == schoolData.hs[i].dbName) {
        //            var distances = feature.getProperty('distance');
        //            var distance = distances[i];
        //            color = HeatMapRG(1000, 5000, distance);
        //        }
        //    }
        //}
        //else {
        //    if ($scope.data.colorMap != 'Safety') {
        //        highSchool = $scope.data.colorMap;
        //    }
        //    for (var i = 0; i < schoolData.hs.length; i++) {
        //        if (highSchool == schoolData.hs[i].dbName) {
        //            var accidentRates = feature.getProperty('accidentRate');
        //            var accidentRate = accidentRates[i];
        //            color = HeatMapRG(minAccidentRate[i], maxAccidentRate[i], accidentRates[i]);
        //        }
        //    }
        //}
        
        return { editable: false, draggable: false, strokeWeight: 1, fillColor: color };
    });
    
    map.data.addListener('addfeature' , function (ev) {
        map.data.revertStyle();
        newFeature = null;
        ev.feature.toGeoJson(function (grid) {
            newFeature = grid;
        });
    });
    
    map.data.addListener('mouseover', function (event) {
        map.data.revertStyle();
        infoWindowMarker.setMap(null);
        map.data.overrideStyle(event.feature, { strokeWeight: 1 });
        
        //if (selecting == 1 && ($scope.data.dragFunc == "paint")) {
        //    var proposedHigh = $scope.data.proposedHigh;
        //    if (proposedHigh) {
        //        // Record selected grid and grid data
        //        selectedGrid = event.feature;
        //        selectedGrid.setProperty('proposedHigh', ProposedHigh(proposedHigh, selectedGrid));
        //        selectedES = selectedGrid.getProperty('elementary');
                
        //        //var numEsGrids = 0;
        //        //if ($scope.data.paintBy == "ES") {
        //        //    mapGrids.forEach(function (grid) {
        //        //        if (grid.getProperty('elementary') == selectedES) {
        //        //            grid.setProperty('proposedHigh', ProposedHigh(proposedHigh, grid));
        //        //            numEsGrids++;
        //        //        }
        //        //    });
        //        //}
                
        //        //map.data.toGeoJson(function (geoJson) {
        //        //    results = Results(geoJson.features, schoolData);
        //        //});
                
        //        //$scope.data.mapName = defaultMapName;
        //        //$scope.data.mapDescription = defaultMapDescription;
                
        //        //UpdateScopeData($scope, results);
        //        $scope.$apply();
        //    }
        //}
    });
    
    map.data.addListener('mouseout', function (event) {
        map.data.revertStyle();
    });
    
    
    map.data.addListener('click', selectGrid = function (event) {
        if (selecting) {
            var thisGrid = event.feature;
            
            var accidentNum = thisGrid.getProperty("accidentRate");
            var accidentStr = [];
            accidentNum.forEach(function (rate, iRate) {
                accidentStr.push(rate.toFixed(2));
            });
            
            thisGrid.getProperty("accidentRate");
            
            var msg = "gc:" + thisGrid.getProperty("gc") +
                    "<br>High School:" + thisGrid.getProperty("high") +
                    "<br>Proposed:" + thisGrid.getProperty("proposedHigh") +
                    "<br>Students:" + thisGrid.getProperty("hs2020") +
                    "<br>Dist:" + thisGrid.getProperty("distance") +
                    "<br>Crash:" + accidentStr;
            
            infoWindowMarker.setMap(null);
            
            infowindow.setContent(msg);
            infowindow.open(map, infoWindowMarker);
            var centroid = thisGrid.getProperty("centroid");
            infoWindowMarker.setPosition({ lat: centroid[1], lng: centroid[0] });
            infoWindowMarker.setVisible(false);
            infoWindowMarker.setMap(map);
        }
        else {
            var proposedHigh = $scope.data.proposedHigh;
            if (proposedHigh) {
                // Record selected grid and grid data
                selectedGrid = event.feature;
                selectedGrid.setProperty('proposedHigh', ProposedHigh(proposedHigh, selectedGrid));
                selectedES = selectedGrid.getProperty('elementary');
                
                var numEsGrids = 0;
                if ($scope.data.paintBy == "ES") {
                    mapGrids.forEach(function (grid) {
                        if (grid.getProperty('elementary') == selectedES) {
                            grid.setProperty('proposedHigh', ProposedHigh(proposedHigh, grid));
                            numEsGrids++;
                        }
                    });
                }
                
                console.log("click elementary grids=" + numEsGrids);
                
                map.data.toGeoJson(function (geoJson) {
                    results = Results(geoJson.features, schoolData);
                });
                
                $scope.data.mapName = defaultMapName;
                $scope.data.mapDescription = defaultMapDescription;
                
                UpdateScopeData($scope, results);
                $scope.$apply();
            }
        }
    });
};


function StudentsToGrids(students, grids)
{
    grids.features.forEach(function (feature) {
        feature.properties.students = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    });    

    students.features.forEach(function(student){
        var location = student.geometry.coordinates;
        var grade = student.properties.GRD;
        var iGrid = FindGridIndex(location, grids);

        grids.features[iGrid].properties.students[grade]++;
    });
}

function FindGridIndex(location, grids)
{
   var gridIndex;

   for(var iGrid = 0; !gridIndex && iGrid < grids.features.length; iGrid++)
   {
       var grid = grids.features[iGrid];
        if(WithnBounds(location, grid.properties.bounds))
        {
            if(WithinPolygon(location, grid))
            {
                gridIndex = iGrid;
            }
        }
   }
   return gridIndex;
}

function WithnBounds(location, bounds)
{
    var withinBounds = false;
    if(location[0] >= bounds[0][0]){
        if(location[0] <= bounds[1][0]){
            if(location[1] >= bounds[0][1]){
                if(location[1]<= bounds[1][1]){
                    withinBounds = true;
                }
            }
        }
    }
    return withinBounds;
}

function WithinPolygon(location, grid)
{
    var polygon = GridJsonTo(grid);
    var loc = new google.maps.LatLng(location[1], location[0]);
    var within = google.maps.geometry.poly.containsLocation(loc, polygon);
    return within;
}

function GridJsonTo(grid) 
{
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

    googleObj = new google.maps.Polygon({paths: paths});
    if (grid.properties) {
        googleObj.set("geojsonProperties", grid.properties);
    }
    return googleObj;
}

function CCW(path) {
    var isCCW;
    var a = 0;
    for (var i = 0; i < path.length - 2; i++) {
        a += ((path[i + 1].lat() - path[i].lat()) * (path[i + 2].lng() - path[i].lng()) - (path[i + 2].lat() - path[i].lat()) * (path[i + 1].lng() - path[i].lng()));
    }
    if (a > 0) {
        isCCW = true;
    }
    else {
        isCCW = false;
    }
    return isCCW;
};

function ConstructionToGrids(construction, grids)
{

}
function BSD2020Estimate(construction, grids)
{
    
}
