var redis = require('redis');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var natural = require('natural');
var fs = require('fs');

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/cli.html'));
});

var valid_commands = ['say','go','n','s','e','w','exit','logout','shout', 'gag','look','desc','who','emote','logout','goto','invis','vis','lol','l','bow'];
var room_list = {};

var redis_client = redis.createClient();
    redis_client.select(3, function() {
        redis_client.flushdb(function() {;

        io.on('connection', function(socket) {
            var player = {
                "name":0,
                "gagged": false,
                "level": 1,
                "ghost": false,
                "hp":100,
                "wizard": false,
                "realm":"main",
                "room_name":"outside_ted",
                "location": "main/outside_ted",
                "ninja_mode": false
            }

            var room = {
                "name":"outside_ted",
                "realm":"main",
                "long":"You are standing outside of Ted's office on the fifth floor of the 9000 building.  It is a beautiful, clear day in Southern California.  The area is brightly lit by the white tiles and floor to ceiling windows.  Just south of you is the accounting area while just a few steps west will bring you in front of the executive shiiter.",
                "short": "Outside of Ted's Office",
                "owner": 0,
                "exits": {'w':'hallway_exec_bathroom', 's':'account_area','enter':'teds_office'}
            }

            var player_redis = redis.createClient();
            player_redis.select(5, function() {
                socket.on('adduser', function(name) {
                    player.name = name;
                    player_redis.get(player.name, function(err, data) {
                        if (data) {
                            console.log('REDIS player HIT:' + data);
                            player = JSON.parse(data);
                            redis_client.get(player.location, function(err, data) {
                                if (data) {
                                    console.log('REDIS room HIT' + data);
                                    room = JSON.parse(data);
                                    initiate_socks(socket, player, room, player_redis);

                                    // update room who list
                                    if (typeof room.who !== 'undefined') {
                                        room.who[player.name] = player;
                                    } else {
                                        room.who = { [player.name]: player };
                                    }
                                    room_id = room.realm + '/' + room.name;
                                    console.log(room.who);
                                    redis_client.set(room_id, JSON.stringify(room), function() {
                                        enter_room(socket, room, player, player_redis, false);
                                    });

                                } else {
                                    console.log('REDIS room MISS: ' + player.location);
                                    fs.readFile('./realms/'+player.realm+'/rooms/'+player.room_name+'.js', 'utf8', function(err, data) {
                                        if (err) {
                                            console.log('could not load room: '+player.location);
                                        } else {
                                            console.log(player.name+' connected');
                                            room_id = player.realm + '/' + player.name;
                                            eval(data);
                                            redis_client.set(room_id, JSON.stringify(room));
                                            initiate_socks(socket, player, room, player_redis);

                                            // update room who list
                                            if (typeof room.who !== 'undefined') {
                                                room.who[player.name] = player;
                                            } else {
                                                room.who = { [player.name]: player };
                                            }
                                            room_id = room.realm + '/' + room.name;
                                            redis_client.set(room_id, JSON.stringify(room), function() {
                                                enter_room(socket, room, player, player_redis, true);
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            console.log('REDIS player MISS: ' + player.name);
                            room_id = room.realm + '/' + room.name;
                            redis_client.get(room_id, function(err, data) {
                                if (data) {
                                    console.log('REDIS room HIT: ' + data);
                                    room = JSON.parse(data);
                                    console.log(room.name);
                                    initiate_socks(socket, player, room, player_redis);

                                    // update room who list
                                    if (typeof room.who !== 'undefined') {
                                        room.who[player.name] = player;
                                    } else {
                                        room.who = { [player.name]: player };
                                    }
                                    room_id = room.realm + '/' + room.name;
                                    redis_client.set(room_id, JSON.stringify(room), function() {
                                        enter_room(socket, room, player, player_redis, true);
                                    });
                                } else {
                                    console.log('REDIS room MISS: ' + room_id);
                                    fs.readFile('./realms/'+player.realm+'/rooms/'+player.room_name+'.js','utf8', function(err, data) {
                                        if (err) {
                                            console.log('could not load room: '+player.location +' : '+err);
                                        } else {
                                            console.log(player.name+' connected');
                                            room_id = player.realm + '/' + player.name;
                                            eval(data);
                                            redis_client.set(room_id, JSON.stringify(room));
                                            initiate_socks(socket, player, room, player_redis);

                                            // update room who list
                                            if (typeof room.who !== 'undefined') {
                                                room.who[player.name] = player;
                                            } else {
                                                room.who = { [player.name]: player };
                                            }
                                            room_id = room.realm + '/' + room.name;
                                            redis_client.set(room_id, JSON.stringify(room), function() {
                                                enter_room(socket, room, player, player_redis, true);
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            });
        });
    });
});

function initiate_socks(socket,player,room, player_redis) {
    socket.on('disconnect', function() {
        room_id = room.realm + '/' + room.name;
        socket.broadcast.to(room_id).emit('update', player.name + ' disconnected.');
        delete room.who[player.name];
        if (room.realm === 'workshop') {
            player_redis.set(room_id, JSON.stringify(room));
        } else {
            redis_client.set(room_id, JSON.stringify(room));
        }
    });
    socket.on('cmd', function(msg) {
        if (player.name) {
            console.log(msg);
            tokens = msg.split(' ');
            command = tokens[0];
            if (valid_commands.indexOf(command) >= 0) {
                tokens.shift();
                if (command === 'say') {
                    if (!player.gagged) {
                        msg = tokens.join(' ');
                        console.log(player.name + ' said ' + msg);
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
                    socket.emit('update','CLAP! CLAP! CLAP!');
                    socket.broadcast.to(room_id).emit('update', player.name + ' takes a bow.');
                } 
                if (command === 'emote') {
                    if (!player.gagged) {
                        msg = tokens.join(' ');
                        console.log(player.name + ' ' + msg);
                        socket.emit('update', 'You ' + msg);
                        room_id = room.realm + '/' + room.name;
                        socket.broadcast.to(room_id).emit('update', player.name + ' ' + msg);
                    }
                }
                if (command === 'go') {
                    try {
                        direction = tokens[0];
                        if (direction in room.exits) {
                            new_room_id = room.realm+'/'+room.exits[direction];
                            console.log('go exit: '+new_room_id);
                            old_room = room;
                            redis_client.get(new_room_id, function(err, data) {
                                if (data) {
                                    console.log('REDIS go room HIT: '+data);
                                    room = JSON.parse(data);
                                    update_room_who(redis_client, room, player, old_room,player_redis);
                                    enter_room(socket, room, player, player_redis, true);
                                    leave_room(socket, old_room, player,false); 
                                } else {
                                    console.log('REDIS go room MISS: '+new_room_id);
                                    fs.readFile('./realms/'+room.realm+'/rooms/'+room.exits[direction]+'.js', 'utf8', function(err, data) {
                                        if (err) {
                                            console.log('room load error - '+new_room_id+'.js');
                                        } else {
                                            eval(data);
                                            redis_client.set(new_room_id, JSON.stringify(room));
                                            update_room_who(redis_client, room, player, old_room,player_redis);
                                            enter_room(socket, room, player, player_redis, true);
                                            leave_room(socket, old_room, player, false);
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
                    room_id = room.realm + '/' + room.name;
                    rclient = redis_client;
                    if (room.realm == 'workshop') {
                        rclient = player_redis;
                    }
                    rclient.get(room_id, function(err, data) {
                        if (err) {
                            console.log('Command LOOK get room from redis error: '+err);
                        } else {
                            room = JSON.parse(data);
/*
                            in_room = '';
                            count = 0;
                            for (var key in room.who) {
                                in_room += key + ',';
                                count++;
                            }
                            in_room = in_room.slice(0,-1);  // rmeove last comma
                            */
                            socket.emit('update', command);
                            socket.emit('update', room.short);
                            socket.emit('update', room.long);
                            show_others_in_room(socket, room, player);
                            /*
                            if (count == 1) {
                                socket.emit('update', 'You are the only one here');
                            } else {
                                socket.emit('update', 'There are '+count+' players here: '+in_room);
                            }
                            */
                            show_exits(socket, room);
                            if (player.ninja_mode) {
                                socket.emit('update', 'You are in ninja mode!  "vis" to disable');
                            }
                        }
                    });
                }
                if (command === 'goto') {
                    if (tokens[0] === 'home') {
                        destination = 'workshop/'+player.name+'s_workshop';  // workshops are persisten, jus tlike players so use player_client (persistent redis db)
                        console.log(player.name + ' GOTO ' + destination);
                        player_redis.get(destination, function(err, data) {
                            old_room = room;
                            if (data) {
                                console.log('REDIS goto HIT: '+data);
                                room = JSON.parse(data);
                                update_room_who(redis_client, room, player, old_room,player_redis);
                                enter_room(socket, room, player, player_redis, true);
                                leave_room(socket, old_room, player, true); 
                            } else {
                                console.log('REDIS goto MISS: ' + destination);
                                fs.readFile('./realms/workshop/rooms/'+player.name+'s_workshop.js','utf8', function(err, data) {
                                    if (err) {
                                        console.log('FS goto load error:' + err);
                                    } else {
                                        if (data) {
                                            eval(data);
                                            player_redis.set(destination, JSON.stringify(room));
                                            update_room_who(redis_client, room, player, old_room,player_redis);
                                            enter_room(socket, room, player, player_redis, true);
                                            leave_room(socket, old_room, player, true); 
                                        } 
                                    }
                                });
                            }
                        });
                    } else {
                        if (typeof tokens[0] !== 'undefined') {
                            destination = tokens[0];
                            console.log(player.name + ' GOTO ' + destination);
                            redis_client.get(destination, function(err, data) {
                                old_room = room;
                                if (data) {
                                    console.log('REDIS goto HIT: '+data);
                                    room = JSON.parse(data);
                                    update_room_who(redis_client, room, player, old_room, player_redis);
                                    enter_room(socket, room, player, player_redis, true);
                                    leave_room(socket, old_room, player, true); 
                                } else {
                                    parts = destination.split('/',2);
                                    console.log('REDIS goto MISS '+ destination + parts.length);
                                    if (parts.length>1) {
                                        realm = parts[0];
                                        dest_room = parts[1];
                                        console.log('REDIS goto MISS: ' + realm + '/' + dest_room);
                                        fs.readFile('./realms/'+realm+'/rooms/'+dest_room+'.js','utf8', function(err, data) {
                                            if (err) {
                                                console.log('FS goto load error, maybe a player target? '+ err);
                                            } else {
                                                if (data) {
                                                    eval(data);
                                                    if (realm == 'workshop') {
                                                        player_redis.set(destination, JSON.stringify(room));
                                                    } else {
                                                        redis_client.set(destination, JSON.stringify(room));
                                                    }
                                                    update_room_who(redis_client, room, player, old_room, player_redis);
                                                    enter_room(socket, room, player, player_redis, true);
                                                    leave_room(socket, old_room, player, true); 

                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                }
                if (command === 'invis')  {
                    if (!player.ninja_mode) {
                        socket.emit('update','You suddenly vanish.  Anyone watching is unsure of their eyes now.');
                    }
                    player.ninja_mode = true;
                    room_id = room.realm + '/' + room.name;
                    socket.broadcast.to(room_id).emit('update', player.name + ' disappears in front of your eyes!');
                    player_redis.set(player.name, JSON.stringify(player));
                    room.who[player.name].ninja_mode = true;
                    if (room.realm == 'workshop') {
                        player_redis.set(room_id, JSON.stringify(room));
                    } else {
                        redis_client.set(room_id, JSON.stringify(room));
                    }
                }
                if (command === 'vis') {
                    if (player.ninja_mode) {
                        socket.emit('update','You suddenly appear in the room.  Everyone can see you!');
                    }
                    player.ninja_mode = false;
                    room_id = room.realm + '/' + room.name;
                    socket.broadcast.to(room_id).emit('update', player.name + ' suddenly appears!');
                    player_redis.set(player.name, JSON.stringify(player));
                    room.who[player.name].ninja_mode = false;
                    if (room.realm == 'workshop') {
                        player_redis.set(room_id, JSON.stringify(room));
                    } else {
                        redis_client.set(room_id, JSON.stringify(room));
                    }
                }
            } else {
                console.log('invalid command');
            }
        }
    });
};

function show_others_in_room(socket, room, player) {
    in_room = '';
    count = 0;
    invis = 0;
    for (var key in room.who) {
        if (room.who[key].ninja_mode && player.wizard) {
            in_room += key+' (invisible),';
            invis++;
        } else if (!room.who[key].ninja_mode) {
            in_room += key+',';
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
    } else {
    if (count == 1) {
            socket.emit('update', 'You are the only one here');
        } else {
            socket.emit('update', 'There are '+count+' players here: '+in_room);
        }
    }
}

function leave_room(socket, old_room, player, is_goto) {
    if (!player.ninja_mode) {
        if (is_goto) {
            socket.broadcast.to(old_room.realm+'/'+old_room.name).emit('update', player.name + ' disappears in a cloud of smoke.');
        } else {
            socket.broadcast.to(old_room.realm+'/'+old_room.name).emit('update', player.name + ' went '+ direction);
        }
    }
    socket.leave(old_room.realm+'/'+old_room.name);
}

function enter_room(socket, room, player, redis_client, update_redis) {
    room_id = room.realm+'/'+room.name;
    console.log('enter_room: '+room_id);
    socket.join(room_id);
    if (!player.ninja_mode) {
        socket.broadcast.to(room_id).emit('update', player.name + ' has arrived.');
    }
    socket.emit('update', room.short);
    socket.emit('update', room.long);
    show_others_in_room(socket, room, player);
    show_exits(socket, room);
    if (player.ninja_mode) {
        socket.emit('update', 'You are in ninja mode!  "vis" to disable');
    }
    if (update_redis) {
        console.log('Update player location');
        player = update_player_location(room, player);
        redis_client.set(player.name, JSON.stringify(player));
    }
}

function update_player_location(room, player) {
    player.location = room.realm+'/'+room.name;
    player.realm = room.realm;
    player.room_name = room.name;
    return player;
}

function update_room_who(redis_client, room, player, old_room,player_redis) {
    if (typeof room.who !== 'undefined') {
        room.who[player.name] = player;
    } else {
        room.who = { [player.name]: player };
    }
    room_id = room.realm + '/' + room.name;
    console.log('up[date_room '+room_id);
    if (room.realm == 'workshop') {
        player_redis.set(room_id, JSON.stringify(room));
    } else {
        redis_client.set(room_id, JSON.stringify(room));
    }
    if (old_room) {
        room_id = old_room.realm +'/' + old_room.name;
        try {
            delete old_room.who[player.name];
            redis_client.set(room_id, JSON.stringify(old_room));
        } catch(e) {
            console.log('error deleting '+player.name+' from '+room_id);
        }
    }
}

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

function show_exits(socket, room) {
    exits = '';
    for (var key in room.exits) {
        exits += key+',';
    }
    exits = exits.slice(0,-1);  // remove last comma
    socket.emit('update', 'You can go: ' + exits);
}

http.listen(2500);
