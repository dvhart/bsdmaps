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
var BSDID = 2243;
var Sunset = 1188;
var Aloha = 1186;
var Southridge = 2783;

app.controller('BoundaryController', function ($scope, $http) {
    $scope.data = {
        "schools":{},
        "district":{}
    };
    
    $scope.onClick = function (points, evt) {
        console.log(points, evt);
    };

    function init() {
        
        SchoolInit($http, $scope.data);
    };

    init();
});


function SchoolInit( $http, data)
{
    LoadSchools($http, function (schoolsObj) {
        data.schools = schoolsObj;

        LoadDistrictData(data);
    });
}

function LoadDistrictData(data)
{
    var schoolId = Aloha;
    if (data.schools && data.schools[schoolId]) {
        data.district = { "enrollment": [], "grade": ["k", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "year": [] };
        
        for (var date in data.schools[schoolId].enrollment) {
            data.district.year.push(date);
            var enrolement = data.schools[schoolId].enrollment[date];
            data.district.enrollment.push(enrolement.grade);
        }

    }
}


