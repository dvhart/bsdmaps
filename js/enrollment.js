var app = angular.module('BoundaryEntry', ['chart.js']);
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

var countyIdcountyId = 34;
var districtId = 2243;


app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "schoolsJson":{}, // School GeoJson data
		"schools": {}, //Sorted school data
        "district": {},
        "high": [],
        "plotData": [],
        "gridsJson": {},
        "studentsJson": {},
        "constructionJson": {},
        "plotYears": [],
        "plotSchool":0,
    };
    
    $scope.onClick = function (points, evt) {
        console.log(points, evt);
    };
    
    $scope.PlotChange = function ()
    {
    	LoadDistrictData($scope.data, $scope.data.plotSchool[0], $scope.data.plotYears, true);
    }
    
    $scope.ComputeEnrollment = function ()
    {
        console.log("ComputeEnrollment");
        //StudentsToGrids($scope.data.studentsJson, $scope.data.gridsJson);
        //console.log("Students assigned to grids");
		
        //console.log("Construction assigned to grids");
		//$http.post('/SetBSData', $scope.data.gridsJson);
        console.log("Posted to DB");
		$http.get('/GetBSData').then(function (bsdData) {
			console.log("/GetBSData " + bsdData.statusText);			
			if(bsdData.statusText == "OK" && bsdData.data && bsdData.data[0])
			{
				$scope.data.gridsJson = bsdData.data[0];
				ConstructionToGrids($scope.data.constructionJson, $scope.data.gridsJson);
				BSD2020Estimate($scope.data.gridsJson);
				console.log("ComputedEstimate");				
			}
		});
    }

    function init() {
        
        SchoolInit($http, $scope.data, function(){
			// Initialise the map.
			var myLatLng = { lat: 45.498, lng: -122.82 };
			var mapProp = {
				center: myLatLng,
				zoom: 12,
				zoom: 12,
				mapTypeId: google.maps.MapTypeId.ROADMAP
			};

			map = new google.maps.Map(document.getElementById('map-holder'), mapProp);
			directionsService = new google.maps.DirectionsService;
			var renderOptions = { preserveViewport: true };
			directionsDisplay = new google.maps.DirectionsRenderer(renderOptions);
			geocoder = new google.maps.Geocoder;
			infowindow = new google.maps.InfoWindow;

			// NOTE: This uses cross-domain XHR, and may not work on older browsers.
			LoadGeoJson($http, $scope, map); 	
        });
    };

    init();
});


function SchoolInit( $http, data, callback)
{
    LoadSchools($http, function (schoolsObj) {
        data.schools = schoolsObj;

        ParseHighSchoolData(data);

        LoadDistrictData(data, 34);

        callback();
    });
}

function GridInit($http, data, callback)
{
	$http.get('/GetBSData').then(function (bsdData) {
		console.log("/GetBSData " + bsdData.statusText);			
		if(bsdData.statusText == "OK" && bsdData.data && bsdData.data[0])
		{
			data.gridsJson = bsdData.data[0];
		}
		callback();
	});
}

function LoadDistrictData(data, schoolId, years, withFeeders)
{
	var iKey = ['"7/1/1999"','"7/1/2000"','"7/1/2001"','"7/1/2002"','"7/1/2003"','"7/1/2004"','"7/1/2005"','"7/1/2006"','"7/1/2007"','"7/1/2008"','"7/1/2009"','"7/1/2010"','"7/1/2011"','"7/1/2012"','"7/1/2013"','"7/1/2014"','"7/1/2015"'];

    if (data.schools && data.schools[schoolId]) {
    	var school = data.schools[schoolId];
        data.district = { "enrollment": [], "grade": ["k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [] };
		if(years && years.length > 0)
		{
			var keys = Object.keys(school.enrollment);
			years.forEach(function(year){
				var key = iKey[Number(year)];
				data.district.year = key;
				var enrollment = school.enrollment[key];
				var enrollmentNum = [];
				enrollment.grade.forEach(function (value, index){
					enrollmentNum[index] = Number(value);
				});
				data.district.enrollment.push(enrollmentNum);			
			});			
		}
		else
		{
		   for (var date in school.enrollment) {
				data.district.year.push(date.replace(/['"]+/g, ''));
				var enrollment = school.enrollment[date];
				var enrollmentNum = [];
				enrollment.grade.forEach(function (value, index){
					enrollmentNum[index] = Number(value);
				});				
				data.district.enrollment.push(enrollmentNum);
			}			
		}
    }

    if(withFeeders)
    {
    	data.gridsJson.features.forEach(function(grid)
    	{
			var hs = SchoolToId(grid.properties.HIGH_DESC);			
			if(hs == schoolId)
			{
				var es = data.schools[SchoolToId(grid.properties.ELEM_DESC)];
				var ms = data.schools[SchoolToId(grid.properties.MID_DESC)];

				years.forEach(function(year, iYear){
					var key = iKey[Number(year)];
					var esEnrolement = es.enrollment[key];
					var msEnrolement = ms.enrollment[key];			

					if(esEnrolement)
					{
						for(var i = 0; i<=5; i++)
						{
							var esStudents = grid.properties.students[i];
							data.district.enrollment[iYear][i] += esStudents * Number(esEnrolement.StudCnt) / es.norm;
						}						
					}

					if(msEnrolement)
					{
					for(var i = 6; i<=8; i++)
						{
							var msStudents = grid.properties.students[i]
							data.district.enrollment[iYear][i] += msStudents * Number(msEnrolement.StudCnt) / ms.norm;
						}						
					}
				});
				console.log("Found HS");
			}
    	});
    }
}

function ParseHighSchoolData(data) {
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
                data.high.push([Number(schoolId), school.displayName]);
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

                    $scope.data.gridsJson = gridsJson;
                    $scope.data.constructionJson = constructionJson;                    
                    $scope.data.studentsJson = studentsJson;
                    $scope.data.schoolsJson = schoolsJson;

                	GridInit($http, $scope.data, function(){
                		                    // Add geometry limits to speed matching
                    	GeomLimits( $scope.data.gridsJson);
                    	GeomLimits($scope.data.constructionJson);


                                        
                    	var newData = new google.maps.Data({ map: map });
                    	newData.addGeoJson(gridsJson);
                    	newData.addGeoJson(constructionJson);
                    	//newData.addGeoJson(studentsJson);
                    	//newData.addGeoJson(schoolsJson);
                    
                    	// No error means GeoJSON was valid!
                    	map.data.setMap(null);
                    	map.data = newData;

                    	FindSchoolEnrollment2020($scope.data.gridsJson, $scope.data.schools);
						ProjectEnrollment($scope.data.gridsJson, $scope.data.schools);
                    
                    	Configure($scope);
                	});
                });

            });
        });
    });
}

// 
function FindSchoolEnrollment2020(grids, schools)
{
	var schoolPA = {};
	grids.features.forEach(function(grid){
		var ELEM_DESC = grid.properties.ELEM_DESC;
		var MID_DESC = grid.properties.MID_DESC;
		var HIGH_DESC = grid.properties.HIGH_DESC;
		var DDP_DISP = grid.properties.DDP_DISP;

		ELEM_DESC = ELEM_DESC.replace(" ES", "");
		ELEM_DESC = ELEM_DESC.replace(" K8", "");
		MID_DESC = MID_DESC.replace(" MS", "");

		if(schoolPA[ELEM_DESC])
		{
			schoolPA[ELEM_DESC] += DDP_DISP;
		}
		else
		{
			schoolPA[ELEM_DESC] = DDP_DISP;
		}

		if(schoolPA[MID_DESC])
		{
			schoolPA[MID_DESC] += DDP_DISP;
		}
		else
		{
			schoolPA[MID_DESC] = DDP_DISP;
		}		
	});

	for (var key in schoolPA)
	{
		var schoolName = key;
		var matches = [];
		
		for(var key in schools)
		{
			var schoolFullName = schools[key].fullName.replace('-', ' ');
			var match = schoolFullName.match(schoolName);
			if(match)
			{
				matches.push({match, key});
			}
		}
		
		schools[matches[0].key].DDP_DISP = schoolPA[schoolName];
	}
}

function ProjectEnrollment(grids, schools)
{
	var schoolPA = {};
	grids.features.forEach(function(grid){
		var ELEM_DESC = grid.properties.ELEM_DESC;
		var MID_DESC = grid.properties.MID_DESC;
		var HIGH_DESC = grid.properties.HIGH_DESC;
		var DDP_DISP = grid.properties.DDP_DISP;

		ELEM_DESC = ELEM_DESC.replace(" ES", "");
		ELEM_DESC = ELEM_DESC.replace(" K8", "");
		MID_DESC = MID_DESC.replace(" MS", "");
		HIGH_DESC = HIGH_DESC.replace(" HS", "");

		var esStudents = 0;
		var msStudents = 0;
		var hsStudents = 0;
		for(var i=0; i<=5; i++)
		{
			esStudents += grid.properties.students[i];
		}
		for(var i=6; i<=8; i++)
		{
			msStudents += grid.properties.students[i];
		}
		for(var i=9; i<=12; i++)
		{
			hsStudents += grid.properties.students[i];
		}		
		
		if(schoolPA[ELEM_DESC])
		{
			schoolPA[ELEM_DESC] += esStudents;
		}
		else
		{
			schoolPA[ELEM_DESC] = esStudents;
		}

		if(schoolPA[MID_DESC])
		{
			schoolPA[MID_DESC] += msStudents;
		}
		else
		{
			schoolPA[MID_DESC] = msStudents;
		}

		if(schoolPA[HIGH_DESC])
		{
			schoolPA[HIGH_DESC] += hsStudents;
		}
		else
		{
			schoolPA[HIGH_DESC] = hsStudents;
		}				
	});

	for (var key in schoolPA)
	{
		var schoolName = key;
		var matches = [];
		
		for(var key in schools)
		{
			var schoolFullName = schools[key].fullName.replace('-', ' ');
			var match = schoolFullName.match(schoolName);
			if(match)
			{
				matches.push({match, key});
			}
		}
		
		schools[matches[0].key].norm = schoolPA[schoolName];
	}
}


function GeomLimits(geoJson)
{
    for(var iFeature = 0; iFeature < geoJson.features.length; iFeature++){
    	var feature = geoJson.features[iFeature];

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
    	
    }
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
        //infoWindowMarker.setMap(null);
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
	grids.features.forEach(function(grid){
		grid.properties.TYPE = [];
		grid.properties.SHAPE_Area = [];
		grid.properties.TTL_DU = [];	
	});

	
    construction.features.forEach(function(development){
        var devPoly = development.geometry.coordinates[0];
        var TTL_DU = development.properties.TTL_DU; // Total development units
        var TYPE = development.properties.TYPE; // Type of contstruction
        var SHAPE_Area = development.properties.SHAPE_Area; // Construction area
        var iGrid = FindIntersectionIndex(development, grids); //

        grids.features[iGrid].properties.TTL_DU.push(TTL_DU);
       	grids.features[iGrid].properties.TYPE.push(TYPE);
       	grids.features[iGrid].properties.SHAPE_Area.push(SHAPE_Area);      	
    });
}

function PolygonFromGeoJson(polygon)
{
	var pointString = [];
	
	polygon[0].forEach(function(pt){
		pointString += pt[0].toString() +","+pt[0].toString()+" ";
	});
	
	var svgPolygon = document.createElementNS('http://www.w3.org/2000/svg','polygon');
	svgPolygon.setAttribute("points", pointString);
	
	var poly = new Polygon(svgPolygon);
	
	return poly;
}

function FindIntersectionIndex(devPoly, grids){
	var gridIndex;
	var stdyArea = devPoly.properties.STDYAREA;

	for(var iGrid = 0; iGrid<grids.features.length && !gridIndex; iGrid++)
	{
		var grid = grids.features[iGrid];
		if (stdyArea == grid.properties.STDYAREA)
		{
			gridIndex = iGrid;
		}
	}		
    return gridIndex;
}

function BoundsOverlap(poly, grids)
{
	var gridIndex;
	var maxX = poly[0][0][0];
	var minX = poly[0][0][0];
	var maxY = poly[0][0][1];
	var minY = poly[0][0][1];
	
	poly[0].forEach(function(pt)
	{
		if(pt[0] < minX)
		{
			minX = pt[0];
		}
		if(pt[0] > maxX)
		{
			maxX = pt[0];
		}
		if(pt[1] < minY)
		{
			minY = pt[1];
		}
		if(pt[1] > maxY)
		{
			maxY = pt[1];
		}
	});

	var centerX = (minX + maxX)/2;
	var centerY = (minY + maxY)/2;
	
	var overlapedGrids = {};
	
	for(var iGrid = 0; iGrid<grids.features.length; iGrid++)
	{
		var grid = grids.features[iGrid];

		if(centerX >= grid.properties.bounds[0][0] && centerX <= grid.properties.bounds[1][0]){
			if(centerY >= grid.properties.bounds[0][1] && centerY <= grid.properties.bounds[1][1]){
				overlapedGrids[iGrid] = grid;
				console.log("Cstn Bounds ["+minX+","+minY+"], ["+maxX+","+maxY+"]");
				console.log( grid.properties.PA_NUMBER +" Bounds [" + grid.properties.bounds[0] +"], [" + grid.properties.bounds[0]+"]");
				gridIndex = iGrid;				
			}
		}
	}

	return gridIndex;
}

function BSD2020Estimate(grids)
{
	var totalProgression = 0;
	var totalNewConstruction = 0;
	grids.features.forEach(function(grid){
		var estProgression = EstProgression(grid);
		var estConstruction = EstConstruciton(grid);

		totalProgression += estProgression;
		totalNewConstruction += estConstruction
		
		var estStudents = estProgression+estConstruction;
		var difference = estStudents - grid.properties.DDP_DISP;
		//console.log("Grid:" + grid.properties.PA_NUMBER + " BSD2020:" + grid.properties.DDP_DISP, " recompted:" + estStudents + " Advanced:"+estProgression+" Const:"+estConstruction+" difference:" + difference);
		if(/*estProgression > 0.1 && estProgression <= 1.2 &&*/ grid.properties.TTL_DU.length > 0)
		{
			var TTL = 0
			for(var iTTL = 0; iTTL<grid.properties.TTL_DU.length; iTTL++)
			{
				TTL += grid.properties.TTL_DU[iTTL];
			}
			var scaleFactorWithProgression  = (grid.properties.DDP_DISP - estProgression)/TTL;
			var scaleFactorWitoutProgression = (grid.properties.DDP_DISP)/TTL;
			var constType = grid.properties.TYPE;
			console.log("Grid:" + grid.properties.PA_NUMBER + " BSD2020:" + grid.properties.DDP_DISP+ " recompted:" + estStudents + " Advanced:"+estProgression+" Const:"+estConstruction+" difference:" + difference);
			console.log(constType + " sfp:" + scaleFactorWithProgression + " sfnp:" + scaleFactorWitoutProgression);
		}
	});

	console.log("totalProgression:"+totalProgression+" totalNewConstruction:"+totalNewConstruction);
}

function EstProgression(grid)
{
	var estStudents = 0;
	var yearProgression = 6
	var progression = [1,1,1,1.013055,0.989824,0.930494,0.923087,1,1,1,1,1,1];
	for(var i=9-yearProgression; i<=12-yearProgression; i++)
	{
		estStudents += grid.properties.students[i]*progression[i];
	}
	return estStudents;
}

function EstConstruciton(grid)
{
	var estStudents = 0; 
	if(grid.properties.TTL_DU && grid.properties.TTL_DU.length)
	{
		for(var i=0; i<grid.properties.TTL_DU.length; i++)
		{
			var TTL_DU = grid.properties.TTL_DU[i];
			if(grid.properties.TYPE[i] == "SFD"){
				estStudents += 0.20*TTL_DU;
				//estStudents += 0.20*TTL_DU;
			}
			else if(grid.properties.TYPE[i] == "SFA"){
				estStudents += 0.04*TTL_DU;			
			}
			else if(grid.properties.TYPE[i] == "MFA"){
			estStudents += 0.066*TTL_DU;			
			}
			else if(grid.properties.TYPE[i] == "APT"){
			estStudents += 0.065*TTL_DU;			
			}		
		}
	}
	return estStudents;
}

