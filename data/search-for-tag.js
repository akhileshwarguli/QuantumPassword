self.port.on("start", function (tagID) {
	if (tagID == null) {
		self.port.emit("error", "search-for-tag.js: tagID was null");
		return;
	}
	if (document.getElementById(tagID) == null) {
		self.port.emit("notFound");
	} else {
		self.port.emit("found");
	}
});