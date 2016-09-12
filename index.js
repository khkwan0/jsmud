var redis = require('redis');
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var cons = require('consolidate');
var io = require('socket.io')(http);
var path = require('path');
//var natural = require('natural');
var uuid = require('uuid');
var fs = require('fs');
var em = require('events');
var serve_index = require('serve-index');
var dir_tree = require('directory-tree');
var bodyParser = require('body-parser');
var config = require('./config');

app.engine('html',  cons.swig);
app.set('view engine', 'swig');
app.set('views', __dirname + '/views');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
app.use('/assets', express.static('assets'));
app.use('/realms', express.static('realms'));
app.use('/realms', serve_index('realms', {'icons':true}));

var attack_timeout = 1000;
var valid_commands = {
    'say':'say [something]'
    ,'go':'go [n/s/e/w/enter/leave]'
    ,'n/s/e/w/enter/leave':'a macro for go [n/s/e/w/enter/leave]'
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
    ,'wiz':'(Wizard only) - wizard [target player]: Grant a mortal the gift of godliness.'
    ,'demote':'(Wizard only) - demote [target player]: Remove wizard status immediately.'
    ,'dem':'(Wizard only) - demote [target player]: Remove wizard status immediately.'
    ,'dest': '(Wizard only) - dest [object/npc]: destroy an object or npc from the realms.'
    ,'destroy': '(Wizard only) - destroy: [object/npc]: destroy an object or npc from the realms.'
    ,'Look': 'Hard look (see objects and npcs hash id numbers.'
    ,'L': '(Wizard only) - Hard look.'
    ,'lwield': 'lwield <obj>: Wield an object or a weapon in your LEFT hand.'
    ,'rwield': 'rwield <obj>: Wield an object or a wepaon in yor RIGHT hand.'
    ,'lholster': 'Put away an object or weapon from your LEFT hand into your bag.'
    ,'rholster': 'Put away an object or weapon from your RIGHT hand into your bag.'
    ,'attack': 'attack <player|npc> <player name|npc name>.'
    ,'kill': 'kill <player|npc> <player name|npc name>: same as attack.'
    ,'slay': '(Wizard only) slay <player|npc> : instantly kill a player or npc (kill - not destroy)'
    ,'res': '(Wizard only) res <player|npc> : restore health back to max_hp.'
    ,'set': '(Wizard only) (SUPER WIZARD only): set server side variables.  dangerous!'
    ,'load': '(Wizard only): reload/load a room.  usage "load <realm>/<filename without the .js extension>"'
    ,'gender': 'set your gender.  You can only do this once on a new character.  gender <[male|female|it]>.'
    ,'quests': 'show your quest log.'
    ,'quest': 'show your quest log.'
    ,'q': 'show your quest log.'
    ,'stats': 'see your stats'
    ,'email': 'set recovery email'
    ,'passwd': 'change your passwd- usage:  passwd <new_password>'
    ,'logout': 'save and quit'
    ,'disconnect': 'save and quit'
    ,'quit': 'save and quit'
    ,'help':'This menu'
};
var player_list = {};
var obj_list = {};
var rooms = {};

var player_redis = redis.createClient();
var obj_redis = redis.createClient();
obj_redis.select(config.redis.obj_db);

http.listen(config.network.port);
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/cli2.html'));
});

app.get('/generate', function(req, res) {
    target = 'realms';
    tree = {};
    tree.isLeaf = 0;
    tree.dir = fs.readdirSync(target).filter(function(file) {
        return (fs.statSync(target+'/'+file).isDirectory())
        }).map(function(dir) {
            return dir;
        });
    console.log(tree);
    res.render('generate.html', {'tree':tree, 'to_edit':'realms','what':''});
});

app.get('/generate/:realm', function(req, res) {
    if (typeof req.params.realm!== 'undefined') {
        target = req.params.realm;
    } else {
        target = 'realms';
    }
    tree = {};
    tree.isLeaf = 0;
    tree.dir  = fs.readdirSync('realms/'+target).filter(function(file) {
        return (fs.statSync('realms/'+target+'/'+file).isDirectory())
        }).map(function(dir) {
            return target+'/'+dir;
        });
    res.render('generate.html', {'tree':tree,'to_edit':false,'what':''});
});

app.post('/realm_edit', function(req, res) {
    try {
        file = req.body.the_file;
    } catch(e) {
        console.log(e);
    }
    fs.readFile('realms/'+file, function(err, data) {
        try {
            if (!err) {
                eval('thing='+data);
                res.send(JSON.stringify(thing));
            } else {
                throw(err)
            }
        } catch(e) {
            console.log(e);
            res.send(e);
        }
    });
});

function get_opp(dir) {
    if (dir == 'n') return 's';
    if (dir == 's') return 'n';
    if (dir == 'e') return 'w';
    if (dir == 'w') return 'e';
    if (dir == 'enter') return 'exit';
    if (dir == 'exit') return 'enter';
    if (dir == 'ne') return 'sw';
    if (dir == 'se') return 'nw';
    if (dir == 'sw') return 'ne';
    if (dir == 'nw') return 'se';
    return null;
}

app.post('/save_entity', function(req, res) {
    try {
        new_entity = req.body.new_entity;
        filename = req.body.filename;
        realm = req.body.realm;
        what = req.body.what;
        var ent_type = '';
        result = {
            error:false,
            msg:'ok',
            tree: {}
            };
        if (what === 'rooms') {
            ent_type = 'room = ';
        }
        if (what === 'objs') {
            ent_type = 'obj = ';
        }
        fs.writeFile(filename, ent_type+new_entity, 'utf8',function(err) {
            if (err) {
                throw(err);
            } else {
                if (what === 'rooms') {
                    room = JSON.parse(new_entity);
                    if (room.exits) {
                        for (var dir in room.exits) {
                            tokens = room.exits[dir].split('/', 2);
                            to_realm = tokens[0];
                            to_room = tokens[1];
                            try {
                                fs.statSync('realms/'+to_realm+'/rooms/'+to_room+'.js');
                            } catch(e) {
                                opp_dir = get_opp(dir);
                                new_room = {
                                    'realm': to_realm,
                                    'name': to_room,
                                    'short': '',
                                    'long': '',
                                };
                                if (opp_dir) {
                                    new_room.exits = {};
                                    new_room.exits[opp_dir] = room.realm+'/'+room.name;
                                } else {
                                    new_room.exits = {}
                                }
                                try {
                                    fs.writeFileSync('realms/'+to_realm+'/rooms/'+to_room+'.js', 'room = '+JSON.stringify(new_room), 'utf8');
                                } catch(e) {
                                    result.error = true;
                                    result.msg = 'Looks like a problem writing to realm/'+to_realm+'/rooms/'+to_room+'.js  Does that realm exist?';
                                }
                            }
                        }
                    }
                }
                dir = fs.readdirSync('realms/'+realm+'/'+what).filter(function(file) {
                    return fs.statSync('realms/'+realm+'/'+what+'/'+file).isFile();
                }).map(function(file) {
                    return {
                        'full_path':realm+'/'+what+'/'+file,
                        'file': file
                    }
                });
                result.tree = dir;
                res.send(JSON.stringify(result));
            }
        });
    } catch(e) {
        console.log('xxx'+e);
        result = {
            error: true,
            msg: e
        }
        res.send(JSON.stringify(result));
    }
});

app.get('/generate/:realm/:what', function(req, res) {
    realm = '';
    what = '';
    if (typeof req.params.realm !== 'undefined' && req.params.what !== 'undefined') {
        realm = req.params.realm;
        what = req.params.what;
    }
    tree = {};
    tree.isLeaf = 1;
    tree.dir = fs.readdirSync('realms/'+realm+'/'+what).filter(function(file) {
            return fs.statSync('realms/'+realm+'/'+what+'/'+file).isFile();
        }).map(function(file) {
            return {
                'full_path':realm+'/'+what+'/'+file,
                'file': file
            }
        });
    res.render('generate.html', {'tree':tree, 'realm':realm, 'what':what});
});

function check_if_logged_in(socket) {
    // check if already connected
    for (var i in player_list) {
        if (player_list[i].socket_id === socket.id) {
            player_redis.set(player_list[i].name, JSON.stringify(player_list[i]));
            if (!player_list[i].ninja_mode) {
                socket.broadcast.to(player_list[i].location).emit('update', player_list[i].name + ' disconnected.');
                try {
                    delete rooms[player_list[i].location].who[player_list[i].id];
                } catch(e) {
                    debug(e);
                }
            }
            delete player_list[i];
        }
    }
}

io.on('connection', function(socket) {
        /*
    var player = {
        "id":null,
        "name":0,
        "alias":null,
        "gagged": false,
        "level": 1,
        "ghost": false,
        "hp":100,
        "max_hp": 100,
        "wizard": false,
        "super_wizard": false,
        "realm":"main",
        "room_name":"outside_ted",
        "location": "main/outside_ted",
        "ninja_mode": false,
        "ghost": false,
        "gender": "male",
        "money": 0,
        "email":'',
        "password":'',
        "xp":0,
        "inv": []
    }
    */
    player = {};

    player_redis.select(config.redis.player_db, function() {
        socket.on('login', function(msg) {
            args = JSON.parse(msg);
            player_name = args.args[0];
            password = args.args[1];
            if (typeof player_name !== 'undefined') {
                player_redis.get(player_name, function(err, data) {
                    if (data) {
                        player = JSON.parse(data);
                        console.log(player.password);
                        if (typeof player.password === 'undefined' || player.password == '' || player.password === password) {
                            check_if_logged_in(socket);
                            player.socket_id = socket.id;
                            if (!player.id) {
                                player.id = uuid.v4();
                            }
                            if (!player.alias) {
                                player.alias = player.name;
                            }
                            if (!player.gender) {
                                player.gender = null;
                                player.possessive_pronoun = 'their';
                                player.direct_object_pronoun = 'them';
                                player.subject_pronoun = player.name;
                            }
                            if (typeof player.xp === 'undefined') {
                                player.xp = 0;
                            }
                            player.inv = [];
                            player_list[player.id] = player;
                            if (!load_and_enter_room(socket, player, player.location, false, args)) {  // this can happen if a wizard screws up their code for the room and they are in it
                                load_and_enter_room(socket, player, 'main/outside_ted', false, args);
                            }
                        } else {
                            socket.emit('update','Incorrect password');
                            player = {};
                        }
                    } else {
                        // initialize new player
                        player.id = uuid.v4();
                        player.name = player_name;
                        if (typeof password !== 'undefined') {
                            player.password = password;
                        }
                        player.email = '';
                        player.alias = player.name;
                        player.gagged = false;
                        player.level = 1;
                        player.ghost = false;
                        player.hp = 100;
                        player.max_hp = 100;
                        player.socket_id = socket.id;
                        player.wizard = false;
                        player.realm = 'main';
                        player.room_name = 'outside_ted';
                        player.location = 'main/outside_ted';
                        player.ninja_mode = false;
                        player.ghost = false;
                        player.gender = null;
                        player.possessive_pronoun = 'their';
                        player.direct_object_pronoun = 'them';
                        player.subject_pronoun = player.name;
                        player.xp = 0;
                        player.money = 100;
                        player.quests = {};
                        player.quests.active = {};
                        player.quests.completed = {};
                        player.inv = [];

                        player_list[player.id] = player;
                        load_and_enter_room(socket, player, player.location, false, args);
                    }
                    debug(player.name + ' connected.');
                });
            } else {
                socket.emit('update','login <username> <password>');
                socket.emit('update','recover <username>');
            }
        });
        socket.on('disconnect', function() {
            if (typeof rooms[player.location] !== 'undefined') {
                try {
                    player_redis.set(player.name,JSON.stringify(player));
                    room = rooms[player.location];
                    room_id = room.realm + '/' + room.name;
                    socket.broadcast.to(room_id).emit('update', player.name + ' disconnected.');
                    delete room.who[player.id];
                    delete player_list[player.id];
                    if (room.realm === 'workshop') {
                        player_redis.set(room_id, JSON.stringify(room));
                    }
                } catch(e) {
                    debug('DISCONNECT: '+e);
                }
            }
        });
        socket.on('cmd', function(msg) {
            if (player.id) {
                debug(player.name+'('+player.id+')'+' '+msg);
                args = JSON.parse(msg);
                command = args.name;
                room_id = player.location;
                room = rooms[room_id];
                if (typeof valid_commands[command] !== 'undefined') {
                    if (command === 'load') {
                        if (typeof args.args[0] !== 'undefined') {
                            tokens = args.args[0].split('/',2);
                            realm = tokens[0];
                            file = tokens[1];
                            type = 'rooms';
                            if (type === 'rooms') {
                                try {
                                    if (typeof room.who === 'undefined') {
                                        room.who = {};
                                    }
                                    old_room = {};
                                    old_room.who = {};
                                    for (var player_id in room.who) {
                                       old_room.who[player_id] = room.who[player_id]; 
                                    }

                                    eval(fs.readFileSync('./realms/'+realm+'/rooms/'+file+'.js','utf8'));
                                    room.who = {};
                                    for (var player_id in old_room.who) {
                                        room.who[player_id] = old_room.who[player_id];
                                    }
                                    if (typeof room.start_npcs !== 'undefined') {
                                        multi = obj_redis.multi();
                                        room.npcs = {};
                                        idnums = [];
                                        for (var i in room.start_npcs) {
                                            multi.incr('npc_id', function(err, data) {
                                               idnums.push(data); 
                                            });
                                        }
                                        multi.exec(function() {
                                            index = 0;
                                            for (var i in room.start_npcs) {
                                                eval(fs.readFileSync('./realms/' + room.start_npcs[i] + '.js','utf8'));
                                                npc.id = npc.name+'#'+idnums[index];
                                                index++;
                                                if (typeof room.npcs === 'undefined') {
                                                    room.npcs = {};
                                                }
                                                // initialize events
                                                if (typeof npc.events !== 'undefined') {
                                                    npc.listener = new em();
                                                    for (var event_name in npc.events) {
                                                        npc.listener.on(event_name, function(event_name,npc_obj, player, args) {
                                                            if (npc_obj.hp > 0) {
                                                                npc_obj.events[event_name](npc_obj,player,args);
                                                            }
                                                        });
                                                    }
                                                }
                                                room.npcs[npc.id] = npc;
                                            }
                                            rooms[room.realm+'/'+room.name] = room;
                                            socket.emit('update', 'loaded: '+room.realm+'/'+room.name);
                                        });
                                    } else {
                                        rooms[room.realm+'/'+room.name] = room;
                                        //enter_room2(socket, player, room, magical, args);
                                        socket.emit('update', 'loaded: '+room.realm+'/'+room.name);
                                    }
                                } catch(e) {
                                    str = 'Problem loading '+ realm+'/'+file+ ' ' + e;
                                    socket.emit('update', str);
                                    debug(str);
                                }
                            }



                        } else {
                        }
                    }
                    if (command === 'say') {
                        if (!player.gagged) {
                            msg = args.rest;
                            debug(player.name + ' said ' + msg);
                            if (player.ghost) {
                                socket.emit('update', 'You tried to say "' + msg + '" but noone hears you.');
                            } else {
                                socket.emit('update', 'You said ' + msg);
                            }
                            if (player.ninja_mode) {
                                socket.broadcast.to(room_id).emit('update', 'A mysterious voice said ' + msg);
                            } else if (player.ghost) {
                                socket.broadcast.to(room_id).emit('update', 'You hear the wail of '+ player.alias);
                            } else {
                                socket.broadcast.to(room_id).emit('update', player.alias+ ' said ' + msg);
                            }
                        }
                    }
                    if (command === 'lol') {
                        if (!player.gagged) {
                            socket.emit('update','You guffaw out loud.');
                            if (player.ninja_mode) {
                                socket.broadcast.to(room_id).emit('update', 'You hear a mysterious laughter nearby.');
                            } else {
                                socket.broadcast.to(room_id).emit('update', player.name + ' laughs.');
                            }
                        }
                    }
                    if (command === 'bow') {
                        if (player.ninja_mode) {
                            socket.emit('update','Noone sees you do that.');
                        } else {
                            socket.emit('update','You take a deep bow.');
                            socket.broadcast.to(room_id).emit('update', player.name + ' takes a bow.');
                        }
                    } 
                    if (command === 'clap') {
                        socket.emit('update','CLAP! CLAP! CLAP!');
                        if (player.ninja_mode) {
                            socket.broadcast.to(room_id).emit('update', 'You hear a round of applause form seeemingly nowhere.');
                        } else {
                            socket.broadcast.to(room_id).emit('update', player.name + ' gives a round of applause');
                        }
                    } 
                    if (command === 'wave') {
                        socket.emit('update','You wave your hand.');
                        if (player.ninja_mode) {
                            socket.emit('update','Noone sees you do that.');
                        } else {
                            socket.broadcast.to(room_id).emit('update', player.name + ' waves '+player.possessive_pronoun+ ' hand!');
                        }
                    } 
                    if (command === 'emote') {
                        if (!player.gagged) {
                            msg = args.rest;
                            socket.emit('update', 'You ' + msg);
                            socket.broadcast.to(room_id).emit('update', player.name + ' ' + msg);
                        }
                    }
                    if (command === 'look' || command === 'l') {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            var match = 0;
                            var to_emote = '';
                            if (typeof room.npcs !==  'undefined') {
                                for (var i in room.npcs) {
                                    if (target.toLowerCase() === room.npcs[i].name.toLowerCase() || target.toLowerCase() === i) {
                                        to_emote = room.npcs[i].desc;
                                        match++;
                                        if (!player.ninja_mode) {
                                            socket.broadcast.to(room_id).emit('update', player.name + ' examines ' + target);
                                        }
                                    }
                                }
                            }
                            if (typeof room.who !== 'undefined') {
                                target_player = null;
                                for (var player_id in room.who) {
                                    if (room.who[player_id].name.toLowerCase() === target.toLowerCase()) {
                                        target_player = room.who[player_id];
                                        socket.emit('update', target+' is a(n) '+target_player.gender);
                                        show_inventory2(socket, target_player);
                                        match++;
                                        if (!player.ninja_mode) {
                                            socket.broadcast.to(room_id).emit('update', player.name + ' examines ' + target);
                                        }
                                    }
                                }
                            } 
                            if (typeof room.inv !== 'undefined') {
                                target_obj = null;
                                for (var obj_id in room.inv) {
                                    if (room.inv[obj_id].name === target.toLowerCase() || obj_id.toLowerCase() === target.toLowerCase()) {
                                        target_obj = room.inv[obj_id];
                                        if (!target_obj.invisible || player.wizard) {
                                            to_emote = target_obj.short+'\n'+target_obj.long;
                                            match++;
                                            if (!player.ninja_mode && !target_obj.invisible) {
                                                socket.broadcast.to(room_id).emit('update', player.name + ' examines ' + target);
                                            }
                                        }
                                    }
                                }
                            }
                            if (typeof player.inv !== 'undefined') {
                                target_obj = null;
                                for (var i in player.inv) {
                                    obj_id = player.inv[i];
                                    if (obj_list[obj_id].name === target.toLowerCase() || obj_list.toLowerCase() === target.toLowerCase()) {
                                        target_obj = obj_list[obj_id];
                                        if (!target_obj.invisible || player.wizard) {
                                            to_emote = obj_id +'\n';
                                            to_emote += target_obj.short+'\n'+target_obj.long;
                                            match++;
                                            if (!player.ninja_mode && !target_obj.invisible) {
                                                socket.broadcast.to(room_id).emit('update', player.name + ' examines ' + target);
                                            }
                                        }
                                    }
                                }
                            }
                            if (match > 1) {
                                socket.emit('update', 'There are '+ match + ' objects/npcs or players that match what you are asking to look at.  You can specify objects and npcs with their hash(#) id\'s.');
                            } else {
                                socket.emit('update', to_emote);
                            }
                        } else {
                            do_look(socket, room, player, false);
                            if (player.ninja_mode) {
                                socket.emit('update', 'You are in ninja mode!  "vis" to disable');
                            } else {
                                socket.broadcast.to(room_id).emit('update', player.name+' looks at '+player.possessive_pronoun+' surroundings.');
                            }
                        }
                    }
                    if (command === 'Look' || command === 'L') {
                        do_look(socket, room, player, true);
                        if (player.ninja_mode) {
                            socket.emit('update', 'You are in ninja mode!  "vis" to disable');
                        }
                    }
                    if (command === 'who' || command === 'W') {
                        plist = get_player_list(player);
                        socket.emit('update',plist.p_list);
                        socket.emit('update',plist.total_count + ' players online.');
                    }
                    if (command === 'i' || command === 'inv' || command === 'inventory') {
                        show_inventory2(socket, player);
                        if (!player.ninja_mode) {
                            socket.broadcast.to(room_id).emit('update', player.name+' checks '+player.possessive_pronoun+' belongings.');
                        }
                    }
                    if (command === 'vis' && player.wizard) {
                        if (player.ninja_mode) {
                            socket.emit('update','You suddenly appear in the room.  Everyone can see you!');
                            player.ninja_mode = false;
                            socket.broadcast.to(room_id).emit('update', player.name + ' suddenly appears!');
                            player_redis.set(player.name, JSON.stringify(player));
                            room.who[player.id].ninja_mode = false;
                            if (room.realm == 'workshop') {
                                player_redis.set(room_id, JSON.stringify(room));
                            }
                        }
                    }
                    if (command === 'invis'  && player.wizard)  {
                        if (!player.ninja_mode) {
                            socket.emit('update','You suddenly vanish.  Anyone watching is unsure of their eyes now.');
                            player.ninja_mode = true;
                            socket.broadcast.to(room_id).emit('update', player.name + ' disappears in front of your eyes!');
                            player_redis.set(player.name, JSON.stringify(player));
                            room.who[player.id].ninja_mode = true;
                            if (room.realm == 'workshop') {
                                player_redis.set(room_id, JSON.stringify(room));
                            }
                        }
                    }
                    if (command === 'goto' && player.wizard) {
                        dest = '';
                        if (typeof args.args[0] !== 'undefined') {
                            target =  args.args[0];
                            if (target === 'home') {
                                dest = 'workshop/'+player.name+'s_workshop';
                            } else {
                                for (var i in player_list) {
                                    if (target === player_list[i].name) {
                                        dest = player_list[i].location;
                                        break;
                                    }    
                                }
                                if (dest.length < 1) {  // did not find a player target destination
                                    dest = target;  // maybve it's a room loation, so let's see if it's loaded
                                }
                            }
                            exit_msg ='disappear\'s in a puff of smoke!';
                            move_player2(socket, player, dest, exit_msg, true, args);
                        } else {
                            socket.emit('update','goto usage: goto <player| [realm]/[room_name]>');
                        }
                    }
                    if (command === 'tele' && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            target_player = null;
                            for (var i in player_list) {
                                if (player_list[i].name === target) {
                                    target_player = player_list[i];
                                    break;
                                }
                            }
                            if (target_player) {
                                if (typeof args.args[1] !== 'undefined') {
                                    dest = args.args[1];
                                } else {
                                    dest = player.location;
                                }
                                exit_msg = 'disappear\'s in a puff of smoke!';
                                target_socket = io.sockets.connected[target_player.socket_id];
                                if (!move_player2(target_socket, target_player, dest, exit_msg, true, args)) {
                                    socket.emit('update','Problem teleporting '+target+' to '+dest);
                                }
                            }
                        } else {
                            socket.emit('update','tele usage: tele <player> to your location.');
                        }
                    }
                    if (command === 'go') {
                        if (typeof args.args[0] !== 'undefined') {
                            direction = args.args[0];
                            if (typeof room.exits!='undefined' && (direction in room.exits)) {
                                dest = room.exits[direction];
                                exit_msg = 'goes '+direction;
                                move_player2(socket, player, dest, exit_msg, false, args);
                            } else {
                                socket.emit('update','You cannot go that way.');
                            }
                        } else {
                            debug('Client problem.  This is not supposed to happen');
                        }
                        
                    }
                    if ((command === 'wiz' || command === 'wizard') && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            found = false;
                            for (var i in player_list) {
                                if (player_list[i].name === target) {
                                    found = true;
                                    if (!player_list[i].wizard) {
                                        player_list[i].wizard = true;
                                        player_redis.set(player_list[i].name, JSON.stringify(player_list[i]));
                                        socket.emit('update', target+' now has wizard powers.');
                                        io.sockets.connected[player_list[i].socket_id].emit('update', player.name+' has granted you wizard powers!');
                                    }
                                    break;
                                }
                            }
                            if (!found) {
                                socket.emit('update', target+' not found.');
                            }
                        } else {
                            socket.emit('update','wizard usage: <wiz|wizard> [target]');
                        }
                    }
                    if ((command === 'dem' || command === 'demote') && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            found = false;
                            for (var i in player_list) {
                                if (player_list[i].name === target) {
                                    found = true;
                                    if (player_list[i].wizard) {
                                        player_list[i].wizard = false;
                                        player_redis.set(player_list[i].name, JSON.stringify(player_list[i]));
                                        socket.emit('update', target+' now has NO wizard powers.');
                                        io.sockets.connected[player_list[i].socket_id].emit('update', player.name+' has REMOVED your wizard powers!');
                                    }
                                    break;
                                }
                            }
                            if (!found) {
                                socket.emit('update', target+' not found.');
                            }
                        } else {
                            socket.emit('update','demote usage: <dem|demote> [target]');
                        }
                    }
                    if ((command === 'spawn'  || command === 'spwan') && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            tokens = args.args[0].split('/', 2);
                            realm = tokens[0];
                            filename = tokens[1];
                            try {
                                eval(fs.readFileSync('./realms/'+realm+'/objs/'+filename+'.js', 'utf8'));
                                obj_redis.incr('objs', function(err, val) {
                                    obj.id = obj.name+'#'+val;
                                    obj.location = { 'player': player.id };
                                    str = 'Loaded '+args.args[0]+' name: '+obj.name+' alias: '+obj.alias;
                                    socket.emit('update',str);
                                    obj_list[obj.id] = obj;
                                    if (typeof player.inv === 'undefined') {
                                        player.inv = [];
                                    }
                                    an_obj = {
                                        'id': obj.id,
                                        'origin': obj.origin
                                    }
                                    player.inv.push(an_obj);
                                    player_redis.set(player.name, JSON.stringify(player),function() {
                                        show_inventory2(socket, player);
                                    });
                                });
                            } catch(e) {
                                socket.emit('update', 'Could not spawn '+args.args[0]);
                                socket.emit('update', 'try spawn <realm>/<object>: for example "spawn main/knife"');
                                debug('SPAWN: '+e);
                            }
                        } else {
                            socket.emit('update','spawn usage:  spawn <[realm]/[filename]> (exclude .js in [filename].');
                        }
                    }
                    if ((command === 'dest' || command === 'destroy') && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            found = false;
                            if (typeof room.npcs !=='undefined' && typeof room.npcs[target] !=='undefined') {  // destroy an npc
                                found = true;
                                if (!player.ninja_mode) {
                                    socket.broadcast.to(room_id).emit('update',player.name+ ' conjures a miniature black hole.  The black hole swallows '+room.npcs[target].alias+ ' and disappears.');
                                } else {
                                    socket.broadcast.to(room_id).emit('update','A miniature black hole appears out of nowhere.  The black hole swallows '+room.npcs[target].alias+ ' and disappears.');
                                }
                                socket.emit('update', 'You destroyed '+target);
                                delete room.npcs[target];
                            }
                            if (!found && typeof room.inv !== 'undefined') { // check objects in the room
                                for (var i in room.inv) {
                                    if (room.inv[i].id == target) {
                                        delete obj_list[room.inv[i].id];
                                        room.inv.splice(i,1);
                                        if (!player.ninja_mode) {
                                            socket.broadcast.to(room_id).emit('update', player.name+ ' shoots a small jet of blue flame towards '+target+'.  '+target+' disappears in a puff of black smoke.  The acrid smell of smoke dissipates.');
                                        } else {
                                            socket.broadcast.to(room_id).emit('update', target+' starts to hover in the air and shakes violently.  Suddenly it disppears.');
                                        }
                                        socket.emit('update','You destroyed '+target);
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if (!found && typeof player.inv !== 'undefined') { // finally check the players inventory
                                for (var i in player.inv) {
                                    if (player.inv[i].id === target) {
                                        delete obj_list[player.inv[i].id];
                                        player.inv.splice(i,1);
                                        socket.emit('update', 'You destroyed '+target);
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if (!found) {
                                socket.emit('update','Could not find '+target);
                            } else {
                                player_redis.set(player.name, JSON.stringify(player));
                            }
                        } else {
                            socket.emit('update','dest usage: dest <[obj.name]|npc.name]>');
                        }
                    }
                    if (command === 'drop') {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            match = 0;
                            obj_target = null;
                            var match_key = null;
                            to_splice = -1;

                            // supports targetting by name or hashid.  have to check if there are muiltiple  objects with the same name
                            for (var i in player.inv) {
                                obj_id = player.inv[i].id;
                                if (obj_list[obj_id].name.toLowerCase() === target.toLowerCase() || obj_id.toLowerCase() === target.toLowerCase()) {
                                    match++;
                                    obj_target = obj_list[obj_id];
                                    match_key = obj_id;
                                    to_splice = i;
                                }
                            }

                            // since there is only 1 object in inventory with a uniquie name, drop it, else require a hash id
                            if (match == 1) {
                                obj_target.location = {'room':room_id};
                                if (typeof room.inv === 'undefined') {
                                    room.inv = [];
                                }
                                room.inv.push(player.inv[to_splice]);
                                player.inv.splice(to_splice, 1);
                                if (player.ninja_mode) {
                                    socket.broadcast.to(room.realm+'/'+room.name).emit('update', target+' appears out of nowhere.');
                                } else {
                                    socket.broadcast.to(room.realm+'/'+room.name).emit('update', player.name +' dropped '+target);
                                }
                                socket.emit('update','You dropped '+match_key);
                                player_redis.set(player.name, JSON.stringify(player));
                                if (room.realm === 'workshop') {
                                    player_redis.set(room_id, JSON.stringify(room));
                                }
                            } else {
                                if (match == 0) {
                                    socket.emit('update', target+' not found.');
                                } else {
                                    socket.emit('update', 'Which '+target+ '?  Try using drop hashid (example, drop knife#89)');
                                }
                            }
                        } else {
                            socket.emit('update', 'drop usage: drop <[obj.name]> from your inventory.');
                        }
                    }
                    if (command === 'get') {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            match = 0;
                            match_key = null;
                            target_obj = null;
                            for (var i in room.inv) {
                                if (obj_list[room.inv[i].id].name.toLowerCase() === target.toLowerCase() || room.inv[i].id.toLowerCase() === target.toLowerCase()) {
                                    match++;
                                    match_key = i;
                                    target_obj = obj_list[room.inv[i].id];
                                }
                            }
                            if (target_obj && match == 1) {
                                if (target_obj.can_get) {
                                    target_obj.location = {'player':player.id};
                                    player.inv.push(room.inv[match_key]);
                                    room.inv.splice(match_key,1);
                                    socket.emit('update','You picked up '+target+' and placed it in your inventory');
                                    if (player.ninja_mode) {
                                        socket.broadcast.to(room.realm+'/'+room.name).emit('update', target +' appears to float in the air then disappears.');
                                    } else {
                                        socket.broadcast.to(room.realm+'/'+room.name).emit('update', player.name + ' picked up '+target);
                                    }
                                    player_redis.set(player.name, JSON.stringify(player));
                                    if (player.realm === 'workshop') {
                                            player_redis.set(room.realm +'/'+ room.name, JSON.stringify(room));
                                    }
                                } else {
                                    socket.emit('update','You cannot pick up '+target+'.');
                                }
                            } else {
                                socket.emit('update',' Which '+ target+'?  Try using the hash id, for example "get knife#66"');
                            }
                        } else {
                            socket.emit('update', 'get usage: get <[obj.name]> and place into your inventory.');
                        }
                    }
                    if (command === 'res' && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            found = false;
                            target = args.args[0];
                            for (var i in player_list) {
                                if (player_list[i].name === target) {
                                    player_list[i].hp = player_list[i].max_hp;
                                    player_list[i].alias = player_list[i].name;
                                    player_list[i].ghost = false;
                                    target_socket = io.sockets.connected[player_list[i].socket_id];
                                    if (player.ninja_mode) {
                                        target_socket.emit('update', 'You have been restored to full health.  You LIVE!.');
                                    } else {
                                        target_socket.emit('update', player.name+ ' restored you to full health.  You LIVE!');
                                    }
                                    found = true;
                                    target_socket.emit('prompt', target + '('+player_list[i].hp+'/'+player_list[i].max_hp+'):'+player_list[i].location+'> ');
                                    socket.emit('update', 'You restored '+target+' to full health.');
                                    player_redis.set(target, JSON.stringify(player_list[i]));
                                    break;
                                }
                            }
                            if (!found) {
                                socket.emit('update',target+' not found.');
                            }
                        } else {
                            socket.emit('update','res usage: res <player|npc>');
                        }
                    }
                    if (command === 'gender') {
                        if (typeof args.args[0] !== 'undefined') {
                            if (typeof player.gender !== 'undefined' && player.gender != null && !player.wizard) {
                                socket.emit('update', 'You are a(n): '+player.gender+'.  You cannot change this without seeing a surgeon (or a wizard).');
                            } else {
                                sex = args.args[0];
                                if (sex === 'male' || sex ==='female' || sex==='it') {
                                    player.gender = sex;
                                    if (sex === 'male') {
                                        player.possessive_pronoun = 'his';
                                        player.direct_object_pronoun = 'him';
                                        player.subject_pronoun = 'he';
                                    } else if (sex === 'female') {
                                        player.possessive_pronoun= 'her';
                                        player.direct_object_pronoun = 'her';
                                        player.subject_pronoun = 'she';
                                    } else {
                                        player.possessive_pronoun= 'its';
                                        player.direct_object_pronoun = 'it';
                                        player.subject_pronoun = 'it';
                                    }
                                    socket.emit('update','You are now a(n): '+sex);
                                    player_redis.set(player.name, JSON.stringify(player));
                                } else {
                                    socket.emit('update', 'try: "gender male" or "gender female" or "gender it" (without the quotes)');
                                }
                            }
                        } else {
                            socket.emit('update', 'You are a(n): '+player.gender+'.  You cannot change this without seeing a surgeon (or a wizard).');
                        }
                    }
                    if (command === 'attack' || command === 'kill' ) {
                        if (typeof args.args[0] !== 'undefined') {
                            if (typeof args.args[1] !== 'undefined') {
                                if (!player.ghost) {
                                    target = args.args[1];
                                    target_type = args.args[0];
                                    if (target_type==='npc' ||  target_type==='player') {
                                        if (target_type === 'npc') {  // PVE
                                            if (typeof room.npcs !== 'undefined') {
                                                for (var npc_name in room.npcs) {
                                                    if (room.npcs[npc_name].alias.toLowerCase() === target.toLowerCase()) {
                                                        player_dam = 500;
                                                        npc_dam = 10;
                                                        alias = room.npcs[npc_name].alias;
                                                        already_attacking = false;
                                                        if (typeof room.npcs[npc_name].attackers === 'undefined') {
                                                            room.npcs[npc_name].attackers = [];
                                                        }
                                                        for (var i in room.npcs[npc_name].attackers) {
                                                            if (room.npcs[npc_name].attackers[i].id === player.id) {
                                                                already_attacking = true;
                                                            }
                                                        }
                                                        if (!already_attacking) {
                                                            room.npcs[npc_name].attackers.push(player);
                                                            room.npcs[npc_name].hp -= player_dam;
                                                            socket.broadcast.to(room_id).emit('update',player.name+ ' attacks '+alias+' for '+player_dam+' hitpoints. ('+room.npcs[npc_name].hp+'/'+room.npcs[npc_name].max_hp+')');
                                                            socket.emit('update','You attack '+alias+' for '+player_dam+' hitpoints. ('+room.npcs[npc_name].hp+'/'+room.npcs[npc_name].max_hp+')');
                                                            if (room.npcs[npc_name].attackers.length== 1) {
                                                                if (typeof room.npcs[npc_name].timers === 'undefined') {
                                                                    room.npcs[npc_name].timers = {};
                                                                }
                                                                if (typeof room.npcs[npc_name].timers['attack_timers'] === 'undefined') {
                                                                    room.npcs[npc_name].timers['attack_timer'] = setInterval(function() {
                                                                        try {
                                                                            if (typeof room.npcs[npc_name] !== 'undefined') {
                                                                            idx = Math.floor(Math.random() * room.npcs[npc_name].attackers.length);
                                                                            chosen_player = room.npcs[npc_name].attackers[idx];
                                                                            chosen_player.hp -= npc_dam;
                                                                            combat_socket = io.sockets.connected[chosen_player.socket_id];
                                                                            combat_socket.broadcast.to(room_id).emit('update', alias + ' hits ' + chosen_player.name.toUpperCase()+ ' for ' + npc_dam + ' hitpoints!');
                                                                            combat_socket.emit('update', alias + ' hits you for '+ npc_dam + ' hitpoints!');
                                                                            combat_socket.emit('prompt',chosen_player.name+' ('+chosen_player.hp+'/'+chosen_player.max_hp+'):'+room_id+'> ');
                                                                            if (chosen_player.hp<1) {
                                                                                room.npcs[npc_name].attackers.splice(idx,1);
                                                                                debug(room.npcs[npc_name].attackers.length);
                                                                                combat_socket.emit('update', 'You were slain by '+room.npcs[npc_name].alias);
                                                                                combat_socket.broadcast.to(room_id).emit('update', room.npcs[npc_name].alias + ' kills '+chosen_player.name);
                                                                                ghost_player(chosen_player);
                                                                            }
                                                                            for (var x in room.npcs[npc_name].attackers) {
                                                                                room.npcs[npc_name].hp -= player_dam;
                                                                                attacker_name = room.npcs[npc_name].attackers[x].name;
                                                                                indy_socket = io.sockets.connected[room.npcs[npc_name].attackers[x].socket_id];
                                                                                indy_socket.broadcast.to(room_id).emit('update',attacker_name+ ' attacks '+alias+' for '+player_dam+' hitpoints. ('+room.npcs[npc_name].hp+'/'+room.npcs[npc_name].max_hp+')');
                                                                                indy_socket.emit('update','You attack '+alias+' for '+player_dam+' hitpoints. ('+room.npcs[npc_name].hp+'/'+room.npcs[npc_name].max_hp+')');
                                                                            }
                                                                            io.sockets.in(room_id).emit('update','--------------------------------');
                                                                            if (room.npcs[npc_name].hp <= 0) {
                                                                                io.sockets.in(room_id).emit('update',npc_name + ' has been slain.');
                                                                                spawn_obj_in_room('main/corpse', room_id, 'Corpse of '+npc_name);
                                                                                clearInterval(room.npcs[npc_name].timers['attack_timer']);
                                                                                num_attackers = room.npcs[npc_name].attackers.length;
                                                                                xp = room.npcs[npc_name].level * 10;
                                                                                base_xp_given = Math.floor(xp/num_attackers);
                                                                                for (var i in room.npcs[npc_name].attackers) {
                                                                                    attacker = get_player_by_name(room.npcs[npc_name].attackers[i].name);
                                                                                    diff_level = attacker.level - room.npcs[npc_name].level;
                                                                                    diff_level -= 2;
                                                                                    if (diff_level<2) {
                                                                                        diff_level = 0;
                                                                                    }
                                                                                    xp_given = Math.floor(base_xp_given * (1-20*diff_level/100));
                                                                                    if (xp_given <0 ) {
                                                                                        xp_given = 0;
                                                                                    }
                                                                                    add_exp(player, xp_given);
                                                                                }
                                                                                delete room.npcs[npc_name];
                                                                            }
                                                                            if (typeof room.npcs[npc_name] !== 'undefined' && room.npcs[npc_name].attackers.length<1) {
                                                                                clearInterval(room.npcs[npc_name].timers['attack_timer']);
                                                                            }
                                                                            player_redis.set(chosen_player.name, JSON.stringify(chosen_player));
                                                                            }
                                                                        } catch(e) {
                                                                            debug('ATTACK'+e + new Error().stack);
                                                                        }
                                                                    }, attack_timeout);
                                                                }
                                                            }
                                                        } else {
                                                            socket.emit('update', 'You are already attacking '+alias);
                                                        }

                                                        break;
                                                    }
                                                }
                                            }
                                        } else {  // PK!
                                            target_player = get_player_by_name(target);
                                            if (target_player) {
                                                if (target_player.location === player.location) {
                                                    if (!player.ghost) {
                                                        if (!target_player.ghost) {
                                                            // todo


                                                        } else {
                                                            socket.emit('update', target + ' is already dead.  You can\t attack a ghost.');
                                                        }
                                                    } else {
                                                        socket.emit('update', "You're already dead,  Ghosts cannot attack.");
                                                    }
                                                } else {
                                                    socket.emit('update', target + 'is not here.');
                                                }
                                            } else {
                                                socket.emit('update', target + ' is not here.');
                                            }
                                        }
                                    } else {
                                        socket.emit('update', '[attack|kill] usage: [attack|kill] [player|npc] <target>.');
                                    }
                                } else {
                                    socket.emit('update', "You're already dead,  Ghosts cannot attack.");
                                }
                            }
                            else {
                                socket.emit('update', '[attack|kill] usage: [attack|kill] [player|npc] <target>.');
                            }
                        } else {
                            socket.emit('update', '[attack|kill] usage: [attack|kill] [player|npc] <target>.');
                        }
                    }
                    if (command === 'slay' && player.wizard) {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            found = false;
                            for (var i in player_list) {
                                if (player_list[i].name === target) {
                                    if (!player_list[i].ghost) {
                                        target_player = player_list[i];
                                        target_player.hp = 0;
                                        target_socket = io.sockets.connected[target_player.socket_id];
                                        target_socket.emit('update', 'A bolt of lightning comes down and smites you dead!');
                                        target_socket.broadcast.to(target_player.location).emit('update', 'A bolt of lightning comes down and smites '+target+' dead!');
                                        socket.emit('update','You have smited '+target);
                                        ghost_player(target_player);
                                    } else {
                                        socket.emit('update',target+' is already dead.');
                                    }
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                socket.emit('update', 'Cannot find '+target);
                            }
                        } else {
                            console.emit('update','slay usage: slay <[player|npc]>');
                        }
                    }
                    if (command === 'logout' || command ==='quit' || command ==='disconnect') {
                        socket.emit('loopback', 'disconnect');
                    }
                    if (command === 'set' && player.super_wizard) {
                        rcon = args.rest;
                        socket.emit('update', args.rest);
                        eval(args.rest);
                    }
                    if (command === 'quests' || command === 'q' || command =='quest') {
                        if (typeof args.args[0] !== 'undefined') {
                            target = args.args[0];
                            if (typeof player.quests.active[target] !== 'undefined') {
                                str = '*-*-* Active Quest: '+target+' *-*-*-\n';
                                str += player.quests.active[target].alias + '\n';
                                str += player.quests.active[target].name + '\n';
                                str += player.quests.active[target].desc+'\n';
                            } else if (typeof player.quests.completed[target] !== 'undefined') {
                                str = '*-*-* Completed Quest: '+target+' *-*-*-\n';
                                str += player.quests.completed[target].alias + '\n';
                                str += player.quests.completed[target].name + '\n';
                                str += player.quests.completed[target].desc+'\n';
                            } else {
                                str = 'Could not find '+target+' in your quest log.';
                            }
                            socket.emit('update', str);
                        } else {
                            if (typeof player.quests !== 'undefined') {
                                str = '*-*-*-*-*-*-*-*-* QUESTS *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\n';
                                str += 'To see details a specifix quest: try "quest <quest id>"\n';
                                str += 'The shortcut \'q <quest id>\' works too.\n';
                                str += 'Active quests:\n\n';
                                for (var i in player.quests.active) {
                                    str += 'Quest ID: '+ i+'\n';
                                }
                                str += '\n-------------------------------------------------------\n';
                                str += 'Completed quests:\n';
                                for (var i in player.quests.completed) {
                                    str += i;
                                }
                                str += '\n';
                                str += '*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-';
                                socket.emit('update', str);
                            } else {
                                player.quests = {};
                                player.quests.ative = {};
                                player.quests.completed = {};
                                player_redis.set(player.name, JSON.stringify(player));
                            }
                        }
                    }
                    if (command === 'stats') {
                        str = 'Alias/Name: '+player.alias+'/'+player.name;
                        str += '\nID: '+player.id;
                        str += '\nLEVEL: '+player.level;
                        str += '\nHP: '+player.hp;
                        str += '\nMAX HP: '+player.max_hp;
                        str += '\nXP: '+player.xp;
                        str += '\nGENDER: '+player.gender;
                        socket.emit('update', str);
                    }
                    if (command === 'email') {
                        if (typeof args.args[0] !== 'undefined') {
                            player.email = args.args[0];
                            player_redis.set(player.name, JSON.stringify(player));
                            socket.emit('update','Email: '+player.email);
                        } else {
                            socket.emit('update','Email: '+player.email);
                        }
                    }
                    if (command === 'passwd') {
                        if (typeof args.args[0] != 'undefined') {
                            player.password = args.args[0];
                            player_redis.set(player.name, JSON.stringify(player), function(err) {
                                if (err) {
                                    socket.emit('update', 'passwd update err: '+err);
                                    debug(err);
                                } else {
                                    socket.emit('update','updated password');
                                }
                            });
                        } else {
                            socket.emit('update','usage: passwd <new_password>');
                        }
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
                    for (var i in room.npcs) {
                        if (typeof room.npcs[i].listener !== 'undefined') {
                            room.npcs[i].listener.emit(command, command, room.npcs[i], player, args);
                        }
                    }
                } else {
//                    socket.emit('update', 'Invalid command.');
                    for (var i in room.npcs) {
                        if (typeof room.npcs[i].listener !== 'undefined') {
                            room.npcs[i].listener.emit(command, command, room.npcs[i], player, args);
                        }
                    }
                }
            }
        });
    });
});

function get_player_by_name(player_name) {
    target = null;
    for (var pid in player_list) {
        if (player_list[pid].name === player_name) {
            target = player_list[pid];
            break;
        }
    }
    return target;
}

function spawn_obj_in_room(file, room_location, new_alias) {
    obj = {};
    try {
        obj_redis.incr('objs', function(err, val) {
            if (err) {
                debug('SPAWN_OBJ_IN_ROOM redis incr ERROR'+ err);
            } else {
                tokens = file.split('/',2);
                realm = tokens[0];
                obj_file = tokens[1];
                file_data = fs.readFileSync('./realms/'+realm+'/objs/'+obj_file+'.js', 'utf8');
                eval(file_data);
                obj.id = obj.name+'#'+val;
                if (typeof rooms[room_location] === 'undefined') {  // room hasn't been loaded yet
                    load_room(room_location);
                }
                if (typeof rooms[room_location].inv === 'undefined') {
                    rooms[room_location].inv = [];
                }
                if (new_alias) {
                    obj.alias = new_alias;
                }
                rooms[room_location].inv.push(obj);
                obj.location = {'room':room_location};
                obj_list[obj.id] = obj;
            }
        });
    } catch(e) {
        debug('SPAWN_OBJ_IN_ROOM: '+e);
    }
    return obj;
}

function ghost_player(dead_player) {
    dead_player.ghost = true;
    dead_player.alias = 'Ghost of '+ dead_player.name;
    dp_socket = io.sockets.connected[dead_player.socket_id];
    dp_socket.emit('prompt', dead_player.name+' (GHOST) (0/'+dead_player.max_hp+'):'+dead_player.location+'> ');
    spawn_obj_in_room('main/corpse', dead_player.location, dead_player.name+"'s corpse");
}

function move_player2(socket, player, dest, exit_msg, magical, args) {
    old_location = player.location;
    socket.leave(old_location);
    rv = false;
    rv = load_and_enter_room(socket, player, dest, magical, args);
    if (rv) {
        delete rooms[old_location].who[player.id];
        if (!player.ninja_mode) {
            socket.broadcast.to(old_location).emit('update', player.name+' '+ exit_msg);
        }
    }
    return rv;
}

function load_and_enter_room(socket, player, dest, magical, args) {
    rv = false;
    if (typeof rooms[dest] !== 'undefined') {
        room = rooms[dest];
        enter_room2(socket, player, room, magical, args);
        rv = true;
    } else {
        area = dest.split('/',2);
        realm = area[0];
        room_name = area[1];
        debug('LOAD room:' + realm+'/'+room_name);
        try {
            eval(fs.readFileSync('./realms/'+realm+'/rooms/'+room_name+'.js','utf8'));
            if (typeof room.start_npcs !== 'undefined') {
                multi = obj_redis.multi();
                room.npcs = {};
                idnums = [];
                for (var i in room.start_npcs) {
                    multi.incr('npc_id', function(err, data) {
                       idnums.push(data); 
                    });
                }
                multi.exec(function() {
                    index = 0;
                    for (var i in room.start_npcs) {
                        eval(fs.readFileSync('./realms/' + room.start_npcs[i] + '.js','utf8'));
                        npc.id = npc.name+'#'+idnums[index];
                        index++;
                        if (typeof room.npcs === 'undefined') {
                            room.npcs = {};
                        }
                        // initialize events
                        if (typeof npc.events !== 'undefined') {
                            npc.listener = new em();
                            for (var event_name in npc.events) {
                                npc.listener.on(event_name, function(event_name,npc_obj, player, args) {
                                    if (npc_obj.hp > 0) {
                                        npc_obj.events[event_name](npc_obj,player,args);
                                    }
                                });
                            }
                        }
                        room.npcs[npc.id] = npc;
                    }
                    rooms[room.realm+'/'+room.name] = room;
                    enter_room2(socket, player, room, magical, args);
                });
                rv = true;
            } else {
                rooms[room.realm+'/'+room.name] = room;
                enter_room2(socket, player, room, magical, args);
                rv = true;
            }
        } catch(e) {
            str = 'Problem loading '+ dest + ' ' + e;
            debug(str);
            rv = false;
        }
    }
    return rv;
}

function load_room(room_locale) {
    if (room_locale) {
        tokens = room_locale.split('/', 2);
        realm = tokens[0];
        file = tokens[1];
        try {
            fs.readFile('realms/'+realm+'/rooms/'+file+'.js','utf8', function(err, data) {
                eval(data);
                multi.exec(function() {
                    index = 0;
                    for (var i in room.start_npcs) {
                        eval(fs.readFileSync('./realms/' + room.start_npcs[i] + '.js','utf8'));
                        npc.id = npc.name+'#'+idnums[index];
                        index++;
                        if (typeof room.npcs === 'undefined') {
                            room.npcs = {};
                        }
                        // initialize events
                        if (typeof npc.events !== 'undefined') {
                            npc.listener = new em();
                            for (var event_name in npc.events) {
                                npc.listener.on(event_name, function(event_name,npc_obj, player, args) {
                                    if (npc_obj.hp > 0) {
                                        npc_obj.events[event_name](npc_obj,player,args);
                                    }
                                });
                            }
                        }
                        room.npcs[npc.id] = npc;
                    }
                    rooms[room.realm+'/'+room.name] = room;
                    rv = true;
                });
                rooms[room.realm+'/'+room.name] = room;
            });
        } catch(e) {
            debug(e);
        }
    }
}

function do_look(socket, room, player, hard_look) {
    socket.emit('update', room.short);
    socket.emit('update', room.long);
    show_others_in_room(socket, room, player);
    show_room_inventory2(socket, room , player, hard_look);
    show_npcs_in_room2(socket,room, player, hard_look);
    show_exits(socket, room, player);
}

function show_inventory2(socket, player) {
    str = 'Items in '+player.name+'\'s inventory:\n';
    if (typeof player.inv !== 'undefined') {
        for (var i in player.inv) {
            obj_id = player.inv[i].id;
            if (player.wizard && obj_list[obj_id].invisible) {
                str += obj_list[obj_id].alias+'('+obj_id+') '+ obj_list[obj_id].origin + ' (invisible)\n';
            } else if (player.wizard) {
                str += obj_list[obj_id].alias+'('+obj_id+') '+ obj_list[obj_id].origin + '\n';
            } else {
                str += obj_list[obj_id].alias+'('+obj_list[obj_id].id+')\n';
            }
        }
    }
    socket.emit('update',str);
}

function debug(msg) {
    date = new Date();
    console.log(date.toString() + ': ' + msg);
}

function get_npc(target, room) {
    rv = null;
    if (typeof room.npcs !== 'undefined') {
        for (var i in room.npcs) {
            if (room.npcs[i].name === target) {
                rv = room.npcs[i];
                break;
            }
        }
    }
    return rv;
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

function show_others_in_room(socket, room, player) {
    in_room = '';
    count = 0;
    invis = 0;
    for (var player_id in room.who) {
        if (room.who[player_id].ninja_mode && player.wizard) {
            in_room += room.who[player_id].alias+' '+'('+room.who[player_id].name+') (invisible),';
            invis++;
        } else if (!room.who[player_id].ninja_mode) {
            if (player.wizard) {
                in_room += room.who[player_id].alias+' '+'('+room.who[player_id].name+'),';
            } else {
                in_room += room.who[player_id].alias+',';
            }
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

function show_room_inventory2(socket, room, player, hard_look) {
    try {
        str = 'Objects in room:\n';
        if (typeof room.inv !== 'undefined') {
            for (var i in room.inv) {
                key = room.inv[i].id;
                if (typeof obj_list[key] === 'undefined') {
                    tokens = room.inv[i].origin.split('/', 2);
                    realm = tokens[0];
                    file = tokens[1];
                    eval(fs.readFileSync('realms/'+realm+'/'+'objs/'+file+'.js','utf8'));
                    obj_list[key] = obj;
                }
                if (player.wizard && obj_list[key].invisible) {
                    str+=  obj_list[key].alias+ ' ('+key+') '+ obj_list[key].origin+ ' (invisible)\n';
                } else if (player.wizard) {
                    str+=  obj_list[key].alias+ ' ('+key+') '+ obj_list[key].origin+ '\n';
                } else if (hard_look) {
                    str+=  obj_list[key].alias+ ' ('+key+') '+ obj_list[key].origin+ '\n';
                } else {
                    str+=  obj_list[key].alias + '\n';
                }
            }
        }
        socket.emit('update', str);
    } catch(e) {
        debug('SHOW_ROOM_INVENTORY: '+ e);
    }
}

function show_npcs_in_room2(socket, room, player, hard_look) {
    str = '';
    if (typeof room.npcs !== 'undefined') {
        for (var i in room.npcs) {
            if (player.wizard && room.npcs[i].invisible) {
                str += room.npcs[i].alias+' ('+room.npcs[i].name+ ' | '+i+') (invis) is here.\n';
            } else if (hard_look || player.wizard) {
                str += room.npcs[i].alias+' ('+room.npcs[i].name+ ' | '+i+') is here.\n';
            } else {
                str += room.npcs[i].alias+ ' is here.\n';
            }
        }
    }
    if (str.length > 0) {
        socket.emit('update', str);
    }
}

function enter_room2(socket, player, room, magical, args) {
    // update room who list
    if (typeof room.who === 'undefined') {
        room.who = {};
    }
    room.who[player.id] = player;

    room_id = room.realm+'/'+room.name;
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

    do_look(socket, room, player, false);
    if (player.ninja_mode) {
        socket.emit('update', 'You are in ninja mode!  "vis" to disable');
    }
    socket.emit('prompt', player.name+' ('+player.hp+'/'+player.max_hp+'):'+room_id+'> ');
    player.location = room.realm+'/'+room.name;
    player.realm = room.realm;
    player.room_name = room.name;
    // sned arrive signal to all npcs
    if (typeof room.npcs !== 'undefined') {
        for (var i in room.npcs) {
            room.npcs[i].listener.emit('arrive', 'arrive',room.npcs[i], player, args);
        }
    }
    player_redis.set(player.name, JSON.stringify(player));
}

function show_exits(socket, room, player) {
    exits = '';
    for (var key in room.exits) {
        exits += key+',';
    }
    exits = exits.slice(0,-1);  // remove last comma
    socket.emit('update', 'You can go: ' + exits);
}

// Helper functions exposed to creators
function send_to_player(player, msg) {
    player_socket = io.sockets.connected[player.socket_id];
    player_socket.emit('update', npc_obj.alias + ' ' + you_emote);
}

function broadcast_to_room(room, msg) {
    player_socket = io.sockets.connected[player.socket_id];
    player_socket.broadcast.to(player.location).emit('update', npc_obj.alias+ ' ' + bcast_emote);
}

function emote_to_room(locale, msg) {
    io.sockets.in(locale).emit('update', msg);
}

function spawn_obj_into_player(obj, player) {
    try {
        if (typeof obj !== 'undefined' && typeof player !== 'undefined') {
            tokens = obj.split('/', 2);
            realm = tokens[0];
            file = tokens[1];
            eval(fs.readFileSync('./realms/'+realm+'/objs/'+file+'.js', 'utf8'));
            // todo, initiate event listeners
            if (typeof player.inv === 'undefined') {
                player.inv = {};
            }
            debug('adding');
            obj_redis.incr('obj_id', function(err, val) {
                obj.id = obj.name+'#'+val;
                player.inv[obj.id] = obj;
            });
        } else {
        }
    } catch(e) {
        debug('SPAWN_OBJ_INTO_PLAYER: '+e);
    }
}

function say_to_player(player, msg) {
    socket = io.sockets.connected[player.socket_id];
    socket.emit('update', msg);
}

function sound_to_player(player, sound) {
    socket = io.sockets.connected[player.socket_id];
    socket.emit('fx'+sound);
}

function set_quest(quest_file, player) {
    rv = false;
    try {
        tokens = quest_file.split('/',2);
        realm = tokens[0];
        file = tokens[1];
        eval(fs.readFileSync('./realms/'+realm+'/quests/'+file+'.js','utf8'));
        if (typeof player.quests.completed[quest_file] === 'undefined') {
            player.quests.active[quest_file] = quest;
            rv = true;
        }
        player_redis.set(player.name, JSON.stringify(player));
    } catch(e) {
        debug('SET_QUEST: '+e);
    }
    return rv;
}

function complete_quest(quest_id, the_npc, player, args) {
    rv = false;
    try {
        if (typeof player.quests.active[quest_id] !== 'undefined') {
            rv = true;
            player.xp += player.quests.active[quest_id].xp;
            add_exp(player, player.quests.active[quest_id].xp);
            if (typeof player.quests.active[quest_id] !== 'undefined') {
                if (typeof player.quests.active[quest_id].complete !== 'undefined') {
                    player.quests.active[quest_id].complete(the_npc, player, args);
                }
            }
            if (player.quests.completed === 'undefined') {
                player.quests.completed = {};
            }
            temp_quest = {};
            for (var i in player.quests.active[quest_id]) {
                temp_quest[i] = player.quests.active[quest_id][i];
            }
            player.quests.completed[quest_id] = temp_quest;
            delete player.quests.active[quest_id];
            player_redis.set(player.name, JSON.stringify(player));
        }
    } catch(e) {
        debug(e);
    }
    return rv;
}

function add_exp(player, xp) {
    try {
        player.xp += xp;
        say_to_player(player, 'You\'ve gained '+xp+' XP.');
        player_redis.set(player.name, JSON.stringify(player));
        check_level(player, player.xp);
    } catch(e) {
        debug(e);
    }
}

function check_level(player, xp) {
    new_level = 1;
    if (xp>99) { new_level = 2; };
    if (xp>299) { new_level = 3; };
    if (xp>499) { new_level = 4; };
    if (xp>799) { new_level = 5; };
    if (xp>1099) { new_level = 6; };
    if (xp>1499) { new_level = 7; };
    if (xp>1899) { new_level = 8; };
    if (xp>2399) { new_level = 9; };
    if (xp>2899) { new_level = 10 };
    if (xp>3399) { new_level = 11 };
    if (xp>3899) { new_level = 12 };
    if (xp>4399) { new_level = 13 };
    if (xp>4899) { new_level = 14 };
    if (xp>5399) { new_level = 15 };
    if (xp>5899) { new_level = 16 };
    if (new_level > player.level) {
        diff = new_level - player.level;
        if (diff > 1) {
            say_to_player(player, 'You GAINED '+diff+' levels!  You feel more experienced.  You are now level '+new_level);
        } else {
            say_to_player(player, 'You GAINED a level!  You feel more experienced. You are now level '+new_level);
        }
        player.level = new_level;
        player.max_hp = new_level * 100 +Math.floor(Math.random() * 10 + 5);
        player.hp = player.max_hp;
        sound_to_player(player, 'level');
        player_redis.set(player.name, JSON.stringify(player));
    }

}
