npc = {
    name:"Kurtis",
    alias: "kurtis",
    desc:"Kurtis is a male caucasian with brown hair.  He is the Chief Operating Office for engagebdr.com.  Upon further inspection, you think you know him from somewhere.  Perhaps on a TV Show that you've seen?  You might want to 'greet kurtis' if you haven't done so.",
    level:20,
    max_hp:1000,
    hp:1000,
    inv: [],
    realm: "main",
    room: "kurtis_office",
    events: {
        say:function(the_npc, player, args) {
            if (args.rest.length>0) {
                if (args.rest.toLowerCase().indexOf('email') !== -1 || args.rest.toLowerCase().indexOf('reading') !== -1) {
                    say_to_player(player, 'Ted says to you, "I just got an email from Kurtis.  He wants to see you, I think he has some bucks for you.  To get there you need to "go exit" to leave this office and then take a few steps w (west) just past the IT Office.  Once you are in front of his office, just "enter" and say hi to Kurtis.  He should be in there now.');
                    set_quest('main/see_kurtis', player);
                    say_to_player(player, 'Ted has given you a quest. You can check your quests by typing, "quests"');

                }
            }
        },
        look:function(the_npc,player, args) {
             if (typeof args.args[0] !== 'undefined') {
                 target = args.args[0];
                 if (target.toLowerCase() == the_npc.name.toLowerCase() || target.toLowerCase() == the_npc.alias.toLowerCase()) {
                     say_to_player(player, the_npc.alias + ' says to you: What you lookin at!?  HR!');
                 }
             }
        },
        arrive: function(the_npc,player, args) {
            var greetings = [
                "says wasssaaaaap!",
                "says hey!",
                "says whatuuuup %player%.",
                "nods at %player%.",
                "does a Fonzi imitatiion and says to %player% ayyyyyyyyyyeee!",
                "seems busy and ignores %player%.",
            ];

            if (!player.ninja_mode) {
                var num_greetings = greetings.length;
                idx = Math.floor(Math.random() * num_greetings);
                msg = the_npc.alias + ' ' + greetings[idx];
                msg = msg.replace('%player%', player.name);
                emote_to_room(the_npc.realm+'/'+the_npc.room, msg);
                //spawn_obj_into_player('main/knife', player);
            }
        },
        greet: function(the_npc, player, args) {
            if (typeof args.args[0] !== 'undefined') {
                target = args.args[0];
                if (target.toLowerCase() == the_npc.name.toLowerCase() || target.toLowerCase() == the_npc.alias.toLowerCase()) {
                    say_to_player(player, 'You greet '+ the_npc.alias);
                    emote_to_room(player.location, player.name + ' greets Kurtis.');
                    if (complete_quest('main/see_kurtis',the_npc,  player, args)) {
                        say_to_player(player, 'Well done!  You have completed the main/see_kurtis quest!');
                    } else {
                        emote_to_room(player.location, the_npc.name + ' salutes '+player.name+'.');
                    }
                }
            }
       }
    }
}
