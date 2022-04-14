# Yahoo Fantasy Baseball Automater

This tool automates your starting lineup for Yahoo Fantasy Baseball. 

For a simpler app that just pulls in the raw data, and a more complete walkthrough on how to get the correct authorization codes from Yahoo, see my [Yahoo Fantasy Baseball Reader](https://github.com/edwarddistel/yahoo-fantasy-baseball-reader).

**NEW for 2020**: It now also pulls in the list of closers, compares them against your relief pitchers, tells you to drop ones who are no longer closing, then searches your league to see which closers are still available and healthy. 

To run that and only that function `npm run closers`.

## Installation
You'll need 3 values from Yahoo to start -- I have a detailed guide here in my [Yahoo Fantasy Baseball Reader](https://github.com/edwarddistel/yahoo-fantasy-baseball-reader).

You'll also need to use the Node version specified in the `.nvmrc` file by running `nvm use`. ([Details](https://github.com/nvm-sh/nvm))

## Logic

1. Gets probable pitchers for that day
1. Gets the roster of your players from Yahoo
1. Gets the stats of all players from MLB.com (Yahoo didn't provide batting average against for pitchers)
1. Calculates the probability of a hit using the [Log5 formula](https://sabr.org/journal/article/matchup-probabilities-in-major-league-baseball/)
1. Makes several passes through the roster to fill out each position using the highest Log5 value for that day
1. Sets your roster for tomorrow and the following 4 days
1. Grabs the closers from MLB.com and compares them to your relief pitchers, letting you know if one of your RPs is no longer a closer and letting you know of those who are who is still a free agent in your league.

## Usage
### Run the app

Navigate to the repo directory and run:
```
> npm start
```
