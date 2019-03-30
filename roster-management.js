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

  roster: {
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
  },

  playersByPos: {
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
  },

  // Look at eligible display positions and slot players accordingly, then run firstPass
  sortPlayers(players) {
    Object.values(players.hitters).forEach((player, i) => {
      const positions = player.position.split(",");
      if (player.status && (player.status === "DL10")) {
        this.playersByPos["IL"].push(player);
      } else if (player.status || player.logFive === "NO GAME") {
        this.playersByPos["BN"].push(player);
      } else {
        this.playersByPos["UT"].push(player);
        positions.forEach(position => {
          const posFormatted = this.convertPositionFormat(position);
          this.playersByPos[posFormatted].push(player);
          if (posFormatted === "FB" || posFormatted === "TB")
            this.playersByPos["CI"].push(player);
        });
      }
    });

    return this.firstPass();
  },

  // First, slot in players who only have a single display position
  firstPass() {
    const pos = [
      "C",
      "FB",
      "SB",
      "TB",
      "SS",
      "CI",
      "OF1",
      "OF2",
      "OF3",
      "UT1",
      "UT2"
    ];

    for (let i = 0; i < pos.length; i++) {
      const convertedOFs = this.outfieldConvert(pos[i]);

      if (
        this.roster[pos[i]] === null &&
        this.playersByPos[convertedOFs].length > 0
      ) {
        const playerIndex = this.setSinglePosPlayer(
          this.playersByPos[convertedOFs]
        );
        const player = this.playersByPos[convertedOFs][playerIndex];
        this.roster[pos[i]] = player;
        this.playersByPos = this.findAndRemovePlayerFromArrays(
          player,
          this.playersByPos
        );
      }
    }

    return this.secondPass();
  },

  // Now go back and replace swap out starters with bench players who have a higher log5
  secondPass() {
    const bench = this.playersByPos["UT"];
    const uts = ["UT1", "UT2"];
    bench.forEach(player => {
      if (player.logFive !== "NO GAME") {
        const positions = player.position.split(",");
        positions.forEach(position => {
          const formattedPos = this.convertPositionFormat(position);
          if (formattedPos === "OF") {
            for (let i = 1; i < 4; i++) {
              this.compareReplace(player, "OF" + i);
            }
          } else {
            this.compareReplace(player, formattedPos);
          }
        });
      }
    });

    uts.forEach(ut => {
      const benchTwo = this.playersByPos["BN"];
      benchTwo.forEach(player => {
        if (player.logFive !== "NO GAME") this.compareReplace(player, ut);
      });
    });

    // Put IL players on IL
    this.playersByPos["IL"].forEach(player => {
      this.roster["IL"].push(player);
    });


    // Put all remaining players on the bench
    Object.values(this.playersByPos).forEach((pos) => {
      if (pos) {
        if (Array.isArray(pos)) {
          pos.forEach((player) => {

              this.roster["BN"].push(player);
              this.findAndRemovePlayerFromArrays(player, this.playersByPos);
          });
        } else {
          this.roster["BN"].push(pos);
              this.findAndRemovePlayerFromArrays(pos, this.playersByPos);
        }
      }
    });

    return this.roster;
  },

  // Compare two players, swap the starter if challenger has a higher logFive; put other guy back on bench
  compareReplace(player, pos) {
    if (!this.checkIfStarting(player)) {
      const starter = this.roster[pos];
      let winner;
      if (starter) {
        winner = player.logFive > starter.logFive ? player : starter;
        if (winner.name !== starter.name) {
          this.playersByPos["BN"].push(starter);
          this.roster[pos] = winner;
          this.findAndRemovePlayerFromArrays(winner, this.playersByPos);
        }
      } else {
        winner = player;
        this.findAndRemovePlayerFromArrays(winner, this.playersByPos);
      }
    }
  },

  checkIfStarting(player) {
    let needle = false;

    Object.keys(this.roster).forEach(pos => {
      if (
        this.roster[pos] &&
        this.roster[pos].name &&
        this.roster[pos].name === player.name
      )
        needle = true;
    });
    return needle;
  },

  // Remove a player from the list of available players in this.playerByPos
  findAndRemovePlayerFromArrays(player, arr) {
    for (var pos in arr) {
      arr[pos] = arr[pos].filter(el => el.name !== player.name);
    }
    return arr;
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
