const fileInput = document.getElementById("fileInput");
const sendFileButton = document.getElementById("sendFile");
const statusDiv = document.getElementById("status");
const messagesArea = document.getElementById("messages");

let peerConnection;
let dataChannel;

const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// WebSocket for signaling (replace localhost with your server address)
const signalingServer = new WebSocket("ws://localhost:8080");

signalingServer.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    if (data.offer) {
        await handleOffer(data.offer);
    } else if (data.answer) {
        await peerConnection.setRemoteDescription(data.answer);
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(data.candidate);
    }
};

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    dataChannel = peerConnection.createDataChannel("fileTransfer");
    dataChannel.onopen = () => (statusDiv.textContent = "Status: Connected");
    dataChannel.onclose = () => (statusDiv.textContent = "Status: Disconnected");
    dataChannel.onmessage = (event) => {
        messagesArea.value += `Received: ${event.data}\n`;
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingServer.send(
                JSON.stringify({ candidate: event.candidate })
            );
        }
    };
}

async function handleOffer(offer) {
    createPeerConnection();
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify({ answer }));
}

sendFileButton.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) return alert("Please select a file first!");

    const reader = new FileReader();
    reader.onload = () => {
        dataChannel.send(reader.result);
        messagesArea.value += `Sent: ${file.name}\n`;
    };
    reader.readAsArrayBuffer(file);
});

createPeerConnection();
peerConnection.createOffer().then(async (offer) => {
    await peerConnection.setLocalDescription(offer);
    signalingServer.send(JSON.stringify({ offer }));
});
