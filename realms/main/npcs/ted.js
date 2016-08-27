npc = {
    name:"ted",
    alias: "Ted",
    desc:"Ted is sitting down at his desk responding to an email, bidding for an item on ebay, checking daily numbers, on the sepaker phone with a client, prosepecting real estate, and has another person on hold.",
    max_hp:1000,
    hp:1000,
    inv: [],
    realm: "main",
    room: "teds_office",
    events: {
        arrive: function(npc,player) {
                    var greetings = [
                        "says what up B!",
                        "says hi %player%!",
                        "says wassup %player%.",
                        "nods at %player%.",
                        "waves hi to %player%.",
                        "seems busy and ignores %player%.",
                        "seems busy and ignores %player%."
                   ];

                    if (!player.ninja_mode) {
                        var num_greetings = greetings.length;
                        idx = Math.floor(Math.random() * num_greetings);
                        msg = npc.alias + ' ' + greetings[idx];
                        msg = msg.replace('%player%', player.name);
                        emote_to_room(npc.realm+'/'+npc.room, msg);
                    }
                 }
    }
}
