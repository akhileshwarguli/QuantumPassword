// a script to submit the last password form on a page, not sure what it's useful for
var forms = document.forms;
var found = false;
var toClick = null;

// Loop through each form element on the page…
for (var i=0; i<forms.length; i++) {
	var passwordForm = false;
	for (var j=0; j<forms[i].length; j++) {
		// Is there an <input type=password> in the form? If not, skip form.
		if (forms[i][j].type == "password") {
			passwordForm = true;
			found = true;
		} else if (passwordForm && forms[i][j].type == "submit") {
			toClick = forms[i][j];
		}
	}
}

if (toClick != null) {
	// submit form
	toClick.click();
}