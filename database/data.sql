import sqlite3


CREATE TABLE users (

    user_id integer primary key autoincrement,
    username string primary key,
    
)

CREATE TABLE games (

    game_id integer primary key autoincrement,
    status string,
    players username[] references users(username),

    player_count integer,
)