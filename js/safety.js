var app = angular.module('BoundaryEntry', ['chart.js']);
var map;
var directionsService;
var directionsDisplay;
var geocoder;
var infowindow;
var panel;
var points = []; // selected feature object
var routes = [];
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
        "accidentRate": 0,
        "accidents": 0,
        "period": 0,
        "traffic": ""
    };
	
    $scope.NewRoute = function () {
        points.forEach(function(point){
            console.log("latlng=" + point.getGeometry().get());
        });
        clearMarkers();
        Configure($scope);


    };

    $scope.DeleteRoute = function () {
		
    };    
	
    function initMap() {
        // Initialise the map.
        var myLatLng = { lat: 45.4980000, lng: -122.8216516 };
        var mapProp = {
            center: myLatLng,
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

		map = new google.maps.Map(document.getElementById('safety-map-holder'), mapProp);
		directionsService = new google.maps.DirectionsService;		
		var renderOptions = { preserveViewport: true };
        //directionsDisplay = new google.maps.DirectionsRenderer(renderOptions);
        geocoder = new google.maps.Geocoder;
        infowindow = new google.maps.InfoWindow;

        // Add the BSD boundary overlay
        var imageBounds = {
            north: 45.577690,
            south: 45.415266,
            east: -122.730426,
            west: -122.921350,
        };

        bsdOverlay = new google.maps.GroundOverlay('http://bsdmaps.monkeyblade.net/bsd-boundary-existing-overlay.png', imageBounds, {clickable:false});
        bsdOverlay.setMap(map);

		panel = document.getElementById('panel');
	
        Configure($scope);
    };

    initMap();
});

function Configure($scope) {
    // Initialise the map.
    map.data.setControls([]);

    map.data.setStyle(function (feature) {
		var color = 'grey';
        return { editable: true, draggable: true, strokeWeight: 0, fillColor: color };
    });

    //map.addListener('addfeature' , function (ev) {
    //    var geo = ev.feature.getGeometry();
    //    points.push(ev.feature);
    //});

    //map.addListener('mouseover', function (event) {
    //    map.data.revertStyle();
    //    map.data.overrideStyle(event.feature, { strokeWeight: 1 });
    //});
    
    //map.addListener('mouseout', function (event) {
    //    map.data.revertStyle();
    //});
    
    map.addListener('click', function (event) {
        
        if (points.length < 2) {
            addMarker(event.latLng);
        }
        if (points.length == 2) {
            FindPath(map, points[0].position, points[1].position, departDate, function (polyline) {
                // Algorithm to find and measure polyline overlap
                //routes.forEach(function (route) {
                //    var points = [];
                //    route.getPath().forEach(function (point) {
                //        if (google.maps.geometry.poly.isLocationOnEdge(point, polyline)) {
                //            points.push(point);
                //        }
                //    });
                //    var distanceMeters = google.maps.geometry.spherical.computeLength(points);
                //    var overlapPolyline = new google.maps.Polyline({ path: points, clickable: false, strokeColor: '#FF0000', strokeWeight: 8, map : map })
                //});
                polyline.setMap(map);
                routes.push(polyline);
                //deleteMarkers();
            });
        }
    });
    //map.addListener('removefeature', function (event) { });
};

//computeDistanceBetween(from:LatLng, to:LatLng, radius?:number)
//google.maps.geometry.poly 
//bool containsLocation(point:LatLng, polygon:Polygon)
//isLocationOnEdge(point:LatLng, poly:Polygon|Polyline, tolerance?:number) // Computes whether the given point lies inside the specified polygon.
//LatLngBounds contains, intersects, union

//function Center(grid) {
//	var maxLat, minLat, maxLong, minLong;

//	maxLong = minLong = grid.geometry.coordinates[0][0][0];
//	maxLat = minLat = grid.geometry.coordinates[0][0][1];
	
//	for (var i=1; i < grid.geometry.coordinates[0].length; i++) {
//		if (grid.geometry.coordinates[0][i][0] < minLong) {
//			minLong = grid.geometry.coordinates[0][i][0]
//		}
//		if (grid.geometry.coordinates[0][i][0] > maxLong) {
//			maxLong = grid.geometry.coordinates[0][i][0]
//		}
//		if (grid.geometry.coordinates[0][i][1] < minLat) {
//			minLat = grid.geometry.coordinates[0][i][1]
//		}
//		if (grid.geometry.coordinates[0][i][1] > maxLat) {
//			maxLat = grid.geometry.coordinates[0][i][1]
//		}
//	}
	
//	var center = {lat:(maxLat+minLat)/2, lng: (maxLong+minLong)/2};

//	return center;
//}


function FindPath(map, origin, destination, departureTime, callback) {
       
    var request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: departureTime }
    };

	//directionsDisplay.setMap(map);
	directionsService.route(request, function (result, status) {
		if (status === google.maps.DirectionsStatus.OK) {
            //directionsDisplay.setDirections(result);
            
            var polyline = new google.maps.Polyline({
                path: [],
                clickable: false,
                strokeColor: '#000000',
                strokeWeight: 2
            });
                                
            var bounds = new google.maps.LatLngBounds();
            var path = result.routes[0].overview_path;
            var legs = result.routes[0].legs;
            for (i = 0; i < legs.length; i++) {
                var steps = legs[i].steps;
                for (j = 0; j < steps.length; j++) {
                    var nextSegment = steps[j].path;
                    for (k = 0; k < nextSegment.length; k++) {
                        polyline.getPath().push(nextSegment[k]);
                        bounds.extend(nextSegment[k]);
                    }
                }
            }

			callback(polyline);
		} else {
			window.alert('Directions request failed due to ' + status);
		}
	});
}

// Adds a marker to the map and push to the array.
function addMarker(location) {
    var marker = new google.maps.Marker({
        position: location,
        map: map,
        draggable:true
    });
    marker.addListener('dragend', MarkerDrag);
    points.push(marker);
}

function MarkerDrag(event) {
    if (points.length == 2) {
        var last = routes.pop();
        last.setMap(null);
        FindPath(map, points[0].position, points[1].position, departDate, function (polyline) {
            // Algorithm to find and measure polyline overlap
            //routes.forEach(function (route) {
            //    var points = [];
            //    route.getPath().forEach(function (point) {
            //        if (google.maps.geometry.poly.isLocationOnEdge(point, polyline)) {
            //            points.push(point);
            //        }
            //    });
            //    var distanceMeters = google.maps.geometry.spherical.computeLength(points);
            //    var overlapPolyline = new google.maps.Polyline({ path: points, clickable: false, strokeColor: '#FF0000', strokeWeight: 8, map : map })
            //});
            polyline.setMap(map);
            routes.push(polyline);
                //deleteMarkers();
        });
    }
};

// Sets the map on all points in the array.
function setMapOnAll(map) {
    for (var i = 0; i < points.length; i++) {
        points[i].setMap(map);
    }
}

// Removes the points from the map, but keeps them in the array.
function clearMarkers() {
    setMapOnAll(null);
}

// Shows any points currently in the array.
function showMarkers() {
    setMapOnAll(map);
}

// Deletes all points in the array by removing references to them.
function deleteMarkers() {
    clearMarkers();
    points = [];
}

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


