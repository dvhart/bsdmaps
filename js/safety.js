var app = angular.module('BoundaryEntry', ['chart.js']);
var map;
var directionsService;
var directionsDisplay;
var geocoder;
var infowindow;
var infoWindowMarker;
var panel;
var points = []; // selected feature object
var newRoute;
var selectedRoute;
var routes = [];
var selectedFeature; //  JSON selected grid
var results;
var milePerMeter = 0.000621371;
var selectedRoute;
var selectedIndex = -1;
var routeWidth = 4;
var highlightWidth = 7;

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
        "aadt": 0,
        "sectionLength":0
    };
	
    $scope.NewRoute = function () {
        if (newRoute != null) {
            var length = milePerMeter * google.maps.geometry.spherical.computeLength(newRoute.getPath());
            var section = {
                rate: $scope.data.accidentRate, 
                accidents: $scope.data.accidents, 
                period: $scope.data.period, 
                aadt: $scope.data.aadt, 
                length: length, 
                polyline: newRoute.getPath()
            };
            
            $scope.data.sectionLength = length;
            newRoute.setMap(null);
            newRoute = null;

            if (section.rate == 0) {
                section.rate = AccidentRate(section.accidents, section.period, section.aadt, section.length);
            }
            $http.post('/NewSection', section).then(function (response) {
                routes = RefreshFromSafetyDB(response, map);
                deleteMarkers();
                
                SetRouteCallback(routes);

                Configure($scope);
                $scope.data.accidentRate = 0;
                $scope.data.accidents = 0;
                $scope.data.period = 0;
                $scope.data.aadt = 0;
                $scope.data.response = "Stored Route";
            });
        }
    };

    $scope.DeleteRoute = function () {
        if (selectedRoute) {
            selectedRoute.polyline.setMap(null);
            selectedRoute.polyline = selectedRoute.polyline.getPath();
            $http.post('/DeleteSection', selectedRoute).then(function (response) {
                routes = RefreshFromSafetyDB(response, map);
                deleteMarkers();
                
                selectedRoute = null;
                selectedIndex = -1;
                infowindowMarker.setMap(null);

                SetRouteCallback(routes);
                
                Configure($scope);
                $scope.data.accidentRate = 0;
                $scope.data.accidents = 0;
                $scope.data.period = 0;
                $scope.data.aadt = 0;
                $scope.data.response = "Route Deleted";
            });
        }
    };
    
    function GetRouteSections()
    {
        $http.get('/GetSection').then(function (response) {
            routes = RefreshFromSafetyDB(response, map);
            SetRouteCallback(routes);
            Configure($scope);
        });
    }  
	
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
        infowindowMarker = new google.maps.Marker();
       

        // Add the BSD boundary overlay
        var imageBounds = {
            north: 45.577690,
            south: 45.415266,
            east: -122.730426,
            west: -122.921350,
        };

        bsdOverlay = new google.maps.GroundOverlay('http://bsdmaps.monkeyblade.net/bsd-boundary-existing-overlay.png', imageBounds, {clickable:false});
        bsdOverlay.setMap(map);
        bsdOverlay.setOpacity(0.4);


		panel = document.getElementById('panel');
        
        GetRouteSections()
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
    
    // Adds a marker to the map and push to the array.
    function addMarker(location) {
        var marker = new google.maps.Marker({
            position: location,
            map: map,
            draggable: true
        });
        marker.addListener('dragend', function (event) {
            if (points.length == 2) {
                FindRoute(points[0].position, points[1].position, routes, function (length) {
                    $scope.data.sectionLength = length;
                    $scope.$apply();
                });
            }
        });
        points.push(marker);
    }
    
    map.addListener('click', function (event) {
        
        if (points.length < 2) {
            addMarker(event.latLng);
        }
        if (points.length == 2) {
            FindRoute(points[0].position, points[1].position, routes, function (length) {
                $scope.data.sectionLength = length;
                $scope.$apply();
            });
        }

    });
    //map.addListener('removefeature', function (event) { });
};


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
                strokeColor: '#000000',
                strokeWeight: routeWidth, 
                clickable : true,
            });
                                
            var legs = result.routes[0].legs;
            for (i = 0; i < legs.length; i++) {
                var steps = legs[i].steps;
                for (j = 0; j < steps.length; j++) {
                    var nextSegment = steps[j].path;
                    for (k = 0; k < nextSegment.length; k++) {
                        polyline.getPath().push(nextSegment[k]);
                    }
                }
            }

			callback(polyline);
		} else {
			window.alert('Directions request failed due to ' + status);
		}
	});
}



function FindRoute(origin, destination, routes, callback) {
    if (newRoute) {
        newRoute.setMap(null);
    }
    FindPath(map, origin, destination, departDate, function (polyline) {
        var points = [];
        newRoute = polyline;
        newRoute.setMap(map);
        sectionLength = milePerMeter * google.maps.geometry.spherical.computeLength(newRoute.getPath());
        callback(sectionLength);
    });
};

// Sets the map on all points in the array.
function setMapOnAll(map) {
    for (var i = 0; i < points.length; i++) {
        points[i].setMap(map);
    }
}

// Shows any points currently in the array.
function showMarkers() {
    setMapOnAll(map);
}

// Deletes all points in the array by removing references to them.
function deleteMarkers() {
    setMapOnAll(null);
    points = [];
}

function SetRouteCallback(routes)
{
    routes.forEach(function (route, iRoute) {
        route.polyline.setOptions({ clickable: true });
        map.data.add(route.polyline);
        route.polyline.addListener('click', function (event) {
            FindRouteAtPoint(event.latLng)
        });
    });
}

function FindRouteAtPoint(latlng) {   
    var routeToDelete = -1;
    
    var scale = 3e-2 / map.getZoom();
    
    if (selectedRoute) {
        selectedRoute.polyline.setOptions({ strokeWeight: routeWidth });
        selectedRoute.polyline.setMap(map);
    }
    selectedRoute = null;
    selectedIndex = -1;

    routes.forEach(function (route, iRoute) {
        
        if (!selectedRoute && google.maps.geometry.poly.isLocationOnEdge(latlng, route.polyline, scale)) {
            selectedRoute = route;
            selectedIndex = iRoute;
            selectedRoute.polyline.setOptions({ strokeWeight: highlightWidth });
            selectedRoute.polyline.setMap(map);
            var msg = "rate:" + selectedRoute.rate.toFixed(2) + 
                "<br>aadt:" + selectedRoute.aadt.toFixed(0) + 
                "<br>accidents:" + selectedRoute.accidents +
                "<br>period:" + selectedRoute.period +
                "<br>length:" + selectedRoute.length.toFixed(2);
            infowindow.setContent(msg);
            infowindow.open(map, infowindowMarker);
            infowindowMarker.setPosition(latlng);
            infowindowMarker.setVisible(false);
            infowindowMarker.setMap(map);


        }
    });
}


