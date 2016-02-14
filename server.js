var express = require('express');
var assert = require('assert');
var auth = require('http-auth');
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;
var app = express();
var dbGrid;
var dbSchool;
var dbSolution;
var basic_auth;

console.log(process.version);

var ObjectId = require('mongodb').ObjectID;
var urlBsdGrid = 'mongodb://localhost:27017/BSDBoundary';
var urlBsdSchool = 'mongodb://localhost:27017/BSDSchools';
var urlBsdSolution = 'mongodb://localhost:27017/BSDSolution';
var htpasswd_path = __dirname + '/users.htpasswd';

// In command prop, start mongo server and point to node data directory:
// c:\Progra~1\MongoDb\Server\2.2.7\bin\mongod --dbpath E:\Web\bsdmaps\db
// In second command prompt start mongdb
// c:\Progra~1\MongoDb\Server\2.2.7\bin\mongo
// Create database "BSDBoundary"
//> use BSDBoundary
// Create data collection in database:
// > db.createCollection(features)
// List all collections in database:
// > db.features.find()
// Remove everyting from database:
// > db.features.remove({})
// dbGrid.usercollection.insert({ "username" : "testuser1", "email" : "testuser1@testdomain.com" })
//
// command line solution evaluation:
//> db.solutions.find()

var port = process.env.port || 1337;

//app.set("view options", { layout: false });
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/css'));

// Authentication module.
// Setup authentication if the htpasswd_path file exists
try {
    var stat = fs.statSync(htpasswd_path);
    basic_auth = auth.basic({
        realm: "BSD Maps",
        file: htpasswd_path
    });
    app.use(auth.connect(basic_auth));
} catch (e) {
    console.log(e);
    console.log("WARNING: Proceeding without http-auth user authentication.");
}


app.get('/GetFeatures', function (request, response) {
    console.time("/GetFeatures");
    dbGrid.collection('features').find().toArray(function (err, items) {
        if (err) {
            console.log("/GetFeatures error" + err);
            return next(err);
        }
        response.send(JSON.stringify(items));
        console.timeEnd("/GetFeatures")
    });
});

app.post('/SetFeatures', function (request, res) {
    console.time("/SetFeatures");
    var putFeatures = '';

    request.on('data', function (data) {
        putFeatures += data;
        if (putFeatures.slength > 1e6)
            request.connection.destroy();
    });

    request.on('end', function () {

        if (putFeatures != '') {
            var newFeatures = JSON.parse(putFeatures);

            dbGrid.collection('features').remove({}); // remove features from database
            dbGrid.collection('features').insert(newFeatures, function (err, result) {
                if (err != null) {
                    console.log("/SetFeatures error" + err);
                }
                else {
                    res.send(JSON.stringify(result));
                    console.timeEnd("/SetFeatures");
                }
            });
        }
    });
});

app.post('/NewGrid', function (request, res) {
    console.time("/NewGrid");
    var putFeature = '';

    request.on('data', function (data) {
        putFeature += data;
        if (putFeature.length > 1e6)
            request.connection.destroy();
    });

    request.on('end', function () {

        if (putFeature != '') {
            var newFeature = JSON.parse(putFeature);
            dbGrid.collection('features').insertOne(newFeature, function (err, result) {
                if (err != null) {
                    console.log("/NewGrid error" + err);
                }
                else {
                    console.log("/NewGrid result" + result);

                    var features = dbGrid.collection('features').find().toArray(function (err, items) {
                        if (err) {
                            console.log("/NewGrid error" + err);
                            return next(err);
                        }
                        res.send(JSON.stringify(items));
                        console.timeEnd("/NewGrid");
                    });
                }
            });
        }

    });
});

app.post('/DeleteGrid', function (request, res) {
    console.time("/DeleteGrid");
    var putFeature = '';
    
    request.on('data', function (data) {
        putFeature += data;
        if (putFeature.length > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        
        if (putFeature != '') {
            //console.log('DeleteGrid: ' + putFeature);
            var grid = JSON.parse(putFeature);
            dbGrid.collection('features').deleteOne(
                { "_id": ObjectId(grid._id) },
                function (err, results) {
                    if (err != null) {
                        console.log("/DeleteGrid error: " + err);
                    }
                    else {
                        console.log("/DeleteGrid " + results.deletedCount + " deleted, result: " + results.result);
                        
                        var features = dbGrid.collection('features').find().toArray(function (err, items) {
                            if (err) {
                                console.log("/GetFeatures error" + err);
                                return next(err);
                            }
                            res.send(JSON.stringify(items));
                            console.timeEnd("/DeleteGrid");
                        });
                    }
                });
        }
    });
});

app.post('/EditGrid', function (request, res) {
    console.time("/EditGrid");
    var putFeature = '';

    request.on('data', function (data) {
        putFeature += data;
        if (putFeature.length > 1e6)
            request.connection.destroy();
    });

    request.on('end', function () {
        if (putFeature != '') {
            var edit = JSON.parse(putFeature);
            var id = ObjectId(edit._id);
            delete edit._id;
            dbGrid.collection('features').replaceOne({ "_id" : id }, edit, function (err, results) {
                if (err != null) {
                    console.log("/EditGrid set properties error: " + err);
                    res.send(JSON.stringify(err));
                }
                else {
                    var features = dbGrid.collection('features').find().toArray(function (err, items) {
                        assert.equal(err, null);
                        res.send(JSON.stringify(items));
                        console.timeEnd("/EditGrid");
                    });
                }
            });
        }
    });
});

app.post('/NewSolution', function (request, res) {
    console.time("/NewSolution");
    var solutionString = '';

    request.on('data', function (data) {
        solutionString += data;
        if (solutionString.length > 1e6)
            request.connection.destroy();
    });

    request.on('end', function () {

        if (solutionString != '') {
            var newSolution = JSON.parse(solutionString);

            if (!newSolution.solutionName || newSolution.solutionName == "") {
                res.send("Soluiton must be named");
            }

            dbGrid.collection('solutions').find({"solutionName": newSolution.solutionName}).toArray(function (err, items) {
                if (err) {
                    console.log("/NewSolution error" + err);
                    res.send("Database find error");
                }
                else if(SolutionInDb(newSolution, items)) {
                    console.log("/NewSolution Solution already in Db" + err);
                    res.send("Solution " + newSolution.solutionName+ " already in Database");
                }
                else{
                    dbGrid.collection('solutions').insertOne(newSolution, function (err, result) {
                        if (err != null) {
                            console.log("/NewSolution error " + err);
                            res.send("Database insert error");
                        }
                        else {
                            console.log("/NewSolution result " + result);

                            if (result.result.ok && result.insertedCount == 1) {
                                res.send("Map saved successfully");

                            }
                            else {
                                res.send("Save error");
                            }
                            console.timeEnd("/NewSolution");
                        }
                    });
                }
            });
        }

    });
});

app.post('/EditSolution', function (request, res) {
    console.time("/EditSolution");
    var putFeature = '';
    
    request.on('data', function (data) {
        putFeature += data;
        if (putFeature.length > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        if (putFeature != '') {
            var edit = JSON.parse(putFeature);
            edit._id = ObjectId(edit._id);
            dbGrid.collection('solutions').replaceOne({"_id":edit._id}, edit, function (err, results) {
                if (err != null) {
                    console.log("/EditSolution set properties error: " + err);
                    res.send(JSON.stringify(err));
                }
                else if (results.modifiedCount ==1) {
                    res.send("Map saved successfully");
                }
                else {
                    res.send("Failed to save map");
                }
                console.timeEnd("/EditSolution");
            });
        }
    });
});

app.post('/DeleteSolution', function (request, res) {
    console.time("/DeleteSolution");
    var solution = '';
    
    request.on('data', function (data) {
        solution += data;
        if (solution.length > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        
        if (solution != '') {
            var section = JSON.parse(solution);
            dbGrid.collection('solutions').deleteOne({ "_id": ObjectId(section._id) },
                function (err, results) {
                if (err != null) {
                    console.log("/DeleteSolution error: " + err);
                }
                else {
                    if (results) {
                        res.send("Successfully Deleted");
                    }
                    else {
                        res.send("Failed to delete solution");
                    }
                }
            });
        }
    });
});


function SolutionInDb(newSolution, items)
{
    var match = false;
    for (var i = 0; i < items.length && match == false; i++) {
        var numGrids = newSolution.grids.length;
        if (numGrids == items[i].grids.length) {
            var assumeSame = true;
            for (var j = 0; j < numGrids && assumeSame == true; j++) {
                if (newSolution.grids[j].gc != items[i].grids[j].gc || newSolution.grids[j].proposedHigh != items[i].grids[j].proposedHigh) {
                    assumeSame = false;
                }
            }
            if (assumeSame) {
                match = true;
            }
        }

    }

    return match;
}

app.post('/Solution', function (request, response) {
    console.time("/Solution");
    var queryString = '';

    request.on('data', function (data) {
        queryString += data;
        if (queryString.length > 1e6)
            request.connection.destroy();
    });

    request.on('end', function () {

        if (queryString != '') {
            var query = JSON.parse(queryString);
            var solutionsObj = dbGrid.collection('solutions').find(query);
            var solutions = [];
            solutionsObj.each(function (err, solution){
                if (solution != null) {
                    solutions.push(solution);
                }
                else {
                    response.send(JSON.stringify(solutions));
                    console.timeEnd("/Solution");
                }
            });

        }

    });
});

app.get('/GetSection', function (request, response) {
    console.time("/GetSection");
    dbGrid.collection('sections').find().toArray(function (err, items) {
        if (err) {
            console.log("/GetSection error" + err);
            return next(err);
        }
        response.send(JSON.stringify(items));
        console.timeEnd("/GetSection")
    });
});

app.post('/NewSection', function (request, res) {
    console.time("/NewSection");
    var putSection = '';
    
    request.on('data', function (data) {
        putSection += data;
        if (putSection.length > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        
        if (putSection != '') {
            var newSection = JSON.parse(putSection);
            dbGrid.collection('sections').insertOne(newSection, function (err, result) {
                if (err != null) {
                    console.log("/NewSection error" + err);
                }
                else {
                    console.log("/NewSection result" + result);
                    
                    var features = dbGrid.collection('sections').find().toArray(function (err, items) {
                        if (err) {
                            console.log("/NewSection error" + err);
                            return next(err);
                        }
                        res.send(JSON.stringify(items));
                        console.timeEnd("/NewSection");
                    });
                }
            });
        }

    });
});

app.post('/DeleteSection', function (request, res) {
    console.time("/DeleteSection");
    var putSection = '';
    
    request.on('data', function (data) {
        putSection += data;
        if (putSection.length > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        
        if (putSection != '') {
            //console.log('DeleteGrid: ' + putSection);
            var section = JSON.parse(putSection);
            dbGrid.collection('sections').deleteOne({"_id": ObjectId(section._id)},
                function (err, results) {
                    if (err != null) {
                        console.log("/DeleteSection error: " + err);
                    }
                    else {
                        console.log("/DeleteSection " + results.deletedCount + " deleted, result: " + results.result);
                        
                        var features = dbGrid.collection('sections').find().toArray(function (err, items) {
                            if (err) {
                                console.log("/DeleteSection error" + err);
                                return next(err);
                            }
                            res.send(JSON.stringify(items));
                            console.timeEnd("/DeleteSection");
                        });
                    }
                }
            );
        }
    });
});

app.get('/GetRoutes', function (request, response) {
    console.time("/GetRoutes");
    dbGrid.collection('routes').find().toArray(function (err, items) {
        if (err) {
            console.log("/GetRoutes error" + err);
            return next(err);
        }
        response.send(JSON.stringify(items));
        console.timeEnd("/GetRoutes")
    });
});

app.post('/SetRoutes', function (request, res) {
    console.time("/SetRoutes");
    var putFeatures = '';
    
    request.on('data', function (data) {
        putFeatures += data;
        if (putFeatures.slength > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        
        if (putFeatures != '') {
            var newFeatures = JSON.parse(putFeatures);
            
            dbGrid.collection('routes').remove({}); // remove features from database
            dbGrid.collection('routes').insert(newFeatures, function (err, result) {
                if (err != null) {
                    console.log("/SetRoutes error" + err);
                }
                else {
                    res.send(JSON.stringify(result));
                    console.timeEnd("/SetRoutes");
                }
            });
        }
    });
});

// spin up server
MongoClient.connect(urlBsdGrid, function (err1, database1) {
    if (err1) throw err1;
    dbGrid = database1;

    MongoClient.connect(urlBsdSchool, function (err2, database2) {
        if (err2) throw err2;
        urlBsdSchool = database2;

        MongoClient.connect(urlBsdSolution, function (err3, database3) {
            if (err3) throw err3;
            urlBsdSchool = database3;

            // Start the application after the database connection is ready
            app.listen(port);
            console.log("Listening on port " + port);
        });
    });
});


