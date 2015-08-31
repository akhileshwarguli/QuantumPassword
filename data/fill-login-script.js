// a script to fill in your username/password when it finds a login form
var forms = document.forms;
var found = false;

// fill in stored login and password info on a site
self.port.on("start", function fill_login_forms(loginString, passString) {
	// Loop through each form element on the page…
	for (var i=0; i<forms.length; i++) {
		for (var j=0; j<forms[i].length && !found; j++) {
			// Is there an <input type=password> in the form? If not, skip form.
			if (forms[i][j].type == "password") {
				// Fill in the username and/or password. Great success!
				if (forms[i][j-1] != null && forms[i][j-1].name.indexOf("email") == -1) { // avoid filling an email box
					// avoid refilling if the fields are already filled
					if(forms[i][j-1].value != null){
						forms[i][j-1].value = loginString;
						console.debug("fill-login-script: Page has login box. Wrote login: "+forms[i][j-1].value);
					}
					
				} else {
					console.debug("fill-login-script: No login box found");
				}
				if(forms[i][j].value !=null){
					forms[i][j].value = passString;
					console.debug("fill-login-script: Page has password box. Wrote password: "+forms[i][j].value);
				}
				
				found = true;
			}
		}
	}
});