module.exports = mongoose.model('EmailBody', {
	mysqlId    : Number,
	emailId     : String,
    message		: String,
    createdAt   : { type : Number, default : Date.now()},
    updatedAt	: { type : Number, default : Date.now()}
});