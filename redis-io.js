var Redis = require('ioredis');
var fs = require('fs');
const uuid = require('uuid')

async function CreateHash() {
    const id = Set