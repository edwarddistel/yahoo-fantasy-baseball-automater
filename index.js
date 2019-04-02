const fs = require('fs');

const stats = require('./mlbcom-stats');
const yahoo = require('./yahooFantasyBaseball');
const probables = require('./probables');
const roster = require('./roster-management');

const getData = async(i) => {
    try {
        // Read credentials file or get new authorization token
        await yahoo.yfbb.readCredentials();

        // If crededentials exist
        if (yahoo.yfbb.CREDENTIALS) {

            const targetDay = new Array(i);
            const yahooDay = new Array(i);
            const pitchers = new Array(i);
            const myPlayers = new Array(i);
            const playersStats = new Array(i);
            const updatedRoster = new Array(i);
            const yahooXML = new Array(i);
            const yahooResponse = new Array(i);
            const todaysRoster = new Array(i);
            const playersByPos = new Array(i);

            todaysRoster[i] = {
            C: null,
            FB: null,
            SB: null,
            TB: null,
            SS: null,
            CI: null,
            OF1: null,
            OF2: null,
            OF3: null,
            UT1: null,
            UT2: null,
            IL: [],
            BN: []
            };

            playersByPos[i] = {
            C: [],
            FB: [],
            SB: [],
            TB: [],
            SS: [],
            CI: [],
            OF: [],
            UT: [],
            IL: [],
            BN: []
            };

            // Get the target date, format it for Yahoo
            const d = new Date();
            const howFarAhead = i;
            d.setDate(d.getDate() + howFarAhead);
            targetDay[i] = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
            yahooDay[i] = `${d.getFullYear()}-${("0" + (d.getMonth() + 1)).slice(-2)}-${("0" + d.getDate()).slice(-2)}`;;

            console.log(`Targeting ${targetDay[i]}`);

            console.log(`Getting probable pitchers...`);
            pitchers[i] = await probables.mlbPitchers.getProbablePitchers(targetDay[i]);

            console.log(`Getting my players...`);
            myPlayers[i] = await yahoo.yfbb.getMyPlayers();

            console.log(`Getting stats...`)
            playersStats[i] = await stats.mlbComStats.calculateStats(pitchers[i], myPlayers[i]);

            console.log(`Analyzing roster...`)
            updatedRoster[i] = await roster.rosterManagement.sortPlayers(playersStats[i], todaysRoster[i], playersByPos[i]);

            console.log(`Building roster...`);
            yahooXML[i] = await roster.rosterManagement.buildRoster(updatedRoster[i], yahooDay[i], todaysRoster[i], playersByPos[i]);

            console.log(`Sending to Yahoo...`);
            yahooResponse[i] = await yahoo.yfbb.updateRoster(yahooXML[i]);

            console.log(`Yahoo response: ${yahooResponse[i].fantasy_content.confirmation.status}`);
        }
    } catch (err) {
        console.error(`Error in getData(): ${err}`);
    }

};

// Loop the roster decisions over a period of 5 days
const loop = async () => {
    const t = new Date();
    for (let i = 0; i <5; i++) {
        global.firstPass = true;
        await getData(i);
        global.firstPass = false;
    }
};

loop();


/** 
            
    // Get current season stats via YAHOO 
    console.log(`Getting player key...`);
    const player_key = await yahoo.yfbb.getPlayer(a);

    console.log(`Getting player stats...`);
    const b = await yahoo.yfbb.getPlayerStats(player_key);
    console.log(b);

*/