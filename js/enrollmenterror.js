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
        "plotSchool": [districtId],
        "plotName": "Plot",
        "permits": {},
        "permitLookup":{},
        "permitPlot": {},
        "schoolPermits": districtId,
        "construction":0
    };

    $scope.onClick = function (points, evt) {
        console.log(points, evt);
    };

    $scope.PlotChange = function ()
    {
        LoadModelvsActualData($scope.data, $scope.data.plotSchool[0]);
    }

    $scope.ComputeEnrollment = function ()
    {
        //console.log("ComputeEnrollment");
        //StudentsToGrids($scope.data.studentsJson, $scope.data.gridsJson);
        //console.log("Students assigned to grids");

        //console.log("Construction assigned to grids");
        //$http.post('/SetBSData', $scope.data.gridsJson);
        //console.log("Posted to DB");
        $http.get('/GetBSData').then(function (bsdData) {
            //console.log("/GetBSData " + bsdData.statusText);
            if (bsdData.statusText == "OK" && bsdData.data)
            {
                $scope.data.gridsJson = bsdData.data;
                ConstructionToGrids($scope.data.constructionJson, $scope.data.gridsJson);
                BSD2020Estimate($scope.data.gridsJson, $scope.data.constructionJson);
                //console.log("ComputedEstimate");
            }
        });
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

function LoadDistrictData(data, schoolId, years, withFeeders)
{
    var enrollment = [];
    var iKey = ['"7/1/1999"','"7/1/2000"','"7/1/2001"','"7/1/2002"','"7/1/2003"','"7/1/2004"','"7/1/2005"','"7/1/2006"','"7/1/2007"','"7/1/2008"','"7/1/2009"','"7/1/2010"','"7/1/2011"','"7/1/2012"','"7/1/2013"','"7/1/2014"','"7/1/2015"'];

    if (data.schools && data.schools[schoolId]) {
        var school = data.schools[schoolId];
        data.district = { "enrollment": [], "construction": [], "grade": ["k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [] };

        if (years && years.length > 0)
        {
            //var keys = Object.keys(school.enrollment);
            years.forEach(function(year) {
                var key = iKey[Number(year)];
                data.district.year = year;
                var schoolEnrollment = school.enrollment[key];
                var enrollmentNum = [];
                if (enrollment)
                {
                    schoolEnrollment.grade.forEach(function (value, index) {
                        enrollmentNum[index] = Number(value);
                    });
                }
                enrollment.push(enrollmentNum);
            });
        }
        else
        {
            for (var date in school.enrollment) {
                data.district.year.push(date.replace(/['"]+/g, ''));
                var schoolEnrollment = school.enrollment[date];
                var enrollmentNum = [];
                schoolEnrollment.grade.forEach(function (value, index) {
                    enrollmentNum[index] = Number(value);
                });
                enrollment.push(enrollmentNum);
            }
        }
    }

    if (withFeeders)
    {
        data.gridsJson.features.forEach(function(grid)
        {
            var hs = SchoolToId(grid.properties.HIGH_DESC);
            if (hs == schoolId || schoolId == districtId)
            {
                var es = data.schools[SchoolToId(grid.properties.ELEM_DESC)];
                var ms = data.schools[SchoolToId(grid.properties.MID_DESC)];

                years.forEach(function(year, iYear) {
                    var key = iKey[Number(year)];
                    var esEnrolement = es.enrollment[key];
                    var msEnrolement = ms.enrollment[key];
                    if (!data.district.construction[iYear])
                    {
                        data.district.construction[iYear] = [0,0,0,0,0,0,0,0,0,0,0,0,0];
                    }
                    if (esEnrolement && schoolId != districtId)
                    {
                        for (var i = 0; i<=8; i++)
                        {
                            enrollment[iYear][i] += grid.properties.students[i] * Number(esEnrolement.grade[i]) / es.norm[i];
                        }
                    }

                    if (msEnrolement && schoolId != districtId)
                    {
                        for (var i = 6; i<=8; i++)
                        {
                            enrollment[iYear][i] += grid.properties.students[i] * Number(msEnrolement.grade[i]) / ms.norm[i];
                        }
                    }

                    var constStudentsArray = EstStudentsFromConstruciton(grid, data, year + 1999);
                    if (data.district.construction[iYear]) {
                        data.district.construction[iYear] = Sum(data.district.construction[iYear],constStudentsArray);
                    }
                    else {
                        data.district.construction[iYear]=constStudentsArray;
                    }
                });
            }
        });
    }

    return enrollment;
}

function LoadDistrictCohortData(data, schoolId, year)
{
    var iKey = ['"7/1/1999"','"7/1/2000"','"7/1/2001"','"7/1/2002"','"7/1/2003"','"7/1/2004"','"7/1/2005"','"7/1/2006"','"7/1/2007"','"7/1/2008"','"7/1/2009"','"7/1/2010"','"7/1/2011"','"7/1/2012"','"7/1/2013"','"7/1/2014"','"7/1/2015"'];
    var gradeOffset = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    var school = data.schools[schoolId];
    data.district = { "enrollment": [], "grade": ["PreK", "k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [year] };

    if (data.schools && data.schools[schoolId]) {

        data.district.enrollment[0] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0];
        // High school data from school database
        for (var iCohart = 0; iCohart <= 12; iCohart++) {
            var key = iKey[Number(year) + iCohart];
            var enrollment = school.enrollment[key];
            if (enrollment)
            {
                data.district.enrollment[0][iCohart+1] = Number(enrollment.grade[iCohart]);
            }
        }

        // Feeder schools weighted by enrollment per grid
        data.gridsJson.features.forEach(function(grid)
                {
                    var hs = SchoolToId(grid.properties.HIGH_DESC);
                    if (hs == schoolId)
                    {
                        var es = data.schools[SchoolToId(grid.properties.ELEM_DESC)];
                        var ms = data.schools[SchoolToId(grid.properties.MID_DESC)];

                        for (var iCohart = 0; iCohart <= 8; iCohart++) {
                            var key = iKey[Number(year) + iCohart];
                            var esEnrolement = es.enrollment[key];
                            var msEnrolement = ms.enrollment[key];

                            if (esEnrolement)
                            {
                                data.district.enrollment[0][iCohart+1] += grid.properties.students[iCohart] * Number(esEnrolement.grade[iCohart]) / es.norm[iCohart];
                            }

                            if (msEnrolement)
                            {
                                data.district.enrollment[0][iCohart+1] += grid.properties.students[iCohart] * Number(msEnrolement.grade[iCohart]) / ms.norm[iCohart];
                            }
                        }
                    }
                });
    }
    else {
        console.log("LoadDistrictCohortData school data not available");
    }
}

function LoadModelvsActualData(data, schoolId)
{
    var iKey = ['"7/1/1999"','"7/1/2000"','"7/1/2001"','"7/1/2002"','"7/1/2003"','"7/1/2004"','"7/1/2005"','"7/1/2006"','"7/1/2007"','"7/1/2008"','"7/1/2009"','"7/1/2010"','"7/1/2011"','"7/1/2012"','"7/1/2013"','"7/1/2014"','"7/1/2015"','"7/1/2016"','"7/1/2017"','"7/1/2018"','"7/1/2019"','"7/1/2020"'];
    var xLables = [1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020];
    var school = data.schools[schoolId];

    var predictedEnrollment = [];
    for (var i=0; i< 16; i++)
    {
        data.construction = 0;
        var districtEnrollment = LoadDistrictData(data, schoolId, [i], true);

        var studentArray = Sum(districtEnrollment[0], data.district.construction[0])
        var promotedStudent=PromoteStudents(studentArray, projectionSpan);
        var prediction = HSStudents(promotedStudent);

        var calendarYear = i + 1999;
        //console.log(school + " year " + calendarYear + " prediction:" + prediction + " enrollment:" + districtEnrollment[0] + " construction:" + data.district.construction[0] + " promoted:"+promotedStudent);
        predictedEnrollment[i+6] = prediction;
        //console.log(i + " constuction units:"+data.construction, "percent constructon:"+100* HSStudents(PromoteStudents(data.district.construction[0], projectionSpan))/ prediction);
    }

//    enrolledStudents = PromoteStudents(enrolledStudents, projectionSpan);
//    var studentsEnrolled = HSStudents(enrolledStudents);
//    constStudents = PromoteStudents(constStudents, projectionSpan);
//    var studentsConst = HSStudents(constStudents);

    data.district = { "enrollment": [], "grade": xLables, "year": ["actual", "forecast"] };
    data.district.enrollment[1] = predictedEnrollment;

    // Historic high school data from school database
    data.district.enrollment[0] = [];
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

    LoadGeoJsonFiles($http, function (constructionJson, studentsJson, schoolsJson) {
        $scope.data.constructionJson = constructionJson;
        $scope.data.studentsJson = studentsJson;
        $scope.data.schoolsJson = schoolsJson;

        LoadBSDGrids($http, function (gridsJson) {
            $scope.data.gridsJson = gridsJson;
            // Add geometry limits to speed matching
            AddFeatureBounds($scope.data.gridsJson);
            AddFeatureBounds($scope.data.constructionJson);

            FindSchoolEnrollment2020($scope.data.gridsJson, $scope.data.schools);
            ProjectEnrollment($scope.data.gridsJson, $scope.data.schools);
            Configure($scope);
        });
    });
}

//
function FindSchoolEnrollment2020(grids, schools)
{
    var schoolPA = {};
    grids.features.forEach(function(grid) {
        var ELEM_DESC = grid.properties.ELEM_DESC;
        var MID_DESC = grid.properties.MID_DESC;
        var HIGH_DESC = grid.properties.HIGH_DESC;
        var DDP_DISP = grid.properties.DDP_DISP;

        ELEM_DESC = ELEM_DESC.replace(" ES", "");
        ELEM_DESC = ELEM_DESC.replace(" K8", "");
        MID_DESC = MID_DESC.replace(" MS", "");

        if (schoolPA[ELEM_DESC])
        {
            schoolPA[ELEM_DESC] += DDP_DISP;
        }
        else
        {
            schoolPA[ELEM_DESC] = DDP_DISP;
        }

        if (schoolPA[MID_DESC])
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

        for (var key in schools)
        {
            var schoolFullName = schools[key].fullName.replace('-', ' ');
            var match = schoolFullName.match(schoolName);
            if (match)
            {
                matches.push({match, key});
            }
        }

        schools[matches[0].key].DDP_DISP = schoolPA[schoolName];
    }
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


function StudentsToGrids(students, grids)
{
    grids.features.forEach(function (feature) {
        feature.properties.students = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    });

    students.features.forEach(function(student) {
        var location = student.geometry.coordinates;
        var grade = student.properties.GRD;
        var iGrid = FindGridIndex(location, grids);

        grids.features[iGrid].properties.students[grade]++;
    });
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
    grids.features.forEach(function(grid) {
        grid.properties.TYPE = [];
        grid.properties.SHAPE_Area = [];
        grid.properties.TTL_DU = [];
    });


    construction.features.forEach(function(development) {
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

    polygon[0].forEach(function(pt) {
        pointString += pt[0].toString() +","+pt[0].toString()+" ";
    });

    var svgPolygon = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    svgPolygon.setAttribute("points", pointString);

    var poly = new Polygon(svgPolygon);

    return poly;
}

function FindIntersectionIndex(devPoly, grids) {
    var gridIndex;
    var stdyArea = devPoly.properties.STDYAREA;

    for (var iGrid = 0; iGrid<grids.features.length && !gridIndex; iGrid++)
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
        if (pt[0] < minX)
        {
            minX = pt[0];
        }
        if (pt[0] > maxX)
        {
            maxX = pt[0];
        }
        if (pt[1] < minY)
        {
            minY = pt[1];
        }
        if (pt[1] > maxY)
        {
            maxY = pt[1];
        }
    });

    var centerX = (minX + maxX)/2;
    var centerY = (minY + maxY)/2;

    var overlapedGrids = {};

    for (var iGrid = 0; iGrid<grids.features.length; iGrid++)
    {
        var grid = grids.features[iGrid];

        if (centerX >= grid.properties.bounds[0][0] && centerX <= grid.properties.bounds[1][0]) {
            if (centerY >= grid.properties.bounds[0][1] && centerY <= grid.properties.bounds[1][1]) {
                overlapedGrids[iGrid] = grid;
                //console.log("Cstn Bounds ["+minX+","+minY+"], ["+maxX+","+maxY+"]");
                //console.log( grid.properties.PA_NUMBER +" Bounds [" + grid.properties.bounds[0] +"], [" + grid.properties.bounds[0]+"]");
                gridIndex = iGrid;
            }
        }
    }

    return gridIndex;
}

function BSD2020Estimate(grids, constructionJson)
{
    var totalProjectedStudents = 0;
    var totalBSDStudents = 0;
    var avergeError = 0;
    var constructionError = 0;

    // Store construction area array by grid code
    var constructionLookup = {};
    constructionJson.features.forEach(function (feature) {
        if (constructionLookup[Number(feature.properties.STDYAREA)]) {
            constructionLookup[Number(feature.properties.STDYAREA)].push(feature);
        }
        else {
            constructionLookup[Number(feature.properties.STDYAREA)] = [feature];
        }
    });

    grids.features.forEach(function (grid) {
        //var estStudents = EstProgression(grid.properties.students) + EstConstruciton(grid);

        var estPromotion = PromoteStudents(grid.properties.students,projectionSpan);
        var estConstruction = EstConstrucitonBSD2020(grid, constructionLookup, projectionYear);
        var gridStudents = Sum(estPromotion, estConstruction);
        var estStudents = HSStudents(gridStudents);

        // Log Results
        totalProjectedStudents += estStudents;
        totalBSDStudents += grid.properties.DDP_DISP
        var modelError = Math.abs(estStudents - grid.properties.DDP_DISP);
        avergeError += modelError

        //console.log("Grid:" + grid.properties.PA_NUMBER + " BSD2020:" + grid.properties.DDP_DISP+ " recomputed:"+ estStudents + " modelError:" + modelError);
        if (/* modelError > 1.0 estProgression > 0.1 && estProgression <= 1.2 &&*/ grid.properties.TTL_DU.length > 0) {
            constructionError += modelError;
        }

    });

    var percentError = 100*Math.abs(totalBSDStudents-totalProjectedStudents)/totalBSDStudents;
    averageError = avergeError / grids.features.length;

    //console.log("BSD 2020 Enrollment Forecast:"+ totalBSDStudents.toFixed(3) + " Verification Forecast:" + totalProjectedStudents.toFixed(3)
    //+ " Percent Error:" +percentError.toFixed(3)+"%  Average Error:"+ averageError.toFixed(3)+" students" +" construction error:"+ constructionError);
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
        var studentGen = Multiply(studentGeneration, construction)
        var studentsYear = PromoteStudents(studentGen, yearsToPromote);
        estStudents = Sum(estStudents, studentsYear);
    }
    return estStudents;
}
