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
    {id:2, dbName:'Cooper', displayName:'Cooper Mtn', color:'green', capacity:2176, location:{ lat: 45.4263618, lng: -122.853657 }}, 
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
		"timeInTraffic": [0, 0, 0, 0, 0, 0]
    };
	
	$scope.Recalculate = function () {
		
		var destinations = [];
		schools.forEach(function (school) {
			destinations.push(school.location);
		});
		
		$http.get('/GetFeatures').then(function (response) {
			var end = response.data.length;
			//end = 3; // Testing
			var j = 0;
            var grids = [];
            var intervalDelayMs = 2000;
            
            // Delay update
			var intervalID = setInterval(function () {
				while (j < end - 1 && response.data[j].properties.time[0] != 0) {
					grids.push(response.data[j]);
					j++;
				}
				FindDistance(map, PolygonCenter(response.data[j].geometry.coordinates), destinations, departDate, function (newGrid) {
					grids.push(newGrid);
					j++;
					if (j >= end) {
						clearInterval(intervalID);
						$http.post('/SetFeatures', grids);
						console.log("Recalculate Complete");
					}
				});
			}, intervalDelayMs);
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
            FindRoute(PolygonCenter(grid.geometry.coordinates), school.location, routes, function (results) {
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
    FindPath(map, origin, destination, departDate, function (response, polyline) {
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



function FindPath(map, origin, destination, departureTime, callback) {
	
    directionsDisplay.setMap(map);
    
    var request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: departureTime }
    };
	
	directionsService.route(request, function (response, status) {
		if (status === google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(response);
            
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
			window.alert('Directions request failed due to ' + status);
		}
	});
}

function FindNeighborhood(map, location, callback) {
    var location = response.routes[0].legs[0].steps[0].start_point;
    geocoder.geocode({ 'location': location }, function (results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
            if (results[1]) {
                var marker = new google.maps.Marker({
                    position: latlng,
                    map: map
                });
                infowindow.setContent(results[1].formatted_address);
                infowindow.open(map, marker);
                
                var neighborhood = results[1].formatted_address;
                
                callback(neighborhood);

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


