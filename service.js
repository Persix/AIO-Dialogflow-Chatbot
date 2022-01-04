const fs = require('fs')
const readline = require('readline')
require('dotenv').config()

const express = require('express')
const app = express()

const bodyParser = require('body-parser');
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.set('trust proxy', 1)

const { WebhookClient } = require('dialogflow-fulfillment-helper')
const { Card, Suggestion } = require('dialogflow-fulfillment-helper')
const { Payload } = require('dialogflow-fulfillment-helper')

var { google } = require('googleapis')
const sheets = google.sheets('v4')
var { GoogleAuth } = require('google-auth-library');
const axios = require("axios")
const path = require('path');
const moment = require('moment')

const { searchconsole } = require('googleapis/build/src/apis/searchconsole')
const { MapsClient } = require("@googlemaps/google-maps-services-js");
const { response } = require('express')

var socketio = require("socket.io")
const uuid = require('uuid')
const randomid = uuid.v4
const session = require('express-session')
const cookieParser = require('cookie-parser')

const redis = require('redis');
const { type } = require('os')

const Redis = require('ioredis')
const redisInstance = new Redis()

const { spawn } = require('child_process')

var redisStore = require('connect-redis')(session)
var redis_client = redis.createClient({ 
    host: 'localhost',
    port: 6379,
    legacyMode: true
});
var sessionStore = new redisStore({ client: redis_client })

app.use(bodyParser.json())

app.use(session({
    name: "UserStore",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    secret: process.env.SESS_SECRET,
    cookie: {
        maxAge: 1000 * 60 * 60 * 2,
        sameSite: true,
        secure: 'development'
    }
}))

var spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

app.listen(3008, async() => {  
    console.log('Hosting fulfillment service webhooks... Waiting for requests from dialogflow...')
    await redis_client.connect();
})
const oneDay = 1000 * 60 * 60 * 24;

async function SessionId(session_path) {
    const session_array = session_path.split('/')
    var session_id = session_array[session_array.length -1]
    console.log(`Dialogflow Session ID: ${session_id}`)
    return session_id
} 


async function CreateHash(id) {
   
    console.log(`Hash ID: ${id}`)
    try {
            var client = new Redis({
        });
    
        const customerData = {
            "sessionID": id
        }
        await client.hmset(id, customerData)
        const SessionData = await client.hgetall(id);
    }
    catch (e) {
        console.log('Error: ', e);
    }
}

async function SetupUUID() {
    var uuid_v4 = uuid.v4()
    console.log(uuid_v4)
    return uuid_v4
}

app.post('/webhook', async(request, response) => {
    console.log(request)
    const query = request.body.queryResult    
    console.log(request.body)

    const intent = request.body.queryResult.intent.displayName;
    const score = request.body.queryResult.intentDetectionConfidence;
  

    const fulfillmentText = request.body.queryResult.fulfillmentText;
    if (fulfillmentText) {
        console.log(`Agent Response: ${fulfillmentText}`)
    }
  
    const session_path = request.body.session;
    var session_id = await SessionId(session_path)
    await CreateHash(session_id)
    const parameters = request.body.queryResult.parameters
    const action = request.body.queryResult.action;
    
    if (action == "input.welcome") {       
        const client = new Redis()
        const sessData = await client.hgetall(session_id)
        if (sessData.FirstName && sessData.LastName) {           
                var agentResponse = {
                    "fulfillmentText": `Hey, what's up ${sessData.FirstName}! What could I help you with today?`
                }
                response.json(agentResponse)            
        }        
    }
    
    if (action == "appointment-booking-checkdate") {
        console.log("Validating the requested appointment date with fulfillment service...")
        var time_parameter = parameters["time"][0]
        var date_parameter = parameters["date"][0]
        var date = moment(date_parameter).format('M/DD/YYYY')
        var formatted_date = moment(date).format('MMMM Do')
        
        var dt = new Date(date_parameter)
        if (dt.getDay() == 6 || dt.getDay() == 0) {
            console.log("The requested date is a weekend...")
            var jsonResponse = {
    