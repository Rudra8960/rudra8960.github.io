const firebaseConfig = {
  apiKey: "AIzaSyCy1reCJaNB1aG3UXT8LPpRR-CgQXXAdZk",
  authDomain: "mychatapp-8ee22.firebaseapp.com",
  databaseURL: "https://mychatapp-8ee22-default-rtdb.firebaseio.com",
  projectId: "mychatapp-8ee22",
  storageBucket: "mychatapp-8ee22.firebasestorage.app",
  messagingSenderId: "844615179260",
  appId: "1:844615179260:web:2f197d1d330448c6dff079"
};

firebase.initializeApp(firebaseConfig);

var db = firebase.database().ref("chats");

var isAdmin = false;
var currentUser="";


// ADMIN LOGIN (OLD)
function adminLogin(){
  var pass = prompt("Enter admin password:");
  if(pass === "Rudra@12"){
    isAdmin = true;
    alert("Admin mode ON");

    document.getElementById("chatBox").innerHTML = "";
    showMessages();
  } else {
    alert("Wrong password");
  }
}


// SEND MESSAGE (UPDATED BUT OLD FUNCTION SAME)
function sendMessage() {

  var name = document.getElementById("username").value;
  var msg = document.getElementById("message").value;
  var receiver = document.getElementById("receiver").value;

  if(name == "" || msg == ""){
    alert("Name and message required");
    return;
  }

  currentUser=name;

  db.push({
    user: name,
    message: msg,
    to: receiver || "public"
  });

  document.getElementById("message").value = "";
}


// SHOW MESSAGES
function showMessages(){

  db.off();

  db.on("child_added", function(snapshot){

    var data = snapshot.val();
    var key = snapshot.key;

    var chatBox = document.getElementById("chatBox");

    var receiver = document.getElementById("receiver").value;

    if(
      data.to=="public" ||
      data.user==currentUser ||
      data.to==currentUser
    ){

      let html = `<p id="${key}">
      <b>${data.user}:</b> ${data.message}`;

      if(isAdmin){
        html += ` <button onclick="deleteMsg('${key}')">❌</button>`;
      }

      html += `</p>`;

      chatBox.innerHTML += html;
    }

  });

}


// DELETE MESSAGE
function deleteMsg(key){
  if(isAdmin){
    firebase.database().ref("chats/" + key).remove();
    document.getElementById(key).remove();
  }
}


// TYPING INDICATOR
function typing(){

  var name=document.getElementById("username").value;

  firebase.database().ref("typing/"+name).set(true);

  setTimeout(function(){
    firebase.database().ref("typing/"+name).remove();
  },2000);

}


// SHOW TYPING USERS
firebase.database().ref("typing").on("value",function(snapshot){

let users=[];

snapshot.forEach(function(child){

users.push(child.key);

});

if(users.length>0){

document.getElementById("typing").innerText=
users.join(", ")+" typing...";

}else{

document.getElementById("typing").innerText="";

}

});


// ONLINE USERS
firebase.database().ref("chats").on("value",function(snapshot){

let list={};

snapshot.forEach(function(child){

let data=child.val();
list[data.user]=true;

});

let html="";

for(let user in list){

html+=`<div>${user}</div>`;

}

document.getElementById("users").innerHTML=html;

});


// LOAD MESSAGES
showMessages();