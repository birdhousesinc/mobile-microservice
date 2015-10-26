var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var fh = require('fh-mbaas-api');

var api = new express.Router();
api.use(cors());
api.use(bodyParser());

// Clever bit of hackery to reduce repetition - takes a response object, 
// gives us a callback function to pass to fh.service and deal with errors or successes
function doServiceResponse(res){
  return function(err, serviceResponseBody, serviceResponse){
    if ( err ) {
      var status = serviceResponse && serviceResponse.statusCode || 500;
      return res.status(status).json(err);
    }
    return res.json(serviceResponseBody);
  };
}

api.get('/accounts', function(req, res) {
  // Login to SF
  return fh.service({
    "guid": "5ls2muzfhb4mqkwqt4gkwik2",
    "path": "login",
    "method": "POST",
    "params": {}
  }, function(err, authInfo, response) {
    if ( err ) {
      return res.status(response.statusCode).json(err);
    }
    // Now we've established a SF session, retrieve a list of accounts
    return fh.service({
      "guid": process.env.SALESFORCE_SERVICE,
      "path": "listAccounts",
      "method": "POST",
      "params": authInfo
    }, doServiceResponse(res));
  });
});

api.get('/products', function(req, res){
  var productListId = process.env.PRODUCTS_LIST_ID;
  fh.service({
    "guid": process.env.SHAREPOINT_SERVICE,
    "path": "lists/" + productListId,
    "method": "GET",
    "params": {}
  }, doServiceResponse(res));
});

// Retrieve orders from our DB microservice
api.get('/orders', function(req, res) {
  fh.service({
    "guid": process.env.ORDERS_SERVICE,
    "path": "orders",
    "method": "GET",
    "params": {}
  }, doServiceResponse(res));
});

// Create an order in our DB microservice
api.post('/orders', function(req, res) {
  return fh.service({
    "guid": process.env.ORDERS_SERVICE,
    "path": "orders",
    "method": "GET",
    "params": {}
  }, doServiceResponse(res));
});

module.exports = api;
