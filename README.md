#jsmud
*NOTE This is/was a learning exercies into Node.JS.  Promises do not exist and callback hell is abound*
Written: 06SEP2016

##Installation:

git clone https://github.com/khkwan0/jsmud

##Prerequisites:

- redis-server
- node 6.4.4+

##Configuration

- alter config.js or use default.

##Execution

 // run this under tmux or screen - for persistence
 $> node index.js 

## API:

- add_exp(player, xp)
- complete_quest(quest_id, npc, player, args)
- set_quest(quest_file, player)
- spawn_obj_into_player(obj_file, player)
- emote_to_room(room, msg)
- send_to_player(player, msg)
- get_player_by_name(string name)
- spawn_obj_in_room(string obj_file, string room_location, string new alias)
