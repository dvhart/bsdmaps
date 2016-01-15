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

app.post('/NewSolution', function (request, res) {
    console.time("/NewSolution");
    var putFeature = '';
    
    request.on('data', function (data) {
        putFeature += data;
        if (putFeature.length > 1e6)
            request.connection.destroy();
    });
    
    request.on('end', function () {
        
        if (putFeature != '') {
            var newFeature = JSON.parse(putFeature);
            dbGrid.collection('solutions').insertOne(newFeature, function (err, result) {
                assert.equal(err, null);
                
                if (err != null) {
                    console.log("/NewSolution error" + err);
                }
                else {
                    console.log("/NewSolution result" + result);
                    
                    var features = dbGrid.collection('solutions').find().toArray(function (err, items) {
                        if (err) {
                            console.log("/NewSolution error" + err);
                            return next(err);
                        }
                        res.send(JSON.stringify(result));
                        console.timeEnd("/NewSolution");
                    });
                }
            });
        }

    });
});

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
            dbGrid.collection('solutions').findOne(query, function (err, queryResult) {
                if (err != null) {
                    console.log("/Solution error" + err);
                }
                else {
                    response.send(JSON.stringify(queryResult));
                    console.timeEnd("/Solution");
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


