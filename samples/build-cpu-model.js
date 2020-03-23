const fs = require('fs');
const { buildModel } = require('../out/cpu/model')

const profile = JSON.parse(fs.readFileSync(process.argv[2]).toString());
fs.writeFileSync(`${__dirname}/cpu-model.json`, JSON.stringify(buildModel(profile)));
