var app = angular.module('BoundaryEntry', ['chart.js']);
var map;
var panel;
var selectedGrid; // selected feature object
var selectedFeature; //  JSON selected grid
var results;
var milePerMeter = 0.000621371;

var defaultMapName = "Unnamed Map";
var defaultMapDescription = "No Description";

// Google Map Overlays
var bsdOverlay;
var mapGrids;

var schoolData = {schools:[
    {id:0, dbName:'Aloha', displayName:'Aloha', color:'blue', capacity:2176, location:{ lat: 45.4846754, lng: -122.8711176 }},
    {id:1, dbName:'Beaverton', displayName:'Beaverton', color:'orange', capacity:2122, location:{ lat: 45.4862466, lng: -122.8127043 }},
    {id:2, dbName:'Cooper', displayName:'Cooper Mtn', color:'green', capacity:2176, location:{ lat: 45.4246773, lng: -122.8589781 }},
    {id:3, dbName:'Southridge', displayName:'Southridge', color:'red', capacity:1850, location:{ lat: 45.450176, lng: -122.8097826 }},
    {id:4, dbName:'Sunset', displayName:'Sunset', color:'purple', capacity:2203, location:{ lat: 45.5275796, lng: -122.8188543 }},
    {id:5, dbName:'Westview', displayName:'Westview', color:'pink', capacity:2421, location:{ lat: 45.55027, lng: -122.8682147}},
    ]};

/*
 * This filter permits the printing of dynamically generated html that sce would
 * otherwise prevent. This is used, for example, by the GenStatsTable function.
 */
app.filter('html', function($sce) {
    return function(val) {
        return $sce.trustAsHtml(val);
    };
});

app.controller('BoundaryController', function ($scope, $http, $sce) {
    $scope.data = {
        "proposedHigh":"Cooper",
        "paintBy":"ES",
        "gc": 0,
        "hs2020": 0,
        "reducedLunch": 0,
        "high": "",
        "middle": "",
        "elementary": "",
        "centroid": [0,0],
        "schools": [],
        "distance":[[0, 0, 0, 0, 0, 0]],
        "time": [0, 0, 0, 0, 0, 0],
        "total_students": 0,
        "total_capacity_p": 0,
        "milesTraveled":0,
        "total_transitions": 0,
        "total_frl_p": 0,
        "students": [
            [2500, 2500, 2500, 2500, 2500, 2500],  // student count
            [0, 0, 0, 0, 0, 0]],                   // school capacity
        "capacity_p": [[0, 0, 0, 0, 0, 0]],        // percent of capacity
        "transitions": [[0, 0, 0, 0, 0, 0]],
        "frl_p": [[0, 0, 0, 0, 0, 0]],
        "solutionName":"",
        "solutionDescription":"",
        "solutionUsername": "",
        "solutionEmail": "",
        "solutionUrl": "",
        "searchName": "",
        "searchDescription": "",
        "searchUsername": "",
        "searchEmail": "",
        "solutions":[],
        "primaryObjectives": [],
        "otherObjectives": [],
        "solutionSaveResponse":"",
        "mapName":defaultMapName,
        "mapDescription":defaultMapDescription
    };

    $scope.DBRefresh = function () {
        map.data.revertStyle();
        $http.get('/GetFeatures').then(function (response) {
            // Load current high school as proposed high school
            response.data.forEach(function AddSolution(grid){
                grid.properties.proposedHigh = grid.properties.high;
            });
            // FIXME: is this still necessary?
            $scope.data.students[0] = ComputeStudents(response.data);
            RefreshFromGrids(response.data);
            Configure($scope);
        });
    };
	
	var SaveJsonToFile = (function () {
		var a = document.createElement("a");
		document.body.appendChild(a);
		a.style = "display: none";
		return function (data, defaultFileName) {
			var json = JSON.stringify(data),
				blob = new Blob([json], {type: "octet/stream"}),
				url = window.URL.createObjectURL(blob);
			a.href = url;
			a.download = defaultFileName;
			a.click();
			window.URL.revokeObjectURL(url);
		};
	}());	
	
    $scope.SaveToFile = function() {

		map.data.toGeoJson(function (geoJson) {
			var solution = SolutionToJson($scope.data, geoJson.features, results);
            var defaultFileName = "solution.json";
			SaveJsonToFile(solution, defaultFileName);
		}); 		
    };	
    
    $scope.SaveSolution = function () {
        map.data.toGeoJson(function (geoJson) {
            var solution = SolutionToJson($scope.data, geoJson.features, results);
            $http.post('/NewSolution', solution).then(function (response) {
                $scope.data.solutionSaveResponse = response.toString();
            });
        });
    };

    
    $scope.LoadFromDB = function () {
        var queryString = {};
        
        if ($scope.data.searchName) {
            queryString.solutionName = $scope.data.searchName;
        }
        if ($scope.data.searchDescription) {
            queryString.solutionDescription = $scope.data.searchDescription;
        }
        if ($scope.data.searchUsername) {
            queryString.solutionUsername = $scope.data.searchUsername;
        }
        
        if ($scope.data.searchEmail) {
            queryString.email = $scope.data.searchEmail;
        }
        
        $http.post('/Solution', queryString).then(function (response) {
            $scope.data.solutions = response.data;
        });
    };

    $scope.SelectSolution = function () {
        var selectedSolution = $scope.data.selectedSolution;
        $scope.data.mapName = selectedSolution[0]["solutionName"];
        $scope.data.mapDescription = selectedSolution[0]["solutionDescription"];

        map.data.toGeoJson(function (geoJson) {
            JsonToSolution(selectedSolution[0], geoJson.features);

            var newData = new google.maps.Data({ map: map });
            var features = newData.addGeoJson(geoJson);

            // No error means GeoJSON was valid!
            map.data.setMap(null);
            map.data = newData;
            mapGrids = features;

            results = Results(geoJson.features, schoolData);
            UpdateScopeData($scope, results);
            Configure($scope);
        });
    };


    /* Dynamically generate the stats table. This requires the angular sce
     * filter to trust the output as html */
    $scope.GenStatsTable = function () {
        var out="";
        out += '<div class="stats-table">';
        out += '<div class="stats-header-row">';
        out += '    <div class="stats-header-cell">School</div>';
        out += '    <div class="stats-header-cell">Capacity</div>';
        out += '    <div class="stats-header-cell">Proximity (miles)</div>';
        out += '    <div class="stats-header-cell">Transitions</div>';
        out += '    <div class="stats-header-cell">FRL</div>';
        out += '</div>';
        for (var i = 0; i < $scope.data.schools.length; i++) {
            out += '<div class="stats-row">';
            out += '    <div class="stats-cell">' + $scope.data.schools[i] + '</div>';
            out += '    <div class="stats-cell">' + $scope.data.capacity_p[0][i] + '%</div>';
            out += '    <div class="stats-cell">' + $scope.data.distance[0][i] + '</div>';
            out += '    <div class="stats-cell">' + $scope.data.transitions[0][i] + '</div>';
            out += '    <div class="stats-cell">' + $scope.data.frl_p[0][i] + '%</div>';
            out += '</div>';
        }
        out += '<div class="stats-footer-row">';
        out += '    <div class="stats-footer-cell">District Total</div>';
        out += '    <div class="stats-footer-cell">' + $scope.data.total_capacity_p + '%</div>';
        out += '    <div class="stats-footer-cell">' + $scope.data.milesTraveled + '</div>';
        out += '    <div class="stats-footer-cell">' + $scope.data.total_transitions + '</div>';
        out += '    <div class="stats-footer-cell">' + $scope.data.total_frl_p + '%</div>';
        out += '</div>';
        out += '</div> <!-- Stats Table -->';
        return out;
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
        var capacity = [];

        for(var i=0; i< schoolData.schools.length; i++)
        {
            schools[i] = schoolData.schools[i].displayName;
            capacity[i] = schoolData.schools[i].capacity;
        }

        /* save immutable data - doesn't change with boundary changes */
        $scope.data.schools = schools;
        $scope.data.students[1] = capacity;

        $http.get('/GetFeatures').then(function (response) {
            response.data.forEach(function AddSolution(grid){
                grid.properties.proposedHigh = grid.properties.high;
            });

            results = Results(response.data, schoolData);
            UpdateScopeData($scope, results);
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

/* Update all the $scope.data from the calculated results */
function UpdateScopeData($scope, results) {
    var cap = 0;
    var students = 0;
    var frl = 0;

    for (var i = 0; i < results.schools.length; i++) {
        $scope.data.students[0][i] = results.schools[i].students;
        $scope.data.capacity_p[0][i] = results.schools[i].capacity_p;
        $scope.data.distance[0][i] = results.schools[i].distance;
        $scope.data.transitions[0][i] = results.schools[i].transitions;
        $scope.data.frl_p[0][i] = results.schools[i].frl_p;

        students += $scope.data.students[0][i];
        cap += $scope.data.students[1][i];
        frl += results.schools[i].frl;
    }

    $scope.data.total_capacity_p = (100 * students/cap).toFixed(2);
    $scope.data.milesTraveled = results.distance;
    $scope.data.total_transitions = results.transitions;
    $scope.data.total_frl_p = (100 * frl/students).toFixed(2);
}

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
        if (proposedHigh) {
            // Record selected grid and grid data
            selectedGrid = event.feature;
            selectedGrid.setProperty('proposedHigh', proposedHigh);
            selectedES = selectedGrid.getProperty('elementary');

            console.log("click proposedHigh=" + proposedHigh + " elementary=" + selectedES);

            var numEsGrids = 0;
            if ($scope.data.paintBy == "ES") {
                mapGrids.forEach(function (grid) {
                    if (grid.getProperty('elementary') == selectedES) {
                        grid.setProperty('proposedHigh', proposedHigh);
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
    });
};

function SolutionToJson(formData, gridData, resultsData)
{
    var solution = {
        solutionName: formData.solutionName, 
        solutionDescription: formData.solutionDescription, 
        solutionUsername: formData.solutionUsername, 
        email: formData.solutionEmail, 
        url: formData.solutionUrl,
        grids: [], 
        results: resultsData
    };
	for(var i=0; i<gridData.length; i++)
	{
		solution.grids[i] = {gc:gridData[i].properties.gc, proposedHigh:gridData[i].properties.proposedHigh};
	}

	return solution;
}

function JsonToSolution(solution, gridData)
{
	for(var i=0; i< solution.grids.length; i++)
	{
		if(gridData[i].properties.gc == solution.grids[i].gc)
		{
			gridData[i].properties.proposedHigh = solution.grids[i].proposedHigh;
		}
		else
		{
			console.log("Unexpected grid code index " + solution.grids[i].gc);
		}
	}
}

function Results(grids, schoolData)
{
    var numSchools = schoolData.schools.length;
    var results = {transitions:0, distance:0, schools:[]};
    for(var i=0; i<numSchools; i++)
    {
        results.schools[i] = {dbname:schoolData.schools[i].dbName, students:0, capacity_p:0, distance:0, transitions:0, frl:0, frl_p:0};
    }

    grids.forEach(function (grid){
        var hs = grid.properties.proposedHigh;
        for(var i=0; i<numSchools; i++)
        {
            // Compute proposed school stats
            if(hs == schoolData.schools[i].dbName)
            {
                results.schools[i].students += grid.properties.hs2020;
                results.schools[i].distance += grid.properties.hs2020*grid.properties.distance[i];
                results.schools[i].frl += FrlFit(grid.properties.reducedLunch,  grid.properties.hs2020);
            }
            // Compute transitions by existing school
            if(grid.properties.high == schoolData.schools[i].dbName && hs != grid.properties.high)
            {
                results.schools[i].transitions += grid.properties.hs2020;
            }
        }
    });

    // Calculate per results from grid totals calculated above
    // Convert native results distance to miles
    for(var i=0; i<numSchools; i++)
    {
        results.schools[i].capacity_p = 100*results.schools[i].students/schoolData.schools[i].capacity;
        results.schools[i].distance *= milePerMeter;
        results.distance += results.schools[i].distance;
        results.transitions += results.schools[i].transitions;
        if (results.schools[i].students) {
            results.schools[i].frl_p = 100*results.schools[i].frl/(results.schools[i].students);
        }

        // Reduce decimal places to 2 (FIXME this is formatting and should be elsewhere)
        results.schools[i].capacity_p = (results.schools[i].capacity_p).toFixed(2);
        results.schools[i].distance = (results.schools[i].distance).toFixed(2);
        results.schools[i].frl_p = (results.schools[i].frl_p).toFixed(2);
    }
    results.distance = results.distance.toFixed(2);

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

function FrlFit(frl, total2020) {
	var m = 0.95
	var b = 0.14;
	var k = 1.25;
	
	var frlFit = 0;
	if (total2020 > 0) {
		frlFit = (m * Math.pow(frl / total2020, k) + b) * total2020;
		if (frlFit > total2020) {
			frlFit = total2020;
		}
	}
	
	return frlFit;
}
