
// 状態取得更新間隔(ms)
let status_update_interval_ms = 500;
// メッセージキュー送信間隔(ms)
let message_queue_send_interval_ms = 100;
// 対話状態保持
var chat_state = {};


// サーバーURL取得
function server_url(){
    var backendAddress = document.getElementById('backend_address').value;
    return backendAddress;
}




// ショートカットキーハンドラ
function shortcutkey_handler(event){

    // Ctrl+Enterでメッセージ送信
    if(event.ctrlKey && event.key === 'Enter'){
        send_message();
    }
}
document.addEventListener('keydown', shortcutkey_handler);

// WebSocketセッション
var websocket_chat = null;
// 対話セッションID
var chat_session_id = null;

// WebSocketセッション作成
function create_ws_session(){

    var ws_url = "ws://" + server_url() + "/chat_ws";
    console.log("create ws session: " + ws_url);
    websocket_chat = new WebSocket(ws_url);


    websocket_chat.onopen = ws_onopen;
    websocket_chat.onclose = ws_onclose;
    websocket_chat.onmessage = ws_onmessage;
}

// Websocketが開いたとき
function ws_onopen(event){
        console.log("WebSocket connection opened.");
}
// Websocketが閉じたとき
function ws_onclose(event){
        console.log("WebSocket connection closed.");
        websocket_chat = null;
        chat_session_id = null;
}
// Websocketでメッセージを受信したとき
function ws_onmessage(event){


    console.log("WebSocket message received: " + event.data);
    var chatArea = instance_chatArea();

    var messageData = JSON.parse(event.data);
    
    var messageType = messageData.type;

    // 対話復元メッセージを受信した場合
    if( "reconnect_ack" == messageType){
        var restore_messages = messageData.restore_messages;
        chat_session_id = messageData.session_id;
        chat_state = messageData.chat_state;

        clear_messageboxes();
        for(var i=0; i<restore_messages.length; i++){
            var entry = restore_messages[i];
            var rx_tx = entry.txrx;
            var message = entry.message;
            console.log("restore message: " + message + " (" + rx_tx + ")");
            append_messagebox( message, rx_tx );
        }
    }


    // メッセージを受信した場合
    if( "message" in  messageData){
        append_messagebox( messageData.message, "rx" );
    }

    // セッションIDを受信した場合
    if( "session_id" in  messageData){
        chat_session_id = messageData.session_id;
    }

    // 処理中状態の更新
    if("busy" in messageData){

        if(messageData.busy == true){
            display_processing_messagebox();
        }else{
            remove_processing_messagebox();
        }
    }

    // chat_stateの更新
    if("chat_state" in messageData){
        chat_state = messageData.chat_state;
    }

}

// WebSocketセッションを閉じる
function close_ws_session(){

    if(websocket_chat != null){
        websocket_chat.close();
        console.log("WebSocket connection closed.");
    }
}

// Websocketセッションがacceptedされているか？
function is_ws_session_accepted(){

    if(websocket_chat != null && websocket_chat.readyState == WebSocket.OPEN){
        return true;
    }
    return false;
}

// Wsセッションが無ければ作成
function ensure_ws_session(){
    if(!is_ws_session_accepted()){
        create_ws_session();
    }
}

// チャットエリアのインスタンス取得
function instance_chatArea(){
    return document.getElementById("chatlog_area");
}

// チャットログをクリア
function clear_messageboxes(){

    var chatArea = instance_chatArea();
    chatArea.innerHTML = "";
}

// メッセージを表示エリアに追加
function append_messagebox( message, rx_tx ){

    var chatArea = document.getElementById('chatlog_area');

    var rx_flag = false;
    if( rx_tx == "rx" ){
        rx_flag = true;
    }

    var speechbox_class = "speechbox_base";
    if( rx_flag == true ){
        speechbox_class += " speechbox_rx";
    }else{
        speechbox_class += " speechbox_tx";
    }

    var massage_class = "message_base";
    if( rx_flag == true ){
        massage_class += " message_rx";
    }else{
        massage_class += " message_tx";
    }

    // これを id=chatlog_areaの中に作る：
    // <div class="speechbox_base speechbox_??"><p class="message_base message_??">メッセージ本文</p></div>

    var speechbox_div = document.createElement("div");
    speechbox_div.setAttribute("class", speechbox_class);
    var message_p = document.createElement("p");
    message_p.setAttribute("class", massage_class);
    message_p.innerText = message;
    speechbox_div.appendChild(message_p);

    chatArea.appendChild(speechbox_div);


    // スクロールを一番下に移動
    chatArea.scrollTop = chatArea.scrollHeight;

}

// メッセージ送信
function send_message(){

    var inputBox = document.getElementById("message_input");
    var message = inputBox.value;
    console.log("send message: " + message);

    ensure_ws_session();

    append_messagebox( message, "tx" );
    inputBox.value = "";
    append_message_to_queue(message);

}

// メッセージキューと送信処理
var send_queue = [];
const send_queued_entries = function(){
    
    if(is_ws_session_accepted()){
        
        while(send_queue.length > 0){
            
            var entry = send_queue.shift();
            var jsondata = JSON.stringify(entry);
            websocket_chat.send(jsondata);
            console.log("sent data: " + jsondata);
        }
    }
}
// 定期的にキュー内メッセージ送信を試みる
setInterval(send_queued_entries, message_queue_send_interval_ms);

// メッセージをキューに追加
function append_message_to_queue(message){
    send_queue.push({"type":"message","message": message, "chat_state": chat_state});
}



// 処理中メッセージボックス表示
function display_processing_messagebox(){

    var chatArea = document.getElementById('chatlog_area');
    var speechbox_div = document.createElement("div");
    speechbox_div.setAttribute("class", "speechbox_base speechbox_rx speechbox_processing");
    speechbox_div.setAttribute("id", "message_box_processing");
    var message_p = document.createElement("p");
    message_p.setAttribute("class", "message_base message_rx message_processing");
    message_p.innerText = "...";
    speechbox_div.appendChild(message_p);
    chatArea.appendChild(speechbox_div);
    // スクロールを一番下に移動
    chatArea.scrollTop = chatArea.scrollHeight;
    return speechbox_div;
}

// 処理中メッセージボックス削除
function remove_processing_messagebox(){

    var chatArea = document.getElementById('chatlog_area');
    var processing_box = document.getElementById("message_box_processing");
    if(processing_box != null){
        chatArea.removeChild( processing_box );
    }
}

// 状態更新
const update_state = function(){

    show_isconnected();
    show_session_id();

    // セッションIDが取得済みなのであれば、セッションIDをcookieに保存
    if(chat_session_id != null){
        document.cookie = "session_id=" + chat_session_id + "; path=/";
    }

    // 
}

// 定期的に状態更新
setInterval(update_state, status_update_interval_ms);



function get_cookie_value( name ) {
    let matches = document.cookie.match(new RegExp(
      "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
  }

// cookieからセッションIDを取得してセッションを復元 undefinedなら何もしない
function load_session_id_from_cookie(){

    let session_id = get_cookie_value("session_id");
    console.log("loaded session_id from cookie: " + session_id);

    if(session_id === undefined){
        return;
    }else{
        restore_session(session_id)
        return;
    }
}

// 
function page_onload(){
    load_session_id_from_cookie();
    return;
}


// 接続状態表示
function show_isconnected(){
    var label_item = document.getElementById("label_isconnected");
    if(is_ws_session_accepted()){
        label_item.innerText = "[Connected]";
    }else{
        label_item.innerText = "[Disconnected]";
    }  
}

// セッションID表示
function show_session_id(){
    var label_item = document.getElementById("label_session_id");

    if(chat_session_id == null){

        label_item.innerText = "Session ID: (not assigned)";

    }else{
        label_item.innerText = "Session ID: " + chat_session_id;
    }

}

// チャット開始
function kickoff_chat(){

    ensure_ws_session();

    clear_messageboxes();
    send_queue.push({"type":"start_chat"});
}

function restore_session(restore_session_id){

    ensure_ws_session();
    console.log("restore session: " + restore_session_id);
    clear_messageboxes();

    send_queue.push({"type":"restore_session","session_id": restore_session_id});

}

function restore_session_manual(){

    var inputBox = document.getElementById("restore_session_id_input");
    var restore_session_id = inputBox.value;
    restore_session(restore_session_id);
}