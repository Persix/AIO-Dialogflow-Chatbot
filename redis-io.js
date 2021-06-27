var Redis = require('ioredis');
var fs = require('fs');
const uuid = require('uuid')

async function CreateHash() {
    const id = SetupUUID()
    console.log(`Hash ID: ${id}`)
    try {
        var client = new Redis({
            // host: '#####.publb.rackspaceclouddb.com',
            // port: 1234,
            // password: 'YOUR_PASSWORD',
            // tls: {
            //     ca: fs.readFileSync('LOCAL/PATH/TO/rackspace-ca-2016.pem')
            // }
        });
    
        const hashValue = {
            "FirstName": "Zion",
            "LastName": "Williamson"
        }
        await client.hmset(id, hashValue)


        const SessionData = await client.hgetall(id);
        console.log(`SessionData`)
