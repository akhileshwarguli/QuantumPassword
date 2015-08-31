// Google doesn't work with a test profile because of google quirks - will it work in deployment?
// live.com: sign-in page doesn't have forms
// twitter: refuses password form request in testing
// amazon: requires clicking an input:submit button value="Edit", maybe?
var priority_pri = 0,
priority_set = 1,
priority_pro = 2,
priority_acc = 3,
priority_sec = 4,
priority_pre = 5,
priority_edi_pro = 6,
priority_pas = 7,
priority_highest = 100;
var tempHistory = [];

self.port.on("start", function (hostURL, closeableTabID, formSubmittedID, history) {
		
	var formSubmit = null,
	formFound = false, buttonFound = false;
	resetLink = null,
	pageURL = document.URL;

	var tempHistory = [];
	if (history.length != 0) {
		tempHistory = history.slice();
		console.log("find-reset-url-script.js: HISTORY LENGTH: " + tempHistory.length);
		for (var i = 0; i < tempHistory.length; i++) {
			tempHistory[i] = tempHistory[i].toLowerCase();
			//console.log("\n"+i+": "+tempHistory[i]+"\n");
		}
	}

	// check forms on the page
	for (var i = 0, tot = document.forms.length; i < tot; i++) {
		for (var j = 0, tot2 = document.forms[i].length; j < tot2; j++) {
			if (
				document.forms[i][j].id.toLowerCase().indexOf("change_password") > -1
				|| document.forms[i][j].id.toLowerCase().indexOf("password") > -1) {
				if (tempHistory.indexOf(document.forms[i].action.toString().toLowerCase()) < 0) {
					console.log("find-reset-url-script: Reset URL form found");
					formFound = true;
					form = document.forms[i];
					resetLink = document.forms[i].action.toString();
				}
			}
		}
	}
	
	// check for buttons which would open  reset-password page.
	// example website: pinterest.com
	if(!formFound){
		var buttonList = document.getElementsByTagName("button");
		for(var i=0; i<buttonList.length; i++){
			if((buttonList[i].innerHTML.toString().toLowerCase().indexOf("change")>-1
			|| buttonList[i].innerHTML.toString().toLowerCase().indexOf("reset")>-1)
			&& buttonList[i].innerHTML.toString().toLowerCase().indexOf("password")>-1){
				buttonList[i].click();
				buttonFound = true;
			}
		}		
	}
		
	var link = null,
	linkElement = null,
	found = -1;
	// check links and pick the one most likely to go to a password reset page
	if (!formFound && !buttonFound) {
		console.log("find-reset-url-script: Reset URL not in form, checking links. " + document.links.length);
		for (var i = 0, tot = document.links.length; i < tot; i++) {
			link = document.links[i].innerHTML.toLowerCase();

			if (tempHistory.indexOf(document.links[i].href.toString().toLowerCase()) < 0) {

				if (found < priority_highest && link.indexOf("change password") > -1) {
					found = priority_highest;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_pas && link.indexOf("password") > -1) {
					found = priority_pas;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_edi_pro && link.indexOf("edit profile") > -1) {
					found = priority_edi_pro;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_pre && link.indexOf("preferences") > -1) {
					found = priority_pre;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_sec && link.indexOf("security") > -1) {
					found = priority_sec;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_acc && link.indexOf("account") > -1) {
					found = priority_acc;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_pro && link.indexOf("profile") > -1) {
					found = priority_pro;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_set && link.indexOf("settings") > -1) {
					found = priority_set;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				} else if (found < priority_pri && link.indexOf("privacy") > -1) {
					found = priority_pri;
					resetLink = document.links[i].href.toString();
					linkElement = document.links[i];
				}
			}

			//console.log("find-reset-url-script: Found Priority: "+found);
		}
	}

	// return results
	if (formFound) {
		console.log("find-reset-url-script: Reset URL found in form: " + resetLink.toString().slice(0, 100) + "...");

		/* Commented since  window.addEventListener() doesn't seem to get fired.
		self.port.emit() is moved to line# 112
		 */
		// attach listener for page unload
		/* window.addEventListener("onload", function(){
		console.log("window.addEventListener(\"onload\")");
		self.port.emit("foundForm", resetLink);
		}); */
		createAndClickSubmitButton(form, resetLink);
	} else if (buttonFound){
			console.log("find-reset-url-script: Reset URL found in Button... ");
			self.port.emit("foundButton");	
	}	else if (found > -1) {
		console.log("find-reset-url-script: Reset URL Priority: " + found);
		console.log("find-reset-url-script: Reset URL link: " + resetLink.toString().slice(0, 80) + "..." + resetLink.toString().slice(-50));
		
		/* If the reset Link has to be clicked, and not open in a new tab
		 * This can be identified if the resetLink is almost the same are page URL.
		 * In this case it's same as clicking and opening a form, therefore we emit the
		 * same formFound event. ELse we go ahead and open it in new tab*/
		if ((resetLink.indexOf(pageURL) > -1 && resetLink.length <= pageURL.length + 5)
			|| resetLink.toLowerCase().indexOf("javascript:void(0)")>-1) {
			linkElement.click();
			console.log("find-reset-url-script: Link CLICKED...");
			self.port.emit("foundForm", resetLink);
		} else {
			self.port.emit("found", resetLink, found);
		}
	} else {
		console.log("find-reset-url-script: Reset URL not found");
		self.port.emit("notFound");
	}
});

// creates a submit button for the given form and clicks it to submit the form
//  useful because a form's own submit button might be greyed out until a user enters text,
//  even if the add-on has already entered text
function createAndClickSubmitButton(form, resetLink) {
	var input = document.createElement('input');
	input.type = 'submit';
	form.appendChild(input);
	input.click();
	console.log("find-reset-url-script: Created a SUBMIT input and CLICKED.");
	self.port.emit("foundForm", resetLink);
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
