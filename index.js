var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var natural = require('natural');
var fs = require('fs');
var classifier = new natural.BayesClassifier();

classifier.addDocument('suck my dick', 'insult');
classifier.addDocument('screw you','insult');
classifier.addDocument('fuck you','insult');
classifier.addDocument('fuck off','insult');
classifier.addDocument('kiss my ass','insult');
classifier.addDocument('you suck','insult');
classifier.addDocument('you jackass','insult');
classifier.addDocument('you asshole','insult');
classifier.addDocument('you jerk','insult');
classifier.addDocument('you dick','insult');
classifier.addDocument('you douche','insult');
classifier.addDocument('you douchebag','insult');


classifier.addDocument('your mom', 'joke');
/*
natural.BayesClassifier.load('./insults.json', null, function(err, classifier) {
        console.log(classifier.classify('fuck off'));
});
        */
classifier.addDocument('hello, how are you', 'greeting');
classifier.addDocument('hello', 'greeting');
classifier.addDocument('how are you', 'greeting');
classifier.addDocument('howdy', 'greeting');
classifier.addDocument('hey there', 'greeting');
classifier.addDocument('whats up', 'greeting');
classifier.addDocument('hi', 'greeting');
classifier.addDocument('greetings', 'greeting');
classifier.addDocument('salutations', 'greeting');
classifier.addDocument('hola', 'greeting');
classifier.addDocument('waddup', 'greeting');
classifier.addDocument('sup', 'greeting');
classifier.addDocument('hows it hangin', 'greeting');
classifier.addDocument('yo', 'greeting');
classifier.addDocument('yoyoyo', 'greeting');
classifier.addDocument('yoyo', 'greeting');
classifier.addDocument('hey', 'greeting');
classifier.addDocument('how are you', 'greeting');
classifier.addDocument('what going on', 'greeting');

classifier.addDocument('what doing', 'job');
classifier.addDocument('what are you doing', 'job');
classifier.addDocument('job', 'job');
classifier.addDocument('what do you do', 'job');

classifier.train();

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/cli.html'));
});

var valid_commands = ['say','go','n','s','e','w','exit','logout','shout', 'gag','look','desc','who','emote'];
var room_list = {};


io.on('connection', function(socket) {
    var player = {
        "name":0,
        "gagged": 0,
        "level": 1,
        "ghost": 0,
        "hp":100
    }
    var room = {
        "name":"outside_ted",
        "realm":"main",
        "long":"You are standing outside of Ted's office on the fifth floor of the 9000 building.  It is a beautiful, clear day in Southern California.  The area is brightly lit by the white tiles and floor to ceiling windows.  Just south of you is the accounting area while just a few steps west will bring you in front of the executive shiiter.",
        "short": "Outside of Ted's Office",
        "exits": {'w':'hallway_exec_bathroom', 's':'account_area','enter':'teds_office'}
    }
    socket.on('adduser', function(name) {
        player.name = name;
        socket.join(room.name);
        socket.broadcast.to(room.name).emit('update', player.name + ' has arrived.');
        socket.emit('update', room.short);
        socket.emit('update', room.long);
        show_exits(socket, room);
        if (typeof room_list[room.realm] !== 'undefined') {
            if (typeof room_list[room.realm][room.name] !== 'undefined') {
                room_list[room.realm][room.name] = { [name]: 1};
            } else {
                room_list[room.realm] = {
                    [room.name]: {
                        [name]: 1
                    }
                }
            }
        } else {
            room_list = {
                [room.realm]: {
                    [room.name]: {
                        [name]: 1
                    }
                }
            };
        }
        console.log(room_list);
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
                        socket.emit('update', 'You said ' + msg);
                        socket.broadcast.to(room.name).emit('update', player.name + ' said ' + msg);
                    }
                }
                if (command === 'emote') {
                    if (!player.gagged) {
                        msg = tokens.join(' ');
                        console.log(player.name + ' ' + msg);
                        socket.emit('update', 'You ' + msg);
                        socket.broadcast.to(room.name).emit('update', player.name + ' ' + msg);
                    }
                }
                if (command === 'go') {
                    try {
                        direction = tokens[0];
                        console.log(command +' '+direction);
                        if (direction in room.exits) {
                            console.log(room.exits[direction]);
                        } else {
                        socket.emit('update','You cannot go that way.');
                        }
                        realm = "main";
                        fs.readFile('./rooms/'+realm+'/'+room.exits[direction]+'.js', 'utf8',function(err, data) {
                            old_room = room;
                            if (err) {
                                console.log('room load error - realm='+realm+', file='+room.exits[direction]);
                            } else {
                                eval(data);
                                enter_room(socket, room, player, old_room);
                            }
                        });
                    } catch(e) {
                    }
                }
                if (command === 'look') {
                    in_room = '';
                    count = 0;
                    for (var key in room_list[room.realm][room.name]) {
                        in_room += key+',';
                        count++;
                    }
                    socket.emit('update', room.short);
                    socket.emit('update', room.long);
                    if (count == 1) {
                        socket.emit('update', 'You are the only one here');
                    } else {
                        socket.emit('update', 'There are '+count+' otheres here: '+in_room);
                    }
                    show_exits(socket, room);
                }
            } else {
                console.log('invalid command');
            }
        }
    });
    console.log('a user connected');
});

function enter_room(socket, room, player,old_room) {
    socket.broadcast.to(old_room.name).emit('update', player.name + ' went '+ direction);
    socket.leave(old_room.name);
    socket.join(room.name);
    socket.broadcast.to(room.name).emit('update', player.name + ' has arrived.');
    socket.emit('update', room.short);
    socket.emit('update', room.long);
    show_exits(socket, room);
    update_room_list(room, player, old_room);
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
        console.log('to_delete: '+ old_room.realm+','+old_room.name+','+player.name);
        console.log('to delete: '+room_list[old_room.realm][old_room.name][player.name]);
        delete room_list[old_room.realm][old_room.name][player.name];
    } catch(e) {
        console.log('could not delete from room list');
    }
}

function show_exits(socket, room) {
    exits = '';
    for (var key in room.exits) {
        exits += key+',';
    }
    socket.emit('update', 'You can go: ' + exits);
}

http.listen(2500);
