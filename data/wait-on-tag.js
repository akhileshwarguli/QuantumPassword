const max_count = 9999;

self.port.on("start", function (tagID) {
	var count = 0;
	console.log("wait-on-tag.js: START tag: "+tagID+" TAB: "+document.URL);
	if (tagID == null) {
		self.port.emit("error", "wait-on-tag.js: tagID was null");
		return;
	}
	while(document.getElementById(tagID) == null && count < max_count) {
		count++;
	}
	console.log("wait-on-tag.js: Complete count: "+count);
	console.log("wait-on-tag.js: "+document.getElementById(tagID));
	var temp = document.getElementsByTagName("meta");
	console.log("wait-on-tag.js: meta Length: "+temp.length);
	if (document.getElementById(tagID) == null) {
		self.port.emit("error", "wait-on-tag.js: tagID not found after "+max_count+" iterations.");
	} else {
		console.log("wait-on-tag.js: EMIT FOUND "+tagID);
		self.port.emit("found");
	}
});