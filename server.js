var express = require('express');
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var app = express();
var dbGrid;
var dbSchool;
var dbSolution;

console.log(process.version);

var ObjectId = require('mongodb').ObjectID;
var urlBsdGrid = 'mongodb://localhost:27017/BSDBoundary';
var urlBsdSchool = 'mongodb://localhost:27017/BSDSchools';
var urlBsdSolution = 'mongodb://localhost:27017/BSDSolution';

// In command prop, start mongo server and point to node data directory:
// c:\Program Files\MongoDb\Server\3.2\bin>mongod --dbpath C:\Web\BSDBoundaryAnalysis\dbGrid
// In second command prompt start mongdb
// c:\Program Files\MongoDb\Server\3.2\bin>mongo
// Create database "BSDBoundary"
//> use BSDBoundary
// Create data collection in database:
// > db.createCollection(features)
// List all collections in database:
// > db.features.features.find()
// Remove everyting from database:
// > db.features.remove({})
// dbGrid.usercollection.insert({ "username" : "testuser1", "email" : "testuser1@testdomain.com" })

var port = process.env.port || 1337;

//app.set("view options", { layout: false });
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/css'));


app.get('/GetFeatures', function (request, response) {
    console.time("/GetFeatures");
    var features = dbGrid.collection('features').find().toArray(function (err, items) {
        if (err) {
            console.log("/GetFeatures error" + err);
            return next(err);
        }
        response.send(JSON.stringify(items));
        console.timeEnd("/GetFeatures")
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
                assert.equal(err, null);

                if (err != null) {
                    console.log("/NewGrid error" + err);
                }
                else {
                    console.log("/NewGrid result" + result);

                    var features = dbGrid.collection('features').find().toArray(function (err, items) {
                        if (err) {
                            console.log("/GetFeatures error" + err);
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
                grid,
                function (err, results)
                {
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
                }
            );
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
            //console.log('/EditGrid: ' + putFeature);
            var edit = JSON.parse(putFeature);
            dbGrid.collection('features').deleteOne(
                edit.remove,
                function (err, results) {
                    assert.equal(err, null);
                    dbGrid.collection('features').insertOne(edit.add, function (err, result) {
                        assert.equal(err, null);
                        console.log("/EditGrid add new result" + result);

                        var features = dbGrid.collection('features').find().toArray(function (err, items) {
                            assert.equal(err, null);
                            res.send(JSON.stringify(items));
                            console.timeEnd("/EditGrid");
                        });
                    });
                }
            );
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


