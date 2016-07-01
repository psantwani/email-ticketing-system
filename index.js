var inbox = require("inbox");
var express = require('express');
var app = express();
var db = require('node-mysql');
var mysql = require('mysql');
var DB = db.DB;
var BaseRow = db.Row;
var BaseTable = db.Table;
var fetchString = 'Content-Type: text/plain; charset=UTF-8\r';
var configDB	= require('./config/database.js');
GLOBAL.mongoose	= require('mongoose');
mongoose.connect(configDB.url);
var emailBodySchema	= require('./models/email_body.js');
var EmailBody	= mongoose.model('EmailBody', emailBodySchema, "emailbodies");
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'root',
  port     :  8889,
  database : '<DB-NAME>'
});
connection.connect();

var api_key = '<YOUR KEY>';
var domain = '<YOUR DOMAIN>';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

app.listen(9000, function(){
	console.log("Magic happens at port 9000");
});

app.get('/clearDB', function(req, res){
	clearDB();
	res.send("OK");
});

app.get('/messages', function(req, res){
	getAllMessagesFromMongo(function(data){
		res.send(JSON.parse(data));
	});
});
 
var client = inbox.createConnection(false, "<IMAP ADD>", {
    secureConnection: true,
    auth:{
        user: "<EMAIL ID>",
        pass: "<EMAIL PASSWORD>"
    }
});
 
client.connect();
 
client.on("connect", function(){
    client.openMailbox("INBOX", function(error, info){
        if(error) throw error;
 
        client.listMessages(-10, function(err, messages){
            messages.forEach(function(message){
                //console.log(message.UID + ": " + message.title);
            });
        });
    });
});

client.on("new", function(message){
	var from_name = message.from.name;
	var from_email = message.from.address;
	var title = message.title;
    var stream = client.createMessageStream(message.UID);
    var msgContent = "";
    stream.on("data", function(data){
		msgContent += data;
    });
    stream.on("end", function(data){
		/**console.log(msgContent);**/
		var lines = msgContent.split("\n");
		var fetchStringIndex = lines.indexOf(fetchString);
		var previousLine = lines[(fetchStringIndex - 1)];
		lines.splice(0,fetchStringIndex + 2);
		var nextIndex = lines.indexOf(previousLine);
		lines.splice(nextIndex, lines.length - nextIndex);
		var msgBody = lines.join("\n");
		var tktIndex = title.indexOf("[TKT");
		if(tktIndex > -1){
			console.log("Old ticket");
			var ticket_number = title.substring(tktIndex + 1, tktIndex + 10);
			getMySQLId(ticket_number, function(data){
				var mysqlId = data;
				var messageData = {
					mysqlId : mysqlId,
					emailId : from_email,
					message : msgBody
				};
				var emailBodyRecord = new emailBodySchema(messageData);
				emailBodyRecord.save(function(err){
					if(err){
						console.log("Error occured in saving the email to the DB.");
						console.log(err);
					}
					else{
						console.log("New email body added to DB successfully.");
						var message_id = emailBodyRecord._id;
						var trail_data = {
								ticket_id : mysqlId,
								ticket_number : ticket_number,
								message_id : message_id
							};
						saveTrail(trail_data);
					}
				});
			});
		}
		else{
			console.log("New ticket");
			var emailData = {
				subject : title,
				from_name : from_name,
				from_email : from_email
			};

			var query = connection.query('INSERT INTO tickets SET ?', emailData, function(err, result){
				if(err){
					console.log(err);
					console.log("Error occured in saving the email to the DB. Error 1");
				}
				else{
					var mysqlId = result.insertId;
					var data = {
						mysqlId : mysqlId,
						emailId : from_email,
						message : msgBody
					};
					var emailBodyRecord = new emailBodySchema(data);
					emailBodyRecord.save(function(err){
						if(err){
							console.log("Error occured in saving the email body to the DB. Error 2");
							console.log(err);
						}
						else{
							console.log("New email boy added to DB successfully.");
							var message_id = emailBodyRecord._id;
							newTicketNumber(data.mysqlId, function(data){
								var ticket_number = data;
								var trail_data = {
									ticket_id : mysqlId,
									ticket_number : ticket_number,
									message_id : message_id
								};
								saveTrail(trail_data);
								var reply = {
									from: '<NAME> <EMAIL ID>',
									to: from_email,
									subject: '[' + ticket_number + '] ' + title,
									text: 'Your complaint/feedback has been registered under the ticket number ' + ticket_number + ' . The customer care team will get back to you within 2 working days. Thank you for using JustRide. Ride. Rent. Repeat.'
								};
							
								mailgun.messages().send(reply, function (error, body) {
									console.log(body);
								});
							});
						}
					});
				}
			});
		}
    });
});


function newTicketNumber(mysqlId, callback){
	var ticketRadix = 1000000;
	var ticketId = "TKT" + (ticketRadix + mysqlId).toString().slice(1);
	var query = connection.query('UPDATE tickets SET ticket_id = ? WHERE id = ?', [ticketId, mysqlId] , function(err, result){
		if(result){
			callback(ticketId);
		}
		if(err)
			console.log("Error occured in updating ticket Id to DB");
			console.log(err);
	});
}

function getMySQLId(data, callback){
	connection.query("SELECT * FROM tickets WHERE ticket_id = '" + data + "'", function(err, rows, fields){
		if (err){
			console.log("getMySQLId error");
			console.log(err);
		}
		else{
			callback(rows[0].id);
		}
	});
}

function saveTrail(trailData){
	var query = connection.query('INSERT INTO message_trail SET ?', trailData, function(err, result){
		if(result){
			console.log("Trail added successfully");
		}
		if(err){
			console.log("Error occured while adding trail to DB");
			console.log(err);
		}
	});
}

function clearDB(){
	mongoose.connection.db.dropCollection('emailbodies', function(err, result) {
		console.log("Email body DB Cleared");
	});
}

function getAllMessagesFromMongo(callback){
	EmailBody.find().lean().exec(function (err, items) {
		return callback(JSON.stringify(items));
	});
}