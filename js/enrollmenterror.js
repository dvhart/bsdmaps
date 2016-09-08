var app = angular.module('BoundaryEntry', ['chart.js']);
var app = angular.module('BoundaryEntry', ['chart.js']);
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
var studyYear = 2014;
var projectionYear = 2020;
var projectionSpan = projectionYear - studyYear;
var BSD_GRADES = 13;
var iKey = ['"7/1/1999"', '"7/1/2000"', '"7/1/2001"', '"7/1/2002"', '"7/1/2003"', '"7/1/2004"', '"7/1/2005"', '"7/1/2006"', '"7/1/2007"', '"7/1/2008"', '"7/1/2009"', '"7/1/2010"', '"7/1/2011"', '"7/1/2012"', '"7/1/2013"', '"7/1/2014"', '"7/1/2015"'];



app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "schools": {}, //Sorted school data
        "district": {},
        "high": [],
        "plotData": [],
        "gridsJson": {},
        "plotYears": [],
        "plotSchool": [districtId],
        "plotName": "Plot",
        "permits": {},
        "permitLookup":{},
        "permitPlot": {},
        "schoolPermits": districtId,
        "construction": 0,
        "constructionJson": {},
        "constructionLookup": {}
    };

    $scope.onClick = function (points, evt) {
        console.log(points, evt);
    };

    $scope.PlotChange = function ()
    {
        LoadModelvsActualData($scope.data, $scope.data.plotSchool[0]);
    }
    
    function init() {
        SchoolInit($http, $scope.data, function () {
            LoadPermits($http, function (permits) {
                $scope.data.permits = { "type": "FeatureCollection", "features": [] };
                permits.features.forEach(function (feature) {
                    if (feature.properties.gc) {
                        $scope.data.permits.features.push(feature);
                    }
                    $scope.data.permitLookup[feature.properties.activity] = feature;
                });
                
                LoadGeoJson($http, $scope);
            });
        });
    };

    init();
});


function SchoolInit( $http, data, callback)
{
    LoadSchools($http, function (schoolsObj) {
        data.schools = schoolsObj;
        ParseHighSchoolData(data);
        callback();
    });
}

function ActualEnrollment(schoolId, year, data) {
    var enrollment = [];
    var school = data.schools[schoolId];
    data.district = { "enrollment": [], "grade": ["k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [] };
    
    var key = iKey[year];
    data.district.year = year;
    var schoolEnrollment = school.enrollment[key];
    if (enrollment) {
        schoolEnrollment.grade.forEach(function (value, index) {
            enrollment[index] = Number(value);
            if (schoolId == districtId) {
                if (data.schools[SchoolToId("Arts and Communication")].enrollment[key]){
                    enrollment[index] -= Number(data.schools[SchoolToId("Arts and Communication")].enrollment[key].grade[index]);
                }
                if (data.schools[SchoolToId("Community School")].enrollment[key]) {
                    enrollment[index] -= Number(data.schools[SchoolToId("Community School")].enrollment[key].grade[index]);
                }
                if (data.schools[SchoolToId("Health & Science School")].enrollment[key]) {
                    enrollment[index] -= Number(data.schools[SchoolToId("Health & Science School")].enrollment[key].grade[index]);
                }
                if (data.schools[SchoolToId("International School of Beaverton")].enrollment[key]) {
                    enrollment[index] -= Number(data.schools[SchoolToId("International School of Beaverton")].enrollment[key].grade[index]);
                }
                if (data.schools[SchoolToId("School of Science & Technology")].enrollment[key]) {
                    enrollment[index] -= Number(data.schools[SchoolToId("School of Science & Technology")].enrollment[key].grade[index]);
                }
                if (data.schools[SchoolToId("Merlo Station")].enrollment[key]) {
                    enrollment[index] -= Number(data.schools[SchoolToId("Merlo Station")].enrollment[key].grade[index]);
                }
                //if (data.schools[SchoolToId("Arts and Communication MS")].enrollment[key]) {
                //    enrollment[index] -= Number(data.schools[SchoolToId("Arts and Communication MS")].enrollment[key].grade[index]);
                //}
                //if (data.schools[SchoolToId("International School of Beaverton--Middle")].enrollment[key]) {
                //    enrollment[index] -= Number(data.schools[SchoolToId("International School of Beaverton-- Middle")].enrollment[key].grade[index]);
                //}
            }
        });
    }
    return enrollment;
}

function ForecastEnrollment(schoolId, startYear, span, data)
{
    var forecastEnrollment = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var predictedConstruction = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    data.gridsJson.features.forEach(function (grid) {
        var hs = SchoolToId(grid.properties.HIGH_DESC);
        if (hs == schoolId || schoolId == districtId) {
            var es = data.schools[SchoolToId(grid.properties.ELEM_DESC)];
            var ms = data.schools[SchoolToId(grid.properties.MID_DESC)];
            var hs = data.schools[SchoolToId(grid.properties.HIGH_DESC)];
            var enrollment = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            var key = iKey[Number(startYear)];
            var esEnrolement = es.enrollment[key];
            var msEnrolement = ms.enrollment[key];
            var hsEnrolement = hs.enrollment[key];
            
            if (esEnrolement || schoolId == districtId) {
                for (var i = 0; i <= 5; i++) {
                    if (esEnrolement) {
                        //if (startYear == 15) {
                        //    enrollment[i] += grid.properties.students[i];

                        //}
                        //else {
                            enrollment[i] += grid.properties.students[i] * Number(esEnrolement.grade[i]) / es.norm[i];
                        //}
                    }
                }
            }
            
            if (msEnrolement || schoolId == districtId) {
                for (var i = 6; i <= 8; i++) {
                    //if (startYear == 15) {
                    //    enrollment[i] += grid.properties.students[i];
                    //}
                    //else {
                        enrollment[i] += grid.properties.students[i] * Number(msEnrolement.grade[i]) / ms.norm[i];
                    //}
                }
            }
            
            if (hsEnrolement && schoolId == districtId) {
                for (var i = 9; i <= 12; i++) {
                    //if (startYear == 15) {
                    //    enrollment[i] += grid.properties.students[i];
                    //}
                    //else {
                        enrollment[i] += grid.properties.students[i] * Number(hsEnrolement.grade[i]) / hs.norm[i];
                    //}

                }
            }
            var gridForecast = PromoteStudents(enrollment, span);
            forecastEnrollment = Sum(forecastEnrollment, gridForecast);
            
            var histConstruction = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for (var i= startYear; i < startYear+span && i < 15; i++) {
                var constStudentsArray = EstStudentsFromConstruciton(grid, data, i + 1999);
                constStudentsArray = PromoteStudents(constStudentsArray, span - i);
                histConstruction = Sum(histConstruction, constStudentsArray);

            }
            forecastEnrollment = Sum(forecastEnrollment, histConstruction);

            var construction = EstConstrucitonBSD2020(grid, data.constructionLookup, startYear + span + 1999);
            forecastEnrollment = Sum(forecastEnrollment, construction);

            //console.log("Grid:" + grid.properties.PA_NUMBER + " recomputed:"+ HSStudents(Sum(construction, Sum(histConstruction, gridForecast)))+ 
            //    " gridForecast:" + gridForecast+ " histConstruction:"+ histConstruction+
            //    " construction:"+ construction
            //);

        }
    });
    
    return forecastEnrollment;
}

function LoadModelvsActualData(data, schoolId)
{
    var xLables = [1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020];
    var school = data.schools[schoolId];
    
    var actualEnrollment = [];
    var predictedEnrollment = [];
    for (var i=0; i< 16; i++)
    {
        var forecast = ForecastEnrollment(schoolId, i, 6, data);

        var calendarYear = i + 1999;
        //console.log(school + " year " + calendarYear + " prediction:" + prediction + " enrollment:" + districtEnrollment[0] + " construction:" + data.district.construction[0] + " promoted:"+promotedStudent);
        predictedEnrollment[i + 6] = HSStudents(forecast);
    }

    data.district = { "enrollment": [], "grade": xLables, "year": ["actual", "forecast"] };
    data.district.enrollment[1] = predictedEnrollment;

    // Historic high school data from school database
    data.district.enrollment[0] = actualEnrollment;
    data.plotName = school.displayName + " Forecast (gray) and Actual Enrollment (blue)";
    iKey.forEach(function (year, iYear) {
        var enrollment = school.enrollment[year];
        if (enrollment)
        {
            var actualStudents = Number(enrollment.StudCnt912)
            if (schoolId == districtId)
            {
                actualStudents = Number(data.schools[1186].enrollment[year].StudCnt912);
                actualStudents += Number(data.schools[1187].enrollment[year].StudCnt912);
                actualStudents += Number(data.schools[2783].enrollment[year].StudCnt912);
                actualStudents += Number(data.schools[1188].enrollment[year].StudCnt912);
                actualStudents += Number(data.schools[1320].enrollment[year].StudCnt912);
                //actualStudents = Number(data.schools[districtId].enrollment[year].StudCnt912);
            }

            data.district.enrollment[0][iYear] = actualStudents;
        }
    });
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
                if (numHsStudents > 0 &&(
                        school.displayName == "Aloha" ||
                        school.displayName == "Beaverton" ||
                        school.displayName == "Sunset" ||
                        school.displayName == "Westview" ||
                        school.displayName == "Beaverton SD 48J" ||
                        school.displayName == "Southridge")) {
                    isHs = true;
                }
            }
            if (isHs) {
                data.high.push([Number(schoolId), school.displayName]);
                //console.log(schoolId+" "+ school.displayName);
            }
        }
    }
}

function LoadGeoJson($http, $scope) {

    LoadConstructionJson($http, function (constructionJson) {
        $scope.data.constructionJson = constructionJson;
        
        $scope.data.constructionLookup = {};
        $scope.data.constructionJson.features.forEach(function (feature) {
            if ($scope.data.constructionLookup[Number(feature.properties.STDYAREA)]) {
                $scope.data.constructionLookup[Number(feature.properties.STDYAREA)].push(feature);
            }
            else {
                $scope.data.constructionLookup[Number(feature.properties.STDYAREA)] = [feature];
            }
        });
    
        LoadBSDGrids($http, function (gridsJson) {
            $scope.data.gridsJson = gridsJson;
            // Add geometry limits to speed matching
            AddFeatureBounds($scope.data.gridsJson);
            ProjectEnrollment($scope.data.gridsJson, $scope.data.schools);
            Configure($scope);
        });
    });
}

function ProjectEnrollment(grids, schools)
{
    for (var key in schools)
    {
        schools[key].norm = [0,0,0,0,0,0,0,0,0,0,0,0,0];
    }

    // use enrollment per grid as normilization factor beause annual enrollment per grid is unavailable
    grids.features.forEach(function(grid) {
        var elem = SchoolToId(grid.properties.ELEM_DESC);
        var mid = SchoolToId(grid.properties.MID_DESC);
        var high = SchoolToId(grid.properties.HIGH_DESC);

        for (var i=0; i<=12; i++)
        {
            schools[elem].norm[i] += grid.properties.students[i];
            schools[mid].norm[i] += grid.properties.students[i];
            schools[high].norm[i] += grid.properties.students[i];
        }
    });

    // Write out for checked
    //for (var key in schools) {
    //    console.log(schools[key].displayName);
    //    if (schools[key].enrollment['"7/1/2014"']) {
    //        console.log(schools[key].enrollment['"7/1/2014"'].grade);
    //    }
    //    console.log(schools[key].norm);
    //}
}


function Configure($scope) {

    LoadModelvsActualData($scope.data, $scope.data.plotSchool[0]);

    return { editable: false, draggable: false, strokeWeight: 1, fillColor: 'blue', fillOpacity: 0.0};
};


function ConstructionToGrids(construction, grids)
{
    grids.features.forEach(function (grid) {
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

function EstProgression(students/*, constStudents*/)
{
    var estStudents = 0;
    var yearProgression = 6
    var progression = [0,0,0,1.013055,0.989824,0.930494,0.923087,0,0,0,0,0,0];
    for (var i=9-yearProgression; i<=12-yearProgression; i++)
    {
        estStudents += students[i]*progression[i];
    }
    return estStudents;
}

function PromoteStudents(students, years)
{
    var progression =[1,1,1,1.243718942,1.10998072,0.954883453,0.574595332,0.86953753,1.538136848,1.215197243,1.043448532,0.947282306,1];
    var estStudents = ProgressStudents(students, progression, years);

    return estStudents;
}

// Estimate students in grid in final year on BSD 2020 contruction forecast
function EstConstrucitonBSD2020(grid, constructionLookup, finalYear) {
    var studentGenerationTable = StudentGenerationBSD2020(SchoolToId(grid.properties.ELEM_DESC));

    var estStudents = InitArray(BSD_GRADES,0); // Initialize zero array
    var projects = constructionLookup[Number(grid.properties.PA_NUMBER)];
    if (projects) {
        projects.forEach(function (project) {
            var studentGeneration = studentGenerationTable[project.properties.TYPE];
            estStudents = AddStudents(estStudents, finalYear, studentGeneration, project.properties.PH1_, project.properties.PH1_COMP);
            estStudents = AddStudents(estStudents, finalYear, studentGeneration, project.properties.PH2_, project.properties.PH2_COMP);
            estStudents = AddStudents(estStudents, finalYear, studentGeneration, project.properties.PH3_, project.properties.PH3_COMP);
            estStudents = AddStudents(estStudents, finalYear, studentGeneration, project.properties.PH4_, project.properties.PH4_COMP);
         });
    }

    return estStudents;
}

// Estimated number of students in grid in selected year added based on historic construction data
function EstStudentsFromConstruciton(grid, data, year) {
    var studentGeneration = StudentGenerationBSD2020(SchoolToId(grid.properties.ELEM_DESC));
    var estStudents = [0,0,0,0,0,0,0,0,0,0,0,0,0];
    if (grid.properties.permits) {
        for (var permitKey in grid.properties.permits) {
            var permit = data.permitLookup[permitKey];
            if (permit && year == Year(permit.properties.acc_date)) {
                var permitData = data.permitLookup[permitKey];
                var type = permitData.properties.class;
                var units = Number(permitData.properties.housecount);
                data.construction += units;

                if (type == "101") {
                    for (var i = 0; i < estStudents.length; i++) {
                        estStudents[i] += studentGeneration["SFD"][i] * units;
                    }
                }
                else if (type == "105") {
                    for (var i = 0; i < estStudents.length; i++) {
                        estStudents[i] += studentGeneration["APT"][i] * units;
                    }
                }
            }
        }
    }
    return estStudents;
}

function StudentGenerationBSD2020(schoolID)
{
    var esg = 0.41 / 6.0;
    var msg = 0.13 / 3.0;

    var studentGeneration;
    switch (schoolID) {
        case 4671:
        case 4671:
        case 3437:
        case 4712:
            studentGeneration = {
                "SFD": [esg, esg, esg, esg, esg, esg, msg, msg, msg, 0.1 / 4.0, 0.1 / 4.0, 0.1 / 4.0, 0.1 / 4.0],
                "SFA": [0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.05 / 3.0, 0.05 / 3.0, 0.05 / 3.0, 0.05 / 4.0, 0.05 / 4.0, 0.05 / 4.0, 0.05 / 4.0],
                "MFA": [0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.04 / 3.0, 0.04 / 3.0, 0.04 / 3.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0],
                "APT": [0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.04 / 3.0, 0.04 / 3.0, 0.04 / 3.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0],
            };
            break;
        default:
            studentGeneration = {
                "SFD": [0.33 / 6.0, 0.33 / 6.0, 0.33 / 6.0, 0.33 / 6.0, 0.33 / 6.0, 0.33 / 6.0, 0.11 / 3.0, 0.11 / 3.0, 0.11 / 3.0, 0.1 / 4.0, 0.1 / 4.0, 0.1 / 4.0, 0.1 / 4.0],
                "SFA": [0.07 / 6.0, 0.07 / 6.0, 0.07 / 6.0, 0.07 / 6.0, 0.07 / 6.0, 0.07 / 6.0, 0.03 / 3.0, 0.03 / 3.0, 0.03 / 3.0, 0.04 / 4.0, 0.04 / 4.0, 0.04 / 4.0, 0.04 / 4.0],
                "MFA": [0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.04 / 3.0, 0.04 / 3.0, 0.04 / 3.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0],
                "APT": [0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.10 / 6.0, 0.04 / 3.0, 0.04 / 3.0, 0.04 / 3.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0, 0.06 / 4.0],
            };
    }
    return studentGeneration;
}

function AddStudents(estStudents, finalYear, studentGeneration, construction, constYear) {
    if (construction) {
        var yearsToPromote = finalYear - Year(constYear);
        if (yearsToPromote > 0) {
            var studentGen = Multiply(studentGeneration, construction)
            var studentsYear = PromoteStudents(studentGen, yearsToPromote);
            estStudents = Sum(estStudents, studentsYear);
        }
    }
    return estStudents;
}
