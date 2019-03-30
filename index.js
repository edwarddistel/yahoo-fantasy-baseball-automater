const fs = require('fs');

const stats = require('./mlbcom-stats');
const yahoo = require('./yahooFantasyBaseball');
const probables = require('./probables');
const roster = require('./roster-management');


/**
 *
 *
 */
const getData = async() => {
    try {
        // Read credentials file or get new authorization token
        await yahoo.yfbb.readCredentials();
        
        // If crededentials exist
        if (yahoo.yfbb.CREDENTIALS) {


        const d = new Date();
        const howFarAhead = 1;
        d.setDate(d.getDate() + howFarAhead);
        const targetDay = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
        const yahooDay = `${d.getFullYear()}-${("0" + (d.getMonth() + 1)).slice(-2)}-${("0" + d.getDate()).slice(-2)}`;;

        console.log(`Targeting ${targetDay}`);

        console.log(`Getting probable pitchers...`);
        const pitchers = await probables.mlbPitchers.getProbablePitchers(targetDay);

        console.log(`Getting my players...`);
        const myPlayers = await yahoo.yfbb.getMyPlayers();

        console.log(`Getting stats...`)
        const playersStats = await stats.mlbComStats.calculateStats(pitchers, myPlayers);

        console.log(`Analyzing roster...`)
        const updatedRoster = await roster.rosterManagement.sortPlayers(playersStats);

        console.log(`Building roster...`);
        const yahooXML = await roster.rosterManagement.buildRoster(updatedRoster, yahooDay);

        console.log(`Sending to Yahoo...`);
        const yahooResponse = await yahoo.yfbb.updateRoster(yahooXML);
        console.log(`Yahoo response: ${yahooResponse.fantasy_content.confirmation.status}`);
        

        }
    } catch (err) {
        console.error(`Error in getData(): ${err}`);
    }

};


getData();


/** 
            
    // Get current season stats via YAHOO 
    console.log(`Getting player key...`);
    const player_key = await yahoo.yfbb.getPlayer(a);

    console.log(`Getting player stats...`);
    const b = await yahoo.yfbb.getPlayerStats(player_key);
    console.log(b);

*/