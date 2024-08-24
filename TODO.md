1. Separate out parts of the index.js file
1. Rename project to reflect purpose
1. Create a variable for chatters to ignore, bots, etc.
1. Hook up toggle for pausing shocks
1. Hook up buttons for disable and replay shocks
1. Store configuration data in a json file
1. Fix new message highlighting after the template changes
1. Create a file for storing redemptions
1. Limit keywords to those that are configured
1. Fix bug with replied mentions not highlighting
1. Dev mode indicator, toolbar, and log output in the UI
1. Child process doesn't close on exit

---

Identified when merging code:
- Nothing identifies if the keyword matches a redemption
- First implementation will just immediately trigger the redemption
- Need to build a queue of redemptions to trigger
- Need a OwoApp launch mechanism with the list of possible redemptions
- Need test endpoint only available during dev mode, maybe this is a button that only loads when dev mode is enabled?

