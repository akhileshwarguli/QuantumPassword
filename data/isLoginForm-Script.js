
self.port.on("start", function(){
	var forms = document.forms;
	var found = false;
	for(var i=0; i<forms.length && !found; i++){
		console.log("Form.id: "+forms[i].id);
		if(isLoginForm(forms[i])){
			found = true; 
		}
	}
	
	if(found){
		self.port.emit("true");
	}
	else{
		self.port.emit("false");
	}
	
});

function isLoginForm(form){
  var return_val = null;
  for(var i=0; i<form.length; i++){
    if(form[i].type == "password"){
      //console.log("Found a PASSWORD field - i:"+i);
      if(checkNeighbours(form, i)){
        return_val = true;
      }
      else{
        return_val = false;
      }
    }
  }
  if(return_val ==null){
    return_val = false;
  }
  return return_val
}

function checkNeighbours(form, i){
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
  /* console.log("foundUsernameField: "+foundUsernameField);
  console.log("foundSubmitButton: "+foundSubmitButton);
  console.log("foundResetPass: "+foundResetPass); */
  if(foundSubmitButton && foundUsernameField && !foundResetPass){
    return_val = true;
  }
  
  return return_val;
  
}