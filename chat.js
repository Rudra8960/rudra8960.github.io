let chatBox = document.getElementById("chatBox");
let msgInput = document.getElementById("msgInput");

// Load old messages
let messages = JSON.parse(localStorage.getItem("messages")) || [];

messages.forEach(msg => {
  addMessage(msg);
});

function sendMsg() {
  let msg = msgInput.value;

  if (msg.trim() === "") return;

  addMessage(msg);

  messages.push(msg);
  localStorage.setItem("messages", JSON.stringify(messages));

  msgInput.value = "";
}

function addMessage(text) {
  let div = document.createElement("div");
  div.className = "message";
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
