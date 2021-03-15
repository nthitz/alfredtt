require('dotenv').config()
const { Sequelize, DataTypes } = require('sequelize');
const ttapi = require('ttapi')

const bot = new ttapi(process.env.TT_AUTH, process.env.TT_USERID, process.env.TT_ROOMID)

const initDB = async () => {
    const sequelize = new Sequelize(process.env.DBCONNECTION, {
        logging: false
    })
    const Play = sequelize.define('Play', {
        starttime: DataTypes.DATE,
        dj_id: DataTypes.STRING,
        song_id: DataTypes.STRING,
        room_id: DataTypes.STRING,
        upvotes: DataTypes.INTEGER,
        downvotes: DataTypes.INTEGER,
        listeners: DataTypes.INTEGER,
    })

    const DJ = sequelize.define('DJ',  {
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        name: DataTypes.STRING,
    })

    const Song = sequelize.define('Song',  {
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        source: DataTypes.STRING,
        sourceId: DataTypes.STRING,
        coverart: DataTypes.STRING,
        length: DataTypes.INTEGER,
        title: DataTypes.STRING,
        artist: DataTypes.STRING,
    })

    Play.hasOne(Song)
    Song.belongsTo(Play)

    Play.hasOne(DJ)
    DJ.belongsTo(Play)

    await sequelize.sync()

    return { Song, Play, DJ }
}

const init = async () => {
    const { Song, Play, DJ } = await initDB()




    // console.log(sequelize)

    let dancing = false
    bot.on('speak', (data) => {
        console.log('speak', data.name, data.text)

        if (data.text.toLowerCase().match(/(bot|alfred) ?dance/)) {
            upvote()
        }
    })
    bot.on('endsong', async data => {
        console.log('endsong')
        console.log(data)
        console.log(data.room.metadata.current_song)

        const { listeners, upvotes, downvotes } = data.room.metadata
        const { djname, djid, starttime, sourceid, source, _id } = data.room.metadata.current_song
        const { coverart, length, artist, song } = data.room.metadata.current_song.metadata
        console.log(listeners, upvotes, downvotes)
        console.log(djname, djid, starttime, sourceid, source, _id)
        console.log(coverart, length, artist, song)
        const dj = await DJ.findOrCreate({
            where: { id: djid },
            defaults: {
                name: djname
            }
        })
        const s = await Song.findOrCreate({
            where: { id: _id },
            defaults: {
                source,
                sourceId: sourceid,
                coverart,
                length,
                title: song,
                artist,
            }
        })

        const play = await Play.create({
            starttime: new Date(starttime * 1000),
            dj_id: djid,
            song_id: _id,
            room_id: process.env.TT_ROOMID,
            upvotes,
            downvotes,
            listeners
        })

    })

    const upvote = () => {
        clearTimeout(autodanceTimeout)
        if (!dancing) {
            bot.vote('up')
            dancing = true
        }
    }

    const checkIfSongRecentlyPlayed = async (id, starttime, djname) => {
        console.log('checking for recent play of ', id)
        const play = await Play.findOne({
            where: {
                song_id: id
            },
            order: [
                ['starttime', 'DESC']
            ],
        })
        if (play) {
            console.log(play.starttime)
            const lastPlayedAt = starttime.valueOf() - play.starttime.valueOf()
            console.log(play.starttime, starttime, lastPlayedAt, Math.floor(lastPlayedAt / 1000 / 60), (lastPlayedAt / 1000) % 60)
            if (lastPlayedAt < 60 * 60 * 1000 * 4) {
                console.log('song recently played')
                bot.speak(`@${djname} this song was played like ${Math.floor(lastPlayedAt / 1000 / 60 * 10) / 10} minutes ago`)
            } else {
                console.log('song not played recently')
            }
        } else {
            console.log('haven\'t seen this song before')
        }
    }


    let autodanceTimeout = null
    bot.on('newsong', data => {
        console.log('newsong')
        // console.log(data)
        // console.log(data.room.metadata.current_song)
        const { _id, starttime, djname } = data.room.metadata.current_song
        checkIfSongRecentlyPlayed(_id, new Date(starttime * 1000), djname)
        dancing = false
        const autodanceTime = (data.room.metadata.current_song.metadata.length - 10) * 1000
        console.log('dance in ', autodanceTime)
        autodanceTimeout = setTimeout(upvote, autodanceTime)
    })
}

init()