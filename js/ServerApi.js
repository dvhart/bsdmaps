
// Load route polylines from Server
// Example: /GetSection
//$http.get('/GetSection').then(function (response) {
//    routes = RefreshFromSafetyDB(response, map);
//});

// Example /NewSection
//$http.post('/NewSection', section).then(function (response) {
//    routes = RefreshFromSafetyDB(response, map);
//});


function RefreshFromSafetyDB(dbData, renderMap) {
    var dbRoutes = []
    try {
        
        dbRoutes = dbData.data;
        
        // Find max accident rate
        var maxRate = 0;
        dbRoutes.forEach(function (route) {
            if (route.rate > maxRate) {
                maxRate = route.rate;
            }
        });
        
        // Set visible with color based on heat map
        dbRoutes.forEach(function (route) {
            var color = HeatMap(0, maxRate, route.rate);
            var polyline = new google.maps.Polyline({
                path: route.polyline.j,
                strokeColor: color,
                strokeWeight: 3
            });
            route.polyline = polyline;
            route.polyline.setMap(renderMap);
        });
        
        return dbRoutes;
        
    } catch (error) {
        console.log('error ' + error);
        
        return dbRoutes;
    }
};

function LoadSchools($http, callback) {
    $http.get('/GetSchools').then(function (getSchools) {
        var schoolArray = getSchools.data
        var schoolsObj = {};
        for (var i = 0; i < schoolArray.length; i++) {
            schoolsObj[schoolArray[i].id] = schoolArray[i];
        }
        callback(schoolsObj);
    });
}

function SaveSchools($http, schoolsObj) {
    var schoolArray = [];
    
    for (var id in schoolsObj) {
        schoolArray.push(schoolsObj[id]);
    }
    
    $http.post('/SetSchools', schoolArray).then(function successCallback(response) {
        console.log(response);
    }, function errorCallback(response) {
        console.log(response);
    });
}