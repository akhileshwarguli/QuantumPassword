const max_count = 9999;

self.port.on("start", function (tagID) {
	var count = 0;
	if (tagID == null) {
		self.port.emit("error", "wait-on-tag.js: tagID was null");
		return;
	}
	while(document.getElementById(tagID) != null && count < max_count) {
		count++;
	}
	if (document.getElementById(tagID) == null) {
		self.port.emit("removed");
	} else {
		self.port.emit("error", "wait-on-tag-removal.js: tagID still exists after "+max_count+" iterations.");
	}
});