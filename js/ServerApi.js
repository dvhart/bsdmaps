
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

function SchoolToId(school)
{
	switch (school)
	{
		case "Aloha High School":
		case "Aloha HS":
		case "Aloha":
			return 1186;
		case "Aloha-Huber Park School":
		case "Aloha-Huber Park":
		case "Aloha Huber Park":
		case "Aloha-Huber Park K8":
		case "Aloha Huber Park K8":
			return 1153;
		case "Arco Iris Spanish Immersion School":
		case "Arco Iris":
			return 4805;
		case "Arts and Communication Magnet Academy":
		case "Arts and Communication":
			return 1304;
		case "Barnes Elementary School":
		case "Barnes ES":
		case "Barnes":
			return 1154;
		case "Beaver Acres Elementary School":
		case "Beaver Acres ES":
		case "Beaver Acres":
			return 1155;
		case "Beaverton High School":
		case "Beaverton HS":
		case "Beaverton":
			return 1187;
		case "Bethany Elementary School":
		case "Bethany ES":
		case "Bethany":
			return 1156;
		case "Bonny Slope Elementary School":
		case "Bonny Slope ES":
		case "Bonny Slope":
			return 4671;
		case "Cedar Mill Elementary School":
		case "Cedar Mill ES":
		case "Cedar Mill":
			return 1158;
		case "Cedar Park Middle School":
		case "Cedar Park MS":
		case "Cedar Park":
			return 1180;
		case "Chehalem Elementary School":
		case "Chehalem ES":
		case "Chehalem":
			return 1159;
		case "Community School":
			return 1305;
		case "Conestoga Middle School":
		case "Conestoga MS":
		case "Conestoga":
			return 1319;
		case "Cooper Mountain Elementary School":
		case "Cooper Mountain ES":
		case "Cooper Mountain":
			return 1160;
		case "Elmonica Elementary School":
		case "Elmonica ES":
		case "Elmonica":
			return 1162;
		case "Errol Hassell Elementary School":
		case "Errol Hassell ES":
		case "Errol Hassell":
			return 1161;
		case "Findley Elementary School":
		case "Findley ES":
		case "Findley":
			return 1370;
		case "Fir Grove Elementary School":
		case "Fir Grove ES":
		case "Fir Grove":
			return 1163;
		case "Five Oaks Middle School":
		case "Five Oaks MS":
		case "Five Oaks":
			return 1181;
		case "Greenway Elementary School":
		case "Greenway ES":
		case "Greenway":
			return 1157;
		case "Hazeldale Elementary School":
		case "Hazeldale ES":
		case "Hazeldale":
			return 1164;
		case "Health & Science School":
			return 4638;
		case "Highland Park Middle School":
		case "Highland Park MS":
		case "Highland Park":
			return 1184;	
		case "Hiteon Elementary School":
		case "Hiteon ES":
		case "Hiteon":
			return 1165;
		case "Hope Chinese Charter School":
			return 4867;
		case "International School of Beaverton":
		case "ISB":
			return 4474;
		case "Jacob Wismer Elementary School":
		case "Jacob Wismer ES":
		case "Jacob Wismer":
			return 3437;
		case "Kinnaman Elementary School":
		case "Kinnaman ES":
		case "Kinnaman":
			return 1166;
		case "McKay Elementary School":
		case "McKay ES":
		case "McKay":
			return 1168;
		case "McKinley Elementary School":
		case "McKinley ES":
		case "McKinley":
			return 1169;
		case "Meadow Park Middle School":
		case "Meadow Park MS":
		case "Meadow Park":
			return 1182;
		case "Montclair Elementary School":
		case "Montclair ES":
		case "Montclair":
			return 1170;
		case "Mountain View Middle School":
		case "Mountain View MS":
		case "Mountain View":
			return 1183;
		case "Nancy Ryles Elementary School":
		case "Nancy Ryles ES":
		case "Nancy Ryles":
			return 1303;
		case "Oak Hills Elementary School":
		case "Oak Hills ES":
		case "Oak Hills":
			return 1171;
		case "Raleigh Hills Elementary School":
		case "Raleigh Hills ES":
		case "Raleigh Hills":
			return 1172;
		case "Raleigh Park Elementary School":
		case "Raleigh Park ES":
		case "Raleigh Park":
			return 1173;
		case "Ridgewood Elementary School":
		case "Ridgewood ES":
		case "Ridgewood":
			return 1174;
		case "Rock Creek Elementary School":
		case "Rock Creek ES":
		case "Rock Creek":
			return 1175;
		case "Scholls Heights Elementary School":
		case "Scholls Heights ES":
		case "Scholls Heights":
			return 2781;
		case "School of Science & Technology":
			return 1314;
		case "Sexton Mountain Elementary School":
		case "Sexton Mountain ES":
		case "Sexton Mountain":
			return 1270;
		case "Southridge High School":
		case "Southridge HS":
		case "Southridge":
			return 2783;
		case "Springville K-8 School":
		case "Springville K8":
		case "Springville":
			return 4712;
		case "Stoller Middle School":
		case "Stoller MS":
		case "Stoller":
			return 2782;
		case "Sunset High School":
		case "Sunset HS":
		case "Sunset":
			return 1188;
		case "Terra Linda Elementary School":
		case "Terra Linda ES":
		case "Terra Linda":
			return 1176;
		case "Vose Elementary School":
		case "Vose ES":
		case "Vose":
			return 1177;
		case "West Tualatin View Elementary School":
		case "West Tualatin View ES":
		 case "West Tualatin View":
		 case "West TV":
			return 1178;
		case "Westview High School":
		case "Westview HS":
		case "Westview":
			return 1320;
		case "Whitford Middle School":
		case "Whitford MS":
		case "Whitford":
			return 1185;
		case "William Walker Elementary School":
		case "William Walker ES":
		case "William Walker":
			return 1179;
		case "South Cooper Mountain High School":
		case "South Cooper Mountain HS":
		case "South Cooper Mountain":
			return 1179;
	}
	return null;
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
