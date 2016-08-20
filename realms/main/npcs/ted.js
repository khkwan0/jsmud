npc = {
    name:"ted",
    alias: "Ted",
    desc:"Ted is sitting down at his desk responding to an email, bidding for an item on ebay, checking daily numbers, on the sepaker phone with a client, prosepecting real estate, and has another person on hold.",
    hp:1000,
    inv: [],
    events: {
        arrive: {
            actions:[
                "says what up B!",
                "says hi %player%!",
                "says wassup %player%.",
                "nods at %player%.",
                "waves hi to %player%.",
                "seems busy and ignores %you%.",
                "seems busy and ignores %you%."
                    ]
             }
    }

    /*

    "events":{
        "say": {
            "trigger":null,
            "response":"There is a drink sitting in front of you",
            "funcs":"spawn drink"
        },
        "arrive": {
            "trigger":null,
            "actions":{
                "says what up B!",
                "says hi %player%!",
                "says wassup %player%",
                "nods at %player%",
                "waves hi to %player%"
            }
        }
    }
    */
}
