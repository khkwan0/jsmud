var config = {};

config.network = {
    port: 2500
};

config.redis = {
    player_db:5, // redis db number - arbitrary
    obj_db:4  // redis db number - arbitrary
}

config.starting_room = 'main/outside_ted';
module.exports = config;
