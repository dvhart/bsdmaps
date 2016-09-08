
// Load route polylines from Server
// Example: /GetSection
//$http.get('/GetSection').then(function (response) {
//    routes = RefreshFromSafetyDB(response, map);
//});

// Example /NewSection
//$http.post('/NewSection', section).then(function (response) {
//    routes = RefreshFromSafetyDB(response, map);
//});

function LoadGrids($http, callback) {
    $http.get('/GetFeatures').then(function (features) {
        console.log("/GetFeatures " + features.statusText);
        var grids;
        if (features.statusText == "OK" && features.data) {
            grids = features.data;
        }
        callback(grids);
    });
}

function SaveGrids($http, grids, callback) {
    $http.post('/SetFeatures', grids).then(function successCallback(response) {
        callback(response);
    }, function errorCallback(response) {
        callback(response);
    });
}


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

function SavePermits($http, permitsObj, callback) {
    $http.post('/SetPermits', permitsObj).then(function successCallback(response) {
        if(callback)
        {
            callback(response);
        }
    }, function errorCallback(response) {
        console.log("SavePermits error:"+response);
    });
}

function LoadBSDGrids($http, callback) {
    $http.get('/GetBSData').then(function (bsdData) {
        console.log("/GetBSData " + bsdData.statusText);
        var gridJson;
        if (bsdData.statusText == "OK" && bsdData.data) {
            gridJson = bsdData.data;
        }
        callback(gridJson);
    });
}

function SaveBSDGrids($http, bsGrids, callback) {
    $http.post('/SetBSData', bsGrids).then(function successCallback(response) {
        callback(response);
    }, function errorCallback(response) {
        callback(response);
    });
}


function LoadPermits($http, callback) {
    $http.get('/GetPermits').then(function (getPermits) {
        var permits = getPermits.data;

        if(!permits.features)
        {
            permits = {"type": "FeatureCollection","features":[]};
        }

        callback(permits);
    });
}

function LoadGeoJsonFiles($http, callback) {
    var construction = "ResDevProjects.geojson";
    var students = "BSDStudents2014.geojson";
    var schools = "Schools.geojson";

    $http.get(construction).success(function (constructionJson) {
        $http.get(students).success(function (studentsJson) {
            $http.get(schools).success(function (schoolsJson) {
                callback(constructionJson, studentsJson, schoolsJson);
            });
        });
    });
}

function LoadConstructionJson($http, callback) {
    var construction = "ResDevProjects.geojson";

    $http.get(construction).success(function (constructionJson) {
                callback(constructionJson);
    });
}
