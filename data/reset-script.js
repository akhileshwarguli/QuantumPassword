var tagToAttach;

self.port.on("start", function resetPass(enteredLogin, currentPass, resetEmail, inputTag) {
	var forms = document.forms, found = false, toClick = null, toSend = null, pwInputs = [], tagToAttach = inputTag;
	self.port.emit("logThis", "reset-script: Resetting pass on "+document.URL.toString().slice(0,80)+"..."+document.URL.toString().slice(-50)+" with "+document.forms.length+" forms");
	
	// look at each form on the page to see if it's a password reset form
	for (var i=0, tot=forms.length; i<tot && !found; i++) {
		var passwordForm = false, currentPWInputs = [];
		console.debug("reset-script: Viewing form "+i);
		for (var j=0, innertot=forms[i].length; j<innertot; j++) {
			// Is there an <input type=password> in the form? If not, skip form.
			// If yes:
			//	1a. var passwordForm = true, so we know to submit this form.
			//	1b. count the number of <input type=password>
			// 	2a. if this is the first <input type=password> found, set found = true and enter current credentials
			//	2b. else enter the new password
			//	3. set toClick = the last <input type=submit> in this form, then stop looking at forms
			if (forms[i][j].type == "password") {
				if (isLoginForm(forms[i], j)) { 
					// if form is a login form, assume that there's no password reset form in the page and that we must login
					self.port.emit("logThis", "reset-script: Form "+i+" is a login form");
					handleLoginForm(forms[i], j, enteredLogin, currentPass);
					return;
				}
				if (forms[i][j+1] != null && forms[i][j+1].type == "password") {
					console.debug("reset-script: Form "+i+" is a password reset form");
					passwordForm = true;
				}
				currentPWInputs.push(forms[i][j]);
				if (currentPWInputs.length > 1) {
					// avoid hitting submit if not a password reset form, i.e. it has less than 2 <input type="password"> in sequence
					pwInputs = currentPWInputs;
				}
				
				if (!found) {
					console.debug("reset-script: first password box found");
					found = true;
					if (forms[i][j-1] != null) { // email
						forms[i][j-1].value = resetEmail;
					}
					
					// If 3 boxes, fill current password in first password box
					// Else 2 boxes, so let a later function fill in the new password
					if (forms[i][j+2] != null && forms[i][j+2].type == "password") {
						currentPWInputs.splice(0, 1);
						forms[i][j].value = currentPass;
					}
				} else {
					console.debug("reset-script: other password box found");
				}
			} else if (passwordForm && forms[i][j].type == "submit" && forms[i][j].value.toLowerCase().indexOf("cancel") < 0) {
				console.debug("reset-script: Submit button found: form "+i+" input "+j+": "+forms[i][j].value);
				if (!forms[i][j].disabled) {
					toClick = forms[i][j];
				} else {
					toSend = forms[i];
				}
			}
		}
		if (passwordForm) {
			// assume the first form with a password field on the page is the reset form
			break; 
		}
	}
	
	if (!found) {
		console.log("reset-script: No reset form found");
		self.port.emit("notResetPage");
	} else if (toClick != null && pwInputs.length >= 2) {
		self.port.emit("logThis", "reset-script: Current pass: "+currentPass);
		prepareRandom(pwInputs, toClick);
	} else if (toSend != null && pwInputs.length >= 2) {
		self.port.emit("logThis", "reset-script: Current pass: "+currentPass);
		prepareRandom(pwInputs, createSubmitButton(toSend));
	} else {
		self.port.emit("error", "Error: Password change not submitted despite password form being found on "+document.URL);
	}
});

function isLoginForm(form, firstPassInput) {
	if(form[firstPassInput-1] != null && form[firstPassInput-1].type == "text"
		&& (form[firstPassInput+1] == null || form[firstPassInput+1].type != "password")) {
		return true;
	} else {
		return false;
	}
}

function handleLoginForm(form, i, enteredLogin, currentPass) {
	form[i-1].value = enteredLogin;
	form[i].value = currentPass;
	createSubmitButton(form).click();
	self.port.emit("logThis", "reset-script: handleLoginForm: Determined page was login screen and tried to log in");
	self.port.emit("wasLoginScreen");
}

function createSubmitButton(form) {
	var input = document.createElement('input');
	input.type = 'submit';
	form.appendChild(input);
	return input;
}

function prepareRandom(pwInputs, clickable) {
	// create random numbers with sjcl.randomWords - note this creates 32-bit integers
	//  thus defaultParanoia = 10 (the max paranoia level) can be used to create passwords with up to 32 x UTF-32 characters in this implementation
	var defaultParanoia = 8, len = 12; // 8 is enough for 512 bits, or 16 x 32-bit characters, len 12 chosen because some sites require 12 or less characters =(
	if (!sjcl.random.isReady()) {
	sjcl.random.randomWords(len, defaultParanoia);
		sjcl.random.startCollectors();
		window.alert("Quantum Passwords needs to fill the random pool to reset your password. Please move your mouse around to fill the pool, and it will alert you when the pool is filled.");
		self.port.emit("logThis", "reset-script: prepareRandom: Collecting mouse movements for random pool.");
		$("body").on('mousemove', function() {
			self.port.emit("logThis", sjcl.random.getProgress(defaultParanoia));
			if(sjcl.random.isReady()) {
				window.alert("The random pool is filled.");
				self.port.emit("logThis", "reset-script: prepareRandom: The random pool is filled.");
				$("body").off('mousemove');
				sjcl.random.stopCollectors();
				var newPass = generateRandomString(sjcl.random.randomWords(len, defaultParanoia));
				finishReset(newPass, pwInputs, clickable);
			}
		});
	} else {
		var newPass = generateRandomString(sjcl.random.randomWords(len));
		finishReset(newPass, pwInputs, clickable);
	}
}

function generateRandomString(randoms) {
	console.debug("reset-script: Creating new password.");
	var n = [], chars = "0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ`~!@#$%^&*()_+-=[]\\;',./{}|:\"<>?"; // the alphabet for our random string
	for (var i=0, tot=randoms.length; i<tot; i++) {
		n.push(chars.substr(randoms[i] % chars.length, 1));
	}
	return n.join("");
}

function finishReset(newPass, pwInputs, clickable) {
	var pwBox = null;
	self.port.emit("logThis", "reset-script: New password chosen: "+newPass);
	// fill in the new password in the password boxes
	for (var i=0, tot=pwInputs.length; i < tot; i++) {
		pwInputs[i].value = newPass;
		pwBox = pwInputs[i];
	}
	
	/* Commented since  window.addEventListener() doesn't seem to get fired.
		self.port.emit() is moved to line# 159
	*/
	// attach listener for page unload
	/* window.addEventListener("onload", function(){
		attachTag(tagToAttach);
		self.port.emit("finished", pwBox.value);
	}); */
	clickable.click();
	self.port.emit("logThis", "reset-script: windows.addEventListener() did not fire.");
	self.port.emit("finished", pwBox.value);
}

// currently unused function
function attachTag(tagID) {
	if (tagID == null) {
		self.port.emit("error", "find-reset-url-script.js: attachTag: tagID was null");
		return;
	}
	var x = document.createElement("meta"); 
	x.id = tagID;
	document.head.appendChild(x);
}