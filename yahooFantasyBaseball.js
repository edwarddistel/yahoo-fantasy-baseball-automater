const fs = require('fs');
const qs = require('qs');

const axios = require('axios');
const parser = require('xml2json');

const CONFIG = require('./config.json');


exports.yfbb = {

    // Global credentials variable
    CREDENTIALS: null,

    // Used for authentication
    AUTH_HEADER: Buffer.from(`${CONFIG.CONSUMER_KEY}:${CONFIG.CONSUMER_SECRET}`, `binary`).toString(`base64`),
    AUTH_ENDPOINT: `https://api.login.yahoo.com/oauth2/get_token`,

    // Global week variable, start at 1
    WEEK: 1,

    // API endpoints
    YAHOO: `https://fantasysports.yahooapis.com/fantasy/v2`,
    freeAgents: function () { return `${this.YAHOO}/league/${CONFIG.LEAGUE_KEY}/players;status=FA;start=0;sort=OR`},
    gameKey: function () { return `${this.YAHOO}/game/mlb` },
    metadata: function () { return `${this.YAHOO}/league/${CONFIG.LEAGUE_KEY}/metadata`},
    myTeam: function () { return `${this.YAHOO}/team/${CONFIG.LEAGUE_KEY}.t.${CONFIG.TEAM}/roster/`}, 
    myWeeklyStats: function () { return `${this.YAHOO}/team/${CONFIG.LEAGUE_KEY}.t.${CONFIG.TEAM}/stats;type=week;week=${this.WEEK}`},
    playerSearch: function () { return `${this.YAHOO}/league/${CONFIG.LEAGUE_KEY}/players;search=` },
    playerStats: function () { return `${this.YAHOO}/player/player_key/stats;sort_type=season;sort_season=2018`},
    roster: function () { return `${this.YAHOO}/team/${CONFIG.LEAGUE_KEY}.t.${CONFIG.TEAM}/roster/players` },
    scoreboard: function () { return `${this.YAHOO}/league/${CONFIG.LEAGUE_KEY}/scoreboard;week=${this.WEEK}`}, 
    statsID: function () { return `${this.YAHOO}/game/${CONFIG.LEAGUE_KEY.substr(0, 3)}/stat_categories` },
    transactions: function () { return `${this.YAHOO}/league/${CONFIG.LEAGUE_KEY}/transactions;types=add,trade,drop`;},
    user: function () { return `${this.YAHOO}/users;use_login=1/games`},


    handleError: function(err, func) {
        const msg = err.response.data ? JSON.parse(parser.toJson(err.response.data)).error.description : "";
        console.error(`Error with credentials in ${func}(): ${err}, ${msg}`);
    },

    // Write to an external file to display output data
    writeToFile: function (data, file, flag) {
        if (flag === null) flag = `a`;
        fs.writeFile(file, data, {flag: flag}, (err) => {
            if (err) {
                console.error(`Error in writing to ${file}: ${err}`);
            }
        });
        return 1;
    },

     
    // Read the Yahoo OAuth credentials file
    readCredentials: async function () {
        try {
            // If the credentials file exists
            if (fs.existsSync(CONFIG.AUTH_FILE)) {
                try {
                    this.CREDENTIALS = JSON.parse(fs.readFileSync(CONFIG.AUTH_FILE, 'utf8'));
                } catch (err) {
                    console.error(`Error parsing credentials file ${CONFIG.AUTH_FILE}: ${err}.\n`);
                    process.exit();
                }
            } else {
                // Get initial authorization token
                const newToken = await this.getInitialAuthorization();
                if (newToken && newToken.data && newToken.data.access_token) {
                    this.writeToFile(JSON.stringify(newToken.data), CONFIG.AUTH_FILE, 'w');
                    this.CREDENTIALS = newToken.data;
                }
            }
        } catch(err) {
			this.handleError(err, "readCredentials");
            process.exit();
        }   
    },   

    // If no yahoo.json file, initialize first authorization
    getInitialAuthorization: function () {
        return axios({
            url: this.AUTH_ENDPOINT,
            method: 'post',
            headers: {
                'Authorization': `Basic ${this.AUTH_HEADER}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
            },
            data: qs.stringify({
                client_id: CONFIG.CONSUMER_KEY,
                client_secret: CONFIG.CONSUMER_SECRET,
                redirect_uri: 'oob',
                code: CONFIG.YAHOO_AUTH_CODE,
                grant_type: 'authorization_code'
            }),
            timeout: 1000,
            }).catch((err) => {
    			this.handleError(err, "getInitialAuthorization");
            });
    },

    // If authorization token is stale, refresh it 
    refreshAuthorizationToken: function (token) {
        return axios({
            url: this.AUTH_ENDPOINT,
            method: 'post',
            headers: {
                'Authorization': `Basic ${this.AUTH_HEADER}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
            },
            data: qs.stringify({
                redirect_uri: 'oob',
                grant_type: 'refresh_token',
                refresh_token: token
            }),
            timeout: 10000,
        }).catch((err) => {
			this.handleError(err, "refreshAuthorizationToken");
        });       
    },

    // Hit the Yahoo Fantasy API
    makeAPIrequest: async function (url) {
        let response;
        try {
            response = await axios({
            url: url,
                method: 'get',
                headers: {
                    'Authorization': `Bearer ${this.CREDENTIALS.access_token}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
                },
                timeout: 10000,
            });
            const jsonData = JSON.parse(parser.toJson(response.data));
            return jsonData;
        } catch (err) {
            if (err.response.data && err.response.data.error && err.response.data.error.description && err.response.data.error.description.includes("token_expired")) {
                const newToken = await this.refreshAuthorizationToken(this.CREDENTIALS.refresh_token);
                if (newToken && newToken.data && newToken.data.access_token) {
                    this.CREDENTIALS = newToken.data;
                    this.writeToFile(JSON.stringify(newToken.data), CONFIG.AUTH_FILE, 'w');
                    return this.makeAPIrequest(url);
    
                 }
            } else {
                this.handleError(err, "makeAPIrequest()/refreshAuthorizationToken")()
                process.exit();
            }
        }
    },


    // Get a list of free agents
    getFreeAgents: async function () {
        try {
            const results = await this.makeAPIrequest(this.freeAgents());
            return results.fantasy_content.league.players
        
        } catch (err) {
			this.handleError(err, "getFreeAgents");
        }
    },

    // Get a list of players on my team
    getMyPlayers: async function () {
        try {
            const results = await this.makeAPIrequest(this.myTeam());
            return results.fantasy_content.team.roster.players.player;    
        } catch (err) {
			this.handleError(err, "getMyPlayers");
        }
    },

    // Get my weekly stats
    getMyWeeklyStats: async function ()  {
        try {
            const results = await this.makeAPIrequest(this.myWeeklyStats());
            return results.fantasy_content.team.team_stats.stats.stat;    
        } catch (err) {
			this.handleError(err, "getMyWeeklyStats");
        }
    },

    // Get my scoreboard
    getMyScoreboard: async function ()  {
        try {
            const results = await this.makeAPIrequest(this.scoreboard());
            return results.fantasy_content.league.scoreboard.matchups.matchup;
        } catch (err) {
			this.handleError(err, "getMyScoreBoard");
        }
    },
    
    // Get a JSON object of your players
    getMyPlayersStats: async function () {
        try {
            const players = await this.getMyPlayers(this.myTeam());

            // Build the list
            let playerIDList = "";
            if (players) {
                players.forEach((player) => {
                    playerIDList += `${player.player_key},`;
                });
            
                // Remove trailing comma
                playerIDList = playerIDList.substring(0, playerIDList.length -1);
            
                const playerStats = `${this.YAHOO}/players;player_keys=${playerIDList};out=stats`;

                return await this.makeAPIrequest(playerStats);
            }
        
        } catch (err) {
			this.handleError(err, "getMyPlayerStats");
        }
    },

    // Get what week it is in the season
    getCurrentWeek: async function() {
        try {
            const results = await this.makeAPIrequest(this.metadata());
            return results.fantasy_content.league.current_week;
        } catch (err) {
			this.handleError(err, "getCurrentWeek");
        }
    },

    // Get the numerical prefix for the league. Was 388 in 2019
    getLeaguePrefix: async function () {
        try {
            const results = await this.makeAPIrequest(this.gameKey());
            return results.fantasy_content.game.game_id;    
        } catch (err) {
			this.handleError(err, "getLeaguePrefix");
        }
    },


    // Get the adds, drops and trades
    getTransactions: async function () {
        try {
            const results = await this.makeAPIrequest(this.transactions());
            return results.fantasy_content.league.transactions;    
        } catch (err) {
			this.handleError(err, "getTransactions");
        }
    },

    // Get user info
    getUserInfo: async function () {
        try {
            const results = await this.makeAPIrequest(this.user());
            return results.fantasy_content.users.user.games;    
        } catch (err) {
			this.handleError(err, "getUserInfo");
        }
    },

    // Get stats IDs
    getStatsIDs: async function () {
        try {
            const results = await this.makeAPIrequest(this.statsID());
            return results.fantasy_content.game.stat_categories.stats;    
        } catch (err) {
			this.handleError(err, "getStatsIDs");
        }
    },

    // See who's starting on your team
    getCurrentRoster: async function () {
        try {
            const results = await this.makeAPIrequest(this.roster());
            return results.fantasy_content.team.roster.players;    
        } catch (err) {
			this.handleError(err, "getCurrentRoster");
        }
    },
    
    // Look up an individual player
    getPlayer: async function (player) {
        try {
            const results = await this.makeAPIrequest(this.playerSearch() + player);
            return results.fantasy_content.league.players.player.player_key;
        } catch (err) {
			this.handleError(err, "getPlayer");
        }
    },

    // Look up player stats
    getPlayerStats: async function (playerKey) {
        try {
            const results = await this.makeAPIrequest(this.playerStats().replace('player_key', playerKey));
            return results.fantasy_content;
        } catch (err) {
			this.handleError(err, "getPlayerStats");
        }
    },

    // Tell Yahoo which players are playing
    updateRoster: async function (payload) {

        let response;

        const config =  { 
            headers: {
                'Authorization': `Bearer ${this.CREDENTIALS.access_token}`,
                'Content-Type': 'application/xml',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
            }, 
            timeout: 10000 };

        try {
            response = await axios.put(`${this.YAHOO}/team/${CONFIG.LEAGUE_KEY}.t.${CONFIG.TEAM}/roster`, payload, config);
            const jsonData = JSON.parse(parser.toJson(response.data));
            return jsonData;
        } catch (err) {

            if (err.response.data && err.response.data.error && err.response.data.error.description && err.response.data.error.description.includes("token_expired")) {
                const newToken = await this.refreshAuthorizationToken(this.CREDENTIALS.refresh_token);
                if (newToken && newToken.data && newToken.data.access_token) {
                    this.CREDENTIALS = newToken.data;
                    this.writeToFile(JSON.stringify(newToken.data), CONFIG.AUTH_FILE, 'w');
                    return this.positionPlayer(payload);
                 }
            } else {
                this.handleError(err, "positionPlayer");
                process.exit();
            }
        }
    },

   

};