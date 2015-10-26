# Birdhouses Inc Mobile Microservice

This microservice is a simple gateway, passing requests through to the relevant Microservice  
It relies on a series of environment variables being set up:  
__SALESFORCE_SERVICE:__ ID of the Salesforce mBaaS service  
__SHAREPOINT_SERVICE:__ ID of the Sharepoint mBaaS Service  
__PRODUCTS_LIST_ID:__ ID of the list in Sharepoint which contains our products descriptions  
__ORDERS_SERVICE:__ ID of the orders mongo database  
  
# Group Mobile Microservice API

# orders [/orders]

'Get orders' endpoint.

## orders [GET] 

'List orders' endpoint.

+ Request (application/json)

+ Response 200 (application/json)
    + Body
    
            {
              "list": ["orders", "go", "here"]
            }

## orders [POST] 

'Create order' endpoint.

+ Request (application/json)
    + Body
    
            {
              "some": "order info"
            }

+ Response 200 (application/json)
    + Body
    
            {
              "your": "new order here"
            }
