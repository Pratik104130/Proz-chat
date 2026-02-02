// ================= FIREBASE CONFIG =================
var firebaseConfig = {
  apiKey: "AIzaSyCRykGgYV0t3vqe1MraK7Hvg2uZvuhna4E",
  authDomain: "chat-alp.firebaseapp.com",
  databaseURL: "https://chat-alp-default-rtdb.firebaseio.com",
  projectId: "chat-alp",
  storageBucket: "chat-alp.appspot.com",
  messagingSenderId: "891719681818",
  appId: "1:891719681818:web:9fa3e65816b6db43c18ea3"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();

// ================= ELEMENTS =================
var usernameInput  = document.getElementById("username");
var messageInput   = document.getElementById("message");
var messagesDiv    = document.getElementById("messages");
var sendBtn        = document.getElementById("sendBtn");
var statusDiv      = document.getElementById("status");
var typingDiv      = document.getElementById("typing");
var notifySound    = document.getElementById("notifySound");

var createGroupBtn = document.getElementById("createGroupBtn");
var joinGroupBtn   = document.getElementById("joinGroupBtn");
var exitGroupBtn   = document.getElementById("exitGroupBtn");
var onlineDiv      = document.getElementById("onlineUsers");
var currentGroupDisplay = document.getElementById("currentGroupDisplay"); // top right

// ================= GLOBAL VARIABLES =================
var currentGroup = "default"; // default group
let soundEnabled = false;

// ================= USERNAME & STATUS =================
usernameInput.value = localStorage.getItem("username") || "";

function initStatus() {
  var username = usernameInput.value;
  if (!username) return;

  var statusRef = db.ref("status/" + username);
  statusRef.set("online");
  statusRef.onDisconnect().set("offline");

  statusRef.on("value", snapshot => {
    statusDiv.innerText = snapshot.exists() && snapshot.val() === "online" ? "● Online" : "● Offline";
  });
}

initStatus();

usernameInput.addEventListener("change", () => {
  localStorage.setItem("username", usernameInput.value);
  initStatus();
});

// ================= CURRENT GROUP DISPLAY =================
function updateGroupDisplay() {
  currentGroupDisplay.innerText = "Group: " + currentGroup;
}

// ================= GROUP MEMBERSHIP =================
function setGroupMemberStatus(groupName) {
  var username = usernameInput.value;
  if (!username) return;

  var memberRef = db.ref(`groupMembers/${groupName}/${username}`);
  memberRef.set(true);
  memberRef.onDisconnect().remove();

  updateOnlineUsers();
}

function updateOnlineUsers() {
  if (!onlineDiv) return;

  db.ref(`groupMembers/${currentGroup}`).on("value", snapshot => {
    var groupMembers = snapshot.val() || {};
    var membersList = [];

    var memberKeys = Object.keys(groupMembers);
    if (memberKeys.length === 0) {
      onlineDiv.innerText = "No members online";
      return;
    }

    memberKeys.forEach(username => {
      db.ref(`status/${username}`).once("value").then(snap => {
        if (snap.exists() && snap.val() === "online") {
          membersList.push(username);
        }
        onlineDiv.innerText = "Online: " + membersList.join(", ");
      });
    });
  });
}

// ================= CREATE GROUP =================
createGroupBtn.addEventListener("click", () => {
  var groupName = prompt("Enter Group Name:");
  if (!groupName) return;

  var groupPassword = prompt("Set a password for this group:");
  if (!groupPassword) return;

  db.ref("groups/" + groupName).set({
    password: groupPassword,
    createdAt: Date.now()
  });

  alert(`Group "${groupName}" created!`);
  joinGroupFirebase(groupName);
});

// ================= JOIN GROUP =================
joinGroupBtn.addEventListener("click", () => {
  var groupName = prompt("Enter Group Name to join:");
  if (!groupName) return;

  db.ref("groups/" + groupName).once("value").then(snapshot => {
    if (!snapshot.exists()) {
      alert("Group does not exist!");
      return;
    }

    var groupData = snapshot.val();
    var enteredPassword = prompt(`Enter password for ${groupName}:`);
    if (enteredPassword === groupData.password) {
      joinGroupFirebase(groupName);
    } else {
      alert("Incorrect password!");
    }
  });
});

// ================= JOIN GROUP FUNCTION =================
function joinGroupFirebase(groupName) {
  currentGroup = groupName;
  localStorage.setItem("currentGroup", currentGroup); // persist
  messagesDiv.innerHTML = "";
  loadGroupMessages();
  setGroupMemberStatus(currentGroup);
  updateOnlineUsers();
  updateGroupDisplay(); // update top right
}

// ================= EXIT GROUP =================
exitGroupBtn.addEventListener("click", () => {
  if (currentGroup === "default") {
    alert("You are already in the default group!");
    return;
  }

  var username = usernameInput.value;
  db.ref(`groupMembers/${currentGroup}/${username}`).remove();

  currentGroup = "default";
  localStorage.setItem("currentGroup", currentGroup);
  messagesDiv.innerHTML = "";
  setGroupMemberStatus(currentGroup);
  loadGroupMessages();
  updateOnlineUsers();
  updateGroupDisplay(); // update top right
  alert("You have exited the group.");
});

// ================= SEND MESSAGE =================
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  var name = usernameInput.value;
  var text = messageInput.value;
  if (!name || !text) return;

  var msgRef = db.ref("groupMessages/" + currentGroup).push();
  msgRef.set({
    id: msgRef.key,
    name: name,
    text: text,
    seen: false,
    time: Date.now()
  });

  messageInput.value = "";
}

// ================= FORMAT TIME =================
function formatTime(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  let minutes = date.getMinutes();
  if (hours < 10) hours = "0" + hours;
  if (minutes < 10) minutes = "0" + minutes;
  return hours + ":" + minutes;
}

// ================= LOAD GROUP MESSAGES =================
function loadGroupMessages() {
  db.ref("groupMessages/" + currentGroup).limitToLast(100).off();

  // New message added
  db.ref("groupMessages/" + currentGroup).limitToLast(100).on("child_added", snapshot => {
    displayMessage(snapshot);
  });

  // Update seen ticks
  db.ref("groupMessages/" + currentGroup).on("child_changed", snapshot => {
    updateSeen(snapshot);
  });

  // Remove messages in real-time
  db.ref("groupMessages/" + currentGroup).on("child_removed", snapshot => {
    var msgDiv = document.getElementById(snapshot.key);
    if (msgDiv) msgDiv.remove(); // remove immediately
  });
}

// ================= DISPLAY MESSAGE =================
function displayMessage(snapshot) {
  var data = snapshot.val();
  if (!data || !data.name || !data.text) return;

  var myName = usernameInput.value;
  var msgDiv = document.createElement("div");
  msgDiv.className = "msg " + (data.name === myName ? "you" : "other");
  msgDiv.id = snapshot.key;

  var ticks = "";
  if (data.name === myName) {
    ticks = data.seen ? `<span class="tick seen">✔✔</span>` : `<span class="tick">✔</span>`;
  }

  var deleteHTML = "";
  if (data.name === myName) {
    deleteHTML = `<span class="delete" onclick="deleteMessage('${snapshot.key}')"> delete</span>`;
  }

  var timeHTML = `<span class="time">${formatTime(data.time)}</span>`; // show time

  msgDiv.innerHTML = `<b>${data.name}:</b> ${data.text} ${ticks} ${deleteHTML} ${timeHTML}`;

  if (data.name !== myName) {
    db.ref(`groupMessages/${currentGroup}/${snapshot.key}/seen`).set(true);
    if (soundEnabled) {
      notifySound.currentTime = 0;
      notifySound.play();
    }
  }

  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ================= UPDATE SEEN =================
function updateSeen(snapshot) {
  var data = snapshot.val();
  var myName = usernameInput.value;

  if (data.name === myName && data.seen) {
    var msgDiv = document.getElementById(snapshot.key);
    if (!msgDiv) return;

    var tick = msgDiv.querySelector(".tick");
    if (tick) {
      tick.innerText = "✔✔";
      tick.classList.add("seen");
    }
  }
}

// ================= DELETE MESSAGE =================
function deleteMessage(msgId) {
  db.ref(`groupMessages/${currentGroup}/${msgId}`).remove();
}

// ================= TYPING INDICATOR =================
var typingRef = db.ref("typing");

messageInput.addEventListener("input", () => {
  if (!usernameInput.value) return;
  typingRef.set(usernameInput.value + "|" + currentGroup);
  setTimeout(() => typingRef.remove(), 800);
});

typingRef.on("value", snapshot => {
  if (!snapshot.exists()) return;

  var val = snapshot.val().split("|");
  var typingUser = val[0];
  var typingGroup = val[1];

  if (typingUser !== usernameInput.value && typingGroup === currentGroup) {
    typingDiv.innerText = typingUser + " is typing...";
  } else {
    typingDiv.innerText = "";
  }
});

// ================= NOTIFICATION SOUND =================
// ================= AUTO UNLOCK SOUND (NO BUTTON) =================
let soundUnlocked = false;

function unlockSound() {
  if (soundUnlocked) return;
  
  notifySound.muted = true;
  notifySound.play().then(() => {
    notifySound.pause();
    notifySound.currentTime = 0;
    notifySound.muted = false;
    soundUnlocked = true;
    soundEnabled = true;
  }).catch(() => {});
}

// Any first interaction unlocks sound
document.addEventListener("click", unlockSound, { once: true });
document.addEventListener("touchstart", unlockSound, { once: true });
document.addEventListener("keydown", unlockSound, { once: true });

// ================= INITIAL LOAD =================
var savedGroup = localStorage.getItem("currentGroup");
if (savedGroup) {
  currentGroup = savedGroup;
}
updateGroupDisplay();
setGroupMemberStatus(currentGroup);
updateOnlineUsers();
loadGroupMessages();

