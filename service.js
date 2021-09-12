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

app.use(bodyParse