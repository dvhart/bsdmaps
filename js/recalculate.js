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
var routes = [];
var newRoute;

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
        "gc": 0,
        "hs2020": 0,
        "reducedLunch": 0,
        "high": "",
        "middle": "",
        "elementary": "",
        "routeLength":0,
        "accidentRate": 0,
        "centroid": [0, 0],
        "distance":[0, 0, 0, 0, 0, 0],
		"time": [0, 0, 0, 0, 0, 0],
        "timeInTraffic": [0, 0, 0, 0, 0, 0],
        "progress":"recompute status"
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
                var intervalDelayMs = 3000;
                
                // Delay update
                var intervalID = setInterval(function () {
                    
                    // Skip grids that already have populated field
                    // Fast forward to point that we need to look up path to school
                    var needPath = false;
                    while (iGrid < end && !needPath) {
                        
                        if (routes.length < iGrid+1) {
                            routes[iGrid] = { gc: grids[iGrid].properties.gc, path: [] };
                            needPath = true;
                        }
                        else {
                            if (routes[iGrid].path.length < iSchool+1 || !routes[iGrid].path[iSchool]) {
                                needPath = true;
                            }
                            else {
                                iSchool++;
                                if (iSchool >= destinations.length) {
                                    iSchool = 0;
                                    iGrid++;
                                }
                            } 
                        }
                    }
                    
                    if (!needPath) { // Done.  Save and exit
                        clearInterval(intervalID); // Done.  Don't restart interval timer
                       // $http.post('/SetFeatures', grids);
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
                            
                            if (findPathResponse.status == "OK") {
                                directionsDisplay.setDirections(findPathResponse);
                                
                                var distance = findPathResponse.routes[0].legs[0].distance.value;
                                var duration = findPathResponse.routes[0].legs[0].duration.value
                                grids[iGrid].properties.distance[iSchool] = distance;
                                grids[iGrid].properties.time[iSchool] = duration;
                                routes[iGrid].path[iSchool] = PolylineToArray(polyline);
                                
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
    
    $scope.CalculateSafety = function() {
        
        $http.get('/GetFeatures').then(function (getFeatures) {
            $http.get('/GetRoutes').then(function (getRoutes) {
                $http.get('/GetSection').then(function (getSafety) {
                    getFeatures.data.forEach(function (grid, iGrid) {
                        grid.properties.accidentRate = [0, 0, 0, 0, 0, 0];
                        
                        var gridRoutes = getRoutes.data[iGrid];
                        if (gridRoutes.gc != grid.properties.gc) { // Indexes don't match, search for matching grid
                            gridRoutes = null;
                            for (var i = 0; i < getRoutes.data.length && !gridRoutes; i++) {
                                if (getRoutes.data[i].gc == grid.properties.gc) {
                                    gridRoutes = getRoutes.data[i];
                                }
                            }
                        }
                        
                        if (gridRoutes) {
                            gridRoutes.path.forEach(function (route, iRoute) {
                                var routePolyline = new google.maps.Polyline();
                                routePolyline.setPath(route);                                
                                grid.properties.accidentRate[iRoute] = FindAccidentRate(getSafety.data, routePolyline);
                                $scope.data.progressSafety = "gc " + grid.properties.gc +" rate "+ grid.properties.accidentRate[iRoute];
                                $scope.$apply();                                
                            });
                        }
                    });
                    
                    $http.post('/SetFeatures', getFeatures.data);
                    $scope.data.progressSafety = "Done Computing Accident Rate";
                    $scope.$apply();
                });
            });
        });
    };
	
    function initMap() {
        // Initialise the map.
        var myLatLng = { lat: 45.4834817, lng: -122.8216516 };
        var mapProp = {
            center: myLatLng,
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

		map = new google.maps.Map(document.getElementById('map-holder'), mapProp);
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
            west: -122.921350,
        };

        bsdOverlay = new google.maps.GroundOverlay('http://bsdmaps.monkeyblade.net/bsd-boundary-existing-overlay.png', imageBounds);
        bsdOverlay.setMap(map);

		panel = document.getElementById('panel');
	
        $http.get('/GetFeatures').then(function (response) {
            RefreshFromGrids(response.data);
            
            $http.get('/GetSection').then(function (sectionResponse) {
                routes = RefreshFromSafetyDB(sectionResponse, map);
            });

            Configure($scope);
        });
    };

    initMap();
});

function RefreshFromGrids(grids) {
    try {
        var geoJsonData = { "type": "FeatureCollection", "features": grids };

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


function Configure($scope) {
    // Initialise the map.
    map.data.setControls(['LineString', 'Polygon']);

    map.data.setStyle(function (feature) {
        var highSchool = feature.getProperty('high');

		var color;
		var school = FindSchool(highSchool, schools);
		if (school) {
			color = school.color;
		}
		else {
			color = 'grey';
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
        selectedGrid = event.feature;
        event.feature.toGeoJson(function (grid) {
            selectedFeature = grid;
            $scope.data.gc = grid.properties.gc;
            $scope.data.hs2020 = grid.properties.hs2020;
            $scope.data.reducedLunch = grid.properties.reducedLunch;
            $scope.data.high = grid.properties.high;
            $scope.data.middle = grid.properties.middle;
            $scope.data.elementary = grid.properties.elementary;
            $scope.data.centroid = grid.properties.centroid;
            $scope.data.distance = grid.properties.distance;
            $scope.data.time = grid.properties.time;
            
            if (grid.properties.timeInTraffic) {
                $scope.data.timeInTraffic = grid.properties.timeInTraffic;
            }
            var school = FindSchool(grid.properties.high, schools);
            var center = PolygonCenter(grid.geometry.coordinates);          
            FindRoute(center, school.location, routes, function (results) {
                $scope.data.routeLength = results.length;
                $scope.data.accidentRate = results.accidentRate;
                var gridPath = { gc: grid.properties.gc, paths: [{ high: grid.properties.high, path: results.polyline }] };                
                map.data.overrideStyle(event.feature, { strokeWeight: 1 });
                $scope.$apply();
            });
        });
    });
};

function FindRoute(origin, destination, routes,  callback) {
    var results = { length: 0, accidentRate: 0, polyline: {} };
    if (newRoute) {
        newRoute.setMap(null);
    }
    directionsDisplay.setMap(map);
    FindPath(origin, destination, departDate, function (response, polyline) {

        directionsDisplay.setDirections(response);
        var points = [];
        // Algorithm to find and measure polyline overlap
        routes.forEach(function (route) {
            var points = [];
            route.polyline.getPath().forEach(function (point) {
                if (google.maps.geometry.poly.isLocationOnEdge(point, polyline)) {
                    points.push(point);
                }
            });
            var distanceMeters = google.maps.geometry.spherical.computeLength(points);
            results.accidentRate += distanceMeters* milePerMeter * route.rate;
            var overlapPolyline = new google.maps.Polyline({ path: points, clickable: false, strokeColor: '#FF0000', strokeWeight: 5, map : map })
        });
        newRoute = polyline;
        newRoute.setMap(map);
        results.length = response.routes[0].legs[0].distance.value;
        results.polyline = polyline;
        callback(results);
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
		if (status === google.maps.DirectionsStatus.OK) {           
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
        
function FindAccidentRate(routes, polyline){
    var accidentRate = 0;

    // Algorithm to find and measure polyline overlap
    routes.forEach(function (route) {
        var points = [];
        var routePolyline = new google.maps.Polyline;
        routePolyline.setPath(route.polyline);
        routePolyline.getPath().forEach(function (point) {
            if (google.maps.geometry.poly.isLocationOnEdge(point, polyline)) {
                points.push(point);
            }
        });
        var distanceMiles = milePerMeter * google.maps.geometry.spherical.computeLength(points);
        accidentRate += route.accidentRate * distanceMiles;
    });
    return accidentRate;
}



