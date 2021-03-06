// QUANTUMPASSWORD.0.8
// <startup info>
const PURLS_PATH = "purls.txt";
const IDENTIFIER = "QuantumPasswords";
const READY_FINISHED_ID = IDENTIFIER + "OnReadyActionsCompleted"; // indicates ready listeners are finished attaching
const OLD_PASS_REMOVED_ID = IDENTIFIER + "OldPasswordsRemoved"; // indicates old passwords have been removed from  password manager
const CLOSEABLE_TAB_ID = IDENTIFIER + "CloseThisTab"; // indicates tab can be closed
const CREATE_NEW_TAB_ID = IDENTIFIER + "CreateNewTab"; // indicates we need to open a new tab
const FORM_SUBMITTED_ID = IDENTIFIER + "FormSubmittedSameTab"; // indicates a form was submitted, used in a content script
const LOGIN_AGAIN_ID = IDENTIFIER + "LoginAgainHere"; // indicates we need to login on this page
const SEARCH_AGAIN_ID = IDENTIFIER + "SearchForResetPageAgain"; // indicates we didn't find password reset URL and need to search again on this page
const RESET_FINISHED_ID = IDENTIFIER + "PasswordResetFinished"; // indicates we submitted a password-reset form
const NO_LOGIN_LISTENER_ID = IDENTIFIER + "DoNotAttachLoginListener"; // attached to pages opened by this add-on so we don't listen to extra logins
const MAX_NUM_SEARCHES = 10;
const DATA = require("sdk/self").data;
const TABS = require("sdk/tabs");
const LOG_FILE = "qpasslog.txt";
const SEARCH_HISTORY_FILE = "qpasssearchhistory.txt";
const {Cu} = require("chrome");
const {TextEncoder, TextDecoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
const {defer, resolve} = require('sdk/core/promise');
Cu.import("resource://gre/modules/Task.jsm");
const encoder = new TextEncoder();
var {off} = require("sdk/event/core"); 
var ss = require("sdk/simple-storage");
var text_entry = require("sdk/panel").Panel({
	contentURL: DATA.url("email-text-entry.html"),
	contentScriptFile: DATA.url("get-text.js")
});
require("sdk/preferences/service").set("javascript.options.strict", false); // TODO: remove this line
console.error("Strict warnings enabled? "+require("sdk/preferences/service").get("javascript.options.strict"));
// </startup info>

// <logging>
var pathToLogFile = LOG_FILE;//OS.Path.join(OS.Constants.Path.profileDir, LOG_FILE); TODO: use commented path
function addToLogfile(logData) {
	let currentdate = new Date();
	let dateTime = currentdate.getHours()+":"+currentdate.getMinutes()+":"+currentdate.getSeconds();
	//console.log("(logging) "+dateTime+" "+logData);
	let dataToWrite = encoder.encode(dateTime+" "+logData+"\r\n");
	Task.spawn(function() {
		let exists = yield OS.File.exists(pathToLogFile);
		let pfh = yield OS.File.open(pathToLogFile, exists ? {read:true, write: true, existing: true, append: true} : {read: true, write: true, create: true, append: false });
		yield pfh.write(dataToWrite);
		yield pfh.close(); 
	});
}
addToLogfile("\r\n\r\nNew log "+(new Date()));
// </logging>

// <extension startup actions>
ss.on("OverQuota", myOnOverQuotaListener);
if (!ss.storage.emails) {
	ss.storage.emails = [];
}
if (!ss.storage.defaultEmail) {
	getDefaultEmail();
}
createEmailButton();
TABS.on("ready", function(tab) { // listen for a new url's page to be loaded
	listenForLoginSubmit(tab);
	attachIdentifierToPage(tab, READY_FINISHED_ID);
});
// </extension startup actions>

// <functions>
function reportMessage(message) {
	console.error(message);
	addToLogfile(message);
}

// puts a note on the tab's page source using a META tag with 'identifier' as the tag's ID
function attachIdentifierToPage(tab, identifier) {
	let worker = tab.attach({
		contentScriptFile: DATA.url("attach-meta-tag.js"),
		onError: function(error) {
			reportMessage("main.js: "+error.fileName+":"+error.lineNumber+": "+error+"\nOn "+tab.url);
		}
	});
	
	worker.port.emit("start", identifier);
	
	worker.port.on("error", reportMessage);
}

// waits for a tag with (ID == identifier) to be attached to the tab's page source before returning
function waitForTag(tab, identifier) {
	var deferred = defer();
	
	let worker = tab.attach({
		contentScriptFile: DATA.url("wait-on-tag.js"),
		onError: function(error) {
			reportMessage("main.js: "+error.fileName+":"+error.lineNumber+": "+error+"\nOn "+tab.url);
		}
	});
	
	worker.port.emit("start", identifier);
	
	worker.port.on("found", function() {
		deferred.resolve();
	});
	
	worker.port.on("error", function(message) {
		deferred.reject(message);
	});
	
	return deferred.promise;
}

// wait for all tags with (ID == identifier) to be removed from the tab's page source before returning
function waitForTagRemoval(tab, identifier) {
	var deferred = defer();
	
	let worker = tab.attach({
		contentScriptFile: DATA.url("wait-on-tag-removal.js"),
		onError: function(error) {
			reportMessage("main.js: "+error.fileName+":"+error.lineNumber+": "+error+"\nOn "+tab.url);
		}
	});
	
	worker.port.emit("start", identifier);
	
	worker.port.on("removed", function() {
		deferred.resolve();
	});
	
	worker.port.on("error", function(message) {
		deferred.reject(message);
	});
	
	return deferred.promise;
}

// search the tab's page source for a tag with (ID == identifier) and return true if found
function searchForTag(tab, identifier) {
	var deferred = defer();
	
	let worker = tab.attach({
		contentScriptFile: DATA.url("search-for-tag.js"),
		onError: function(error) {
			reportMessage("main.js: "+error.fileName+":"+error.lineNumber+": "+error+"\nOn "+tab.url);
		}
	});
	
	worker.port.emit("start", identifier);
	
	worker.port.on("found", function() {
		deferred.resolve(true);
	});
	
	worker.port.on("notFound", function() {
		deferred.resolve(false);
	});
	
	return deferred.promise;
}

// finds tabs opened by this add-on (i.e. tabs with a CLOSEABLE_TAB_ID tag), and closes them
function closeCloseableTabs() {
	for (let tab of TABS) {
		searchForTag(tab, CLOSEABLE_TAB_ID)
		.then(function (isCloseable) {
			if (isCloseable) {
				// wait until after the on-ready listeners above are finished attaching to the tab, if needed
				waitForTag(tab, READY_FINISHED_ID) 
				.then(function onSuccess() {
					tab.close();
				});
			}
		})
		.then(null, function onFailure(error) {
			reportMessage(error.fileName+":"+error.lineNumber+": "+error);
		});
	}
}

function myOnOverQuotaListener() {
	while (ss.quotaUsage > 1) {
		reportMessage("main-js: Simple storage is over quota. Removing "+ss.storage.emails.pop());
	}
}

function getDefaultEmail() {
	let text_entry = require("sdk/panel").Panel({
		contentURL: DATA.url("default-email-text-entry.html"),
		contentScriptFile: DATA.url("get-text.js")
	});
	
	text_entry.on("show", function() {
		text_entry.port.emit("show");
	});
	
	text_entry.port.on("text-entered", function (text) {
		ss.storage.defaultEmail = text;
		reportMessage(text+" set as default email address.");
		text_entry.hide();
	});
	
	text_entry.show();
}

function createEmailButton() {
	// Create a button
	require("sdk/ui/button/action").ActionButton({
		id: "show-panel",
		label: "Show Panel",
		icon: {
			"16": "./lock-icon-16.png",
			"32": "./lock-icon-32.png",
			"64": "./lock-icon-64.png"
		},
		onClick: handleClick
	});

	// Show the panel when the user clicks the button.
	function handleClick(state) {
		text_entry.show();
	}

	// When the panel is displayed it generated an event called
	// "show": we will listen for that event and when it happens,
	// send our own "show" event to the panel's script, so the
	// script can prepare the panel for display.
	text_entry.on("show", function() {
		text_entry.port.emit("show");
	});

	// Listen for messages called "text-entered" coming from
	// the content script. The message payload is the text the user
	// entered.
	text_entry.port.on("text-entered", function (text) {
		var fullTabURL = require("sdk/url").URL(TABS.activeTab.url);
		var thisURL = fullTabURL.protocol+"//"+fullTabURL.host+"/";
		console.debug([thisURL, text]);
		for (var i=0, tot=ss.storage.emails.length; i<tot; i++) {
			console.debug(i+": "+ss.storage.emails[i][0]+"\t"+ss.storage.emails[i][1]);
			if (ss.storage.emails[i][0].indexOf(thisURL) > -1) {
				ss.storage.emails.splice(i, 1);
				break;
			}
		}
		ss.storage.emails.push([thisURL, text]);
		text_entry.hide();
	});
}

// Attaches a submit listener to any login forms. On submission, executes a chain of functions that reset user's password for this website when user clicks submit, using password user entered in password box
// this function should complete execution before a user logs in, unless the user has a login script to submit on page ready
function listenForLoginSubmit(tab) {
	var fullTabURL = require("sdk/url").URL(tab.url);
	var siteURL = fullTabURL.protocol+"//"+fullTabURL.host+"/";
	
	searchForTag(tab, NO_LOGIN_LISTENER_ID)
	.then(function onSuccess(truthValue) {
		// continue if the tag isn't there
		if (truthValue) {
			return;
		}
		
		// attach submit listener 
		let worker = tab.attach({
			contentScriptFile: [DATA.url("jquery-1.11.1.min.js"), DATA.url("listener-script.js")],
			onError: function(error) {
				reportMessage("main.js: "+error.fileName+":"+error.lineNumber+": "+error+"\nOn "+tab.url);
			}
		});

		worker.port.emit("start");
		
		worker.port.on("submittedCredentials", function (formSubmitURL, enteredLogin, loginField, enteredPassword, passwordField) {
			console.debug("main-js: Credentials received: "+formSubmitURL+"\t"+enteredLogin+"\t"+loginField+"\t"+enteredPassword+"\t"+passwordField);
			if (enteredLogin == null) {
				reportMessage("Entered login was null, unable to store new credentials");
				return;
			}
			off(worker.port); // required until Mozilla fixes workers
			var scriptRunning = false;
			tab.on("ready", function() {
				if (!scriptRunning) {
					scriptRunning = true;
					updatePassword(tab, siteURL, formSubmitURL, enteredLogin, loginField, enteredPassword, passwordField, 0, true, true,true);
				}
			});
		});
		
		worker.port.on("formsWasNull", function() {
			reportMessage("Unable to attach submit listener: forms was null on "+tab.URL);
		});
	})
	.then(null, function onFailure(error) {
		reportMessage(error.fileName+":"+error.lineNumber+": "+error);
	});
}

// concatenates array2 onto (and modifying) array1, without duplicates
function concatNew(array1, array2) {
	if (array2 == null) {
		return;
	}
	for (var i=0; i<array2.length; i++) {
		if (array1.indexOf(array2[i]) < 0) {
		   array1.push(array2[i]);
		}
	}
}

// Executes the functions to find a password-reset page, reset the user's password for this site using that page, and store the new password in Firefox's password manager
function updatePassword(inputTab, siteURL, formSubmitURL, enteredLogin, loginField, enteredPassword, passwordField, count, continueSearching, needCheckLogin, needCheckStored) {
	
	console.log("main-js: count: "+count);
	
	if (!continueSearching) {
		return;
	}
	count = count + 1;
	
	var tab = inputTab;
	var continueSearching = true, 
	//needCheckLogin = true, needCheckStored = true, 
	needGetResetURL = true;
	var searchHistory = [];
	var newPassword = null, resetURL = null;
	
	
	continueSearching = false;
		var promise = resolve();
		
		promise.then(function (){
			if (needCheckLogin) {
				needCheckLogin = false;
				console.log("main.js: needCheckLogin");
				//require("sdk/timers").setTimeout(function(){
							return checkLogin(tab)
							.then(function onSuccess(loggedIn) {
								// reset password only if login was successful
								console.log("Logged in? "+loggedIn);
								if (!loggedIn) {
									console.log("stop searching");
									throw new Error("main-js: initial login failed.");
								}
							});
				//}, 3000);
			}
		}).then(function () {
			if (needCheckStored) {
				console.log("main.js: needCheckStored");
				needCheckStored = false;
					// check if we already have the url for this site's password reset page
					return checkStoredResetURLs(siteURL);
			}
		}).then(function (newResetURL) {
			if (needGetResetURL) {
				console.log("main.js: needGetResetURL");
				needGetResetURL = false;
					// if we don't have url for site's password reset page, get it
					if (newResetURL == null) {
						return getResetURL(tab);
					} else {
						return resolve(newResetURL);
					}
			}
		}).then(function onSuccess(newResetURL) {
			if (newResetURL != null && newResetURL.length > 0 && searchHistory.indexOf(newResetURL) < 0) {
				resetURL = newResetURL;
				searchHistory.push(newResetURL);
			} else {
				throw new Error("main-js: updatePassword: search produced no new URL, abandoning search");
			}
			
			return prepareToExecute(tab, resetURL);
		})
		.then(function onSuccess(newTab) {
			tab = newTab;
			let minorDeferred = defer();
			var delay = 0;
			if (resetURL.indexOf("twitter.com/") > -1) {
				// twitter requires waiting approx. 1 second to fill in form values (so wait 2 seconds to be safe), 
				//  not sure why, nor how to avoid using a manual delay
				delay = 2000;
			}
			require("sdk/timers").setTimeout( function () { // wait if required
				executeResetScript(tab, siteURL, enteredLogin, enteredPassword, searchHistory)
				.then(minorDeferred.resolve)
				.then(null, minorDeferred.reject);
			}, delay);
			return minorDeferred.promise;
		})
		.then(function onSuccess(output) {
			// depending on the result, output could be an array or a string
			if (output == null) {
				throw new Error("main.js: output from executeResetScript was null");
			}
			
			// find out what happened, then handle results
			var resetFinished = false;
			searchForTag(tab, RESET_FINISHED_ID)
			.then(function onSuccess(truthValue) {
				if (truthValue) {
					resetFinished = true;
					newPassword = output;
					
					// password reset finished; store the password-reset url for this site if not already stored
					//  however, Amazon requires a form submission so storing a URL won't work for that site
					if (siteURL.indexOf("amazon.com") < 0) {
						updateStoredResetURLs(siteURL, resetURL);
						updateSearchHistoryFile(siteURL, searchHistory);
					}
					if (newPassword.constructor === Array) {
						reportMessage("main-js: Password reset finished but executeResetScript returned an array: "+newPassword);
					} else {
						// check that the password was correct
						checkReset(tab, siteURL, formSubmitURL, enteredLogin, loginField, newPassword, passwordField);
						return resolve();
					}
				}
				return searchForTag(tab, LOGIN_AGAIN_ID)
			})
			.then(function onSuccess(truthValue) {
				if (truthValue == null) {
					return resolve();
				}
				if (truthValue) {
					// logged in again, continue search on the new page
					if (!(output.constructor === Array)) {
						throw new Error ("main-js: executeResetScript returned a non-array for searchHistory: "+output);
					}
					// output is the updated searchHistory
					concatNew(searchHistory, output);
					continueSearching = true;
					needCheckLogin = true;
					return resolve();
				}
				return searchForTag(tab, SEARCH_AGAIN_ID);
			})
			.then(function onSuccess(truthValue) {
				if (truthValue == null) {
					return resolve();
				}
				if (truthValue) {
					console.log("Truth Value for SEARCH_AGAIN_ID: "+truthValue);
					// need to search again
					if (!(output.constructor === Array)) {
						throw new Error ("main-js: executeResetScript returned a non-array for searchHistory: "+output);
					}
					// output is the updated searchHistory
					concatNew(searchHistory, output);
					continueSearching = true;
					needGetResetURL = true;
				}
				return resolve();
			})
			.then(function onSuccess() {
				console.log("main-js: Still Going...");
				if (count >= MAX_NUM_SEARCHES && !needCheckLogin) { // don't keep searching infinitely
					continueSearching = false;
					throw new Error("main.js: updatePassword: Search for password reset page exceeded max number searches ("+MAX_NUM_SEARCHES+").\nSearch history: "+searchHistory);
				}				
				console.log("main-js: ContinueSearch: "+continueSearching)
				if (resetFinished) {
					closeCloseableTabs();
				}
			})
			.then(function onSuccess() {
				
				console.log("main-js: Recursive Call ContinueSearch: "+continueSearching);
				
				updatePassword(inputTab, siteURL, formSubmitURL, enteredLogin, loginField, enteredPassword, passwordField, count, continueSearching, false,false);
			})
			.then(null, function onFailure(error) {
				throw new Error(error);
			});
		})
		.then(null, function onFailure(error) {
			reportMessage(error.fileName+":"+error.lineNumber+": "+error);
			if (count >= MAX_NUM_SEARCHES) { // don't keep searching infinitely
				continueSearching = false;
				reportMessage("main.js: updatePassword: Search for password reset page exceeded max number searches ("+MAX_NUM_SEARCHES+").\nSearch history: "+searchHistory);
			}
			closeCloseableTabs();
		});
	
}

function checkLogin(tab) {
	var deferred = defer();
	let worker = tab.attach({
		contentScriptFile: DATA.url("login-check-script.js"),
		onError: deferred.reject
	});
	
	worker.port.emit("start");
	
	worker.port.on("bad_login", function() {
		console.log("main-js: Bad login");
		off(worker.port); // required until Mozilla fixes workers
		deferred.resolve(false);
	});
	
	worker.port.on("good_login", function() {
		console.log("main-js: Good login");
		off(worker.port); // required until Mozilla fixes workers
		waitForTag(tab, READY_FINISHED_ID) // wait until after the on-ready listeners above are finished being attached to page
		.then(function onSuccess() {
			deferred.resolve(true);
		})
		.then(null, function onFailure(error) {
			deferred.reject(error);
		});
	});
	
	return deferred.promise;
}

// tries to get the URL of the password reset page from purls.txt
// returns a string for the URL, or null if none was found
function checkStoredResetURLs(siteURL) {
	var deferred = defer();
	
	let decoder = new TextDecoder();
	let pathToPurls = "purls.txt";//OS.Path.join(OS.Constants.Path.profileDir, "purls.txt"); TODO: use commented path
	OS.File.read(pathToPurls)
	.then(function onSuccess(array) {
		let text = decoder.decode(array);
		let startPos = text.indexOf(siteURL);
		if (startPos < 0) return null;
		text = text.substring(startPos, text.length);
		return text.substring(text.indexOf("\t")+1, text.indexOf("\n") > -1 ? text.indexOf("\n") : text.length);
	},
	function onReject(reason) {
		throw new Error("Couldn't read from purls.txt:\n"+reason);
	})
	.then(function onSuccess(resetURL) {
		deferred.resolve(resetURL);
	}, // resolve URL
	function onReject(reason) {
		deferred.resolve(); // resolve null, which is okay since we can search for the URL on the page
	})
	.then(null, deferred.reject);
	
	return deferred.promise;
}
	
// gets URL of password reset page by searching page links
function getResetURL(tab, searchHistory) {
	var deferred = defer();
	var needsCloseableTag = false;
	
	let worker = tab.attach({
		contentScriptFile: DATA.url("find-reset-url-script.js"),
		onError: deferred.reject
	});
	
	// make sure we reattach a closeable tag if needed
	searchForTag(tab, CLOSEABLE_TAB_ID)
	.then(function onSuccess(truthValue) {
		if (truthValue) {
			needsCloseableTag = true;
		}
	})
	.then(function onSuccess() {
		worker.port.emit("start", CLOSEABLE_TAB_ID, FORM_SUBMITTED_ID);
	})
	.then(null, function onFailure(error) {
		reportMessage(error.fileName+":"+error.lineNumber+": "+error);
	});
	
	worker.port.on("foundForm", deferred.resolve); // we found the next URL in a form and clicked it, we're now in the new page and are returning the url of the current page
	
	worker.port.on("found", function(returnedURL) {
		// found a link to the password reset page
		if (needsCloseableTag) {
			attachIdentifierToPage(tab, CLOSEABLE_TAB_ID);
		}
		attachIdentifierToPage(tab, CREATE_NEW_TAB_ID); // put a note on the page to open URL in a new tab
		deferred.resolve(returnedURL);
	});
	
	worker.port.on("notFound", function() {
		deferred.reject("main-js: link to password reset page not found");
	});
	
	return deferred.promise;
}

function prepareToExecute(tab, resetURL) {
	var deferred = defer();
	var openURLInNewTab = true;
	
	// open the URL for the password reset page; in a new tab if needed
	searchForTag(tab, CREATE_NEW_TAB_ID)
	.then(function onSuccess(truthValue) {
		openURLInNewTab = truthValue;
	})
	.then(null, function onFailure(reason) {
		throw new Error(reason);
	});
	
	if (openURLInNewTab) {
		openNewTab(resetURL)
		.then(deferred.resolve) // sends the newly-opened tab to next promise
		.then(null, deferred.reject);
	} else {
		deferred.resolve(tab);
	}
	
	return deferred.promise;
}

// returns a new tab with url = urlToOpen
function openNewTab(urlToOpen) {
	var deferred = defer();
	
	var scriptRunning = false;
	TABS.open({
		url: urlToOpen,
		inBackground: true,
		onOpen: function(newTab) {
			tab = newTab;
		},
		onReady: function() {
			if (!scriptRunning) { // or this will execute over and over because a page sends ready signals after each form submission
				scriptRunning = true;
				attachIdentifierToPage(tab, CLOSEABLE_TAB_ID); // add note to page that this tab should be closed when add-on actions are finished
				deferred.resolve(tab);
			}
		}
	});
	
	return deferred.promise;
}

// attaches script to reset user's password
function executeResetScript(tab, siteURL, enteredLogin, enteredPassword, searchHistory) {
	console.debug("main-js: Attempting to reset pass on "+tab.url);
	var deferred = defer();
	var needsCloseableTag = false;
	
	let worker = tab.attach({
		contentScriptFile: [DATA.url("sjcl.js"), DATA.url("jquery-1.11.1.min.js"), DATA.url("reset-script.js")],
		onError: deferred.reject
	});
	
	// make sure we reattach a closeable tag if needed
	searchForTag(tab, CLOSEABLE_TAB_ID)
	.then(function onSuccess(truthValue) {
		if (truthValue) {
			needsCloseableTag = true;
		}
	})
	.then(function onSuccess() {
		worker.port.emit("start", enteredLogin, enteredPassword, getResetEmail(siteURL), NO_LOGIN_LISTENER_ID);
	})
	.then(null, function onFailure(error) {
		reportMessage(error.fileName+":"+error.lineNumber+": "+error);
	});
	
	worker.port.on("logThis", reportMessage);
	
	worker.port.on("error", deferred.reject);
	
	worker.port.on("wasLoginScreen", function() {
		// we ended up at a login page, so we logged in again and will continue searching
		searchHistory.push(tab.url);
		attachIdentifierToPage(tab, LOGIN_AGAIN_ID);
		deferred.resolve(searchHistory);
	});
	
	worker.port.on("notResetPage", function() {
		// we can't reset the password on this page, so add a note to the page to search again
		console.debug("main-js: Could not reset password: not a password reset page.");
		
		// this could cause an infinite loop, eg. this page links to another page that links back to this one
		// current solution: add this tab's url to searchHistory, and the search method quits on a repeated url or after a certain number visited
		searchHistory.push(tab.url);
		attachIdentifierToPage(tab, SEARCH_AGAIN_ID);
		deferred.resolve(searchHistory);
	});
	
	worker.port.on("finished", function(newPass) {
		if (newPass == null) {
			deferred.reject("main-js: New password was null, unable to store new credentials");
		} else {
			if (needsCloseableTag) {
				attachIdentifierToPage(tab, CLOSEABLE_TAB_ID);
			}
			attachIdentifierToPage(tab, RESET_FINISHED_ID);
			deferred.resolve(newPass);
		}
	});
	
	return deferred.promise;
}

function getResetEmail(siteURL) {
	if (!ss.storage.emails) {
		return ss.storage.defaultEmail;
	}
	for (var i=0, tot=ss.storage.emails.length; i<tot; i++) {
		if (siteURL == ss.storage.emails[i][0]) {
			return ss.storage.emails[i][1];
		}
	}
	return ss.storage.defaultEmail;
}

function updateStoredResetURLs(siteURL, resetURL) {
	var fileName = PURLS_PATH; // purls = Password-reset URLs
	let decoder = new TextDecoder();
	var data = encoder.encode("\r\n"+siteURL+"\t"+resetURL+"\r\n");
	Task.spawn(function() {
		let exists = yield OS.File.exists(fileName);
		let pfh = yield OS.File.open(fileName, exists ? {read:true, write: true, existing: true, append: true} : {read: true, write: true, create: true, append: false });
		let array = yield pfh.read();
		text = decoder.decode(array);
		if (text.indexOf(siteURL) < 0) yield pfh.write(data);
		yield pfh.close(); 
	});
}

function updateSearchHistoryFile(siteURL, searchHistory) {
	var fileName = SEARCH_HISTORY_FILE;
	let decoder = new TextDecoder();
	var data = encoder.encode("\r\n"+siteURL+"\t"+searchHistory+"\r\n");
	Task.spawn(function() {
		let exists = yield OS.File.exists(fileName);
		let pfh = yield OS.File.open(fileName, exists ? {read:true, write: true, existing: true, append: true} : {read: true, write: true, create: true, append: false });
		let array = yield pfh.read();
		text = decoder.decode(array);
		if (text.indexOf(siteURL) < 0) yield pfh.write(data);
		yield pfh.close(); 
	});
}

function checkReset(tab, siteURL, formSubmitURL, enteredLogin, loginField, newPass, passwordField) {
	worker = tab.attach({
		contentScriptFile: DATA.url("login-check-script.js"),
		onError: function(error) {
			reportMessage("main.js: "+error.fileName+":"+error.lineNumber+": "+error);
		}
	});
	
	worker.port.on("bad_login", function() {
		reportMessage("main-js: Incorrect information entered during password reset, please attempt manually");
	});
	
	worker.port.on("good_login", function() {
		storePassAsync(tab, siteURL, formSubmitURL, enteredLogin, loginField, newPass, passwordField)
		.then(null, function onFailure(error) {
			reportMessage(error.fileName+":"+error.lineNumber+": "+error);
		});
	});
}

// removes old credentials for this site and stores new ones in Firefox's password manager
function storePassAsync(tab, siteURL, submitURL, myUsername, myUsernameField, myNewPass, myPassField) {
	var passwords = require("sdk/passwords");
	var deferred = defer();
	
	passwords.search({
		url: siteURL,
		username: myUsername,
		onComplete: function onComplete(credentials) {
			for (var i = 0, len = credentials.length; i < len; i++) {
				passwords.remove(credentials[i]);
			}
			attachIdentifierToPage(tab, OLD_PASS_REMOVED_ID);
		},
		onError: function(event) {
			deferred.reject(event);
		}
	});
	
	// wait to avoid "login already exists" error - purely cosmetic, not necessary if you're not viewing the console
	waitForTag(tab, OLD_PASS_REMOVED_ID)
	.then(function onSuccess() {
		passwords.store({
			url: siteURL,
			formSubmitURL: submitURL,
			username: myUsername,
			usernameField: myUsernameField,
			password: myNewPass,
			passwordField: myPassField
		});
		deferred.resolve();
		reportMessage("main-js: Credentials stored: "+myUsername+" "+myNewPass);
	});
	
	return deferred.promise;
}
// </functions>

// credit: nmaier for OS.File.open example, Mozilla Addon SDK, W3Schools, and StackOverflow for code examples