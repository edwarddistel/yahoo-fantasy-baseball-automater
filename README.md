# Yahoo Fantasy Baseball Automater

This tool automates your starting lineup for Yahoo Fantasy Baseball. 

For a simpler app that just pulls in the raw data, and a more complete walkthrough on how to get the correct authorization codes from Yahoo, see my [Yahoo Fantasy Baseball Reader](https://github.com/edwarddistel/yahoo-fantasy-baseball-reader).

**NEW for 2020**: It now also pulls in the list of closers, compares them against your relief pitchers, tells you to drop ones who are no longer closing, then searches your league to see which closers are still available and healthy. 

## Installation

### Part 1: Get access codes from Yahoo
1. Log into Yahoo
2. Navigate to https://developer.yahoo.com/apps/create/
3. Fill out the form
    - Application Name (Whatever)
    - Application Type (Web Application)
    - Callback Domain (anything, e.g. www.github.com)
    - API Permissions (checkmark Fantasy Sports, then Read/Write)
4. Create App
5. Yahoo will give you 3 values. Write down the last two:
    - App ID (don't care)
    - Client ID/Consumer Key
    - Client Secret/Consumer Secret
6. However the above codes are **not enough** to interface with the Yahoo Fantasy API. Take the `Client ID/Consumer Key` from above and paste it into the following URL:
    
https://api.login.yahoo.com/oauth2/request_auth?client_id=YOUR-CLIENT-ID-GOES-HERE&redirect_uri=oob&response_type=code&language=en-us

7. Enter that URL into your browser.
8. Agree to allow access for your app.

9. Grab the code Yahoo now gives you.


### Part 2: Configure this app

10. [Install NodeJS](https://nodejs.org/en/download/) (I used v11.11.0 but most versions should work)
11. Clone this repo
12. In the repo directory type `npm install`
13. Open `config.json` in a text editor
14. Enter in the following values and save:
    - `CONSUMER_KEY`: Obtained from Yahoo in step 5 above
    - `CONSUMER_SECRET`: Also obtained from Yahoo in step 5 above
    - `YAHOO_AUTH_CODE`: Obtained from Yahoo in step 9 above (**not the App ID in step 5!**)
    - `LEAGUE_KEY`: the League Key has three parts: 
        - (1) a unique prefix Yahoo randomly assigns each season
        - (2) the string ".l." (that's a lowercase L)
        - (3) the unique ID of your league
        - E.g.: `398.l.123456`
        - To find out this number:
            - If it's 2020, the unique prefix for MLB is `398`. 
            - You can find out the league prefix by running:
            ```
            npm run league-prefix
            ```
            - You can find your league ID simply by logging into the Yahoo Fantasy Baseball website - it'll be the value after `https://baseball.fantasysports.yahoo.com/b1/`
            - Combine those two with ".l." for a final format of `398.l.123456`
    - `TEAM`: This is your team number.
        - Just log into the Yahoo Fantasy Baseball website, click on "My Team", then check the URL to see what team number you are.
    - `AUTH_FILE`: Where to store the credentials. Can be anything you want.

## Usage
### Run the app

Navigate to the repo directory and run:
```
> npm start
```
