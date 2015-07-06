self.port.on("start", function () {
	var text = document.body.innerHTML.toLowerCase();
	if (hasLoginForm() ||
		text.indexOf("password you entered is incorrect") > -1 ||
		text.indexOf("invalid temporary or current password") > -1 ||
		text.indexOf("specified an incorrect or inactive username, or an invalid password") > 1 ||
		text.indexOf("you are not allowed to login") > -1) {
			console.debug("login-check-scripts-js: bad login");
		self.port.emit("bad_login");
	} else {
		console.debug("login-check-scripts-js: good login");
		self.port.emit("good_login");
	}
});

function hasLoginForm() {
	var forms = document.forms;
	
	// look at each form on the page, and check its inputs for type=password
	for (var i=0, tot=forms.length; i<tot; i++) {
		for (var j=0, innertot=forms[i].length; j<innertot; j++) {
			if (forms[i][j].type == "password") {
				if (isLoginForm(forms[i], j)) { 
					return true;
				}
			}
		}
	}
	
	return false;
}

function isLoginForm(form, firstPassInput) {
	if(form[firstPassInput-1] != null && form[firstPassInput-1].type == "text"
		&& (form[firstPassInput+1] == null || form[firstPassInput+1].type != "password")) {
		return true;
	} else {
		return false;
	}
}