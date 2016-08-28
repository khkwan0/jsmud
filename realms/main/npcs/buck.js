npc = {
    name:"Buck",
    alias: "buck",
    desc:"Buck is a labrador retriever.  He has 4 legs and 4 paws and a cream color coat of short haired fur. He is always looking for food.",
    max_hp:1000,
    hp:1000,
    inv: [],
    realm: "main",
    room: "kurtis_office",
    events: {
        say:function(the_npc, player, args) {
            if (args.rest.length>0) {
                if (args.rest.toLowerCase().indexOf('buck') !== -1) {
                    say_to_player(player, 'Buck looks up at you for a second and then ignores you.');
                }
            }
        },
        arrive: function(the_npc,player, args) {
            if (!player.ninja_mode) {
                emote_to_room(player.location, 'Buck lifts his nose up and smells '+player.name+'.  He is looking for some food.');
            }
        }
    }
}
