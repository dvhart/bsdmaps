var app = angular.module('BoundaryEntry', ['chart.js']);
var map;
var directionsService;
var directionsDisplay;
var panel;
var selectedGrid; // selected feature object
var selectedFeature; //  JSON selected grid
var results;
var milePerMeter = 0.000621371;

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
        "centroid": [0,0],
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
			
			var intervalID = setInterval(function () {
				while (j < end - 1 && response.data[j].properties.time[0] != 0) {
					grids.push(response.data[j]);
					j++;
				}
				FindDistance(map, response.data[j], destinations, departDate, function (newGrid) {
					grids.push(newGrid);
					j++;
					if (j >= end) {
						clearInterval(intervalID);
						$http.post('/SetFeatures', grids);
						console.log("Recalculate Complete");
					}
				});
			}, 2000);
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
        if (selectedGrid == null) {
            map.data.revertStyle();
            map.data.overrideStyle(event.feature, { strokeWeight: 1 });
        }
    });
    
    map.data.addListener('mouseout', function (event) {
        if (selectedGrid == null) {
            map.data.revertStyle();
        }
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
		});
		
		map.data.overrideStyle(event.feature, { strokeWeight: 1 });		
			
		$scope.$apply();
    });
};

function Center(grid) {
	var maxLat, minLat, maxLong, minLong;

	maxLong = minLong = grid.geometry.coordinates[0][0][0];
	maxLat = minLat = grid.geometry.coordinates[0][0][1];
	
	for (var i=1; i < grid.geometry.coordinates[0].length; i++) {
		if (grid.geometry.coordinates[0][i][0] < minLong) {
			minLong = grid.geometry.coordinates[0][i][0]
		}
		if (grid.geometry.coordinates[0][i][0] > maxLong) {
			maxLong = grid.geometry.coordinates[0][i][0]
		}
		if (grid.geometry.coordinates[0][i][1] < minLat) {
			minLat = grid.geometry.coordinates[0][i][1]
		}
		if (grid.geometry.coordinates[0][i][1] > maxLat) {
			maxLat = grid.geometry.coordinates[0][i][1]
		}
	}
	
	var center = {lat:(maxLat+minLat)/2, lng: (maxLong+minLong)/2};

	return center;
}

function FindDistance(map, grid, destinations, departureTime, callback) {
	var service = new google.maps.DistanceMatrixService;
	var newGrid = JSON.parse(JSON.stringify(grid));  // Make a deep copy

	service.getDistanceMatrix({
		origins: [Center(grid)],
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

//function FindDistance(map, origin, destination, departureTime, callback) {
	
//	directionsDisplay.setMap(map);
	
	
//	directionsService.route({
//		origin: origin,
//		destination: destination,
//		travelMode: google.maps.TravelMode.DRIVING,
//		drivingOptions: {departureTime: departureTime}
//	}, function (response, status) {
//		if (status === google.maps.DirectionsStatus.OK) {
//			directionsDisplay.setDirections(response);
//			callback(response);
//		} else {
//			window.alert('Directions request failed due to ' + status);
//		}
//	});
//}

function FindSchool(schoolName, schoolsData) {
	var school;
	for (var i = 0; i < schoolsData.length && school == null; i++) {
		if (schoolName == schoolsData[i].dbName) {
			school = schoolsData[i];
		}
	}
	return school;
}


