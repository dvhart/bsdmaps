var app = angular.module('BoundaryEntry', ['chart.js']);
var map;
var panel;
var selectedGrid; // selected feature object
var selectedFeature; //  JSON selected grid
var milePerMeter = 0.000621371;

// Google Map Overlays
var bsdOverlay;

var schoolData = {schools:[
    {id:0, dbName:'Aloha', displayName:'Aloha', color:'blue', location:{ lat: 45.4846754, lng: -122.8711176 }},
    {id:1, dbName:'Beaverton', displayName:'Beaverton', color:'orange', location:{ lat: 45.4862466, lng: -122.8127043 }},
    {id:2, dbName:'Cooper', displayName:'Cooper Mtn', color:'green', location:{ lat: 45.4246773, lng: -122.8589781 }},
    {id:3, dbName:'Southridge', displayName:'Southridge', color:'red', location:{ lat: 45.450176, lng: -122.8097826 }},
    {id:4, dbName:'Sunset', displayName:'Sunset', color:'purple', location:{ lat: 45.5275796, lng: -122.8188543 }},
    {id:5, dbName:'Westview', displayName:'Westview', color:'pink', location:{ lat: 45.55027, lng: -122.8682147}},
    ]};

    /*
var solution = {submiter:'Brad Larson',
    contact:'bhlarson@gmail.com',
    objectives:['Weight solutions using school district criteria'],
    results:{ [{
            population:0,
            percentReducedLunch:0,
            performance:{math:0,english:0,science:0},
            demographics:{[group:percent]}
            ]
        transitions:0,
        travelDistance:0,
        travelTime:0,
        safety:0,
        unity:0},
    allocation:{[school:[grid]]}
    };
*/

app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "gc": 0,
        "hs2020": 0,
        "reducedLunch": 0,
        "high": "",
        "middle": "",
        "elementary": "",
        "centroid": [0,0],
        "schools": [],
        "distance":[0,0,0,0,0,0],
        "time": [0, 0, 0, 0, 0, 0],
        "transitions":0,
        "milesTraveled":0,
        "students": [
            [2500, 2500, 2500, 2500, 2500, 2500],
            [0, 0, 0, 0, 0]]
    };

    $scope.DBRefresh = function () {
        map.data.revertStyle();
        $http.get('/GetFeatures').then(function (response) {
            response.data.forEach(function AddSolution(grid){
                grid.properties.proposedHigh = grid.properties.high;
            });
            $scope.data.students[0] = ComputeStudents(response.data);
            RefreshFromDB(response);
            Configure($scope);
        });
    };

  $scope.series = ['Students', 'Capacity 35/90'];



    function initMap() {
        // Initialise the map.
        var myLatLng = { lat: 45.4834817, lng: -122.8216516 };
        var mapProp = {
            center: myLatLng,
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        map = new google.maps.Map(document.getElementById('map-holder'), mapProp);

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

        var schools = [];

        for(var i=0; i< schoolData.schools.length; i++)
        {
            schools[i] = schoolData.schools[i].displayName;
        }

        $scope.data.schools = schools;

        $http.get('/GetFeatures').then(function (response) {
            response.data.forEach(function AddSolution(grid){
                grid.properties.proposedHigh = grid.properties.high;
            });
            var results = Results(response.data, schoolData);
            $scope.data.transitions = results.transitions;
            for(var i=0; i<results.schools.length; i++)
            {
                $scope.data.students[0][i] = results.schools[i].students;
            }
            $scope.data.milesTraveled = milePerMeter*results.distance;
            RefreshFromDB(response);
            Configure($scope);
        });
    };

    initMap();
});

function RefreshFromDB(dbData) {
    try {
        var geoJsonData = { "type": "FeatureCollection", "features": dbData.data };

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
    map.data.setControls(['LineString', 'Polygon']);

    map.data.setStyle(function (feature) {
        var highSchool = feature.getProperty('proposedHigh');

        var color = 'grey';
        for(var i=0; i<schoolData.schools.length && color == 'grey'; i++)
        {
            var school = schoolData.schools[i];
            if(highSchool == school.dbName)
            {
                color = school.color;
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

    map.data.addListener('click', selectGrid = function (event) {
        map.data.revertStyle();

        var proposedHigh = $scope.data.proposedHigh;
        if(proposedHigh)
        {
                // Record selected grid and grid data
                selectedGrid = event.feature;
                selectedGrid.setProperty('proposedHigh', proposedHigh);
                map.data.toGeoJson(function (geoJson) {
                    var results = Results(geoJson.features, schoolData);
                    $scope.data.transitions = results.transitions;
                    for(var i=0; i<results.schools.length; i++)
                    {
                        $scope.data.students[0][i] = results.schools[i].students;
                    }
                    $scope.data.milesTraveled = milePerMeter*results.distance;
                    event.feature.toGeoJson(function (grid) {
                        selectedFeature = grid;
                        $scope.$apply();
                });
            });

        }
    });
}

function Results(grids, schoolData)
{
    var numSchools = schoolData.schools.length;
    var results = {transitions:0, distance:0,schools:[]};
    for(var i=0; i<numSchools; i++)
    {
        results.schools[i] = {dbname:schoolData.schools[i].dbName, students:0};
    }

    grids.forEach(function (grid){
        var hs = grid.properties.proposedHigh;
        for(var i=0; i<numSchools; i++)
        {
            if(grid.properties.proposedHigh != grid.properties.high)
            {
                results.transitions += grid.properties.hs2020;
            }
            // Compute number of students
            if(hs == schoolData.schools[i].dbName)
            {
                results.schools[i].students+= grid.properties.hs2020;
                results.distance += grid.properties.hs2020*grid.properties.distance[i];
            }
        }

    });

    return results;
}

function ComputeStudents(db)
{
    var numSchools = schoolData.schools.length;
    var students = Array.apply(null, new Array(numSchools)).map(Number.prototype.valueOf,0);

    db.forEach(function (grid){
        var hs = grid.properties.proposedHigh;
        for(var i=0; i<numSchools; i++)
        {
            if(hs == schoolData.schools[i].dbName)
            {
                students[i] += grid.properties.hs2020;
            }
        }

    });
    return students;
}

function Transitions(db)
{
    var transitions = 0;
    db.forEach(function (grid){
        if(grid.properties.proposedHigh != grid.properties.high)
        {
            transitions += grid.properties.hs2020;
        }
    });
    return transitions;
}





