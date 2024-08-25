Twitch messages push a new object onto the queue.

Node has a scheduled job that runs every 3 seconds.

The job checks to see when the last command was sent, if sent longer than 30 seconds ago, it will trigger the next command to avoid stalling if a response is not received.

A socket io listener will watch for trigger completion event and fire a new emit event after shifting the trigger off the queue and executing the defined resolution function.

Delete keyword will remove an object from the queue matching the keyword. This requires the object to have the id of the keyword.

Recreate keyword will add the object to end of the queue.

Queue can be toggled on and off in the UI.

The queue should track attempts to avoid getting stuck, executing 3 times before giving up.

Queue Object Properties:
1. triggeringId: The id of the keyword that generated the trigger.
2. trigger: a function that will execute and emit the correct.
3. resolution: a function that will execute after the trigger is complete.
4. failure: a function that will execute when the attempt limit is reached.
5. attempts: starts at 0, increments on each attempt.


Progress:
[x] Create a trigger array
[x] Create a trigger object
[x] Generate a trigger object on message
[x] Create a scheduled job
[x] The job runs every 3 seconds
[x] The job checks when last run, if longer than 30 seconds, call the trigger function
[x] Create a listener that looks for responses from application
[x] The listener should call the resolution function
[x] The listener should call the trigger function
[x] The job and listener should increment attempts
[x] The job and listener should remove the trigger if attempts are greater than 3
[x] The job and listener should call the error function if attempts are greater than 3
[x] Add API for replaying keywords
[x] Add API for deleting keywords
[x] Toggle queue on and off in the UI


Follow on options:
1. Doesn't feel like there is a great separation between the queue and the triggers themselves. I feel like triggers should have IDs and each trigger's retries should be managed by the queue instead of in the trigger data. Currently requires mutating the trigger to update the attempt count.
2. There could be a function that you pass the triggers to that will setup an ID for them and track the attempts separately.
3. There is a problem right now if you "replay" a trigger multiple times quickly. It will be added to the queue multiple times but only executed once.
4. There is a sporadic issue where when trying to access the attempts the trigger itself is null. Not sure what is deleting the trigger object but I've seen it error a couple times.