var redis = require('redis');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
//var natural = require('natural');
var uuid = require('uuid');
var fs = require('fs');
var em = require('events');

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/cli2.html'));
});

var valid_commands = {
    'say':'say [something]'
    ,'go':'go [n/s/e/w/enter/exit]'
    ,'n/s/e/w/enter/exit':'a macro for go [n/s/e/w/enter/exit]'
    ,'shout':'Yell across all realms, across all rooms - probably will be a wizard command to prevent spamming'
    ,'gag':'(Wizard only) - Gag a player from talking'
    ,'look':'Look at your surroundings'
    ,'desc':'Same as look'
    ,'emote':'emote [message] results in [player name] [message]'
    ,'goto':'(Wizard only) - goto [room_id]: teleport to a room, a room id is [realm]/[room_name]'
    ,'invis':'(Wizard only) - Go invisible.  You are hidden from mere mortals'
    ,'vis':'(Wizard only) - Become visible to all'
    ,'lol':'Laugh'
    ,'l':'Another alias for the look command'
    ,'bow':'Take a bow'
    ,'who':'See who is currenly connected to the realms.'
    ,'W':'An alias for who'
    ,'tele':'(Wizard only) - tele [player name]: teleport a player to your location'
    ,'spawn':'(Wizard only) - spawn [realm]/[object file name]: spawn an object into your inventory'
    ,'i':'an alias for inventory'
    ,'inventory':'see what you are currently carrying'
    ,'inv':'Another alias for inventory'
    ,'drop':'drop [item name]: drop an item into the room'
    ,'get':'get [item name]: pick up an item in the room (if possible) and put it into your inventory'
    ,'clap':'Give a round of applause'
    ,'wizard':'(Wizard only) - wizard [target player]: Grant a mortal the gift of godliness.'
    ,'demote':'(Wizard only) - demote [target player]: Remove wizard status immediately.'
    ,'dest': '(Wizard only) - dest [object/npc]: destroy an object or npc from the realms.'
    ,'Look': '(Wizard only) - Hard look.'
    ,'L': '(Wizard only) - Hard look.'
    ,'help':'This menu'
};
var player_list = {};
var obj_list = {};

var redis_client = redis.createClient();
    redis_client.select(3, function() {
        redis_client.flushdb(function() {;

        io.on('connection', function(socket) {
            var player = {
                "id":null,
                "name":0,
                "alias":null,
                "gagged": false,
                "level": 1,
                "ghost": false,
                "hp":100,
                "wizard": false,
                "realm":"main",
                "room_name":"outside_ted",
                "location": "main/outside_ted",
                "ninja_mode": false,
                "inv": {}
            }

            var room = {
                "name":"outside_ted",
                "realm":"main",
                "long":"You are standing outside of Ted's office on the fifth floor of the 9000 building.  It is a beautiful, clear day in Southern California.  The area is brightly lit by the white tiles and floor to ceiling windows.  Just south of you is the accounting area while just a few steps west will bring you in front of the executive shiiter.",
                "short": "Outside of Ted's Office",
                "owner": 0,
                "exits": {'w':'hallway_exec_bathroom', 's':'account_area','enter':'teds_office'},
                "who": {}
            }

            var player_redis = redis.createClient();
            player_redis.select(5, function() {
                socket.on('login', function(msg) {
                    args = JSON.parse(msg);
                    player.name = args.args[0];
                    if (typeof player.name !== 'undefined') {
                        player_redis.get(player.name, function(err, data) {
                            if (data) {
//                                debug('REDIS player HIT:' + data);
                                player = JSON.parse(data);
                                if (!player.id) {
                                    player.id = uuid.v4();
                                    debug('Generating new player id: ' + player.id);
                                    player_redis.set(player.name, JSON.stringify(player));
                                }
                                player.socket_id = socket.id;
                                add_player_to_list(player);
                                rclient = redis_client;
                                if (player.realm === 'workshop') {
                                    rclient = player_redis;
                                }
                                rclient.get(player.location, function(err, data) {
                                    if (data) {
                                        debug('REDIS room HIT' + data);
                                        room = JSON.parse(data);
                                        initiate_socks(socket, player, room, player_redis);

                                        // update room who list
                                        if (typeof room.who !== 'undefined') {
                                            room.who[player.id] = player;
                                        } else {
                                            room.who = { [player.id]: player };
                                        }
                                        room_id = room.realm + '/' + room.name;
                                        debug('ROOM WHO :'+room.who);
                                        rclient.set(room_id, JSON.stringify(room), function() {
                                            enter_room(socket, room, player, player_redis, false);
                                        });

                                    } else {
                                        debug('REDIS room MISS: ' + player.location);
                                        fs.readFile('./realms/'+player.realm+'/rooms/'+player.room_name+'.js', 'utf8', function(err, data) {
                                            if (err) {
                                                debug('could not load room: '+player.location);
                                            } else {
                                                debug(player.name+' connected');
                                                room_id = player.realm + '/' + player.room_name;
                                                eval(data);
                                                // load npcs
                                                multi = player_redis.multi();
                                                if (typeof room.start_npcs !== 'undefined') {
                                                    room.npcs = [];
                                                    for (var i in room.start_npcs) {
                                                        try {
                                                            eval(fs.readFileSync('./realms/' + room.start_npcs[i] + '.js','utf8'));
                                                            multi.incr('npc_id', function(err, data) {
                                                                npc.name = npc.name+'#'+data;
                                                                debug("NPC SPAWN:"+ npc.name);
                                                                room.npcs.push(npc);
                                                            });
                                                        } catch(e) {
                                                            debug('error loading npc from file: ' + e);
                                                        }
                                                    }
                                                }
                                                multi.exec(function() {
                                                    initiate_socks(socket, player, room, player_redis);

                                                    // update room who list
                                                    if (typeof room.who !== 'undefined') {
                                                        room.who[player.id] = player;
                                                    } else {
                                                        room.who = { [player.id]: player };
                                                    }
                                                    if (player.realm === 'workshop') {
                                                        player_redis.set(room_id, JSON.stringify(room), function() {
                                                            debug('PLAYER_REDIS SET room_id: '+room_id)
                                                            enter_room(socket, room, player, player_redis, false);
                                                        });
                                                    } else {
                                                        debug(JSON.stringify(room));
                                                        redis_client.set(room_id, JSON.stringify(room), function() {
                                                            debug('ROOM_REDIS SET room_id: '+room_id)
                                                            enter_room(socket, room, player, player_redis, false);
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            } else {
                                debug('REDIS player MISS: ' + player.name);
                                // new user
                                room_id = room.realm + '/' + room.name;
                                player.id = uuid.v4();
                                player_redis.set(player.name, JSON.stringify(player));
                                player.socket_id = socket.id;
                                add_player_to_list(player);
                                redis_client.get(room_id, function(err, data) {
                                    if (data) {
                                        debug('REDIS room HIT: ' + data);
                                        room = JSON.parse(data);
                                        initiate_socks(socket, player, room, player_redis);

                                        // update room who list
                                        if (typeof room.who !== 'undefined') {
                                            room.who[player.id] = player;
                                        } else {
                                            room.who = { [player.id]: player };
                                        }
                                        room_id = room.realm + '/' + room.name;
                                        if (player.realm === 'workshop') {
                                            player_redis.set(room_id, JSON.stringify(room), function() {
                                                enter_room(socket, room, player, player_redis,false);
                                            });
                                        } else {
                                            redis_client.set(room_id, JSON.stringify(room), function() {
                                                enter_room(socket, room, player, player_redis,false);
                                            });
                                        }
                                    } else {
                                        debug('REDIS room MISS: ' + room_id);
                                        fs.readFile('./realms/'+player.realm+'/rooms/'+player.room_name+'.js','utf8', function(err, data) {
                                            if (err) {
                                                debug('could not load room: '+player.location +' : '+err);
                                            } else {
                                                debug(player.name+' connected');
                                                room_id = player.realm + '/' + player.name;
                                                eval(data);
                                                initiate_socks(socket, player, room, player_redis);

                                                // update room who list
                                                if (typeof room.who !== 'undefined') {
                                                    room.who[player.id] = player;
                                                } else {
                                                    room.who = { [player.id]: player };
                                                }
                                                room_id = room.realm + '/' + room.name;
                                                if (player.realm ==='workshop') {
                                                    player_redis.set(room_id, JSON.stringify(room), function() {
                                                        enter_room(socket, room, player, player_redis, false);
                                                    });
                                                } else {
                                                    redis_client.set(room_id, JSON.stringify(room), function() {
                                                        debug('REDIS SET room_id: '+room_id)
                                                        enter_room(socket, room, player, player_redis, false);
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        socket.emit('update','login <username>');
                    }
                });
            });
        });
    });
});

function load_npcs(room, player_redis) {
    debug('LOAD_NPCS');
    // npcs have been loaded, get from redis and never from file.  this npc exists in the world
    if (typeof room.npcs !== 'undefined') {
    debug('LOAD_NPCS here');
        rclient = redis_client;
        if (room.realm === 'workshop') {
            rclient = player_redis;
        }

        // referesh all npcs living in room
        for (var npc in room.npcs) {
            rclient.get(npc, function(err, data) {
                if (data) {
                    room.npcs[npc] = JSON.parse(data);
                }
            });
        }
    } else {
        // this room has just been loaded, spawn the npcsa
        if (room.start_npcs != 'undefined') {
            debug('LOAD_NPCS spawning NPCS');
            room.npcs = {};
            for (var npc_key in room.start_npcs) {
                player_redis.incr('npc_num',function(err, npc_num) {
                    debug('LOAD_NPCS readfile: '+room.start_npcs[npc_key]);
                    data = fs.readFileSync('./realms/'+room.start_npcs[npc_key]+'.js', 'utf8');
                    if (data) {
                        try {
                            debug('LOAD_NPCS data='+data);
                            eval(data);
                            npc.id = npc.name+'#'+npc_num;       
                            debug('LOAD_NPCS npc.id='+npc.id);
                            room.npcs[npc.id] = npc;
                            rclient.set(npc.id, JSON.stringify(npc), function() {
                                debug('LOAD_NPCS set '+npc.id);
                            });
                        } catch(e) {
                            debug('Unable to parse '+room.start_npcs[npc_key]+'.js' + ' '+e);
                        }
                    } else {
                        debug('LOAD_NPCS error readFile: ./realms/'+room.start_npcs[npc_key]+'.js');
                    }
                });
            }
        }
    }
}

function debug(msg) {
    date = new Date();
    console.log(date.toString() + ': ' + msg);
}

function initiate_socks(socket,player,room, player_redis) {
    socket.on('disconnect', function() {
        room_id = room.realm + '/' + room.name;
        rclient = redis_client;
        if (player.realm === 'workshop') {
            rclient = player_redis;
        }
        rclient.get(room_id, function(err, data) {
            if (err) {
                debug('DISCONNECT REDIS MISS! '+ err);
            } else {
                room = JSON.parse(data);
                socket.broadcast.to(room_id).emit('update', player.name + ' disconnected.');
                delete room.who[player.id];
                remove_player_from_list(player);
                if (room.realm === 'workshop') {
                    player_redis.set(room_id, JSON.stringify(room));
                } else {
                    redis_client.set(room_id, JSON.stringify(room));
                }
                debug(player.name+' disconnected.');
            }
        });
    });
    socket.on('cmd', function(msg) {
        if (player.id) {
            debug(msg);
            args = JSON.parse(msg);
            command = args.name;
            if (typeof valid_commands[command] !== 'undefined') {
                if (command === 'say') {
                    if (!player.gagged) {
                        msg = args.rest;
                        debug(player.name + ' said ' + msg);
                        room_id = room.realm + '/' + room.name;
                        socket.emit('update', 'You said ' + msg);
                        if (player.ninja_mode) {
                            socket.broadcast.to(room_id).emit('update', 'A mysterious voice said ' + msg);
                        } else {
                            socket.broadcast.to(room_id).emit('update', player.name + ' said ' + msg);
                        }
                    }
                }
                if (command === 'lol') {
                    if (!player.gagged) {
                        room_id = room.realm + '/' + room.name;
                        socket.emit('update','You guffaw out loud.');
                        if (player.ninja_mode) {
                            socket.broadcast.to(room_id).emit('update', 'You hear a mysterious laughter nearby.');
                        } else {
                            socket.broadcast.to(room_id).emit('update', player.name + ' laughs.');
                        }
                    }
                }
                if (command === 'bow') {
                    room_id = room.realm + '/' + room.name;
                    socket.emit('update','You take a deep bow.');
                        socket.emit('update','Noone sees you do that.');
                    if (player.ninja_mode) {
                    } else {
                        socket.broadcast.to(room_id).emit('update', player.name + ' takes a bow.');
                    }
                } 
                if (command === 'clap') {
                    room_id = room.realm + '/' + room.name;
                    socket.emit('update','CLAP! CLAP! CLAP!');
                    if (player.ninja_mode) {
                        socket.broadcast.to(room_id).emit('update', 'You hear a round of applause form seeemingly nowhere.');
                    } else {
                        socket.broadcast.to(room_id).emit('update', player.name + ' gives a round of applause');
                    }
                } 
                if (command === 'wave') {
                    room_id = room.realm + '/' + room.name;
                    socket.emit('update','You wave your hand.');
                    if (player.ninja_mode) {
                        socket.emit('update','Noone sees you do that.');
                    } else {
                        socket.broadcast.to(room_id).emit('update', player.name + ' waves their hand!');
                    }
                } 
                if (command === 'emote') {
                    if (!player.gagged) {
                        msg = args.rest;
                        debug(player.name + ' ' + msg);
                        socket.emit('update', 'You ' + msg);
                        room_id = room.realm + '/' + room.name;
                        socket.broadcast.to(room_id).emit('update', player.name + ' ' + msg);
                    }
                }
                if (command === 'go') {
                    try {
                        direction = args.args[0];
                        if (direction in room.exits) {
                            new_room_id = room.realm+'/'+room.exits[direction];
                            debug('go exit: '+new_room_id);
                            old_room = room;
                            redis_client.get(new_room_id, function(err, data) {
                                if (data) {
                                    debug('REDIS go room HIT: '+data);
                                    room = JSON.parse(data);
                                    update_room_who(redis_client, room, player, old_room,player_redis);
                                    leave_room(socket, old_room, player,false); 
                                    enter_room(socket, room, player, player_redis,  false);
                                } else {
                                    debug('REDIS go room MISS: '+new_room_id);
                                    fs.readFile('./realms/'+room.realm+'/rooms/'+room.exits[direction]+'.js', 'utf8', function(err, data) {
                                        if (err) {
                                            debug('room load error - '+new_room_id+'.js');
                                        } else {
                                            eval(data);
                                            redis_client.set(new_room_id, JSON.stringify(room));
                                            update_room_who(redis_client, room, player, old_room,player_redis);
                                            leave_room(socket, old_room, player, false);
                                            enter_room(socket, room, player, player_redis, false);
                                        }
                                    });
                                }
                            });
                        } else {
                            socket.emit('update','You cannot go that way.');
                        }
                    } catch(e) {
                    }
                }
                if (command === 'look' || command === 'l') {
                    room_id = player.realm + '/' + player.room_name;
                    rclient = redis_client;
                    if (player.realm === 'workshop') {
                        rclient = player_redis;
                    }
                    rclient.get(room_id, function(err, data) {
                        if (err) {
                            debug('Command LOOK get room from redis error: '+err);
                        } else {
                            room = JSON.parse(data);
                            socket.emit('update', command);
                            socket.emit('update', room.short);
                            socket.emit('update', room.long);
                            show_others_in_room(socket, room, player);
                            show_room_inventory(socket, room ,player,player_redis);
                            show_npcs_in_room(socket,room,player,player_redis, false, false);
                            show_exits(socket, room);
                            if (player.ninja_mode) {
                                socket.emit('update', 'You are in ninja mode!  "vis" to disable');
                            }
                        }
                    });
                }
                if ((command === 'Look' || command === 'L') && player.wizard) {
                    room_id = player.realm + '/' + player.room_name;
                    rclient = redis_client;
                    if (player.realm === 'workshop') {
                        rclient = player_redis;
                    }
                    rclient.get(room_id, function(err, data) {
                        if (err) {
                            debug('Command HARD_LOOK get room from redis error: '+err);
                        } else {
                            room = JSON.parse(data);
                            socket.emit('update', command);
                            socket.emit('update', room.short);
                            socket.emit('update', room.long);
                            show_others_in_room(socket, room, player);
                            show_room_inventory(socket, room ,player,player_redis);
                            show_npcs_in_room(socket,room,player,player_redis, false, true);
                            show_exits(socket, room);
                            if (player.ninja_mode) {
                                socket.emit('update', 'You are in ninja mode!  "vis" to disable');
                            }
                        }
                    });
                }
                if (command === 'goto'  && player.wizard) {
                    if (args.args[0] === 'home') {
                        destination = 'workshop/'+player.name+'s_workshop';  // workshops are persisten, jus tlike players so use player_client (persistent redis db)
                        debug(player.name + ' GOTO ' + destination);
                        player_redis.get(destination, function(err, data) {
                            old_room = room;
                            if (data) {
                                debug('REDIS goto HIT: '+data);
                                room = JSON.parse(data);
                                update_room_who(redis_client, room, player, old_room,player_redis);
                                leave_room(socket, old_room, player, true); 
                                enter_room(socket, room, player, player_redis, true);
                            } else {
                               debug('REDIS goto MISS: ' + destination);
                                fs.readFile('./realms/workshop/rooms/'+player.name+'s_workshop.js','utf8', function(err, data) {
                                    if (err) {
                                        debug('FS goto load error:' + err);
                                    } else {
                                        if (data) {
                                            eval(data);
                                            load_npcs(room,player_redis);
                                            player_redis.set(destination, JSON.stringify(room));
                                            update_room_who(redis_client, room, player, old_room,player_redis);
                                            leave_room(socket, old_room, player, true); 
                                            enter_room(socket, room, player, player_redis, true);
                                        } 
                                    }
                                });
                            }
                        });
                    } else {
                        if (typeof args.args[0] !== 'undefined') {
                            destination = args.args[0];
                            debug(player.name + ' GOTO ' + destination);
                            redis_client.get(destination, function(err, data) {
                                old_room = room;
                                if (data) {
                                    debug('REDIS goto HIT: '+data);
                                    room = JSON.parse(data);
                                    update_room_who(redis_client, room, player, old_room, player_redis);
                                    leave_room(socket, old_room, player, true); 
                                    enter_room(socket, room, player, player_redis, true);
                                } else {
                                    parts = destination.split('/',2);
                                    debug('REDIS goto MISS '+ destination + parts.length);
                                    if (parts.length>1) {
                                        realm = parts[0];
                                        dest_room = parts[1];
                                        debug('REDIS goto MISS: ' + realm + '/' + dest_room);
                                        fs.readFile('./realms/'+realm+'/rooms/'+dest_room+'.js','utf8', function(err, data) {
                                            if (err) {
                                                debug('FS goto load error, maybe a player target? '+ err);
                                            } else {
                                                if (data) {
                                                    eval(data);
                                                    load_npcs(room,player_redis);
                                                    if (realm == 'workshop') {
                                                        player_redis.set(destination, JSON.stringify(room));
                                                    } else {
                                                        redis_client.set(destination, JSON.stringify(room));
                                                    }
                                                    update_room_who(redis_client, room, player, old_room, player_redis);
                                                    leave_room(socket, old_room, player, true); 
                                                    enter_room(socket, room, player, player_redis, true);

                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                }
                if (command === 'invis'  && player.wizard)  {
                    if (!player.ninja_mode) {
                        socket.emit('update','You suddenly vanish.  Anyone watching is unsure of their eyes now.');
                    }
                    player.ninja_mode = true;
                    room_id = room.realm + '/' + room.name;
                    socket.broadcast.to(room_id).emit('update', player.name + ' disappears in front of your eyes!');
                    player_redis.set(player.name, JSON.stringify(player));
                    room.who[player.id].ninja_mode = true;
                    if (room.realm == 'workshop') {
                        player_redis.set(room_id, JSON.stringify(room));
                    } else {
                        redis_client.set(room_id, JSON.stringify(room));
                    }
                }
                if (command === 'vis' && player.wizard) {
                    if (player.ninja_mode) {
                        socket.emit('update','You suddenly appear in the room.  Everyone can see you!');
                    }
                    player.ninja_mode = false;
                    room_id = room.realm + '/' + room.name;
                    socket.broadcast.to(room_id).emit('update', player.name + ' suddenly appears!');
                    player_redis.set(player.name, JSON.stringify(player));
                    room.who[player.id].ninja_mode = false;
                    if (room.realm == 'workshop') {
                        player_redis.set(room_id, JSON.stringify(room));
                    } else {
                        redis_client.set(room_id, JSON.stringify(room));
                    }
                }
                if (command === 'who' || command === 'W') {
                    plist = get_player_list(player);
                    socket.emit('update',plist.p_list);
                    socket.emit('update',plist.total_count + ' players online.');
                }
                if (command === 'tele'  && player.wizard) {
                    if (typeof args.args[0] !== 'undefined') {
                        target = args.args[0];
                        player_redis.get(target, function(err, data) {
                            if (err) {
                                socket.emit('update', 'There is no player by that name.');
                            } else {
                                try {
                                    target_player = JSON.parse(data);
                                    live_target = player_list[target_player.id];
                                    if (typeof live_target !== 'undefined') {
                                        move_player(socket, redis_client, player_redis, live_target, player.realm, player.room_name, null, true);
                                    } else {
                                        socket.emit('update', 'There is no live player by that name.');
                                    }
                                } catch(e) {
                                    socket.emit('update', 'There is no live player by that name.');
                                }
                            }
                        });
                    }
                }
                if (command === 'spawn' && player.wizard) {
                    if (typeof args.args[0] !== 'undefined') {
                        tokens = args.args[0].split('/',2);
                        fs.readFile('./realms/'+tokens[0]+'/objs/'+tokens[1]+'.js', function(err, data) {
                            if (data) {
                                obj = JSON.parse(data);
                                obj.str_func = 'a=function(socket,player) { socket.emit("update","'+obj.alias+' says ehllo " + player.name) }';
                                obj.em = new em();
                                obj.em.on('arrive', eval(obj.str_func));
                                player_redis.incr('objs', function(err, obj_val) {
                                    obj.name += '#'+obj_val;
                                    obj.location = player.name+','+player.id;
                                    str = 'Loaded '+args.args[0]+' name: '+obj.name+' alias: '+obj.alias;
                                    debug(str);
                                    socket.emit('update',str);
                                    obj_list[obj.name] = obj;
                                    if (typeof player.inv !== 'undefined') {
                                        player.inv[obj.name] = obj;
                                    } else {
                                        player.inv = { [obj.name]:obj };
                                    }
                                    player_redis.set(player.name, JSON.stringify(player),function() {
                                        show_inventory(socket, player_redis, player);
                                    });
                                    player.inv[obj.name].em.emit('event');
                                });
                            } else  {
                                debug('Cannot load: '+args.args[0]);
                                socket.emit('update','Cannot load: '+args.args[0]);
                            }
                        });
                    }

                }
                if (command === 'dest' && player.wizard) {
                    if (typeof args.args[0] !== 'undefined') {
                        target = args.args[0];
                        found = false;
                        try {
                            for (var i in room.npcs) {
                                if (room.npcs[i].name === target) {
                                    found = true;
                                    room.npcs.splice(i,1);
                                    break;
                                }
                            }
                            if (found) {
                                rclient = redis_client;
                                if (room.realm === 'workshop') {
                                    rclient = player_redis;
                                }
                                debug('DEST new room:'+ JSON.stringify(room));
                                rclient.set(room.realm+'/'+room.name, JSON.stringify(room));
                                socket.emit('update', 'You destroyed '+target);
                            }
                        } catch(e) {
                            debug('DEST error('+target+'): '+ e);
                        }
                    }
                }
                if (command === 'i' || command ==='inventory' || command =='inv') {
                    show_inventory(socket, player_redis, player);
                }
                if (command === 'drop') {
                    target = args.args[0];
                    if (typeof player.inv !== 'undefined') {
                        if (typeof player.inv[target] !== 'undefined') {
                            new_obj = {};
                            for (var key in player.inv[target]) {
                                new_obj[key] = player.inv[target][key];
                            }
                            if (typeof room.inv !== 'undefined') {
                                new_obj.location = player.realm +'/' + player.room_name;
                                room.inv[target] = new_obj;
                            } else {
                                room.inv = { [target]:new_obj };
                            }
                            if (typeof obj_list[target] !== 'undefined') {
                                obj_list[target].location = player.realm+'/'+player.room_name;
                            } else {
                                obj_list[target] = new_obj;
                            }
                            if (player.ninja_mode) {
                                socket.broadcast.to(room.realm+'/'+room.name).emit('update', target+' appears out of nowhere.');
                            } else {
                                socket.broadcast.to(room.realm+'/'+room.name).emit('update', player.name +' dropped '+target);
                            }
                            socket.emit('update','You dropped a '+ target);
                            delete player.inv[target];
                            player_redis.set(player.name, JSON.stringify(player));
                            if (player.realm === 'workshop') {
                                player_redis.set(player.realm+'/'+player.room_name, JSON.stringify(room));
                            } else {
                                redis_client.set(player.realm+'/'+player.room_name, JSON.stringify(room));
                            }
                        }
                    } else {
                        socket.emit('update','You have nothing to drop.');
                    }
                }
                if (command === 'get') {
                    target = args.args[0];
                    if (typeof room.inv[target] !== 'undefined') {
                        if (room.inv[target].can_get) {
                            new_obj = {};
                            for (var keys in room.inv[target]) {
                                new_obj[keys] = room.inv[target][keys];
                            }
                            new_obj.location = player.name+','+player.id;
                            try {
                                delete room.inv[target];
                                if (typeof player.inv != 'undefined') {
                                    player.inv[target] = new_obj;
                                } else {
                                    player.inv = { [target]:new_obj };
                                }
                                socket.emit('update','You picked up '+target+' and placed it in your inventory');
                                if (player.ninja_mode) {
                                    socket.broadcast.to(room.realm+'/'+room.name).emit('update', target +' appears to float in the air then disappears.');
                                } else {
                                    socket.broadcast.to(room.realm+'/'+room.name).emit('update', player.name + ' picked up '+target);
                                }
                                player_redis.set(player.name, JSON.stringify(player));
                                if (typeof obj_list[target] !== 'undefined') {
                                    obj_list[target].location = player.name +','+player.id;
                                } else {
                                    obj_list[target] = new_obj;
                                }
                                if (player.realm === 'workshop') {
                                    player_redis.set(room.realm +'/'+ room.name, JSON.stringify(room));
                                } else {
                                    redis_client.set(room.realm +'/'+ room.name, JSON.stringify(room));
                                }
                            } catch(e) {
                                debug('Couldn\'t delete for GET command.  Possible DUP');
                            }
                        } else {
                            socket.emit('update','You cannot pick up '+target+'.');
                        }
                    } else {
                        socket.emit('update','There is no '+ target+' here.');
                    }
                }
                if (command === 'wizard' && player.wizard) {
                    target = args.args[0];
                    player_redis.get(target, function(err, data) {
                        if (data) {
                            target_player = JSON.parse(data);
                            target_player.wizard = true;
                            player_redis.set(target, JSON.stringify(target_player), function() {
                                socket.emit('update','You have promoted:'+target);
                                debug(player.name + 'granted '+target+' wizardship');
                            });
                        } else {
                            socket.emit('update', target + ' has not logged in.');
                            debug('WIZARD: Cannot find '+target);
                        }
                    });
                }
                if (command === 'demote' && player.wizard) {
                    target = args.args[0];
                    player_redis.get(target, function(err, data) {
                        if (data) {
                            target_player = JSON.parse(data);
                            target_player.wizard = false;
                            player_redis.set(target, JSON.stringify(target_player),function() {
                                socket.emit('update','You have demoted '+target);
                                debug(player.name + ' demoted '+ target);
                            })
                        } else {
                            socket.emit('update', target + ' has not logged in.');
                            debug('WIZARD: Cannot find '+target);
                        }
                    });
                }
                if (command === 'help') {
                    str = 'You can:\n';
                    for (var key in valid_commands) {
                        if (player.wizard) {
                            str+= key + '-' + valid_commands[key] + '\n';
                        } else if (valid_commands[key].indexOf('Wizard only') < 0) {
                            str+= key + '-' + valid_commands[key] + '\n';
                        }
                    }
                    socket.emit('update',str);
                }
            } else {
                debug('invalid command' + JSON.stringify(msg));
                socket.emit('update', 'Invalid command.');
            }
        }
    });
};

function spawn_it() {
    console.log('spawn_it');
}

function show_inventory(socket, player_redis, player) {
    str = 'Items in inventory:\n';
    player_redis.get(player.name, function(err, data) {
        if (data) {
            the_player = JSON.parse(data);
            for (var objs in the_player.inv) {
                if (player.wizard && the_player.inv[objs].invisible) {
                    str += player.inv[objs].name+' (invisibile)\n';
                } else {
                    str += player.inv[objs].name+'\n';
                }
            }
            socket.emit('update',str);
        } else {
            debug('SHOW_INVENTORY REDIS MISS');
        }
    });
}

function show_room_inventory(socket, room, player, player_redis, some_event) {
    str = 'Objects in the room: \n';
    rclient = redis_client;
    if (room.realm ==='workshop') {
        rclient = player_redis;
    }
    rclient.get(room.realm + '/' + room.name, function(err, data) {
        if (data) {
            the_room = JSON.parse(data);
            if (typeof the_room.inv !== 'undefined') {
                for (key in the_room.inv) {
                    the_room.inv[key].em = new em();
                    if (player.wizard && the_room.inv[key].invisible) {
                        str+= key +' (invisible)\n';
                    } else {
                        str+= key +'\n';
                    }
                    if (typeof the_room.inv[key].str_func !== 'undefined') {
                        the_room.inv[key].em.on('arrive', eval(the_room.inv[key].str_func));
                    }
                }
                socket.emit('update',str);
                for (key in the_room.inv) {
                    if (typeof the_room.inv[key].em !== 'undefined') {
                        try {
                            the_room.inv[key].em.emit(some_event,socket,player);
                        } catch(e) {
                            debug('SHOW_ROOM_INVENTORY em.emit error('+key+'): '+e);
                        }
                    }
                }
            }
        } else {
            debug('SHOW_ROOM_INVENTORY REDIS MISS: ' +room.realm +'/'+ room.name);
        }
    });
}

function move_player(socket, redis_client,player_redis, live_target, target_realm, target_room, target_thing,magical) {
    try {
    debug('MOVE PLAYER target: '+ target_realm+'/'+target_room);
    rclient = redis_client;
    if (target_realm === 'workshop') {
        rclient = player_redis;
    }
    rclient.get(target_realm+'/'+target_room, function(err, data) {
        if (data) {
            debug('MOVE_PLAYER REDIS client HIT: '+data);
            room = JSON.parse(data);
            load_npcs(room,player_redis);
            move_player_to_room(socket, redis_client, player_redis, live_target,room,magical);
        } else {
            debug('MOVE_PLAYER REDIS client MISS:'+ target_realm+'/'+target_room);
            fs.readFile('./realms/'+target_realm+'/rooms/'+target_room+'.js', 'utf8', function(err, data) {
                if (data) {
                    eval(data);
                    load_npcs(room,player_redis);
                    move_player_to_room(socket, redis_client, player_redis, live_target,room, magical);
                } else {
                    socket.emit('update', './realms/'+target_realm+'/rooms/'+target_room+'.js does not exist.');
                }
            });
        }
    });
    } catch(e) {
        debug(e);
    }
}
/*
function spawn_player_login(socket,redis_client, player_redis, player,room) {
    rclient = redis_client;
    if (player.realm === 'workshop')  {
        rclient = player_redis;
    }
    room_id = player.realm + '/' + player.room_name;
    rclient.get(player.location,function(err, data) {
        if (data) {
            room = JSON.parse(data);
            spawn_player_room(socket, rclient, player_redis, player, room);
        } else {
            fs.readFile('./realms/'+player.realm+'/rooms/'+player.room_name+'.js','utf8',function(err, data) {
                if (err) {
                    debug('SPAWN_PLAYER_LOGIN error reading room: ' + err);
                } else {
                    debug('SPAWN_PLAYER_LOGIN REDIS miss: ' + data);
                    eval(data);
                    spawn_player_room(socket, rclient, player_redis, player, room);
                }
            });
        }
    });
}

function spawn_player_room(socket, rclient, player_redis, player, room) {
    if (room) {
        if (typeof room.who !== 'undefined') {
            room.who[player.id] = player;
        } else {
            room.who = { [player.id]: player };
        }
        debug('SPAWN_PLAYER_ROOM: '+ room.who[player.id].name);
        socket.join(room_id);
        if (!player.ninja_mode) {
            socket.broadcast.to(room_id).emit('update', player.name + ' has arrived.');
        }
        socket.emit('update',room.short + '\n' + room.long);
        socket.emit('prompt', player.name+':'+room_id+'> ');
        show_others_in_room(socket, room, player);
        if (player.ninja_mode) {
            socket.emit('update', 'You are in ninja mode!  "vis" to disable');
        }
        update_player_location(room, player);
        player_redis.set(player.name, JSON.stringify(player));
        player_list[player.id] = player;
        rclient.set(room_id, JSON.stringify(room), function(msg) {
}); 
    }   
}
*/

function move_player_to_room(socket, redis_client, player_redis, live_target, room, magical) {
    rclient = redis_client;
    if (live_target.realm === 'workshop') {
        rclient = player_redis;
    }
    rclient.get(live_target.location, function(err, data) {
        if (data) {
            old_room = JSON.parse(data);
            target_socket = io.sockets.connected[live_target.socket_id];
            update_room_who(redis_client, room, live_target, old_room, player_redis);
            leave_room(target_socket,old_room, live_target,magical);
            enter_room(target_socket, room, live_target, player_redis, magical);
        } else {
            debug('MOVE_PLAYER_TO_ROOM REDIS MISS!!!!! SHOULD  NOT HAPPEN!');
        }
    });
}

function get_player_list(player) {
    count = 0;
    invis = 0;
    var dat = {};
    dat.p_list = '';
    dat.total_count = 0;
    for (var key in player_list) {
        some_player = player_list[key];
        if (some_player.ninja_mode) {
            invis++;
            if (player.wizard) {
                dat.p_list += some_player.name + ' (level: ' + some_player.level + ')' + ' ' + some_player.location + ' (invis)\n';
            }
        } else {
            count++;
            if (player.wizard) {
                dat.p_list += some_player.name + ' (level: ' + some_player.level + ')' + ' ' + some_player.location+ '\n';
            } else {
                dat.p_list += some_player.name+'\n';
            }
        }
    }
    if (player.wizard) {
        dat.total_count = invis + count;
    } else {
        dat.total_count = count;
    }
    return dat;
}

function add_player_to_list(player) {
    player_list[player.id] = player;
}

function remove_player_from_list(player) {
    try {
        delete player_list[player.id];
    } catch(e) {
        debug('remove player error: '+e);
    }
}

function show_others_in_room(socket, room, player) {
    in_room = '';
    count = 0;
    invis = 0;
    for (var player_id in room.who) {
        if (room.who[player_id].ninja_mode && player.wizard) {
            in_room += room.who[player_id].name +' (invisible),';
            invis++;
        } else if (!room.who[player_id].ninja_mode) {
            in_room += room.who[player_id].name +',';
            count++;
        }
    }
    in_room = in_room.slice(0,-1);  // rmeove last comma
    if (player.wizard) {
        total_count = count + invis;
        if (total_count == 1) {
            socket.emit('update', 'You are the only one here');
        } else {
            socket.emit('update', 'There are '+total_count+' players here: '+in_room);
        }
    } else if (count == 1) {
        socket.emit('update', 'You are the only one here');
    } else {
        socket.emit('update', 'There are '+count+' players here: '+in_room);
    }
}

function leave_room(socket, old_room, player, magical) {
    debug('LEAVE_ROOM' + old_room.realm + '/' + old_room.name);
    if (!player.ninja_mode) {
        if (magical) {
            socket.broadcast.to(old_room.realm+'/'+old_room.name).emit('update', player.name + ' disappears in a cloud of smoke.');
        } else {
            socket.broadcast.to(old_room.realm+'/'+old_room.name).emit('update', player.name + ' went '+ direction);
        }
    }
    socket.leave(old_room.realm+'/'+old_room.name);
}

function show_npcs_in_room(socket, room, player, player_redis, process_listeners, hard_look) {
    npcs = '';
    /*
    rclient = redis_client;
    debug('SHOW_NPCS_IN_ROOM ' + room.npcs);
    if (typeof room.npcs !== 'undefined') {
        multi = rclient.multi();
        for (var npc_key in room.npcs) {
            debug('SHOW_NPCS_IN_ROOM attempting to load: '+ npc_key);
            multi.get(npc_key, function(data) {
                npc = JSON.parse(data);
                npcs += npcs.name + 'is here.\n';
                debug('SHOW_NPCS_IN_ROOM '+ npcs);
            });
        }
        multi.exec();
        debug('SHOW_NPCS_IN_ROOM final: '+ npcs);
    }
    */
    if (typeof room.npcs !== 'undefined') {
        for (var i in room.npcs) {
            if (hard_look) {
                npcs += room.npcs[i].name + ' is here.\n';
            } else {
                npcs += room.npcs[i].alias + ' is here.\n';
            }
            if (process_listeners) {
                if (typeof room.npcs[i].events !== 'undefined') {
                    room.npcs[i].listener = new em();
                    for (var ev in room.npcs[i].events) {
                        room.npcs[i].listener.on(ev, function(event_name,npc_obj,player) {
                        var num_actions = npc_obj.events[event_name].actions.length;
                            if (num_actions == 1) {
                                opt = 0;
                                to_emote = npc_obj.events[event_name].actions[opt].replace('%player%', player.name);
                                bcast_emote = to_emote.replace('%you%', player.name);
                                you_emote = to_emote.replace('%you%', 'you');
                                socket.broadcast.to(room.realm+'/'+room.name).emit('update', npc_obj.alias + ' ' + you_emote);
                                socket.emit('update', npc_obj.alias+ ' '+ to_emote);
                            } else {
                                min = 0;
                                max = num_actions-1;
                                opt = Math.floor(Math.random() * (max - min + 1)) + min;
                                debug('npc option: '+opt);
                                to_emote = npc_obj.events[event_name].actions[opt].replace('%player%', player.name);
                                bcast_emote = to_emote.replace('%you%', player.name);
                                you_emote = to_emote.replace('%you%', 'you');
                                socket.emit('update', npc_obj.alias + ' ' + you_emote);
                                socket.broadcast.to(room.realm+'/'+room.name).emit('update', npc_obj.alias+ ' ' + bcast_emote);
                            }
                        });
                    }
                }
            }
        }
    }
    socket.emit('update', npcs);
}

function enter_room(socket, room, player, player_redis, magical) {
    room_id = room.realm+'/'+room.name;
    debug('enter_room: '+room_id);
    socket.join(room_id);
    if (!player.ninja_mode) {
        if (!magical) {
            socket.broadcast.to(room_id).emit('update', player.name + ' has arrived.');
        } else {
            socket.broadcast.to(room_id).emit('update', player.name + ' materializes in front of you.');
        }
    }
    if (magical) {
        socket.emit('update','You\'ve just been teleported!');
    }

    socket.emit('update', room.short);
    socket.emit('update', room.long);
    socket.emit('prompt', player.name+':'+room_id+'> ');
    show_npcs_in_room(socket,room,player,player_redis, true, false);
    show_others_in_room(socket, room, player);
    show_room_inventory(socket, room, player,player_redis,'arrive');
    show_exits(socket, room);

    if (player.ninja_mode) {
        socket.emit('update', 'You are in ninja mode!  "vis" to disable');
    }
    player = update_player_location(room, player);
    player_redis.set(player.name, JSON.stringify(player));
    player_list[player.id] = player;
    if (typeof room.npcs !== 'undefined') {
        for (var i in room.npcs) {
            room.npcs[i].listener.emit('arrive', 'arrive', room.npcs[i], player);
        }
    }
}

function update_player_location(room, player) {
    player.location = room.realm+'/'+room.name;
    player.realm = room.realm;
    player.room_name = room.name;
    return player;
}

function update_room_who(redis_client, room, player, old_room,player_redis) {
    if (room && typeof room.who !== 'undefined') {
        room.who[player.id] = player;
    } else {
        room.who = { [player.id]: player };
    }
    room_id = room.realm + '/' + room.name;
    debug('update_room '+room_id);
    if (room.realm == 'workshop') {
        player_redis.set(room_id, JSON.stringify(room));
    } else {
        redis_client.set(room_id, JSON.stringify(room));
    }
    if (old_room) {
        room_id = old_room.realm +'/' + old_room.name;
        try {
            delete old_room.who[player.id];
            redis_client.set(room_id, JSON.stringify(old_room));
        } catch(e) {
            debug('error deleting '+player.name+' from '+room_id);
        }
    }
}

/*
function update_room_list(room, player, old_room) {
    for (var keys in room_list[room.realm]) {
        console.log('bkey='+ keys);
    }
    if (typeof room_list[room.realm] !== 'undefined') {
        if (typeof room_list[room.realm][room.name] !== 'undefined') {
            room_list[room.realm][room.name][player.name] = 1;
        } else {
            room_list[room.realm][room.name] = {
                [player.name]: 1
            }
        }
    } else {
        room_list = {
            [room.realm]: {
                [room.name]: {
                    [player.name]: 1
                }
            }
        };
    }
    for (var keys in room_list[room.realm]) {
        console.log('key='+ keys);
    }
    try {
        if (old_room) {
            console.log('to_delete: '+ old_room.realm+','+old_room.name+','+player.name);
            console.log('to delete: '+room_list[old_room.realm][old_room.name][player.name]);
            delete room_list[old_room.realm][old_room.name][player.name];
        }
    } catch(e) {
        console.log('could not delete from room list');
    }
}
*/

function show_exits(socket, room) {
    exits = '';
    for (var key in room.exits) {
        exits += key+',';
    }
    exits = exits.slice(0,-1);  // remove last comma
    socket.emit('update', 'You can go: ' + exits);
}

http.listen(2500);
