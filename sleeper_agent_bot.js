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

var aliases;
var messagebox;

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
		usage: "<platform> <id>",
		description: "register your ID for a certain platform [ps4, pc, xbox]",
		process: function (bot, msg, suffix)
		{
			var user = msg.author;
			var suffixes = suffix.split(" ");
			if (suffixes.length === 2)
			{
				var platform = suffixes[0];
				var id = suffixes[1];

				var list = getListOfPlatform(platform);

				if (list != null)
				{
					addToList(list, msg.channel, user, platform, id);
					console.log("platform: " + platform + ", id: " + id);
				} else
				{
					printUsage(msg.channel, "register");
				}
			} else
			{
				printUsage(msg.channel, "register");
			}
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
	}
}

var printList = function (channel, list, platform)
{
	if (list.length > 0)
	{
		bot.sendMessage(channel, "Current players known for " + platform + ":", function()
			{			
				var msg = "**user\t\t\t\tnickname**";
				for (user in list)
				{
					var id = "*" + list[user].id + "*";
					var nickname = "*" + list[user].nickname + "*";
					
					msg += "\n" + id + "\t" + nickname;
				}

				bot.sendMessage(channel, msg);
			});
	} else
	{
		bot.sendMessage(channel, "there are no players registered for this platform. See `!register`.");
	}
};

var listContainsUser = function (list, id)
{
	if (list.length != 0)
	{
		for (usr in list)
		{
			console.log("checking id " + id + "with user in list : " + list[usr].id);
			if (list[usr].id === id)
			{
				return true;
			}
		}
	}
	return false;
};

var getListOfPlatform = function (platform)
{
	var list;
	switch(platform)
	{
		case "ps4":
			list = ps4Users;
			break;
		case "pc":
			list = pcUsers;
			break;
		case "xbox":
			list = x1Users;
			break;
	};
	return list;
};

var addToList = function (list, channel, user, platform, id)
{
	var userObject = new User(user, id, platform, 30, 50);
	if (!listContainsUser(list, user))
	{
		list.push(userObject);
		bot.sendMessage(channel, "succesfully added you to the " + platform + " list " + user + "!");
	} else
	{
		bot.sendMessage(channel, "you are already in the list. Perhaps you want to update your data?");
	}
};

var ps4Users = [];
var pcUsers = [];
var x1Users = [];

function User (id, nickname, platform, level, rank)
{
	this.id = id;
	this.nickname = nickname;
	this.platform = platform;
	this.level = level;
	this.rank = rank;
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