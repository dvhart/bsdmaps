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

var countyId = 34;
var districtId = 2243;


app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "schools":{},
        "district": {},
        "high": [],
        "plotData": []
    };
    
    $scope.onClick = function (points, evt) {
        console.log(points, evt);
    };
    
    $scope.PlotChange = function ()
    {
        if ($scope.data.plotData) {
            LoadDistrictData($scope.data, $scope.data.plotData[0]);
        }
    }

    function init() {
        
        SchoolInit($http, $scope.data);
    };

    init();
});


function SchoolInit( $http, data)
{
    LoadSchools($http, function (schoolsObj) {
        data.schools = schoolsObj;

        FindHigh(data);

        LoadDistrictData(data, 34);
    });
}

function LoadDistrictData(data, schoolId)
{
    if (data.schools && data.schools[schoolId]) {
        data.district = { "enrollment": [], "grade": ["k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [] };
        
        for (var date in data.schools[schoolId].enrollment) {
            data.district.year.push(date);
            var enrolement = data.schools[schoolId].enrollment[date];
            data.district.enrollment.push(enrolement.grade);
        }

    }
}

function FindHigh(data) {
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
                data.high.push([schoolId, school.displayName]);
            }
        }
    }
}


