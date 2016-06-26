var inbox = require("inbox");
var express = require('express');
var app = express();
var db = require('node-mysql');
var mysql = require('mysql');
var DB = db.DB;
var BaseRow = db.Row;
var BaseTable = db.Table;
var fetchString = 'Content-Type: text/plain; charset=UTF-8\r';
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'root',
  port     :  8889,
  database : '<DB-NAME>'
});
connection.connect();

app.listen(9000, function(){
	console.log("Magic happens at port 9000");
});
 
var client = inbox.createConnection(false, "imap.gmail.com", {
    secureConnection: true,
    auth:{
        user: "<YOUR EMAIL>",
        pass: "<YOUR PASSWORD>"
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
		console.log("---MESSAGE CONTENT---");
		console.log(msgContent);
		var lines = msgContent.split("\n");
		var fetchStringIndex = lines.indexOf(fetchString);
		var previousLine = lines[(fetchStringIndex - 1)];
		lines.splice(0,fetchStringIndex + 2);
		var nextIndex = lines.indexOf(previousLine);
		lines.splice(nextIndex, lines.length - nextIndex);
		var msgBody = lines.join("\n");
		
		var emailData = {
			subject : title,
			from_name : from_name,
			from_email : from_email,
			body : msgBody
		};
		
		var query = connection.query('INSERT INTO tickets SET ?', emailData, function(err, result){
			if(result)
				console.log("New email added to DB successfully.");
			if(err)
				console.log("Error occured in adding new email to DB");
		});
    });
});