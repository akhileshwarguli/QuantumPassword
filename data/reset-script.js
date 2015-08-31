var tagToAttach;
/* passType = 0 => Password contains a-z A-Z 0-9 and other special characters
 * passType = 1 => Password contains a-z A-Z 0-9
 * passType = 2 => Password contains a-z A-Z 0-9 . _ -*/
var passType = 0;
var avoidLoginFormCheck = false;

self.port.on("start", function resetPass(siteURL, enteredLogin, currentPass, resetEmail, inputTag) {
	var forms = document.forms,
	found = false,
	toClick = null,
	toSend = null,
	pwInputs = [],
	tagToAttach = inputTag;
	self.port.emit("logThis", "reset-script: Resetting pass on " + document.URL.toString().slice(0, 80) + "..." + document.URL.toString().slice(-50) + " with " + document.forms.length + " forms");

	if (siteURL.toLowerCase().indexOf("fc2.com") > -1 || siteURL.toLowerCase().indexOf("nytimes.com") > -1) {
		passType = 1;
	}
	/* Godaddy.com has a hidden login form, if not avoided script recursively logs-in*/
	if (siteURL.indexOf("godaddy.com") > -1) {
		avoidLoginFormCheck = true;
	}

	// look at each form on the page to see if it's a password reset form
	for (var i = 0, tot = forms.length; i < tot && isFormVisible(forms[i]) && !found; i++) {
		var passwordForm = false,
		currentPWInputs = [];
		console.log("reset-script: Viewing form " + i);
		for (var j = 0, innertot = forms[i].length; j < innertot; j++) {
			/* Is there an <input type=password> in the form? If not, skip form.
			If yes:
			1a. var passwordForm = true, so we know to submit this form.
			1b. count the number of <input type=password>
			2a. if this is the first <input type=password> found, set found = true and enter current credentials
			2b. else enter the new password
			3. set toClick = the last <input type=submit> in this form, then stop looking at forms
			 */
			
			if (forms[i][j].type == "password") {
				if (isLoginForm(forms[i], j) && !avoidLoginFormCheck) {
					// if form is a login form, assume that there's no password reset form in the page and that we must login
					self.port.emit("logThis", "reset-script: Form " + i + " is a login form");
					handleLoginForm(forms[i], j, enteredLogin, currentPass);
					return;
				}
				if (forms[i][j + 1] != null && forms[i][j + 1].type == "password") {
					console.log("reset-script: Form " + i + " is a password reset form");
					passwordForm = true;
				}
				currentPWInputs.push(forms[i][j]);
				if (currentPWInputs.length > 1) {
					// avoid hitting submit if not a password reset form, i.e. it has less than 2 <input type="password"> in sequence
					pwInputs = currentPWInputs;
				}

				if (!found) {
					console.log("reset-script: first password box found");
					found = true;
					if (forms[i][j - 1] != null) { // email
						forms[i][j - 1].value = resetEmail;
					}

					/* // If 3 boxes, fill current password in first password box
					// Else 2 boxes, so let a later function fill in the new password
					if (forms[i][j+2] != null && forms[i][j+2].type == "password") {
					currentPWInputs.splice(0, 1);
					forms[i][j].value = currentPass;
					} */

					/* check next  few elements to confirm that this is the 1st password box
					 * This is because some website have checkboxes, password generating buttons etc
					 * between the old password box and new password boxes.
					 * After confirming that its the 1st password box, enter the old/current password */
					var done = false;
					for (var k = 2; k < 5 && !done; k++) {
						if (forms[i][j + k] != null && forms[i][j + k].type == "password") {
							currentPWInputs.splice(0, 1);
							console.log("reset-script.js: Current Password: "+currentPass);
							forms[i][j].value = currentPass;
							done = true;
						}
					}
				} else {
					console.log("reset-script: other password box found");
				}
			} else if (passwordForm && forms[i][j].type == "submit" && 
			(forms[i][j].value.toLowerCase().indexOf("cancel") < 0 && forms[i][j].value.toLowerCase().indexOf("delete") < 0)) {
				console.log("reset-script: Submit button found: form " + i + " input " + j + ": " + forms[i][j].value);

				// try to enable submit button
				if (!forms[i][j].disabled) {
					forms[i][j].disabled = false;
				}
				// if failed to enable, try submitting a the form by attaching a button
				if (!forms[i][j].disabled) {
					console.log("reset-script.js: toClick()");
					toClick = forms[i][j];
				} else {
						console.log("reset-script.js: toSend()");
					toSend = forms[i];
				}
			}
		}
		if (passwordForm) {
			// assume the first form with a password field on the page is the reset form
			break;
		} else {
			if (found) {
				found = false;
			} // Resetting found to FALSE. Since password form is still not found.
		}
	}

	if (!found) {
		console.log("reset-script: No reset form found");
		self.port.emit("notResetPage");
	} else if (toClick != null && pwInputs.length >= 2) {
		self.port.emit("logThis", "reset-script: toClick - Current pass: " + currentPass);
		prepareRandom(pwInputs, toClick);
	} else if (toSend != null && pwInputs.length >= 2) {
		self.port.emit("logThis", "reset-script: toSend - Current pass: " + currentPass);
		prepareRandom(pwInputs, createSubmitButton(toSend));
	} else {
		self.port.emit("error", "Error: Password change not submitted despite password form being found on " + document.URL);
	}
});

function isLoginForm(form, firstPassInput) {
	if (form[firstPassInput - 1] != null && form[firstPassInput - 1].type == "text"
		 && (form[firstPassInput + 1] == null || form[firstPassInput + 1].type != "password")) {
		return true;
	} else {
		return false;
	}
}

function handleLoginForm(form, i, enteredLogin, currentPass) {
	if (form[i - 1].value == "") {
		form[i - 1].value = enteredLogin;
	}

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
	var defaultParanoia = 8,
	len = 12; // 8 is enough for 512 bits, or 16 x 32-bit characters, len 12 chosen because some sites require 12 or less characters =(
	if (!sjcl.random.isReady()) {
		sjcl.random.randomWords(len, defaultParanoia);
		sjcl.random.startCollectors();
		window.alert("Quantum Passwords needs to fill the random pool to reset your password. Please move your mouse around to fill the pool, and it will alert you when the pool is filled.");
		self.port.emit("logThis", "reset-script: prepareRandom: Collecting mouse movements for random pool.");
		$("body").on('mousemove', function () {
			self.port.emit("logThis", sjcl.random.getProgress(defaultParanoia));
			if (sjcl.random.isReady()) {
				window.alert("The random pool is filled.");
				self.port.emit("logThis", "reset-script: prepareRandom: The random pool is filled.");
				$("body").off('mousemove');
				sjcl.random.stopCollectors();
				var newPass = generateRandomString(sjcl.random.randomWords(len, defaultParanoia), passType);
				finishReset(newPass, pwInputs, clickable);
				//var returnObj = {newPassword: newPass, passwordField: pwInputs, submitField: clickable};
				//self.port.emit("redyToSubmit", returnObj);
			}
		});
	} else {
		var newPass = generateRandomString(sjcl.random.randomWords(len), passType);
		finishReset(newPass, pwInputs, clickable);
		//var returnObj = {newPassword: newPass, passwordField: pwInputs, submitField: clickable};
		//self.port.emit("redyToSubmit", returnObj);
	}
}

function generateRandomString(randoms, pType) {
	console.log("reset-script: Creating new password.");
	var n = [],
	chars = "0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ`~!@#$%^&*()_+-=[]\\;',./{}|:\"<>?"; // the alphabet for our random string
	if (pType != 0) {
		chars = "0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ"; // the alphabet for our random string with only letters and  numbers
	}

	for (var i = 0, tot = randoms.length; i < tot; i++) {
		n.push(chars.substr(randoms[i] % chars.length, 1));
	}
	return n.join("");
}

/* self.port.on("submitForm", function(passedObj){
		finishReset(passedObj.newPassword, passedObj.passwordField, passedObj.submitField);
}); */

function finishReset(newPass, pwInputs, clickable) {
	var pwBox = null;
	self.port.emit("logThis", "reset-script: New password chosen: " + newPass);
	console.log("pwInputs.length: "+pwInputs.length);
	// fill in the new password in the password boxes
	for (var i = 0, tot = pwInputs.length; i < tot; i++) {
		pwInputs[i].value = newPass;
		pwInputs[i].click();
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
	
	self.port.emit("logThis", "reset-script: Clickable.click(): Clickable.value = "+clickable.value);
	clickable.click();
	self.port.emit("logThis", "reset-script: windows.addEventListener() did not fire.");
	self.port.emit("finished", pwBox.value);
}

// return TRUE if Form is Visible / in foreground and  FALSE other wise
function isFormVisible(form){
		var visible = true;
		
		// 1. check for ClassName
		if(form.className.toLowerCase().indexOf("hide")>-1 || form.className.toLowerCase().indexOf("none")>-1){
				visible = false;
		}
		
		return visible;
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
