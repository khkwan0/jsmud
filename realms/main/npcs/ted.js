npc = {
    name:"ted",
    alias: "Ted",
    desc:"Ted is sitting down at his desk responding to an email, bidding for an item on ebay, checking daily numbers, on the speaker phone with a client, prosepecting real estate, and has another person on hold.  You should ask him what he is reading by trying 'say ted, what are you reading?' or 'say ted, what is that email all about?' or even just 'say email'",
    max_hp:1000,
    hp:1000,
    inv: [],
    realm: "main",
    room: "teds_office",
    events: {
        say:function(the_npc, player, args) {
            if (args.rest.length>0) {
                if (args.rest.toLowerCase().indexOf('email') !== -1 || args.rest.toLowerCase().indexOf('reading') !== -1) {
                    say_to_player(player, 'Ted says to you, "I just got an email from Kurtis.  He wants to see you, I think he has some bucks for you.  To get there you need to "go exit" to leave this office and then take a few steps w (west) just past the IT Office.  Once you are in front of his office, just "enter" and say hi to Kurtis.  He should be in there now.  You should go and "greet kurtis" if you haven\'t done so.');
                    if (set_quest('main/see_kurtis', player)) {
                        say_to_player(player, 'Ted has given you a quest. You can check your quests by typing, "quests"');
                    }
                }
            }
        },
        look:function(the_npc,player, args) {
             if (typeof args.args[0] !== 'undefined') {
                 target = args.args[0];
                 if (target.toLowerCase() == the_npc.name.toLowerCase() || target.toLowerCase() == the_npc.alias.toLowerCase()) {
                     say_to_player(player, the_npc.alias + ' says to you: Do you see anything interesting?');
                 }
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
                //spawn_obj_into_player('main/knife', player);
            }
        }
    }
}
