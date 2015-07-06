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
	var passwordIndex = 9999;
	
	/* for (var j=0, innertot=form.length; j<innertot; j++) {
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
	} */
	
	var divList = form.getElementsByTagName("div");
	var ipList = form.getElementsByTagName("input");
	
	console.debug("listener-script.js: Input List- "+ipList.length);
	console.debug("listener-script.js: Div List- "+divList.length);
	
	// Search Login 7 LoginField in Input-List
	for(var i=0; i<ipList.length; i++){
	   if(ipList[i].type != "hidden"){
		 if(password == null){
		   if(ipList[i].type == "password"){
			 passwordIndex =i;
			 password = ipList[i].value;
			 passwordField = ipList[i].name;
		   }         
		  }
		  if(login == null){
			if(ipList[i].type=="email"){
			  login = ipList[i].value;
			  loginField = ipList[i].name;
			}
		  else if(login == null && ipList[i].type=="text"){
			  if((ipList[i].id.toLowerCase().indexOf("email")>-1 ||
				ipList[i].id.toLowerCase().indexOf("username")>-1) ||
				(ipList[i].name.toLowerCase().indexOf("email")>-1 ||
				ipList[i].name.toLowerCase().indexOf("username")>-1)){
				
				login = ipList[i].value;
				loginField = ipList[i].name;            
			  }
			}
		  } 
		}
	}
	// Search Login & LoginField in Div-List
	if(login==null){
	  for(var i=0; i<divList.length; i++){
		if(divList[i].innerHTML.length !=0 &&
		  divList[i].innerHTML.indexOf(" ")<0 &&
		  divList[i].innerHTML.indexOf("-")<0 &&
		  divList[i].innerHTML.indexOf("@")>-1){
		  login = divList[i].innerHTML;
		}
	  }
	  
	}
	// Search Login & LoginField around Password
	if(login == null){
		if(passwordIndex!=9999){
			//assuming the Input Element of TYPE = text before password is UserName(login)
			for(var i=passwordIndex-1; i>-1; i--){
				if(ipList[i].type == "text"){
					login = ipList[i].value;
					loginField = ipList[i].name;
				}
			}
		}
		else{
			login= "";
			loginField = "";
		}
	}
	
	console.debug("listener-script: submittedCredentials "+form.action+", "+login+", "+loginField+", "+ password+", "+ passwordField);
	self.port.emit("submittedCredentials", form.action, login, loginField, password, passwordField);
}