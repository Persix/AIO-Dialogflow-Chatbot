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
                "fulfillmentText" : "I'm really sorry, but pick-ups don't run on weekends, only week days from 8-11 am."            
            }
           return response.json(jsonResponse)
        }
 
        var time = moment(time_parameter).format('HH:mm')       
        var formattedtime = moment(time_parameter).format('LT')

        console.log(`formattedtime is: ${formattedtime}`)
        console.log(`Time is: ${time}`)
        var time_string = String(time)
        var time_array = time_string.split(":")
        var hours = time_array[0]
        var minutes = time_array[1]
        var total_minutes = Number(hours) * 60 + Number(minutes)
        
        console.log("Verifying whether the requested time is within business hours (8am-11am)...")
        if (total_minutes >= 480 && total_minutes < 660) {
        console.log("Requested time meets the criteria! Check whether that date is available in appointment spreadsheet...")
        const status = await VerifyAppointment(parameters)
        console.log("The appointment status is: " + status)
        
        if (status == "available") {
            const context = request.body.queryResult["outputContexts"]
            try {
            const hashMap = {
                "AppointmentDate": String(date),
                "AppointmentTime": String(formattedtime)
            }
                var client = new Redis()    
                await client.hmset(session_id, hashMap)
                const sessData = await client.hgetall(session_id) 
            } catch (err) {
            console.log(err)
            }
            for (i=0; i < context.length; i++) {
                var context_name = context[i]["name"]
                if (context_name == session_path + '/contexts/' + 'appointment-booking-reschedule') {
                    console.log("Customer is in the process of rescheduling an appointment...") 
                    console.log("Attempting to update appointment details to spreadsheet...")
                    var update_sheet = await ChangeAppointment(parameters, "reschedule", session_id)
                    console.log(`ChangeAppointment() Result: ${update_sheet}`)  
                        if (update_sheet == "success") {
                            var jsonResponse = { "fulfillmentText" : `And... you're all set! I rescheduled your new appointment date to ${formatted_date} at ${formattedtime}. Please let me know if you need help with anything, I would absolutely love to help.`}
                        }
                        if (update_sheet == "fail") {
                            var jsonResponse = { "fulfillmentText" : `I'm incredibly sorry, we're having network issues, so I'm having issues on our end. Once our system's back up, I will reschedule your appointment date as soon as possible!`}
                        }
                        response.send(jsonResponse)                            
                }

                if (context_name == session_path + '/contexts/' + 'appointment-booking-create') {     
                    var jsonResponse = { "fulfillmentText" : `Perfect, you're in luck! ${formatted_date} at ${formattedtime} is available... What name should I put the appointment under?`}
                    response.send(jsonResponse)
                }
                
                }
            } else {
                var jsonResponse = {
                    "fulfillmentText" : `Sorry, we're completely booked on ${formatted_date}... Would it be okay if we chose a different date? I would still love to help you.`            
                }
            }    
           
            response.json(jsonResponse)

        } else {
            console.log("Appointment time is outside of business hours")
            var jsonResponse = {
                "fulfillmentText" : `Sorry, ${formatted_date} at ${formattedtime} is outside of our business fundraiser hours. We are only available on weekdays, from 8am - 11am. What time works best for you?`
            }
            response.send(jsonResponse)
        }
    }

    if (action == "appointment-booking-getname") {
        // ******* The name of a specific context object has the format below:  ******** //
        
        console.log("Using context to determine whether the customer intends to book, reschedule, or cancel their appointment\n")
        // Strategy: Parse the most recent context object in the query request and apply the following operations:
        // Step (1) Split the context name by the '/' backslash character into 9 elements
        // Step (2) Extract the last element in the context array 
        // Step (3) Check if the context name is equal to 'appointment-booking-reschedule'
        var FirstName = await parameters["first-name"]
        var LastName = await parameters["last-name"]
        console.log("Attempting to update session hash data...")
        try {
          const client = new Redis()
          const hashMap = {
              "FirstName": FirstName,
              "LastName": LastName
            }
            await client.hmset(session_id, hashMap)
            const sessData = await client.hgetall(session_id)
            console.log(sessData)
        } catch(err) {

        }
        
        const context = request.body.queryResult["outputContexts"]
        console.log(`Displaying ${context.length} items in the context list: \n`)
        // console.log(context)
        console.log(`Printing context: \n`)
        // console.log(context)
        for (i=0; i < context.length; i++) {
            // console.log(`Parsing the context object...`)
            var context_name = context[i]["name"]
            if (context_name == session_path + '/contexts/' + 'appointment-booking-reschedule') {
                if (FirstName !== undefined && LastName !== undefined) {
                    console.log(`Saving customer name: ${FirstName} ${LastName} to session cache...`)
                    const res_context = { 
                        "entity": "name",
                        "action": "reschedule"
                    }
                    const fulfillmentText = await LookupName(parameters, res_context, session_id)
                    var jsonResponse = {
                        "fulfillmentText": fulfillmentText
                    }
                    response.send(jsonResponse)
                }
            }
            if (context_name == session_path + '/contexts/' + 'appointment-booking-create') {
                    console.log(`Customer is attempting to book an appointment... `)
                    var jsonResponse = { 
                        "fulfillmentText": `Thank you ${parameters["first-name"]}! Please give me your email as well, we send out important reminders and details regarding your appointment.`}
                    response.json(jsonResponse)
                    var FirstName = await parameters["first-name"]
                    var LastName = await parameters["last-name"]
                    
                    console.log(FirstName)
                    console.log(LastName)
                    
                    console.log("Asking customer for email address...")
                    console.log(`Saving customer name: ${FirstName} ${LastName} to session cache...`)
                    
                    redis_client.set("FirstName", FirstName, function(err, response) { if(err) { console.log(err)} console.log("Saved customer's first name to session cache...") })
                    redis_client.set("LastName", LastName, function(err, response) { if(err) { console.log(err) } console.log("Saved customer's lastname to session cache...") }) 
                }
  
                

             if (context_name == session_path + '/contexts/' + 'appointment-booking-cancel') {
                    console.log(`Customer is attempting to cancel an appointment... `)
                //     var jsonResponse = { 
                //         "fulfillmentText": `Thank you ${parameters["first-name"].original}! Please give me your email as well, we send out important reminders and details regarding your appointment.`}
                //   response.json(jsonResponse)
                   console.log("Checking if customer name was provided...")
                var FirstName = await parameters["first-name"]
                var LastName = await parameters["last-name"]
                console.log(FirstName)
                console.log(LastName)

                if (FirstName !== undefined && LastName !== undefined) {
                    console.log("Customer provided full name.... LookupAppointment() \n")
                    console.log(`${FirstName} ${LastName}`)
                    const context_cancel = {
                        "entity": "name",
                        "action": "cancel"
                        }
                        
                    const fulfillmentText = await LookupName(parameters, context_cancel)
                    var jsonResponse = {
                        "fulfillmentText": fulfillmentText
                    }
                    console.log(`Sending fulfillment response: "${fulfillmentText}" to customer...`)
                    response.send(jsonResponse)

                    console.log(`Saving customer name: ${FirstName} ${LastName} to session cache...`)
                    redis_client.set("FirstName", FirstName, function(err, response) { if(err) { console.log(err)} console.log("Saved customer's first name to session cache...") })
                    redis_client.set("LastName", LastName, function(err, response) { if(err) { console.log(err) } console.log("Saved customer's lastname to session cache...") }) }
  
                }            
                
        }
    }

    if (action == "get_customer_email") {
        console.log(query)
        console.log("Displaying parameters...")
        // Run operations to check if the email was provided...
        console.log("Checking if customer email was provided...")
        console.log("Printing parameters...")
        console.log(parameters)
        if (parameters["email"].length > 0) {
            var Email = parameters["email"]     
            console.log(`Attempting to store ${Email} in session hash....`)          
            console.log("Email is: " + Email)
            const hashData = {
                "Email": Email
            }

            try {                
                const client = await new Redis()
                await client.hmset(session_id, hashData)
                const sessData = await client.hgetall(session_id)
            } catch(err) {
                console.log(err)
            }

            redis_client.set("Email", Email, function(err, response) {
                if(err) {
                    console.log(err)
                }
                console.log("Saved customer's email to session cache...")
            })
            var jsonResponse = {
                "fulfillmentText" : "Thanks! I need your phone number in order to book the appointment, we're almost finished!"
            }
            console.log("Activate'appointment-booking-getnumber'")
           
    } else {
        console.log("Email not found... Triggering 'appointment-booking-getemail' intent...")
        var jsonResponse = {
            "fulfillmentText" : "Sorry! I need your email in order to book the appointment"
        }
        
    }
        response.json(jsonResponse)
    }

    if (action == "appointment-booking-getphone") {
        console.log("Saving customer's phone number to system...")
        console.log(parameters)
        const Phone = parameters["phone-number"]
        console.log("Phone Number: " + Phone)

       
        if (Phone.replace(/\D/g,'').length !== 10) {
            console.log("Phone number is invalid")
            var jsonResponse = {
                "fulfillmentText": "Sorry, it looks like that phone number is invalid, could you tell me the full phone number, please?"
                }
                response.json(jsonResponse)
            
        } else {
            console.log("Phone number is valid...")
            var jsonResponse = {
                "fulfillmentText": "Thanks! And the address of the location for the pick-up?"
                }

        try {
            console.log("Attempting to save customer phone number to session cache...")
            const client = new Redis()
            const hashData = { "Phone": Phone }
            await client.hmset(session_id, hashData)
            const sessData = await client.hgetall(session_id)
            console.log(sessData)

            redis_client.set("Phone", Phone, function(err, response) {
                if(err) {
                    console.log(err)
                }
                console.log("Saved customer phone number to session cache")
            })
            } catch(err) {
                console.log("Error:", err)
            }      
        }
    }

    if (action == "appointment-booking-getaddress") {
        console.log(parameters)
        var Origin = "4231 Firestone Blvd, South Gate, California"
        var Address = parameters["address"]
        var ZipCode = parameters["zipcode"]
        var City = parameters["city"]
        var Destination = Address + ", " + City + ", " + ZipCode;    
        console.log(Destination)   
        
        const context = request.body.queryResult["outputContexts"]
        for (var i=0; i