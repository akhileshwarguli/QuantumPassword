self.port.on("start", function (siteURL) {
	var text = document.body.innerHTML.toLowerCase();
	
	if (hasLoginForm(siteURL) ||
		//(text.indexOf("password") >-1 && (text.indexOf("incorrect") >-1 || text.indexOf("wrong") >-1)) ||
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

function hasLoginForm(siteURL) {
	var forms = document.forms;
	/* Godaddy.com has login form hidden even after we login*/
	if (siteURL.indexOf("godaddy.com") < 0) {
		// look at each form on the page, and check its inputs for type=password
		for (var i = 0, tot = forms.length; i < tot; i++) {
			for (var j = 0, innertot = forms[i].length; j < innertot; j++) {
				if (forms[i][j].type == "password") {
					if (isLoginForm(forms[i], j)) {
						console.log("login-check-scripts-js: hasLoginForm(): returning TRUE");
						return true;
					}
				}
			}
		}
	}

	console.log("login-check-scripts-js: hasLoginForm(): returning FALSE");
	return false;
}

/* function isLoginForm(form, firstPassInput) {
	if ((form[firstPassInput - 1] != null && 
       ((form[firstPassInput-1].id.toLowerCase().indexOf("new")<0 && form[firstPassInput-1].id.toLowerCase().indexOf("email")<0) || ( form[firstPassInput-1].name.toLowerCase().indexOf("new")<0 && form[firstPassInput-1].name.toLowerCase().indexOf("email")<0)) 
       && (form[firstPassInput - 1].type == "text" || form[firstPassInput - 1].type == "email")
	|| form[firstPassInput - 2] != null && 
       ((form[firstPassInput-2].id.toLowerCase().indexOf("new")<0 && form[firstPassInput-2].id.toLowerCase().indexOf("email")<0) || ( form[firstPassInput-2].name.toLowerCase().indexOf("new")<0 && form[firstPassInput-2].name.toLowerCase().indexOf("email")<0)) 
       &&  (form[firstPassInput - 2].type == "text" || form[firstPassInput - 2].type == "email")
	|| form[firstPassInput - 3] != null && 
       ((form[firstPassInput-3].id.toLowerCase().indexOf("new")<0 && form[firstPassInput-3].id.toLowerCase().indexOf("email")<0) || ( form[firstPassInput-3].name.toLowerCase().indexOf("new")<0 && form[firstPassInput-3].name.toLowerCase().indexOf("email")<0)) 
       &&  (form[firstPassInput - 3].type == "text" || form[firstPassInput - 3].type == "email"))
		 && (form[firstPassInput + 1] == null || form[firstPassInput + 1].type != "password")) {
		return true;
	} else {
		return false;
	}
} */

function isLoginForm(form, i){
  var return_val = false;
  var foundUsernameField = false, foundSubmitButton = false, foundResetPass = false;
  
  // check if any of previous 3 elements is of type "TEXT" or "EMAIL"
  for(var j=1; (i-j)>=0 && !foundUsernameField; j++){
    if(form[i-j]!=null && (form[i-j].type == "text" || form[i-j].type == "email")){
      foundUsernameField = true;
    }
  }
  // check if any of the elements after i are of type "SUBMIT"
  var pattern = /login|log in|log_in|log-in|signin|sign in|sign-in|sign_in/i;
  for(var j=0; j<5 &&(i+j)<form.length&& !foundSubmitButton; j++){
    var eleValue = form[i+j].value;
    var eleId = form[i+j].id;
    if(form[i+j] != null && (form[i+j].type == "submit" ||
                            (form[i+j].type == "button" && pattern.test(eleValue)) ||
                            (form[i+j].tagName.toLowerCase() == "button" && pattern.test(eleId)))){
      foundSubmitButton = true;
    }
  }  
  // check for any links elements in form used as SUBMIT button. For example: disneystore.com
  if(!foundSubmitButton){
     var aList = form.getElementsByTagName("a");
    for(var j=0; j<aList.length && !foundSubmitButton; j++){
      var idValue = aList[j].id.toLowerCase();
      if(pattern.test(idValue)){
           foundSubmitButton = true;
      }
    }
  }
  
  // check if there are any elements of type "password" after i
  for(var j=1; j<5 && !foundResetPass; j++){
    if(form[i+j] != null && form[i+j].type == "password"){
      foundResetPass= true;
    }
  }
  console.log("foundUsernameField: "+foundUsernameField);
  console.log("foundSubmitButton: "+foundSubmitButton);
  console.log("foundResetPass: "+foundResetPass);
  if(foundSubmitButton && foundUsernameField && !foundResetPass){
    return_val = true;
  }
  
  return return_val;
  
}
