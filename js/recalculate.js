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

// Google Map Overlays
var bsdOverlay;
var mapGrids;
var departDate = new Date("Wed Feb 17 2016 7:10:00 GMT-0800")

var schools = [
    {id:0, dbName:'Aloha', displayName:'Aloha', color:'blue', capacity:2176, location:{ lat: 45.4857177, lng: -122.8695357 }},
    {id:1, dbName:'Beaverton', displayName:'Beaverton', color:'orange', capacity:2122, location:{ lat: 45.4862121, lng: -122.8111987 }},
    {id:2, dbName:'Cooper', displayName:'Cooper Mtn', color:'green', capacity:2176, location:{ lat: 45.4264562, lng: -122.8536721 }},
    {id:3, dbName:'Southridge', displayName:'Southridge', color:'red', capacity:1850, location:{ lat: 45.4507757, lng: -122.8063213 }},
    {id:4, dbName:'Sunset', displayName:'Sunset', color:'purple', capacity:2203, location:{ lat: 45.5275752, lng: -122.8188107 }},
    {id:5, dbName:'Westview', displayName:'Westview', color:'pink', capacity:2421, location:{ lat: 45.5489509, lng: -122.8663216}}
];


app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "rid": "",
        "gc": 0,
        "hs2020": 0,
        "reducedLunch": 0,
        "high": "",
        "middle": "",
        "elementary": "",
        "routeLength":0,
        "accidentRate": [0, 0, 0, 0, 0, 0],
        "centroid": [0, 0],
        "distance":[0, 0, 0, 0, 0, 0],
        "time": [0, 0, 0, 0, 0, 0],
        "timeInTraffic": [0, 0, 0, 0, 0, 0],
        "progress": "recompute status",
        "evalHigh": "Current",
        "fileContents": [],
        "permetContents": []
    };

    $scope.RecalculateRoutes = function () {
        var destinations = [];
        schools.forEach(function (school) {
            destinations.push(school.location);
        });

        $http.get('/GetFeatures').then(function (getFeatures) {
            $http.get('/GetRoutes').then(function (getRoutes) {

                var end = getFeatures.data.length;
                //end = 8; // Testing
                var iSchool = 0; // school index
                var iGrid = 0; // grid index

                var grids = getFeatures.data;
                var routes = getRoutes.data;
                var intervalDelayMs = 10000;

                // Delay update
                var intervalID = setInterval(function () {

                    // Skip grids that already have populated field
                    // Fast forward to point that we need to look up path to school
                    var needPath = false;
                    var jRoute;
                    var iRoute = [];
                    var route;
                    while (iGrid < end && !needPath) {
                        // Find all routes that match the grid code.

                        jRoute = 0;
                        iRoute = [];
                        route = null;
                        for (var i = 0; i < routes.length; i++) {
                            if (routes[i].gc == grids[iGrid].properties.gc) {
                                route = routes[i];
                                iRoute.push(i);
                                if (iRoute.length > 1) {
                                    console.log("Found repeated route " + routes[i].gc + " at " + i);
                                }
                            }
                            if (!route) { // Lock index of first mactching route
                                jRoute++;
                            }
                        }

                        if (routes.length <= jRoute) {
                            console.log("No route found for gc " + grids[iGrid].properties.gc);
                            routes.push({ gc: grids[iGrid].properties.gc, path: [] });
                            needPath = true;
                            iSchool = 0;
                            console.assert(jRoute < routes.length, "Past end of route array");
                        }
                        else if (routes[jRoute].path == null) {
                            routes[jRoute].path = [];
                            needPath = true;
                        }
                        else if (routes[jRoute].path.length < iSchool + 1) {
                            needPath = true;
                        }
                        else if (!routes[jRoute].path[iSchool]) {
                            needPath = true;
                        }
                        else {
                            iSchool++;
                            if (iSchool >= destinations.length) {
                                iSchool = 0;
                                iGrid++;
                            }
                        }
                        console.log(iGrid + " "+ jRoute + " " +iSchool);
                    }

                    if (!needPath) { // Done.  Save and exit
                        clearInterval(intervalID); // Done.  Don't restart interval timer
                        //$http.post('/SetFeatures', grids);
                        $http.post('/SetRoutes', routes);
                        $scope.data.progress = "Recalculate Complete grids:" + iGrid;
                        $scope.$apply();
                    }
                    else {
                        if (!grids[iGrid].properties.distance) grids[iGrid].properties.distance = [];
                        if (!grids[iGrid].properties.time) grids[iGrid].properties.time = [];
                        if (!grids[iGrid].properties.path) grids[iGrid].properties.path = [];

                        var center = PolygonCenter(grids[iGrid].geometry.coordinates);

                        directionsDisplay.setMap(map);
                        FindPath(center, destinations[iSchool], departDate, function (findPathResponse, polyline) {

                            if (findPathResponse && findPathResponse.status == "OK") {
                                directionsDisplay.setDirections(findPathResponse);

                                var distance = findPathResponse.routes[0].legs[0].distance.value;
                                var duration = findPathResponse.routes[0].legs[0].duration.value
                                grids[iGrid].properties.distance[iSchool] = distance;
                                grids[iGrid].properties.time[iSchool] = duration;
                                routes[jRoute].path[iSchool] = PolylineToArray(polyline);
                                $scope.data.distance = grids[iGrid].properties.distance;
                                $scope.data.duration = grids[iGrid].properties.time[iSchool];

                                $scope.data.progress = "Grid " + iGrid + " of " + grids.length + " route " + iSchool + " distance " + distance + " duration " + duration;
                                $scope.$apply();
                            }
                            else { // Google does not like to give the data all at once.  Save off to database and try again later
                                clearInterval(intervalID); // Done.  Don't restart interval timer
                                //$http.post('/SetFeatures', grids);
                                $http.post('/SetRoutes', routes);
                                $scope.data.progress = "Recalculate Finished Incoplete grids:" + iGrid;
                                $scope.$apply();
                            }
                        });
                    }
                }, intervalDelayMs);
            });
        });
    };

    $scope.CalculateSafety = function () {
        $scope.data.progressSafety = "Calculating Safety ...";
        $http.get('/GetFeatures').then(function (getFeatures) {
            $http.get('/GetRoutes').then(function (getRoutes) {
                getFeatures.data.forEach(function (grid, iGrid) {
                    if (grid.properties.accidentRate == null) {
                        grid.properties.accidentRate = [0, 0, 0, 0, 0, 0];
                    }
                    if (iGrid < getRoutes.data.length) {
                        var gridRoutes = getRoutes.data[iGrid];
                        console.log("Calculate safety grid " + iGrid + " gc " + grid.properties.gc);
                        if (gridRoutes.gc != grid.properties.gc) { // Indexes don't match, search for matching grid
                            gridRoutes = null;
                            for (var i = 0; i < getRoutes.data.length && !gridRoutes; i++) {
                                if (getRoutes.data[i].gc == grid.properties.gc) {
                                    gridRoutes = getRoutes.data[i];
                                }
                            }
                        }

                        if (gridRoutes) {
                            gridRoutes.path.forEach(function (path, iPath) {
                                grid.properties.accidentRate[iPath] = FindAccidentRate(path);
                                var status = "gc " + grid.properties.gc + " rate " + grid.properties.accidentRate[iPath];
                                console.log(status)
                                $scope.data.progressSafety = status;
                            });
                        }
                    }
                });

                $http.post('/SetFeatures', getFeatures.data);
                $scope.data.progressSafety = "Done Computing Accident Rate";
                $scope.$apply();
            });
        });
    };

    $scope.UpdateHigh = function () {
        Configure($scope, $http);
    };
    
    $scope.showContent = function ($fileContent) {
        $scope.data.fileContents = $fileContent;
    };
    
    $scope.parsePermit = function ($fileContent) {
        $scope.data.permetContents = $fileContent;
    };

    function initMap() {
        // Initialise the map.
        var myLatLng = { lat: 45.4834817, lng: -122.8216516 };
        var mapProp = {
            center: myLatLng,
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        map = new google.maps.Map(document.getElementById('safety-map-holder'), mapProp);
        directionsService = new google.maps.DirectionsService;
        var renderOptions = { preserveViewport: true };
        directionsDisplay = new google.maps.DirectionsRenderer(renderOptions);
        geocoder = new google.maps.Geocoder;
        infowindow = new google.maps.InfoWindow;

        // Add the BSD boundary overlay
        var imageBounds = {
            north: 45.577690,
            south: 45.415266,
            east: -122.730426,
            west: -122.921350
        };

        bsdOverlay = new google.maps.GroundOverlay('http://bsdmaps.monkeyblade.net/bsd-boundary-existing-overlay.png', imageBounds);
        bsdOverlay.setMap(map);

        panel = document.getElementById('panel');

        $http.get('/GetFeatures').then(function (response) {
            RefreshFromGrids(response.data);

            $http.get('/GetSection').then(function (sectionResponse) {
                sections = RefreshFromSafetyDB(sectionResponse, map);

                $http.get('/GetRoutes').then(function (getRoutes) {
                    routes = getRoutes.data;
                });
            });

            Configure($scope, $http);
        });
    };

    initMap();
});

function RefreshFromGrids(grids) {
    try {
        var geoJsonData = { "type": "FeatureCollection", "features": grids };

        geoJsonData.features.forEach(function (grid, iGrid) {
            if (grid._id) {
                grid.properties.id = grid._id;
            }
        });

        var newData = new google.maps.Data({map: map});
        var features = newData.addGeoJson(geoJsonData);

        // No error means GeoJSON was valid!
        map.data.setMap(null);
        map.data = newData;
        mapGrids = features;

    } catch (error) {
        newData.setMap(null);
        if (geoJsonInput.value !== "") {
            setGeoJsonValidity(false);
        } else {
            setGeoJsonValidity(true);
        }
        return;
    }
};


function Configure($scope, $http) {
    // Initialise the map.
    map.data.setControls(['LineString', 'Polygon']);

    map.data.setStyle(function (feature) {

        var highSchool = feature.getProperty('high');
        var color = 'grey';
        if ($scope.data.evalHigh == 'Current') {

            var school = FindSchool(highSchool, schools);
            if (school) {
                color = school.color;
            }
        }
        else {
            for (var i = 0; i < schools.length; i++) {
                if ($scope.data.evalHigh == schools[i].dbName) {
                    var accidentRates = feature.getProperty('accidentRate');
                    var accidentRate = accidentRates[i];
                    color = HeatMapRG(minAccidentRate[i], maxAccidentRate[i], accidentRates[i]);
                }
            }
        }
        return { editable: false, draggable: false, strokeWeight: 0, fillColor: color };
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
        map.data.overrideStyle(event.feature, { strokeWeight: 1 });
    });

    map.data.addListener('mouseout', function (event) {
        map.data.revertStyle();
    });

    map.data.addListener('click', selectGrid = function (event) {
        map.data.revertStyle();

        overlapPolylines.forEach(function (polyline) {
            polyline.setMap(null);
        });
        overlapPolylines = [];

        selectedGrid = event.feature;
        event.feature.toGeoJson(function (grid) {
            if (event.Fb.ctrlKey) {
                selectedFeature = grid;
                // Find route associated with gc
                var route;
                for (var i = 0; i < routes.length && route == null; i++) {
                    if (routes[i].gc == grid.properties.gc) {
                        route = routes[i];
                    }
                }

                if (route && route.path.length == schools.length) {
                    grid.properties.accidentRate = [];
                    route.path.forEach(function (path, iPath) {
                        grid.properties.accidentRate[iPath] = FindAccidentRate(path);
                        var status = "gc " + grid.properties.gc + " rate " + grid.properties.accidentRate[iPath];
                        console.log(status)

                        if (iPath == schools.length - 1) {
                            if (grid.properties.id) {
                                grid._id = grid.properties.id;
                                delete grid.properties.id;
                            }

                            $http.post('/EditGrid', grid).then(function (response) {
                                console.log("/EditGrid " + response);
                            });

                            $http.post('/EditGrid', grid).then(function (response) {
                                RefreshFromGrids(response.data);
                                Configure($scope);
                            });
                        }
                    });
                }
            }
            else {
                $scope.data.gc = grid.properties.gc;
                $scope.data.hs2020 = grid.properties.hs2020;
                $scope.data.reducedLunch = grid.properties.reducedLunch;
                $scope.data.high = grid.properties.high;
                $scope.data.middle = grid.properties.middle;
                $scope.data.elementary = grid.properties.elementary;
                $scope.data.centroid = grid.properties.centroid;
                $scope.data.distance = grid.properties.distance;
                $scope.data.time = grid.properties.time;
                $scope.data.accidentRate = grid.properties.accidentRate

                var iRoute = [];
                var route;
                for (var i = 0; i < routes.length; i++) {
                    if (routes[i].gc == grid.properties.gc) {
                        route = routes[i];
                        iRoute.push(i);
                        if (iRoute.length > 1) {
                            console.log("Found route " + routes[i].gc + " at "+i);
                        }

                    }
                }

                if (route == null) {
                    console.log("No route found for gc " + grid.properties.gc);
                }

                if (grid.properties.timeInTraffic) {
                    $scope.data.timeInTraffic = grid.properties.timeInTraffic;
                }

                var schoolTofind = grid.properties.high;
                if ($scope.data.evalHigh != 'Current') {
                    schoolTofind = $scope.data.evalHigh
                }
                var school = FindSchool(schoolTofind, schools);
                var center = PolygonCenter(grid.geometry.coordinates);
                FindRoute(center, school.location, sections, function (results) {
                    $scope.data.routeLength = results.length;
                    map.data.overrideStyle(event.feature, { strokeWeight: 1 });

                    if (route) {
                        if (route.path) {
                            route.path.forEach(function (points) {
                                overlapPolylines.push(new google.maps.Polyline({ path: points, clickable: false, strokeColor: '#ffff00', strokeWeight: 6 }));
                            });
                        }
                        else {
                            console.log("route " + iRoute + " gc " + route.gc + " missing path");
                        }

                    }

                    overlapPolylines.forEach(function (polyline) {
                        polyline.setMap(map);
                    });
                    if (route) {
                        $scope.data.rid = route._id;
                    }
                    $scope.$apply();
                });
            }
        });
    });
};

function FindRoute(origin, destination, sections,  callback) {
    var results = { length: 0, accidentRate: 0, polyline: {} };

    overlapPolylines.forEach(function (polyline) {
        polyline.setMap(null);
    });
    overlapPolylines = [];
    directionsDisplay.setMap(map);
    FindPath(origin, destination, departDate, function (response, newRoute) {

        directionsDisplay.setDirections(response);
        var points = [];
        // Algorithm to find and measure polyline overlap
        console.log("route, distance, rate");

        sections.forEach(function (route, iRoute) {
            var points = [];
            if (route.polyline) {
                route.polyline.getPath().forEach(function (point) {
                    if (google.maps.geometry.poly.isLocationOnEdge(point, newRoute)) {
                        points.push(point);
                    }
                });
            }

            var distanceMeters = google.maps.geometry.spherical.computeLength(points);
            results.accidentRate += distanceMeters * milePerMeter * route.rate;
            if (distanceMeters > 0) {
                console.log(iRoute + ", " + distanceMeters * milePerMeter + ", " + route.rate);
                overlapPolylines.push(new google.maps.Polyline({ path: points, clickable: false, strokeColor: '#FF0000', strokeWeight: 8 }));
            }
        });

        console.log("accidentRate="+results.accidentRate);


        results.length = response.routes[0].legs[0].distance.value;
        results.polyline = newRoute;
        callback(results, overlapPolylines);
    });
};

function FindDistance(map, origin, destinations, departureTime, callback) {
    var service = new google.maps.DistanceMatrixService;
    var newGrid = JSON.parse(JSON.stringify(grid));  // Make a deep copy

    service.getDistanceMatrix({
        origins: [origin],
        destinations: destinations,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: departureTime, trafficModel: google.maps.TrafficModel.BEST_GUESS }
    },
        function (response, status) {
        if (status !== google.maps.DistanceMatrixStatus.OK) {
            console.log("Grid "+ newGrid.properties.gc +" Error:" + status + " grid:" + newGrid);
        } else {
            var travelDistance = [];
            var travelTimeNoTraffic = [];
            var travelTimeInTraffic = [];
            response.rows[0].elements.forEach(function (travel) {
                travelDistance.push(travel.distance.value);
                travelTimeNoTraffic.push(travel.duration.value);
                if (travel.duration_in_traffic) {
                    travelTimeInTraffic.push(travel.duration_in_traffic.value);
                }
            });
            newGrid.properties.distance = travelDistance;
            newGrid.properties.time = travelTimeNoTraffic;
            newGrid.properties.timeInTraffic = travelTimeInTraffic;
            console.log("Grid " + newGrid.properties.gc +
                " distance=" + newGrid.properties.distance +
                " time="+ newGrid.properties.time +
                " trafficTime=" + newGrid.properties.timeInTraffic);

        }
        callback(newGrid);
    });
}



function FindPath(origin, destination, departureTime, callback) {

    var request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: departureTime }
    };

    directionsService.route(request, function (response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            // Convert route to polyline
            var polyline = new google.maps.Polyline({
                path: [],
                strokeColor: '#000000',
                strokeWeight: 2
            });

            var legs = response.routes[0].legs;
            for (i = 0; i < legs.length; i++) {
                var steps = legs[i].steps;
                for (j = 0; j < steps.length; j++) {
                    var nextSegment = steps[j].path;
                    for (k = 0; k < nextSegment.length; k++) {
                        polyline.getPath().push(nextSegment[k]);
                    }
                }
            }
            callback(response, polyline);
        } else {
            console.log('Directions request failed due to ' + status);
            callback(response, null);
        }
    });
}

function FindNeighborhood(map, location, callback) {
    geocoder.geocode({ 'location': location }, function (results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
            if (results[1]) {
                var marker = new google.maps.Marker({
                    position: location,
                    map: map
                });
                infowindow.setContent(results[1].address_components[0].long_name);
                infowindow.open(map, marker);
                callback(results);

            } else {
                window.alert('No results found');
            }
        } else {
            window.alert('Geocoder failed due to: ' + status);
        }
    });
}

function LocationFromAddress(map, address, callback) {
    geocoder.geocode({ 'location': address }, function (results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
            if (results[1]) {
                callback(results);
            } else {
                window.alert('No results found');
            }
        } else {
            window.alert('Geocoder failed due to: ' + status);
        }
    });
}

function FindSchool(schoolName, schoolsData) {
    var school;
    for (var i = 0; i < schoolsData.length && school == null; i++) {
        if (schoolName == schoolsData[i].dbName) {
            school = schoolsData[i];
        }
    }
    return school;
}

function PolylineToArray(polyline) {
    var pointArray = [];
    var polyArray = polyline.getPath();

    polyArray.forEach(function (point) {
//        pointArray.push([point.lat(), point.lng()]);
        pointArray.push({lat:point.lat(), lng:point.lng()});
    });

    return pointArray;
}

function PolylineFromArray(array) {
    var polyline = new google.maps.Polyline();
    polyline.setPath(array);
    return polyline;
 }

function FindAccidentRate(path){
    var accidentRate = 0;

    // Algorithm to find and measure polyline overlap
    sections.forEach(function (route) {
        var points = [];
        //var routePolyline = new google.maps.Polyline;
        //routePolyline.setPath(route.polyline);
        path.forEach(function (pointLoc) {
            var point = new google.maps.LatLng(pointLoc.lat, pointLoc.lng);
            if (google.maps.geometry.poly.isLocationOnEdge(point, route.polyline)) {
                points.push(point);
            }
        });
        var distanceMiles = milePerMeter * google.maps.geometry.spherical.computeLength(points);
        accidentRate += route.rate * distanceMiles;
    });
    return accidentRate;
}

app.directive('onReadFile', function ($parse) {
    return {
        restrict: 'A',
        scope: false,
        link: function (scope, element, attrs) {
            var fn = $parse(attrs.onReadFile);
            
            element.on('change', function (onChangeEvent) {
                var reader = new FileReader();
                
                reader.onload = function (onLoadEvent) {
                    scope.$apply(function () {
                       
                        var splitOnCr = onLoadEvent.target.result.split("\n");
                        var csv = [];
                        splitOnCr.forEach(function (line, iLine) {
                            csv[iLine] = line.split("|");
                            if (iLine >= splitOnCr.length - 1) {
                                var permits = BuildingPermit(csv);
                                fn(scope, { $fileContent: permits });
                            }
                        });
                    });
                };
                reader.readAsText((onChangeEvent.srcElement |": ",onChangeEvent.target).files[0]);
            });
        }
    };
});

function BuildingPermit(data) {
    var permitsJSON = { "type": "FeatureCollection", "features": [] }
    
    data.forEach(function (permitEntry) {
        if (permitEntry[16] == 101 || permitEntry[16] == 105) {
            if (BSDZip(permitEntry[6])) {
                if (NewActivity(permitEntry[0])) {
                    var newFeature = AddFeature();
                    permitsJSON.features.push(newFeature);
                }
            }
        }
    });
    return permitsJSON;
};

function BSDZip(zip)
{
    var zipInBsd = false;
    switch (zip) {
        case 97003:
        case 97078:        case 97229:        case 97006:        case 97225:        case 97005:        case 97007:        case 97008:
        case 97223:
        case 97124:
            zipInBsd = true;
        break
    }
    return zipInBsd;
}

function NewActivity(activity) {
    var newActivity = false;
    
    return newActivity;
}

function AddFeature(newEntry){
    var newPoint = {
        "type": "Feature", "geometry": { "type": "Point", "coordinates": [] }, "properties": {
            "activity": newEntry[0],
            "project": newEntry[1],
            "phone_no": newEntry[2],
            "pa_add1": newEntry[3],
            "pa_add2": newEntry[4],
            "pa_add3": newEntry[5], 
            "pa_zip": newEntry[6], 
            "apptype": newEntry[7], 
            "firstname": newEntry[8], 
            "license": newEntry[9], 
            "sub_date ": newEntry[10], 
            "descript1": newEntry[11],
            "descript2": newEntry[12], 
            "type": newEntry[13], 
            "housecount": newEntry[14], 
            "units": newEntry[15], 
            "class": newEntry[16],
            "acc_date": newEntry[17], 
            "ent_date": newEntry[18], 
            "valuation": newEntry[19], 
            "parcel": newEntry[20], 
            "status": newEntry[21], 
            "construction": newEntry[22], 
            "diradd": newEntry[23], 
            "streetadd": newEntry[24], 
            "cityadd": newEntry[25], 
            "numadd": newEntry[26],
            "counter": newEntry[27]
        }
    };
};


