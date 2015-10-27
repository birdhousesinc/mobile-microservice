var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var _ = require('underscore');
var fh = require('fh-mbaas-api');
var async = require('async');

const EXPIRES = 1800; // 30 min cache expire

var api = new express.Router();
api.use(cors());
api.use(bodyParser());

// Clever bit of hackery to reduce repetition - takes a response object, 
// gives us a callback function to pass to fh.service and deal with errors or successes
function doServiceResponse(res, filter){
  return function(err, serviceResponseBody){
    if ( err ) {
      console.log('Error reaching service: ');
      console.log(err);
      return res.status(500).json(err);
    }
    if (_.isFunction(filter)){
      serviceResponseBody = filter(serviceResponseBody);
    }
    return res.json(serviceResponseBody);
  };
}

// Retrieve orders from our DB microservice
api.get('/orders', function(req, res) {
  fh.service({
    "guid": process.env.ORDERS_SERVICE,
    "path": "/orders",
    "method": "GET",
    "params": {}
  }, function(err, body, serviceResponse){
    if (err){
      return res.status(500).json(err);
    }
    // Transform our fh.db response into something simpler
    var filteredOrders = _.pluck(body.list, 'fields');
    if (filteredOrders.length === 0){
      return res.json(filteredOrders);
    }
    // Pull from the cache what the various account and product keys correspond to
    async.parallel({
      accounts : async.apply(fh.cache, { act : 'load', key : 'accounts' }),
      products : async.apply(fh.cache, { act : 'load', key : 'products' })
    }, function(err, cacheResults){
      if (err){
        return res.json(filteredOrders);
      }
      var accounts = JSON.parse(cacheResults.accounts),
      products = JSON.parse(cacheResults.products);
      // Iterate over every order, and include the account and product object for each
      filteredOrders = _.map(filteredOrders, function(order){
        var account = _.findWhere(accounts, { Id : order.account }),
        product = _.findWhere(products, { id : order.product });
        // Assign the full object if we found a match, otherwise leave it assigned to the Id for safety
        order.account = account || order.account;
        order.product = product || order.product;
        return order;
      });
      return res.json(filteredOrders);
    })
  });
});

// Create an order in our DB microservice
api.post('/orders', function(req, res) {
  return fh.service({
    "guid": process.env.ORDERS_SERVICE,
    "path": "/orders",
    "method": "GET",
    "params": req.body
  }, doServiceResponse(res));
});

api.use(function(req, res, next){
  var cacheKey = _.last(req.path.split('/'));
  return fh.cache({ act : 'load', key : cacheKey }, function(err, cacheRes){
    if (!err && cacheRes){
      cacheRes = JSON.parse(cacheRes);
      return res.json(cacheRes)
    }
    return next();
  });
});

api.get('/accounts', function(req, res) {
  // Login to SF
  return fh.service({
    "guid": "5ls2muzfhb4mqkwqt4gkwik2",
    "path": "/cloud/login",
    "method": "POST",
    "params": {}
  }, function(err, authInfo, response) {
    if ( err ) {
      var status = response && response.statusCode || 500;
      return res.status(status).json(err);
    }
    // Now we've established a SF session, retrieve a list of accounts
    return fh.service({
      "guid": process.env.SALESFORCE_SERVICE,
      "path": "/cloud/listAccounts",
      "method": "POST",
      "params": authInfo
    }, doServiceResponse(res, function(unfiltered){
      var filtered = unfiltered.records;
      // fire & forget a cache save
      fh.cache({ act : 'save', key : 'accounts', value : JSON.stringify(filtered), expire : EXPIRES}, _.noop);
      return filtered;
    }));
  });
});

// Convert a sharepoint field ID into 
function getInternalSharepointName(fields, name){
  var field = _.findWhere(fields, { Title : name });
  if (!field){
    return name;
  }
  return field.InternalName;
}

api.get('/products', function(req, res){
  var productListId = process.env.PRODUCTS_LIST_ID;
  fh.service({
    "guid": process.env.SHAREPOINT_SERVICE,
    "path": "/lists/" + productListId,
    "method": "GET",
    "params": {}
  }, doServiceResponse(res, function filter(unfiltered){
    // Filter the response from the products service to only contain stuff we're interested in
    var fields = unfiltered.Fields,
    products = unfiltered.Items,
    nameField = getInternalSharepointName(fields, 'name'),
    priceField = getInternalSharepointName(fields, 'price'),
    colorField = getInternalSharepointName(fields, 'color'),
    materialField = getInternalSharepointName(fields, 'material'),
    descriptionField = getInternalSharepointName(fields, 'description');
    
    // return something sensible as a product, rather than god-awful sharepoint response
    var filtered = _.map(products, function(product){
      return {
        name : product[nameField],
        price : product[priceField],
        color : product[colorField],
        material : product[materialField],
        description: product[descriptionField],
        id : product.Id
      }
    });
    fh.cache({ act : 'save', key : 'products', value : JSON.stringify(filtered), expire : EXPIRES}, _.noop);
    return filtered;
  }));
});

module.exports = api;
