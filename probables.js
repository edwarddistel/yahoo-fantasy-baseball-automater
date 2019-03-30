const xray = require("x-ray");

exports.mlbPitchers = {

  // Promisify callback for x-ray
  getProbablePitchers(day) {
    return new Promise((resolve, reject) => {
      this.getPitchers(day, data => {
        resolve(data);
      });
    });
  },

  // Convert long-form team names into 3-letter codes
  teamShortCode(longName) {
    const teams = {
      Angels: "LAA",
      Astros: "HOU",
      Athletics: "OAK",
      "Blue Jays": "TOR",
      Braves: "ATL",
      Brewers: "MIL",
      Cardinals: "STL",
      Cubs: "CHC",
      "D-backs": "ARI",
      Detroit: "DET",
      Diamondbacks: "ARI",
      Dodgers: "LAD",
      Giants: "SF",
      Indians: "CLE",
      Jays: "TOR",
      Mariners: "SEA",
      Marlins: "MIA",
      Milwaukee: "MIL",
      Mets: "NYM",
      Nationals: "WAS",
      Orioles: "BAL",
      Padres: "SD",
      Phillies: "PHI",
      Pirates: "PIT",
      Rangers: "TEX",
      Rays: "TB",
      "Red Sox": "BOS",
      Reds: "CIN",
      Rockies: "COL",
      Royals: "KC",
      Tigers: "DET",
      Twins: "MIN",
      "White Sox": "CWS",
      Yankees: "NYY"
    };
    return teams[longName]
      ? teams[longName]
      : longName
          .replace(/ /g, "_")
          .toUpperCase()
          .trim();
  },

  // Take the results and put them in a nice JSON object
  formatResults(rawData, callback) {
    const totalGames = rawData.teamAway.length;
    const matchups = new Array(totalGames);
    const teamPitchers = {};
    for (let i = 0; i < totalGames; i++) {
      let j = i * 2;
      matchups[i] = {
        teamAway: rawData.teamAway[i].trim(),
        teamHome: rawData.teamHome[i].trim(),
        time: rawData.time[i].trim(),
        pitcherAway: rawData.pitchers[j].trim(),
        pitcherHome: rawData.pitchers[j + 1].trim()
      };
      const homeTeamCode = this.teamShortCode(rawData.teamHome[i].trim());
      const awayTeamCode = this.teamShortCode(rawData.teamAway[i].trim());
      teamPitchers[homeTeamCode] = {
        pitcher: rawData.pitchers[j].trim(),
        team: awayTeamCode
      };
      teamPitchers[awayTeamCode] = {
        pitcher: rawData.pitchers[j + 1].trim(),
        team: homeTeamCode
      };
    }
    callback({ matchups: matchups, opponentPitchers: teamPitchers });
  },

  // Values to scrape
  getPitchers(day, callback) {
    const url = `https://www.mlb.com/probable-pitchers/${day}`;
    const selector = {
      teamAway: [".probable-pitchers__team-name--away"],
      teamHome: [".probable-pitchers__team-name--home"],
      time: ["time"],
      pitchers: [".probable-pitchers__pitcher-name"]
    };

    // Run scraper
    const x = xray();
    x(url, selector)((err, result) => {
      if (err) {
        return `Error in getPitchers: ${err}`;
      } else {
        this.formatResults(result, callback);
      }
    });
  }
};
