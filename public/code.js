let receiverID;
let senderID;
let fileBuffer = "";
let fileName;
const socket = io();

function generateId() {
    let code = "x".repeat(6)
         .replace(/./g, c => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 62) ] );
    return code;
}

const filedrop_btn = document.getElementById('file-drop')
const filedrop_input = document.getElementById("fileid");
filedrop_btn.addEventListener("click", () => {
    filedrop_input.click()
})

const codeinput = document.getElementById('code');
const codebtn = document.getElementById('code-btn');
const helptext = document.getElementById('helptext');
const qrcode = document.getElementById('qrcode');
const fileshare = document.getElementById('fileshare');
const processnode = document.getElementById('processnode');
const checkmark = document.getElementById('checkmark');
const downloaded = document.getElementById('downloaded');

if(localStorage.getItem("code") || localStorage.getItem("code") !== ""){
    codeinput.value = localStorage.getItem('code')
    codebtn.click();
    localStorage.setItem("code", "");
}

codebtn.addEventListener("click", () => {
    if(fileBuffer !== "") {
        codeinput.select();
        codeinput.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(codeinput.value);
        alert("code copied "+codeinput.value)
    }else{
        if(codeinput.value == "" || codeinput.value.length !== 6){
            alert("Invalid Code");
            return;
        }
        senderID = codeinput.value;
        let recJoinID = generateId();
        socket.emit("receiver-join", {
            uid: recJoinID,
            server_uid: senderID
        })
        filedrop_btn.style.display = "none";
        fileshare.style.display = "flex";
    }
})

filedrop_input.addEventListener("change", (event) => {
    let file = event.target.files[0];
    if(!file){
        return;
    }
    fileName = file.name;
    let reader = new FileReader();
    reader.onload = function(e) {
        let buffer = new Uint8Array(reader.result);
        fileBuffer = buffer;
        let joinId = generateId();
        socket.emit("sender-join", {
            uid: joinId
        })
        codeinput.value = joinId;
        codebtn.innerHTML = "Copy"
        helptext.style.display = "block";
        filedrop_btn.style.display = "none";
        qrcode.style.background = "url('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="+joinId+"&qzone=1&color=ffd900')";
        qrcode.style.backgroundSize = "cover";
        qrcode.style.display = "block"
    }
    reader.readAsArrayBuffer(file);
})

socket.on("init", function(uid) {
    fileshare.style.display = "flex";
    qrcode.style.display = "none";
    let metadata = {
        fileName: fileName,
        total_buffer_size: fileBuffer.length,
        buffer_size: 4096 * 100
    }
    socket.emit("file-meta", {
        uid: uid,
        metadata: metadata
    })
    socket.on("fs-share", () => {
        console.log("sender")
        let chunk = fileBuffer.slice(0, metadata.buffer_size);
        fileBuffer = fileBuffer.slice(metadata.buffer_size, fileBuffer.length);
        fileshare.style.display = "flex"
        processnode.innerText = Math.trunc((metadata.total_buffer_size - fileBuffer.length) / metadata.total_buffer_size * 100) + "%";
        downloaded.innerText = ((metadata.total_buffer_size - fileBuffer.length) / 1024 / 1024).toFixed(2)  + " MB / " + (metadata.total_buffer_size / 1024 / 1024).toFixed(2) + " MB";
        if(processnode.innerText == "100%"){
            processnode.style.display = "none";
            downloaded.style.display = "none";
            checkmark.style.display = "block"
        }
        if(chunk.length != 0) {
            socket.emit("file-raw",  {
                uid: uid,
                buffer: chunk
            })
        }
    })
})

let files = {}

socket.on("fs-meta" , function(metadata) {
    files.metadata = metadata;
    files.transmitted = 0;
    files.buffer = [];
    files.progress_node = processnode;

    socket.emit("fs-start", {
        uid: senderID
    });

    socket.on("fs-share", function(buffer) {
        files.buffer.push(buffer);
        files.transmitted += buffer.byteLength;
        fileshare.style.display = "flex"
        console.log(Math.trunc((files.transmitted / files.metadata.total_buffer_size) * 100))
        processnode.innerText = Math.trunc((files.transmitted / files.metadata.total_buffer_size) * 100) + "%";
        downloaded.innerText = (files.transmitted / 1024 / 1024).toFixed(2)  + " MB / " + (metadata.total_buffer_size / 1024 / 1024).toFixed(2) + " MB";
        downloaded.style.display = "none"
        if(files.transmitted == files.metadata.total_buffer_size){
            processnode.style.display = "none";
            checkmark.style.display = "block"
            console.log(files)
            createAndDownloadBlobFile(files.buffer, files.metadata.fileName)
            files = {};
        }else{
            socket.emit("fs-start", {
                uid: senderID
            })
        }
    })
})

function createAndDownloadBlobFile(body, filename) {
    const blob = new Blob(body);
    const fileName = `${filename}`;
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, fileName);
    } else {
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }