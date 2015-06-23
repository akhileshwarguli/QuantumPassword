self.port.on("start", function (tagID) {
	if (tagID == null) {
		self.port.emit("error", "attach-meta-tag.js: tagID was null");
		return;
	}
	var x = document.createElement("meta"); 
	x.id = tagID;
	document.head.appendChild(x);
});