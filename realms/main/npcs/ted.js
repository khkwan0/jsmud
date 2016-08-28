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
        say:function(the_npc, player, args) {
            if (args.rest.length>0) {
                debug(the_npc.name+' heard: '+args.rest);
            }
        },
        arrive: function(the_npc,player, args) {
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
                msg = the_npc.alias + ' ' + greetings[idx];
                msg = msg.replace('%player%', player.name);
                emote_to_room(the_npc.realm+'/'+the_npc.room, msg);
            }
        }
    }
}
