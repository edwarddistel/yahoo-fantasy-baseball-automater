const xray = require("x-ray");

exports.scrape = {
  processTeams(teamArr) {
    const avoid = ["Elite Closers", "Stable Situations", "Uncertain Situations", "Injured Closers"];
    const newTeamArr = [];
    for (let i = 0; i < teamArr.length; i++) {
      let safe = true;
      avoid.forEach((phrase) => {
        if (teamArr[i].includes(phrase)) {
          safe = false;
        }
      });
      if (safe) {
        newTeamArr.push(teamArr[i].replace(/\n\s+([^\\]+)\n/, "$1"));
      }
    }
    return newTeamArr;
  },

  processPitchers(pitchersArr) {
    return pitchersArr.filter((val, index) => index % 3 === 0);
  },

  // Scrape probable pitchers
  getPitchers() {
    return new Promise((resolve, reject) => {
      const url = `https://www.mlb.com/closer-report`;
      const selector = {
        teams: [".p-content-heading--left"],
        pitchers: [".u-text-center"],
      };

      const x = xray();
      x(
        url,
        selector
      )((err, result) => {
        if (err) {
          console.log(`Error in getPitchers: ${err}`);
          reject();
        }
        const teams = this.processTeams(result.teams);
        const pitchers = this.processPitchers(result.pitchers);

        const closerList = [];
        teams.forEach((team, index) => {
          closerList.push(pitchers[index].normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        });

        resolve(closerList);
      });
    });
  },
};
