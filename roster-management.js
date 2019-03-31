const js2xmlparser = require("js2xmlparser");

exports.rosterManagement = {
  // Convert to JSON-friendly notation
  convertPositionFormat(pos) {
    switch (pos) {
      case "1B":
        return "FB";
        break;
      case "2B":
        return "SB";
        break;
      case "3B":
        return "TB";
        break;
      case "FB":
        return "1B";
        break;
      case "SB":
        return "2B";
        break;
      case "TB":
        return "3B";
        break;
      default:
        return pos;
        break;
    }
  },

  outfieldConvert(pos) {
    switch (pos) {
      case "OF1":
      case "OF2":
      case "OF3":
        return "OF";
        break;
      case "UT1":
      case "UT2":
        return "UT";
        break;
      default:
        return pos;
        break;
    }
  },

  // Look at eligible display positions and slot players accordingly, then run firstPass
  sortPlayers(players, roster, playersByPos) {
    Object.values(players.hitters).forEach((player) => {
      const positions = player.position.split(",");
      if (player.status && (player.status === "DL10")) {
        playersByPos["IL"].push(player);
      } else if (player.status || player.logFive === "NO GAME") {
        playersByPos["BN"].push(player);
      } else {
        playersByPos["UT"].push(player);
        positions.forEach(position => {
          const posFormatted = this.convertPositionFormat(position);
          playersByPos[posFormatted].push(player);
          if (posFormatted === "FB" || posFormatted === "TB")
            playersByPos["CI"].push(player);
        });
      }
    });

    return this.firstPass(roster, playersByPos);
  },

  // First, slot in players who only have a single display position
  firstPass(roster, playersByPos) {
    const pos = ["C","FB","SB","TB","SS","CI","OF1","OF2","OF3","UT1","UT2"];

    for (let i = 0; i < pos.length; i++) {
      const convertedOFs = this.outfieldConvert(pos[i]);

      if (roster[pos[i]] === null && playersByPos[convertedOFs].length > 0) {
        const playerIndex = this.setSinglePosPlayer(playersByPos[convertedOFs]);
        const player = playersByPos[convertedOFs][playerIndex];
        playersByPos = this.findAndRemovePlayerFromArrays(player, playersByPos);
        roster[pos[i]] = player;
      }
    }

    return this.secondPass(roster, playersByPos);
  },

  // Now go back and replace swap out starters with bench players who have a higher log5
  secondPass(roster, playersByPos) {
    const bench = playersByPos["UT"];




    bench.forEach(player => {
      if (player.logFive !== "NO GAME") {
        const positions = player.position.split(",");
        positions.forEach(position => {
          const formattedPos = this.convertPositionFormat(position);
          if (formattedPos === "OF") {
            for (let i = 1; i < 4; i++) {
              const updated = this.compareReplace(player, "OF" + i, roster, playersByPos);
              roster = updated[0];
              playersByPos = updated[1];
            }
          } else {
            const updated = this.compareReplace(player, formattedPos, roster, playersByPos);
            roster = updated[0];
            playersByPos = updated[1];
          }
        });
      }
    });



    const uts = ["UT1", "UT2"];
    uts.forEach(ut => {
      const benchTwo = playersByPos["BN"];
      benchTwo.forEach(player => {
        if (player.logFive !== "NO GAME") {
          const updated = this.compareReplace(player, ut, roster, playersByPos);
          roster = updated[0];
          playersByPos = updated[1];
        }
      });
    });
    


    // Put IL players on IL
    playersByPos["IL"].forEach(player => {
      roster["IL"].push(player);
    });

    // Put all remaining players on the bench
    Object.values(playersByPos).forEach((pos) => {
      if (pos) {
        if (Array.isArray(pos)) {
          pos.forEach((player) => {
              playersByPos = this.findAndRemovePlayerFromArrays(player, playersByPos);
              roster["BN"].push(player);

          });
        } else {
          playersByPos = this.findAndRemovePlayerFromArrays(pos, playersByPos);
          roster["BN"].push(pos);
        } 
      }
    });

    return roster;
  },

  // Compare two players, swap the starter if challenger has a higher logFive; put other guy back on bench
  compareReplace(player, pos, roster, playersByPos) {
    if (!this.checkIfStarting(player, roster)) {
      const starter = roster[pos];
      let winner;
      if (starter) {
        winner = (player.logFive > starter.logFive) && (!player.status) ? player : starter;
        if (winner.name !== starter.name) {
          playersByPos = this.findAndRemovePlayerFromArrays(winner, playersByPos);
          roster[pos] = winner;
          playersByPos["BN"].push(starter);
        }
      } 
    }
    return [roster, playersByPos];
  },

  checkIfStarting(player, roster) {
    let needle = false;

    Object.keys(roster).forEach(pos => {
      if (
        roster[pos] &&
        roster[pos].name &&
        roster[pos].name === player.name
      )
        needle = true;
    });
    return needle;
  },

  // Remove a player from the list of available players in this.playerByPos
  findAndRemovePlayerFromArrays(player, playersByPos) {
    for (const pos in playersByPos) {
      playersByPos[pos] = playersByPos[pos].filter(el => el.name !== player.name);
    }
    return playersByPos;
  },

  // Return the index of the first player for that position who ONLY plays that position, or return the first player in the list
  setSinglePosPlayer(players) {
    let player = 0;

    for (let i = 0; i < players.length; i++) {
      if (!players[i].multiPos) player = i;
    }
    return player;
  },

  buildRoster(updatedRoster, yahooDay) {
    // Prepare roster object
    const yahooRoster = {
      roster: {
        coverage_type: "date",
        date: yahooDay,
        players: {
          player: []
        }
      }
    };

    Object.keys(updatedRoster).forEach(pos => {
      let updatedPos;
      let player;
      if (pos === "FB") updatedPos = "1B";
      else if (pos === "SB") updatedPos = "2B";
      else if (pos === "TB") updatedPos = "3B";
      else if (pos.includes("OF")) updatedPos = "OF";
      else if (pos.includes("UT")) updatedPos = "Util";
      else updatedPos = pos;

      if (pos === "BN") {
        updatedRoster[pos].forEach(player => {
          player = { player_key: player.playerKey, position: "BN" };
          if (player) yahooRoster.roster.players.player.push(player);
        });
      } else if (pos === "IL") {
        updatedRoster[pos].forEach(player => {
          player = { player_key: player.playerKey, position: "DL" };
          if (player) yahooRoster.roster.players.player.push(player);
        });
      } else {
        if (updatedRoster[pos]) {
          player = {
            player_key: updatedRoster[pos].playerKey,
            position: updatedPos
          };
          if (player) yahooRoster.roster.players.player.push(player);
        }
      }
    });

    // Convert JSON object to XML
    return js2xmlparser.parse("fantasy_content", yahooRoster);
  }
};
