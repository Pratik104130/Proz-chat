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



let unreadDividerAdded = false;

function getLastSeenKey() {
  return "lastSeen_" + currentGroup;
}



// ================= GLOBAL VARIABLES =================




var currentGroup = "default"; // default group
let soundEnabled = false;

let isAtBottom = true;

let lastDateLabel = "";
// ================= USERNAME & STATUS =================
const savedName = localStorage.getItem("username");
if (savedName) {
  usernameInput.value = savedName;
  initStatus();
}

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

let usernameTimer;

usernameInput.addEventListener("input", () => {
  clearTimeout(usernameTimer);
  
  usernameTimer = setTimeout(async () => {
    let baseName = usernameInput.value.trim();
    if (!baseName) return;
    
    const uniqueName = await getUniqueUsername(baseName);
    
    usernameInput.value = uniqueName;
    localStorage.setItem("username", uniqueName);
    
    db.ref("users/" + uniqueName).set(true);
    initStatus();
  }, 600); // wait till user stops typing
});

function checkAdmin() {
  isAdmin = (usernameInput.value === ADMIN_NAME);
  if (isAdmin) {
    showAdminPanel();
  } else {
    hideAdminPanel();
  }
}

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
  lastDateLabel = "";
  // save last seen when leaving previous group
const lastKey = getLastSeenKey();
localStorage.setItem(lastKey, Date.now());
unreadDividerAdded = false;
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
  
  let hours = date.getHours(); // 0–23
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 → 12
  
  if (minutes < 10) minutes = "0" + minutes;
  
  return hours + ":" + minutes + " " + ampm;
}
function getDateLabel(time) {
  const msgDate = new Date(Number(time));
  const now = new Date();
  
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  
  if (msgDate >= startToday) return "Today";
  if (msgDate >= startYesterday) return "Yesterday";
  
  const d = String(msgDate.getDate()).padStart(2, "0");
  const m = String(msgDate.getMonth() + 1).padStart(2, "0");
  const y = msgDate.getFullYear();
  
  return `${d}/${m}/${y}`;
}
// ================= LOAD GROUP MESSAGES =================
function loadGroupMessages() {
  const ref = db.ref("groupMessages/" + currentGroup).limitToLast(100);
  
  messagesDiv.innerHTML = "";
  
  ref.off();
  
  ref.on("child_added", snapshot => {
    const shouldStickToBottom =
      messagesDiv.scrollTop + messagesDiv.clientHeight >=
      messagesDiv.scrollHeight - 40;
    
    displayMessage(snapshot);
    
    if (shouldStickToBottom) {
      requestAnimationFrame(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
    }
  });
  
  ref.on("child_changed", snapshot => {
    updateSeen(snapshot);
  });
  
  ref.on("child_removed", snapshot => {
    const msgDiv = document.getElementById(snapshot.key);
    if (msgDiv) msgDiv.remove();
  });
}

// ================= DISPLAY MESSAGE =================
function displayMessage(snapshot) {
  const data = snapshot.val();
  if (!data || !data.name || !data.text) return;
  
  const myName = usernameInput.value;
  
  // ===== DATE SEPARATOR LOGIC =====
  const currentLabel = getDateLabel(data.time);
  
  if (currentLabel !== lastDateLabel) {
    const dateDiv = document.createElement("div");
    dateDiv.className = "date-separator";
    dateDiv.textContent = `--- ${currentLabel} ---`;
    messagesDiv.appendChild(dateDiv);
    
    lastDateLabel = currentLabel;
  }
  // ===============================
  
  const msgDiv = document.createElement("div");
  msgDiv.className = "msg " + (data.name === myName ? "you" : "other");
  msgDiv.id = snapshot.key;
  
  let ticks = "";
  if (data.name === myName) {
    ticks = data.seen ?
      `<span class="tick seen">✔✔</span>` :
      `<span class="tick">✔</span>`;
  }
  
  let deleteHTML = "";
  if (data.name === myName) {
    deleteHTML = `<span class="delete" onclick="deleteMessage('${snapshot.key}')"> delete</span>`;
  }
  
  msgDiv.innerHTML = `
    <b>${data.name}:</b> ${data.text}
    ${ticks}
    ${deleteHTML}
    <span class="time">${formatTime(data.time)}</span>
  `;
  
  messagesDiv.appendChild(msgDiv);
  
  if (data.name !== myName) {
    db.ref(`groupMessages/${currentGroup}/${snapshot.key}/seen`).set(true);
    if (soundEnabled) {
      notifySound.currentTime = 0;
      notifySound.play();
    }
  }
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
  const msgDiv = document.getElementById(msgId);
  if (!msgDiv) return;
  
  const bg = window.getComputedStyle(msgDiv).backgroundColor;


  // Create particles INSIDE message
  for (let i = 0; i < 20; i++) {
    const dust = document.createElement("div");
    dust.className = "dust";
    
    dust.style.background = bg;
    dust.style.left = Math.random() * msgDiv.offsetWidth + "px";
    dust.style.top = Math.random() * msgDiv.offsetHeight + "px";
    
    dust.style.setProperty("--x", (Math.random() - 0.5) * 100 + "px");
    dust.style.setProperty("--y", (Math.random() - 0.5) * 100 + "px");
    
    msgDiv.appendChild(dust);
    
    setTimeout(() => dust.remove(), 600);
  }
  
  // Shrink + fade
  msgDiv.style.transition = "transform 0.35s ease, opacity 0.35s ease";
  msgDiv.style.transform = "scale(0.75)";
  msgDiv.style.opacity = "0";
  
  // Remove from Firebase AFTER animation
  setTimeout(() => {
    db.ref(`groupMessages/${currentGroup}/${msgId}`).remove();
  }, 350);
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

messagesDiv.addEventListener("scroll", () => {
  isAtBottom =
    messagesDiv.scrollTop + messagesDiv.clientHeight >=
    messagesDiv.scrollHeight - 20;
});


//delete old 7 days messages 

function cleanOldMessages(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000; // default 7 days
  const messagesRef = db.ref("groupMessages/" + currentGroup);
  
  messagesRef.orderByChild("time").endAt(cutoff).once("value", snapshot => {
    snapshot.forEach(msg => {
      messagesRef.child(msg.key).remove();
    });
  });
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



// When joining a group or loading messages
joinGroupFirebase(currentGroup);
cleanOldMessages(); // cleanup old messages

// Optional: repeat every hour
setInterval(() => {
  cleanOldMessages();
}, 60 * 60 * 1000); // every 1 hour