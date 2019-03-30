const axios = require("axios");
const LEAGUE_AVERAGE = 0.249;

exports.mlbComStats = {
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
    const url = `https://lookup-service-prod.mlb.com/json/named.search_player_all.bam?sport_code='mlb'&active_sw='Y'&name_part='${encodeURIComponent(
      name
    )}'`;

    try {
      const response = await axios.get(url);
      const results = response.data.search_player_all.queryResults.row;
      var player_id = null;
      // If multiple players with the same name, check team affiliation
      if (results && results.length > 1) {
        results.forEach(player => {
          if (player.team_abbrev === team) player_id = player.player_id;
        });
      } else {
        player_id = response.data.search_player_all.queryResults.row.player_id;
      }
      return player_id;
    } catch (error) {
      console.error(`Error in MLB PlayerID lookup: ${error}`);
    }
  },

  // Get the season stats for an MLB player
  async playerStats(id, type, year) {
    const hitOrPitch = type === "B" ? "hitting" : "pitching";

    const url = `http://lookup-service-prod.mlb.com/json/named.sport_${hitOrPitch}_tm.bam?league_list_id='mlb'&game_type='R'&season='${year}'&player_id='${id}'`;
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

    process.stdout.write(`Acquiring player statistics from MLB.com...`);
    await this.asyncForEach(myPlayers, async player => {
      process.stdout.write(`.`);
      const playerTeam = player.editorial_team_abbr.toUpperCase();
      const year = 2018;
      const playerName = player.name.ascii_first + " " + player.name.ascii_last;

      const playerID = await this.playerID(playerName, playerTeam);
      const playerStats = await this.playerStats(
        playerID,
        player.position_type,
        year
      );

      let pitchersAverage = 0;
      let battingAverage = 0;
      if (player.position_type === "B") {
        if (Array.isArray(playerStats)) {
          playerStats.forEach(team => {
            battingAverage += parseFloat(team.avg, 10);
          });
        } else {
          battingAverage = playerStats.avg;
        }

        if (opposingPitchersData[playerTeam])
          pitchersAverage = opposingPitchersData[playerTeam];
        else {
          // If they're playing a game that day
          if (pitchers.opponentPitchers[playerTeam]) {
            const opposingPitcher = pitchers.opponentPitchers[playerTeam];

            // If the pitcher is announced
            if (opposingPitcher.pitcher !== "TBD") {
              const oppPitchID = await this.playerID(
                opposingPitcher.pitcher,
                opposingPitcher.team
              );
              const oppPitchStats = await this.playerStats(
                oppPitchID,
                "P",
                year
              );
              if (oppPitchStats) {
                if (Array.isArray(oppPitchStats)) {
                  oppPitchStats.forEach(team => {
                    pitchersAverage += parseFloat(team.avg);
                  });
                  pitchersAverage = pitchersAverage / oppPitchStats.length;
                } else {
                  pitchersAverage = oppPitchStats.avg;
                }
                opposingPitchersData[playerTeam] = pitchersAverage.toString();
              } else {
                opposingPitchersData[playerTeam] = LEAGUE_AVERAGE.toString();
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

        const logFive =
          pitchersAverage === "NO GAME"
            ? "NO GAME"
            : this.predictLogFive(battingAverage, pitchersAverage);
        myHittersData[player.player_id] = {
          logFive: logFive,
          multiPos: player.display_position.includes(",") ? true : false,
          name: playerName,
          playerID: playerID,
          playerKey: player.player_key,
          playerStats: playerStats,
          position: player.display_position,
          positionType: player.position_type,
          rosterPosition: player.selected_position.position,
          status: player.status ? player.status : null,
          team: playerTeam
        };
      } else {
        const pitcherID = await this.playerID(playerName, playerTeam);
        const pitcherStats = await this.playerStats(pitcherID, "P", year);

        myPitchersData[player.player_id] = {
          name: playerName,
          playerID: playerID,
          playerKey: player.player_key,
          playerStats: pitcherStats,
          position: player.display_position,
          positionType: player.position_type,
          rosterPosition: player.selected_position.position,
          status: player.status ? player.status : null,
          team: playerTeam
        };
      }
    });
    process.stdout.write("\n");

    return { hitters: myHittersData, pitchers: myPitchersData };
  }
};
