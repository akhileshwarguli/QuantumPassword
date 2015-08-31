self.port.on("start", function(tagID){
	if(tagID == null){
		self.port.emit("error", "remove-meta-tag.js: tagID was null");
		return;
	}
	
	var x = document.getElementById(tagID);
	document.head.removeChild(x);	
});