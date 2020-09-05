const stats = require("./mlbcom-stats");
const yahoo = require("./yahooFantasyBaseball");
const probables = require("./probables");
const roster = require("./roster-management");
const closers = require("./getClosers");

async function getData(i) {
  try {
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
        BN: [],
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
        BN: [],
      };

      // Get the target date, format it for Yahoo
      const d = new Date();
      const howFarAhead = i;
      d.setDate(d.getDate() + howFarAhead);
      targetDay[i] = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      yahooDay[i] = `${d.getFullYear()}-${`0${d.getMonth() + 1}`.slice(-2)}-${`0${d.getDate()}`.slice(-2)}`;

      console.log(`Targeting ${targetDay[i]}`);

      console.log(`Getting probable pitchers...`);
      pitchers[i] = await probables.mlbPitchers.getProbablePitchers(targetDay[i]);

      console.log(`Getting my players...`);
      myPlayers[i] = await yahoo.yfbb.getMyPlayers();

      console.log(`Getting stats...`);
      playersStats[i] = await stats.mlbComStats.calculateStats(pitchers[i], myPlayers[i]);

      console.log(`Analyzing roster...`);
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
}

// Checks available closers from MLB.com, compares vs your team and who's a fre agent
async function checkClosers() {
  try {
    // Scrape all closers from MLB.com
    const closerList = await closers.scrape.getPitchers();

    // If scrape a success
    if (closerList && Array.isArray(closerList)) {

      // Fetch players from your team
      console.log(`Getting my players...`);
      const myPlayerList = await yahoo.yfbb.getMyPlayers();
      const myRelievers = [];

      // If able to get the players from your team
      if (myPlayerList && Array.isArray(myPlayerList)) {

        // Grab the names of just the relief pitchers
        myPlayerList.forEach((player) => {
          if (player.display_position === "RP") {
            myRelievers.push(player.name.full.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          }
        });

        // If your RP is already a closer, remove him from the list
        myRelievers.forEach((reliever) => {
          let isAcloser = false;
          closerList.forEach((closer, index, object) => {
            if (closer === reliever) {
              isAcloser = true;
              object.splice(index, 1);
            }
          });
          // If not, drop the sucker!
          if (!isAcloser) {
            console.log(`${reliever} is on your team but is not a closer. Drop him!`);
          }
        });

        // Before you can look up the status of any player in the leauge you must first acquire their Yahoo player ID key
        const playerKeys = [];
        process.stdout.write("Getting player IDs for each closer...");

        // Cycle through them all
        for (let i = 0; i < closerList.length; i++) {
          const pitcher = closerList[i].replace("(IL)", "").trim();
          process.stdout.write(".");
          const playerKey = await yahoo.yfbb.getPlayer(pitcher);
          // Push them onto an array
          playerKeys.push(playerKey);
          // Wait half a second, otherwise Yahoo gets mad
          setTimeout(() => {}, 500);
        }
        process.stdout.write("\n");

        // Get the ownership status of all the player keys
        const playerOwnership = await yahoo.yfbb.getPlayerOwner(playerKeys.join(","));

        // If successful
        if (playerOwnership && Array.isArray(playerOwnership)) {
          playerOwnership.forEach((player) => {
            // Check to see if they're already on a team
            const onAteam = player.ownership && player.ownership.ownership_type && player.ownership.ownership_type === "team";
            // Check to make sure they're not injured
            const onIL = player.status;
            if (!onAteam && !onIL) {
              console.log(`${player.name.full} is a closer and a free agent. Pick him up!`);
            }
          });
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
}

// Loop the roster decisions over a period of 5 days
const loop = async () => {
  // Read credentials file or get new authorization token
  await yahoo.yfbb.readCredentials();

  for (let i = 1; i < 5; i++) {
    global.firstPass = true;
    await getData(i);
    global.firstPass = false;
  } 

  checkClosers();
};

loop();
