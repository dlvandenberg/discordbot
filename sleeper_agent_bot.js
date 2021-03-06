try 
{
	var Discord = require("discord.js");
} catch (e) 
{
	console.log(e.stack);
	console.log(process.version);
	console.log("Plase run npm install and ensure it passes with no errors!");
	process.exit();
}

// Get authentication data
try 
{
	var AuthData = require("./auth.json");
} catch (e) 
{
	console.log("No auth.json found, please create one with at least an email and password for the bot account.\n" + e.stack);
	process.exit();
}

// Get data storage objects
try
{
	var Ps4_list = require("./ps4.json");
	var Pc_list = require("./pc.json");
	var Xbox_list = require("./xbox.json");
} catch (e)
{
	console.log(e.stack);
	console.log("Please create an empty json object for the given platform.")
	process.exit();
}

// Load fs
try {
	var fs = require("fs");
} catch (e)
{
	console.log("Cannot find required module: fs");
}

// Load custom permissions.
var Permissions = {};
try 
{
	Permissions = require("./permissions.json");
} catch (e) {}

Permissions.checkPermissions = function(user, permission) 
{
	try 
	{
		var allowed = false;
		try 
		{
			if (Permissions.global.hasOwnProperty(permission))
			{
				allowed = Permissions.global[permission] == true;
			}
		} catch (e) {}

		try 
		{
			if (Permissions.users[user.id].hasOwnProperty(permission)) 
			{
				allowed = Permissions.users[user.id][permission] == true;
			}
		} catch (e) {}

		return allowed;
	} catch (e) {}

	return false;
}

// Load config
var Config = {};
try
{
	Config = require("./config.json");
} catch (e)
{ // No config file, use defaults;
	Config.debug = false;
	Config.respondToInvalid = false;
}

var _ = require('underscore');

var commands = 
{
	"ping": 
	{
		description: "responds pong, useful for checking if bot is alive",
		process: function (bot, msg, suffix) 
		{
			bot.sendMessage(msg.channel, msg.sender + " pong!");
			if (suffix) 
			{
				bot.sendMessage(msg.channel, "note that `!ping` takes no arguments!");
			}
		}
	},
	"register":
	{
		usage: "<platform> <id> <level> <rank>",
		description: "register your ID for a certain platform [ps4, pc, xbox]",
		process: function (bot, msg, suffix)
		{
			regOrUpdate(bot, msg, suffix);
		}
	},
	"update":
	{
		usage: "<platform> <id> <level> <rank>",
		description: "update your ID for a certain platform [ps4, pc, xbox]",
		process: function (bot, msg, suffix)
		{
			regOrUpdate(bot, msg, suffix);
		}
	},
	"list":
	{
		usage: "<platform>",
		description: "list the users of the given platform [ps4, pc, xbox]",
		process: function (bot, msg, suffix)
		{
			var user = msg.author;
			var suffixes = suffix.split(" ");
			if (suffixes.length === 1)
			{
				var platform = suffixes[0];
				var list = getListOfPlatform(platform);

				if (list != null)
				{
					console.log("printing list for platform: " + platform);
					printList(msg.channel, list, platform);
				} else
				{
					printUsage(msg.channel, "list");
				}
			} else
			{
				printUsage(msg.channel, "list");
			}
		}
	},
	"remove":
	{
		usage: "<platform>",
		description: "remove your ID for a certain platform [ps4, pc, xbox]",
		process: function (bot, msg, suffix)
		{
			var user = msg.author;
			var suffixes = suffix.split(" ");
			if (suffixes.length === 1)
			{
				var platform = suffixes[0];
				var list = getListOfPlatform(platform);

				if (list != null)
				{
					console.log("removing user " + user.id + " from " + platform + "list");
					removeFromList(list, msg.channel, platform, user);
				} else
				{
					printUsage(msg.channel, "remove");
				}
			} else
			{
				printUsage(msg.channel, "remove");
			}
		}
	}
}

var regOrUpdate = function(bot, msg, suffix)
{
	var cmdTxt = msg.content.split(" ")[0].substring(1);
	var user = msg.author;
	var suffixes = suffix.split(" ");
	if (suffixes.length === 4)
	{
		var platform = suffixes[0];
		var id = suffixes[1];
		var level = suffixes[2];
		var rank = suffixes[3];

		var list = getListOfPlatform(platform);

		if (list != null)
		{
			var userobj = {
				"id": user.id,
				"data": {
					"nickname": id,
					"level": level,
					"rank": rank,
				}
			};
			addToList(list, msg.channel, platform, userobj, cmdTxt === "update");
		} else
		{
			printUsage(msg.channel, cmdTxt);
		}
	} else
	{
		printUsage(msg.channel, cmdTxt);
	}
};

var printList = function (channel, list, platform)
{
	if (list.users.length > 0)
	{
		bot.sendMessage(channel, "Current players known for " + platform + ":", function()
			{			
				var msg = "**User - " + getPlatformIDType(platform) + " - Level - DZ Rank**";
				for (user in list.users)
				{
					var userid = "*<@" + list.users[user].id + ">*";
					var nickname = "*" + list.users[user].data.nickname + "*";
					var level = "*" + list.users[user].data.level + "*";
					var rank = "*" + list.users[user].data.rank + "*";
					
					msg += "\n" + userid + " - " + nickname + " - " + level + " - " + rank;
				}

				bot.sendMessage(channel, msg);
			});
	} else
	{
		bot.sendMessage(channel, "there are no players registered for this platform. See `!register`.");
	}
};

var getPlatformIDType = function (platform)
{
	var idtype;
	switch (platform)
	{
		case "ps4":
			idtype = "PSN ID";
			break;
		case "xbox":
			idtype = "Gamertag";
			break;
		case "pc":
			idtype = "Uplay ID";
			break;
	}
	return idtype;
}

var getListOfPlatform = function (platform)
{
	if (platform === "ps4" || platform === "pc" || platform === "xbox")
	{
		var file = fs.readFileSync(platform + ".json");
		return JSON.parse(file);
	}
	return null;
};

var saveList = function (platform, list)
{
	if (platform === "ps4" || platform === "pc" || platform === "xbox")
	{
		var content = JSON.stringify(list);
		fs.writeFileSync(platform + ".json", content);
	}
};

var addToList = function (list, channel, platform, user, isUpdate)
{
	if (!isUpdate && !listContainsUser(list, user))
	{
		list.users.push(user);
		saveList(platform, list);
		bot.sendMessage(channel, "succesfully added you to the " + platform + " list <@" + user.id + ">!");
	} else if (isUpdate && listContainsUser(list, user))
	{
		var idx = _.findIndex(list.users, {id: user.id});
		console.log("index for id: " + user.id + " : " + idx);
		list.users[idx].data.nickname = user.data.nickname;
		list.users[idx].data.level = user.data.level;
		list.users[idx].data.rank = user.data.rank;
		saveList(platform, list);
		bot.sendMessage(channel, "succesfully updated your information, <@" + user.id + ">!");
	} else
	{
		if (isUpdate)
			bot.sendMessage(channel, "you are not in the list. Perhaps you want to `!register` first?");
		else
			bot.sendMessage(channel, "you are already in the list. Perhaps you want to `!update` your data?");
	}
};

var removeFromList = function (list, channel, platform, user)
{
	if (listContainsUser(list, user))
	{
		var idx = _.findIndex(list.users, {id: user.id});
		list.users.splice(idx, 1);
		saveList(platform, list);
		bot.sendMessage(channel, "succesfully removed you from the " + platform + " list, <@" + user.id + ">!");
	} else
	{
		bot.sendMessage(channel, "you are not in the list, relax!");
	}
};

var listContainsUser = function (list, user)
{
	return _.findWhere(list.users, {id: user.id}) != null;
};

// Bot code
var bot = new Discord.Client();

bot.on("ready", function() 
{
	console.log("Ready to begin! Serving in " + bot.channels.length + " channels");
});

bot.on("disconnected", function() 
{
	console.log("Disconnected!");
	process.exit(1);
});

var printUsage = function(channel, cmd)
{
	var info = "`!" + cmd + "`";
	var usage = commands[cmd].usage;
	if (usage)
	{
		info += " `" + usage + "`";
	}
	var description = commands[cmd].description;
	if (description)
	{
		info += "\n\t" + description;
	}
	bot.sendMessage(channel, info);
};

bot.on("message", function (msg) 
{
	// Check if the message is a command.
	if (msg.author.id != bot.user.id && (msg.content[0] === "!" || msg.content.indexOf(bot.user.mention()) == 0)) 
	{
		console.log("treating " + msg.content + " from " + msg.author + " as a command");
		var cmdTxt = msg.content.split(" ")[0].substring(1);
		var suffix = msg.content.substring(cmdTxt.length + 2);

		console.log("cmdTxt = " + cmdTxt + ", suffix = " + suffix);

		if (msg.content.indexOf(bot.user.mention()) == 0) 
		{ // Bot's name is mentioned.
			try {
				cmdTxt = msg.content.split(" ")[1];
				suffix = msg.content.substring(bot.user.mention().length + cmdTxt.length + 2);
			} catch (e) 
			{ // No command.
				bot.sendMessage(msg.channel, "What's up?");
			}
		}

		var cmd = commands[cmdTxt];
		if (cmdTxt === "help") 
		{ // Display command help
			console.log("going to print out all commands... " + commands);
			bot.sendMessage(msg.channel, "Available commands:", function() 
			{
				for (var cmd in commands) 
				{
					printUsage(msg.channel, cmd);
				}
			});
			console.log("finished printing out all commands");
		} else if (cmd)
		{
			try
			{
				cmd.process(bot, msg, suffix);
			} catch (e)
			{
				if (Config.debug)
				{
					bot.sendMessage(msg.channel, "command " + cmdTxt + " failed :-(\n" + e.stack);
				}
			}
		} else
		{
			if (Config.respondToInvalid)
			{
				bot.sendMessage(msg.channel, "Invalid command: " + cmdTxt);
			}
		}
	} else
	{ // msg is not a command, or it is a message from us.
		if (msg.author === bot.user) 
		{
			return;
		}

		if (msg.author != bot.user && msg.isMentioned(bot.user))
		{
			bot.sendMessage(msg.channel, msg.author + ", you called?");
		}
	}
});

bot.login(AuthData.email, AuthData.password);