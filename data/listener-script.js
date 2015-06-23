self.port.on("start", function () {
	var forms = document.forms;
	if (forms == null) {
		self.port.emit("formsWasNull");
		return;
	}

	// Loop through each form element on the page…
	for (var i=0, tot=forms.length; i<tot; i++) {
		for (var j=0; j<forms[i].length; j++) {
			console.debug("listener-script: Looking at form "+i+" element "+j+": "+forms[i][j].type);
			// Is there an <input type=password> in the form? If not, skip form.
			// Second, skip a password reset form, characterized by having 2 <input type="password"> in a row (eg. a "confirm password" box right after the password box)
			if (forms[i][j].type == "password" && !(forms[i][j+1] != null && forms[i][j+1].type == "password")) {
				console.debug("listener-script: Submit listener attached to form "+i+" with action "+forms[i].action);
				attachSubmitListener(forms[i]);
				break; // go to next form
			} else if (forms[i][j].type == "password") {
				break;
			}
		}
	}
});

function attachSubmitListener(form) {
	// Uses jQuery to listen for form submit
	$(form).submit( function () {
		console.debug("listener-script: Form submitted on "+document.URL);
		returnFormInfo(form);
	});
}

// Sends [formSubmitURL, login, loginField, password, passwordField] values from the form on the page to main.js
function returnFormInfo(form) {
	console.debug("listener-script: Getting form info for form with action"+form.action);
	var login = null;
	var loginField = null;
	var password = null;
	var passwordField = null;
	for (var j=0, innertot=form.length; j<innertot; j++) {
		console.debug("listener-script: input "+j+" "+form[j].type);
		if (form[j].type == "password") {
			// assume the box before password is login
			if (form[j-1] != null) { 
				login = form[j-1].value;
				if (form[j-1].name != null) {
					loginField = form[j-1].name;
				} else {
					loginField = "";
				}
				console.debug("listener-script: Login: "+login+"	Field: "+loginField);
			} else {
				login = "";
				loginField = "";
			}
			
			password = form[j].value;
			if (form[j].name != null) {
				passwordField = form[j].name;
			} else {
				passwordField = "";
			}
			break;
		}
	}
	console.debug("listener-script: submittedCredentials "+form.action+", "+login+", "+loginField+", "+ password+", "+ passwordField);
	self.port.emit("submittedCredentials", form.action, login, loginField, password, passwordField);
}