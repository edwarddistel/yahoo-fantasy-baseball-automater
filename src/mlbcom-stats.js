/* eslint-disable */

const axios = require("axios");
const { Console } = require("console");
const fs = require("fs");

const LEAGUE_AVERAGE = 0.249;

exports.mlbComStats = {
  existingPlayerIDs: {},
  existingPlayerStats: {},

  // Write to an external file to display output data
  writeToFile(data, file, flag) {
    if (flag === null) flag = `a`;
    fs.writeFile(file, data, { flag }, (err) => {
      if (err) {
        console.error(`Error in writing to ${file}: ${err}`);
      }
    });
    return 1;
  },

  // Asynchronous forEach function
  async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  },

  // Calculate hitter's probability against specific pitcher
  predictLogFive(ba, paa) {
    const probA = (ba * paa) / LEAGUE_AVERAGE;
    const probB = ((1 - ba) * (1 - paa)) / (1 - LEAGUE_AVERAGE);
    return (probA / (probA + probB)).toFixed(3);
  },

  // Look up the MLB.com player ID via a player name and team
  async playerID(name, team) {
    const playerName = encodeURIComponent(
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    );
    const url = `https://lookup-service-prod.mlb.com/json/named.search_player_all.bam?sport_code=%27mlb%27&active_sw=%27Y%27&name_part=%27${playerName}%25%27`;

    try {
      const response = await axios.get(url);
      let playerID = null;
      const totalResults = response.data.search_player_all.queryResults.totalSize;

      // Exact match
      if (totalResults === 1) {
        playerID = response.data.search_player_all.queryResults.row.player_id;
      }

      // Multiple matches
      if (response.data.search_player_all.queryResults.totalSize > 1) {
        response.data.search_player_all.queryResults.row.forEach((player) => {
          // Match team
          if (player.team_abbrev === team) playerID = player.player_id;
        });
      }

      // No match
      if (totalResults < 1) {
        playerID = null;
      }

      return playerID;
    } catch (error) {
      console.error(`Error in MLB PlayerID lookup of ${name} on ${team}: ${error}`);
    }
  },

  // Get the season stats for an MLB player
  async playerStats(id, type, year) {
    const hitOrPitch = type === "B" ? "hitting" : "pitching";

    const url = `https://lookup-service-prod.mlb.com/json/named.sport_${hitOrPitch}_tm.bam?league_list_id='mlb'&game_type='R'&season='${year}'&player_id='${id}'`;
    let response;

    if (hitOrPitch === "hitting") {
      try {
        response = await axios.get(url);
        if (response.data.sport_hitting_tm) {
          return response.data.sport_hitting_tm.queryResults.row;
        }
      } catch (error) {
        console.error(`Error in mlbPlayerStatsLookup: ${error}`);
      }
    } else {
      try {
        response = await axios.get(url);
        if (response.data.sport_pitching_tm) {
          return response.data.sport_pitching_tm.queryResults.row;
        }
      } catch (error) {
        console.error(`Error in mlbPlayerStatsLookup: ${error}`);
      }
    }
  },

  // Get stats from MLB.com and calculate Log5
  async calculateStats(pitchers, myPlayers) {
    const myHittersData = {};
    const myPitchersData = {};
    const opposingPitchersData = {};

    // Try pulling MLBcom playerIDs from existing file; if not, create file for next time
    const playerIDsFile = "./playerIDs.json";
    let playerIDs;
    try {
      if (fs.existsSync(playerIDsFile)) {
        try {
          playerIDs = JSON.parse(fs.readFileSync(playerIDsFile, "utf8"));
          Object.keys(playerIDs).forEach((key) => {
            this.existingPlayerIDs[key] = playerIDs[key];
          });
        } catch (err) {
          console.error(`Error parsing file ${playerIDsFile}: ${err}.\n`);
        }
      }
    } catch (err) {
      console.log(`No MLB.com playerID found, creating one.`);
    }

    // Get MLBcom stats for each player
    process.stdout.write(`Acquiring player statistics from MLB.com...`);
    await this.asyncForEach(myPlayers, async (player) => {
      process.stdout.write(`.`);
      const playerTeam = player.editorial_team_abbr.toUpperCase();

      // If before May 1, get last year's stats; otherwise get this year's stats
      const d = new Date();
      const mayFirst = new Date(`4-5-${d.getFullYear()}`);
      const year = d < mayFirst ? d.getFullYear() - 1 : d.getFullYear();

      const playerName = `${player.name.ascii_first} ${player.name.ascii_last}`;

      // See if hitter's player ID and stats exist; if not, look them up, then store them
      const playerID = this.existingPlayerIDs[player.player_key] ? this.existingPlayerIDs[player.player_key] : await this.playerID(playerName, playerTeam);
      if (playerID) {
        const playerStats = this.existingPlayerStats[playerID] ? this.existingPlayerStats[playerID] : await this.playerStats(playerID, player.position_type, year);
        this.existingPlayerIDs[player.player_key] = playerID;
        this.existingPlayerStats[playerID] = playerStats;
  
        let pitchersAverage = 0;
        let battingAverage = 0;
        if (player.position_type === "B") {
          if (Array.isArray(playerStats)) {
            playerStats.forEach((team) => {
              battingAverage += team ? parseFloat(team.avg, 10) : LEAGUE_AVERAGE;
            });
          } else {
            battingAverage = playerStats ? playerStats.avg : LEAGUE_AVERAGE;
          }
  
          if (opposingPitchersData[playerTeam]) pitchersAverage = opposingPitchersData[playerTeam];
          else {
            // If they're playing a game that day
            if (pitchers.opponentPitchers[playerTeam]) {
              const opposingPitcher = pitchers.opponentPitchers[playerTeam];
  
              // If the pitcher is announced
              if (opposingPitcher.pitcher !== "TBD") {
                // See if opposing pitcher ID and stats exist; if not, look them up, then store them
                const oppPitchID = this.existingPlayerIDs[opposingPitcher.pitcher + opposingPitcher.team] ? this.existingPlayerIDs[opposingPitcher.pitcher + opposingPitcher.team] : await this.playerID(opposingPitcher.pitcher, opposingPitcher.team);
                if(oppPitchID) {
                  const oppPitchStats = this.existingPlayerStats[opposingPitcher.pitcher + opposingPitcher.team] ? this.existingPlayerStats[opposingPitcher.pitcher + opposingPitcher.team] : await this.playerStats(oppPitchID, "P", year);
                  this.existingPlayerIDs[opposingPitcher.pitcher + opposingPitcher.team] = oppPitchID;
                  this.existingPlayerStats[opposingPitcher.pitcher + opposingPitcher.team] = oppPitchStats;
                  if (oppPitchStats) {
                    if (Array.isArray(oppPitchStats)) {
                      oppPitchStats.forEach((team) => {
                        pitchersAverage += parseFloat(team.ops);
                      });
                      pitchersAverage /= oppPitchStats.length;
                    } else {
                      pitchersAverage = oppPitchStats.ops;
                    }
                    opposingPitchersData[playerTeam] = pitchersAverage.toString();
                  } else {
                    opposingPitchersData[playerTeam] = LEAGUE_AVERAGE.toString();
                  }                     
                }

 
              } else {
                pitchersAverage = LEAGUE_AVERAGE.toString();
                opposingPitchersData[playerTeam] = LEAGUE_AVERAGE.toString();
              }
            } else {
              pitchersAverage = "NO GAME";
              opposingPitchersData[playerTeam] = "NO GAME";
            }
          }
  
          const logFive = pitchersAverage === "NO GAME" ? "NO GAME" : this.predictLogFive(battingAverage, pitchersAverage);
          myHittersData[player.player_id] = {
            logFive,
            multiPos: !!player.display_position.includes(","),
            name: playerName,
            playerID,
            playerKey: player.player_key,
            playerStats,
            position: player.display_position,
            positionType: player.position_type,
            rosterPosition: player.selected_position.position,
            status: player.status ? player.status : null,
            team: playerTeam,
          };
        } else {
          const pitcherID = await this.playerID(playerName, playerTeam);
          // Sometimes MLB.com doesn't have the player in their stat database, for whatever reason
          if (pitcherID) {
            const pitcherStats = await this.playerStats(pitcherID, "P", year);
  
            myPitchersData[player.player_id] = {
              name: playerName,
              playerID,
              playerKey: player.player_key,
              playerStats: pitcherStats,
              position: player.display_position,
              positionType: player.position_type,
              rosterPosition: player.selected_position.position,
              status: player.status ? player.status : null,
              team: playerTeam,
            };          
          }
  
        }
      } else {
        console.log(`No player stats for ${playerName}`);
      }
 
    });
    process.stdout.write("\n");
    this.writeToFile(JSON.stringify(this.existingPlayerIDs), playerIDsFile, "w");

    return { hitters: myHittersData, pitchers: myPitchersData };
  },
};
