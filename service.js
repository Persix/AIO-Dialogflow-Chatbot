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
c