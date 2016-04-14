var app = angular.module('BoundaryEntry', []);
var map;
var panel;
var selectedGrid; // selected feature object
var selectedFeature; //  JSON selected grid
var newFeature;
var localOverlay;




var schools = [
    { id: 0, dbName: 'Aloha', displayName: 'Aloha', color: 'blue', capacity: 2176, location: { lat: 45.4857177, lng: -122.8695357 } },
    { id: 1, dbName: 'Beaverton', displayName: 'Beaverton', color: 'orange', capacity: 2122, location: { lat: 45.4862121, lng: -122.8111987 } },
    { id: 2, dbName: 'Cooper', displayName: 'Cooper Mtn', color: 'green', capacity: 2176, location: { lat: 45.4263618, lng: -122.853657 } },
    { id: 3, dbName: 'Southridge', displayName: 'Southridge', color: 'red', capacity: 1850, location: { lat: 45.4507757, lng: -122.8063213 } },
    { id: 4, dbName: 'Sunset', displayName: 'Sunset', color: 'purple', capacity: 2203, location: { lat: 45.5275752, lng: -122.8188107 } },
    { id: 5, dbName: 'Westview', displayName: 'Westview', color: 'pink', capacity: 2421, location: { lat: 45.5489509, lng: -122.8663216 } }
];


var destination = [];
schools.forEach(function (school) {
    destination.push(school.location);
});


app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = { "gc": 12, "hs2020": 10, "reducedLunch": 0, "notFRL": 0, "high": "Westview", "middle": "Meadow Park", "elementary": "Beaver Acres", "centroid": [0,0], "distance":[0,0,0,0,0,0], "time": [0, 0, 0, 0, 0, 0], "view":"high" };
    $scope.master = {};

    $scope.update = function (user) {
        $scope.master = angular.copy(user);
    };

    $scope.reset = function () {
        $scope.data = angular.copy($scope.master);
    };

    $scope.reset();


    $scope.NewGrid = function (formData) {
        if (newFeature != null) {
            var grid = newFeature;
            var centroid = Centroid(grid.geometry.coordinates[0]);
            var origin = [{ lat: centroid[1], lng: centroid[0] }];

            var service = new google.maps.DistanceMatrixService;
            service.getDistanceMatrix({
                origins: origin,
                destinations: destination,
                travelMode: google.maps.TravelMode.DRIVING,
                unitSystem: google.maps.UnitSystem.imperial,
                avoidHighways: false,
                avoidTolls: false
            }, function (response, status) {
                if (status !== google.maps.DistanceMatrixStatus.OK) {
                    alert('Error was: ' + status);
                } else {
                    var schoolDistance = [0, 0, 0, 0, 0, 0];

                    for (var i = 0; i < response.rows[0].elements.length; i++) {
                        schoolDistance[i] = response.rows[0].elements[i].distance.value; //distance in meters
                    }

                    grid.properties = {
                        "gc": $scope.data.gc,
                        "hs2020": $scope.data.hs2020,
                        "reducedLunch": $scope.data.reducedLunch,
                        "notFRL": $scope.data.notFRL,
                        "high": $scope.data.high,
                        "middle": $scope.data.middle,
                        "elementary": $scope.data.elementary,
                        "centroid": centroid,
                        "distance": schoolDistance,
                        "time": [0, 0, 0, 0, 0, 0]
                    }

                    $http.post('/NewGrid', grid).then(function (response) {
                        RefreshFromDB(response);
                        Configure($scope);
                    });
                }
            });
        }
    };

    $scope.DBRefresh = function () {
        map.data.revertStyle();
        $http.get('/GetFeatures').then(function (response) {
            RefreshFromDB(response);
            Configure($scope);
        });
    };

    $scope.EditGrid = function (formData) {
        map.data.revertStyle();
        if (selectedFeature != null && selectedGrid != null) {
            selectedGrid.toGeoJson(function (grid) {

                var centroid = Centroid(grid.geometry.coordinates[0]);
                var origin = [{ lat: centroid[1], lng: centroid[0] }];

                var service = new google.maps.DistanceMatrixService;
                service.getDistanceMatrix({
                    origins: origin,
                    destinations: destination,
                    travelMode: google.maps.TravelMode.DRIVING,
                    unitSystem: google.maps.UnitSystem.METRIC,
                    avoidHighways: false,
                    avoidTolls: false
                }, function (response, status) {
                    if (status !== google.maps.DistanceMatrixStatus.OK) {
                        alert('Error was: ' + status);
                    } else {
                        var schoolDistance = [0, 0, 0, 0, 0, 0];

                        for (var i = 0; i < response.rows[0].elements.length; i++) {
                            schoolDistance[i] = response.rows[0].elements[i].distance.value; //distance in meters
                        }

                        if (grid.properties.id) {
                            grid._id = grid.properties.id;
                            delete grid.properties.id;
                        }

                        grid.properties = {
                            "gc": $scope.data.gc,
                            "hs2020": $scope.data.hs2020,
                            "reducedLunch": $scope.data.reducedLunch,
                            "notFRL": $scope.data.notFRL,
                            "high": $scope.data.high,
                            "middle": $scope.data.middle,
                            "elementary": $scope.data.elementary,
                            "centroid": centroid,
                            "distance": schoolDistance,
                            "time": [0, 0, 0, 0, 0, 0]
                        }

                        $http.post('/EditGrid', grid).then(function (response) {
                            RefreshFromDB(response);
                            Configure($scope);
                        });
                    }
                });
            });
        }
    };

    $scope.DeleteGrid = function (formData) {
        if (selectedGrid != null) {
            selectedGrid.toGeoJson(function (geoJson) {

                // move id to top level from properties
                if (geoJson.properties.id) {
                    geoJson._id = geoJson.properties.id;
                    delete geoJson.properties.id;
                }

                $http.post('/DeleteGrid', geoJson).then(function (response) {
                    RefreshFromDB(response);
                    Configure($scope);
                });
            });
        }
    };

    $scope.ChangeView = function (formData) {
        Configure($scope);
    }


    function initMap() {
        // Initialise the map.
        var myLatLng = { lat: 45.4834817, lng: -122.8216516 };
        var mapProp = {
            center: myLatLng,
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        map = new google.maps.Map(document.getElementById('map-holder'), mapProp);

        // Add the BSD aggregated data overlay (boundaries, grid, and frl)
        var imageBounds = {
            // Values from Google maps need some tweaking
            // north: 45.577106,
            // south: 45.415266,
            // east: -122.720426,
            // west: -122.921279,
            north: 45.577690,
            south: 45.415266,
            east: -122.730426,
            west: -122.921350,
        };

        localOverlay = new google.maps.GroundOverlay('http://bsdmaps.monkeyblade.net/bsd-boundary-data-merged-overlay.png', imageBounds);
        localOverlay.setMap(map);

        panel = document.getElementById('panel');

        $http.get('/GetFeatures').then(function (response) {
            RefreshFromDB(response);
            Configure($scope);
        });
    }    ;

    initMap();
});

function RefreshFromDB(dbData) {
    try {

        var geoJsonData = { "type": "FeatureCollection", "features": dbData.data };

        // Database ID does not survive going to and from google maps unless it is copied into properties
        geoJsonData.features.forEach(function (grid, iGrid) {
            if (grid._id) {
                grid.properties.id = grid._id;
            }
        });

        var newData = new google.maps.Data({map: map});
        newData.addGeoJson(geoJsonData);

        // No error means GeoJSON was valid!
        map.data.setMap(null);
        map.data = newData;

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
    map.data.setControls(['Polygon']);

    map.data.setStyle(function (feature) {
        var view = "elementary";

        var color = 'grey';
        if ($scope.data.view == "frl") {

            var hs2020 = feature.getProperty("hs2020");
            var frlCount = feature.getProperty("reducedLunch");
            var nonFrl = feature.getProperty("notFRL");

            var percentFRL = 0;
            if (nonFrl) {
                var den = frlCount + nonFrl
                if (den > 0) {
                    percentFRL = frlCount / den;
                }
            }
            else if(hs2020 > 0){
                percentFRL = frlCount / hs2020;
            }

            color = HeatMap(0, 1, percentFRL);

        }
        else if ($scope.data.view == "high") {
            switch (feature.getProperty('high')) {
                case 'Sunset': color = 'purple'; break;
                case 'Beaverton': color = 'orange'; break;
                case 'Westview': color = 'pink'; break;
                case 'Aloha': color = 'blue'; break;
                case 'Southridge': color = 'red'; break;
                case 'Cooper': color = 'green'; break;
            }
        }
        else if ($scope.data.view == "middle") {
            switch (feature.getProperty('middle')) {
                case 'Cedar Park': color = 'purple'; break;
                case 'Conestoga': color = 'orange'; break;
                case 'Five Oaks': color = 'pink'; break;
                case 'Highland Park': color = 'blue'; break;
                case 'Meadow Park': color = 'red'; break;
                case 'Mountain View': color = 'green'; break;
                case 'Stoller': color = 'Peru'; break;
                case 'Whitford': color = 'PaleVioletRed'; break;
            }
        }
        else {
            switch (feature.getProperty('elementary')) {
                case 'Aloha-Huber Park': color = 'AliceBlue'; break;
                case 'Barnes': color = 'Brown'; break;
                case 'Beaver Acres': color = 'Chartreuse'; break;
                case 'Bethany': color = 'Coral'; break;
                case 'Bonny Slope': color = 'DarkGreen'; break;
                case 'Cedar Mill': color = 'DarkMagenta'; break;
                case 'Chehalem': color = 'DeepSkyBlue'; break;
                case 'Cooper Mountain': color = 'DarkOrange'; break;
                case 'Elmonica': color = 'Gold'; break;
                case 'Errol Hassell': color = 'HotPink'; break;
                case 'Findley': color = 'Tomato'; break;
                case 'Fir Grove': color = 'MediumOrchid'; break;
                case 'Greenway': color = 'Peru'; break;
                case 'Hazeldale': color = 'OrangeRed'; break;
                case 'Hiteon': color = 'PaleGreen'; break;
                case 'Jacob Wismer': color = 'PaleVioletRed'; break;
                case 'Kinnaman': color = 'LightBlue'; break;
                case 'Mckay': color = 'PaleVioletRed'; break;
                case 'Mckinley': color = 'Red'; break;
                case 'Montclair': color = 'Sienna'; break;
                case 'Nancy Ryles': color = 'SeaGreen'; break;
                case 'Oak Hills': color = 'Teal'; break;
                case 'Raleigh Hills': color = 'MediumVioletRed'; break;
                case 'Raleigh Park': color = 'Navy'; break;
                case 'Ridgewood': color = 'YellowGreen'; break;
                case 'Rock Creek': color = 'SteelBlue'; break;
                case 'Scholls Heights': color = 'RosyBrown'; break;
                case 'Sexton Mountain': color = 'RoyalBlue'; break;
                case 'Springville': color = 'MediumTurquoise'; break;
                case 'Terra Linda': color = 'SaddleBrown'; break;
                case 'Vose': color = 'SlateGray'; break;
                case 'West Tualatin View': color = 'Yellow'; break;
                case 'William Walker': color = 'Salmon'; break;
                default: console.log("Did not find elementary gc:"+ +feature.getProperty('gc')+ " elementary:" + feature.getProperty('elementary'));
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

    map.data.addListener('click', function (event) {
        map.data.revertStyle();

        selectedGrid = event.feature;
        event.feature.toGeoJson(function (grid) {
            selectedFeature = grid;
            $scope.data.gc = grid.properties.gc;
            $scope.data.hs2020 = grid.properties.hs2020;
            $scope.data.reducedLunch = grid.properties.reducedLunch;
            $scope.data.notFRL = grid.properties.notFRL;
            $scope.data.high = grid.properties.high;
            $scope.data.middle = grid.properties.middle;
            $scope.data.elementary = grid.properties.elementary;
            $scope.data.centroid = grid.properties.centroid;
            $scope.data.distance = grid.properties.distance;
        });

        map.data.overrideStyle(event.feature, { editable: true, draggable: true, strokeWeight: 1 });
        $scope.$apply();
    });

    // Set up events for styling.
    //google.maps.event.addDomListener(window, 'resize', resizeGeoJsonInput);
}

function deleteMarkers(markersArray) {
    for (var i = 0; i < markersArray.length; i++) {
        markersArray[i].setMap(null);
    }
    markersArray = [];
}

function HeatMap(minimum, maximum, value)
{
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

