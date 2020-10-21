const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core-discord');
const YouTube =require("simple-youtube-api");
require('dotenv').config();

const youtube = new YouTube(process.env.YOUTUBE_ID);

const queue = new Map();

client.on("warn", console.warn);
client.on("error", console.error);
client.on("disconnect",() => console.log("Disconnected"));
client.on("reconnecting", () => console.log("Reconnecting now!"));
client.on('ready', () => {
    client.user.setActivity(">help", { type: "LISTENING" });
    console.log('Ready!');
});


client.on("message", async msg => {
   if(msg.author.bot) return undefined;
   if(!msg.content.startsWith(">")) return undefined;
   const args = msg.content.split(/ /);
    //console.log(args);
   const url=msg.content.slice(args[0].length);
    //console.log(url);
   const serverQueue= queue.get(msg.guild.id);

   if(args[0]===">play" || args[0]===">p"){
       const voiceChannel=msg.member.voice.channel;
       //console.log(msg.member.voice.channel);
       if(!voiceChannel) return msg.channel.send("You must be present in the voice channel to play music!");
       const permissions = voiceChannel.permissionsFor(msg.client.user);
       if(!permissions.has("CONNECT")) return msg.channel.send("I do not have the permission to connect!");
       if(!permissions.has("SPEAK")) return msg.channel.send("I do not have the permission to speak!");

       if(url==="")
           return msg.channel.send("No song name or link passed!");

       msg.react('🤟');
       try{
           var video= await youtube.getVideo(url);
       }
       catch (err){
           try{
               var videos = await youtube.searchVideos(url,1);
               var video = await youtube.getVideoByID(videos[0].id);
           }
           catch (error){
               console.log(error);
               msg.channel.send("Sorry.. I'm unable to find the video");
           }
       }
       return handleVideo(video,msg,voiceChannel);
       return undefined;
   }

    else if(args[0]===">search") {
        const voiceChannel = msg.member.voice.channel;
        //console.log(msg.member.voice.channel);
        if (!voiceChannel) return msg.channel.send("You must be present in the voice channel to play music!");
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has("CONNECT")) return msg.channel.send("I do not have the permission to connect!");
        if (!permissions.has("SPEAK")) return msg.channel.send("I do not have the permission to speak!");

        if (url === "")
            return msg.channel.send("No song name or link passed!");
        msg.react('🔍');

           youtube.searchVideos(url, 5)
               .then(videos => {
                   var message=`____**Song Search Results**____ \n \n` ;
                   for(num in videos)
                   {
                       var num2=parseInt(num)+1;
                       message= message + `**${num2}.** ${videos[num].title} \n \n`;
                   }
                   message= message + `**Please provide a number ranging from 1-5 to select the song!** \n \n`;
                   message=message+`*Waiting for response in 10 secs*`;
                   msg.channel.send(message);
                       const filter = response => {
                           //console.log(response.content);
                           if(parseInt(response.content)>0 && parseInt(response.content)<6)
                           return true;
                       };
                       msg.channel.awaitMessages(filter,{
                           max:1,
                           time: 10000,
                           errors:['time']
                       })
                           .then(response => {
                               //console.log(response);
                               const videoIndex = parseInt(response.first().content);
                               youtube.getVideoByID(videos[videoIndex-1].id)
                                   .then(video => handleVideo(video,msg,voiceChannel))
                                   .catch(err => console.log(err));
                           })
                           .catch(err => {
                               console.log(`didnt reaceive ${err}`);
                               return msg.channel.send("No valid value entered in the specified time. Cancelling search request...");
                           });


               })
               .catch(err => {
                   console.log(`searcing went wrong ${err}`);
                   return msg.channel.send("I coudn't find any search results");
               });


    }

    else if(args[0]===">playlist") {
        const voiceChannel = msg.member.voice.channel;
        //console.log(msg.member.voice.channel);
        if (!voiceChannel) return msg.channel.send("You must be present in the voice channel to play music!");
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has("CONNECT")) return msg.channel.send("I do not have the permission to connect!");
        if (!permissions.has("SPEAK")) return msg.channel.send("I do not have the permission to speak!");

        if (url === "")
            return msg.channel.send("No playlist link passed!");
        try{
            const playlist = await youtube.getPlaylist(url);
        }
        catch (err){
            //console.log(err);
            return msg.channel.send("Invalid link!");
        }
        msg.react('📰');
        const playlist = await youtube.getPlaylist(url);
        const videos = await playlist.getVideos();
        //console.log(videos[0]);
        for(const video in videos){
            //console.log(videos[video].id);
            const curVideo= await youtube.getVideoByID(videos[video].id);
            await handleVideo(curVideo,msg,voiceChannel,true);
        }
        return msg.channel.send(`Playlist **${playlist.title}** has been added to the queue`);
    }

    else if(args[0]===">skip") {
       const voiceChannel=msg.member.voice.channel;
       if(!voiceChannel) return msg.channel.send("You must be present in the voice channel to skip music!");
       //console.log(serverQueue.songs);
        if(!serverQueue) return msg.channel.send("There is no song in the queue to skip");
        msg.react('👌');
        serverQueue.connection.dispatcher.destroy();
       //console.log("Song ended");
       serverQueue.songs.shift();
       play(msg.guild,serverQueue.songs[0]);
        return msg.channel.send("Skipping to the next song!");
   }

    else if(args[0]===">remove") {
        const voiceChannel = msg.member.voice.channel;
        if (!voiceChannel) return msg.channel.send("You must be present in the voice channel to remove music!");
        //console.log(serverQueue.songs);
        if (!serverQueue) return msg.channel.send("There is no song in the queue to remove");
        msg.react('🗑️');
        if(parseInt(url)>0 && parseInt(url)<serverQueue.songs.length){
            const songtitle = serverQueue.songs[parseInt(url)].title;
            serverQueue.songs.splice(parseInt(url),1);
            return msg.channel.send(`**${songtitle}** has been removed`);
        }
        else
            return msg.channel.send("Invalid command!");
    }

    else if(args[0]===">stop"){

       const voiceChannel=msg.member.voice.channel;
       if(!voiceChannel) return msg.channel.send("You must be present in the voice channel to play music!");
       if(!serverQueue) return msg.channel.send("There is no song in the queue to skip");
       msg.react('🛑');
       serverQueue.songs = [];
       serverQueue.connection.dispatcher.destroy();
       play(msg.guild,serverQueue.songs[0]);
       return msg.channel.send("Stopping the queue!");
   }

    else if(args[0]===">np"){
       if(!serverQueue) return msg.channel.send("There is no song playing right now!");
       msg.react('🎧');
       return msg.channel.send(`Now Playing: **${serverQueue.songs[0].title}**`);
   }

   else if(args[0]===">queue"){
       if(!serverQueue) return msg.channel.send("There is no song playing right now!");
       msg.react('🤹‍♂️');
       var message=`____**Song Queue**____ \n \n***Now Playing*** : ${serverQueue.songs[0].title} \n \n` ;
       for(num in serverQueue.songs)
            {
                //console.log(num);
                if(num>0 && num<=8)
                {message= message + `**${num}.** ${serverQueue.songs[num].title}*(${serverQueue.songs[num].duration.minutes}:${serverQueue.songs[num].duration.seconds})* \n \n`;
                }
            }
       message=message+`**Total songs in the queue: **${serverQueue.songs.length}`;
       return msg.channel.send(message);
   }
   else if(args[0]===">pause"){
       if(!serverQueue || !serverQueue.playing) return msg.channel.send("There is no song playing right now!");
       msg.react('⏸️');
       serverQueue.playing=false;
       serverQueue.connection.dispatcher.pause();
       return msg.channel.send("The music is paused for you!");
   }
   else if(args[0]===">resume"){
       if(!serverQueue) return msg.channel.send("There is no song to play!");
       msg.react('🥳');
       if(serverQueue.playing) return  msg.channel.send("The music is already playing!! Don't simply disturb my sleep -.-");
       serverQueue.playing=true;
       serverQueue.connection.dispatcher.resume();
       return msg.channel.send("The music has resumed for you!");
   }
   else if(args[0]===">help"){
       msg.react('🥰');
       return msg.channel.send("**Echo** *Always echoing for you ;)* \n\n" +
           "**Commands :** \n" +
           "**>play [name or link]** or **>p[name or link]** *Play any song* \n" +
           "**>playlist [playlist link]** *Imposts a playlist to the queue* \n" +
           "**>search [name]** *Displays the top 5 search results for that name from which you can add to queue* \n" +
           "**>stop** *Stop the queue and leave* \n" +
           "**>pause** *Pause the queue* \n" +
           "**>resume** *Resume the queue* \n" +
           "**>skip** *Skip to the next song in the queue* \n" +
           "**>queue** *Display the queue* \n" +
           "**>np** *Display the current song* \n" +
           "**>remove [number]** *Removes that song with that number from the queue* \n");
   }
    return undefined;
});

client.login(process.env.DISCORD);

async function play(guild,song){
    const serverQueue = queue.get(guild.id);

    if(!song){
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return undefined;
    }

    const dispatcher = serverQueue.connection.play(await ytdl(song.url), { filter:"audioonly" ,type: 'opus', quality: 'highestaudio', highWaterMark: 1 << 25})
        .on("finish", () => {
            console.log("Song ended");
            serverQueue.songs.shift();
            play(guild,serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(1);
    serverQueue.textChannel.send(`Started playing: **${song.title}**`);
}

async function handleVideo(video,msg,voiceChannel,playlist=false){
    const serverQueue = queue.get(msg.guild.id);
    //console.log(serverQueue);
    //console.log(video);
    const song = {
        duration: video.duration,
        id: video.id,
        title:Discord.Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    //console.log(song);

    if(!serverQueue){
        const queueConstruct = {
            textChannel : msg.channel,
            voiceChannel : voiceChannel,
            connection : null,
            songs : [],
            volume :5,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);

        queueConstruct.songs.push(song);
        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection=connection;
            await play(msg.guild, queueConstruct.songs[0]);
        }
        catch (error){
            console.error(error);
            queue.delete(msg.guild.id);
            return msg.channel.send("I could not join the voice channel:" +error);
        }
    }
    else {
        serverQueue.songs.push(song);
        if(playlist) return undefined;
        return msg.channel.send(`**${song.title}** has been added to the queue!`);
    }
    return undefined;
}