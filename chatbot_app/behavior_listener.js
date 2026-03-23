

// Behabior Log送信間隔(ms)
let behavior_log_send_interval_ms = 2000;

// Behavior Log最大キュー長
let behavior_log_max_queue_length = 1000;



// Behavior Log送信関連
event_log_queue = [];


var behavior_listener_active = true;
// チェックボックスで有効/無効切り替え

document.getElementById("checkbox_activate_behavior_listener").addEventListener('change', function() {

  behavior_listener_active = this.checked;
  console.log("[Activity Listener] Behavior listener active: " + behavior_listener_active);
});

function append_behavior_log(event_data){
    
    if(!behavior_listener_active){
        //console.log(`[Activity Listener] not active.`);
        return;
    } 


    event_log_queue.push(event_data);

      // キューが長すぎる場合
    if(event_log_queue.length > behavior_log_max_queue_length){
        
        // 送信可能であれば送信
        send_behavior_log_queue();
        // それでも長すぎる場合は古いログを削除
        if(event_log_queue.length > behavior_log_max_queue_length){
          let excess_length = event_log_queue.length - behavior_log_max_queue_length;
          event_log_queue.splice(0, excess_length);
          console.log(`[Activity Listener] Event log queue exceeded max length. Removed ${excess_length} oldest entries.`);
        }
    }
}







// addEventListener複数登録
const entryAddEventListenerMulti = (target, types, handler, useCapture) => {
  for (let type of types) {
    target.addEventListener(type, handler, useCapture);
  }
};


// キーイベント監視
// keyup	キーを離したとき
// keydown	キーを押したとき
// keypress	キーを押し続けている間
function key_event_handler(event){


    //console.log("Key event: " + event);

    eventDetails = {
        "altKey"       : altKey,
        "code"         : code,
        "ctrlKey"      : ctrlKey,
        "isComposing"  : isComposing,
        "key"          : key,
        "location"     : location,
        "metaKey"      : metaKey,
        "repeat"       : repeat,
        "shiftKey"     : shiftKey
    }

    append_behavior_log({"type": "key", "event":eventDetails, "timestamp": Date.now()});
    //console.log("Key event: " + event.type + " key: " + event.key);
}
entryAddEventListenerMulti(document, ['keyup', 'keydown', 'keypress'], key_event_handler);


// マウスイベント監視
// click	要素をクリックしたとき
// dbclick	要素をダブルクリックしたとき
// mouseOut	マウスポインタが要素上からでたとき
// mouseOver	マウスポインタが要素上に乗ったとき
// mouseup	マウスボタンを放したとき
// mousedown	マウスボタンを押し下げたとき
// mousemove	マウスを動かしている間

function mouse_event_handler(event){
    //console.log("Mouse event: " + event);

    eventDetails = {
        "altKey"        : event.altKey,
        "button"        : event.button,
        "buttons"       : event.buttons,
        "clientX"       : event.clientX,
        "clientY"       : event.clientY,
        "ctrlKey"       : event.ctrlKey,
        "metaKey"       : event.metaKey,
        "movementX"     : event.movementX,
        "movementY"     : event.movementY,
        "offsetX"       : event.offsetX,
        "offsetY"       : event.offsetY,
        "pageX"         : event.pageX,
        "pageY"         : event.pageY,
        "relatedTarget" : event.relatedTarget,
        "screenX"       : event.screenX,
        "screenY"       : event.screenY,
        "shiftKey"      : event.shiftKey
    }


    append_behavior_log({"type": "mouse", "event":eventDetails, "timestamp": Date.now()});
    //console.log("Mouse event: " + event.type + " on position (" + event.clientX + ", " + event.clientY + ")");
}
entryAddEventListenerMulti(document, ['click', 'dblclick', 'mouseout', 'mouseover', 'mouseup', 'mousedown', 'mousemove'], mouse_event_handler); 




// WebSocketセッション
var websocket_listen = null;

// チャットのセッションID
var chat_session_id = null;

// WebSocketセッション作成
function create_listener_ws_session(){

    var ws_url = "ws://" + server_url() + "/behavior_ws";
    console.log("create ws session: " + ws_url);
    websocket_listen = new WebSocket(ws_url);


    websocket_listen.onopen = liestener_ws_onopen;
    websocket_listen.onclose = liestener_ws_onclose;
    websocket_listen.onmessage = liestener_ws_onmessage;
}

// Websocketが開いたとき
function liestener_ws_onopen(event){
        console.log("[Activity Listener] WebSocket connection opened.");
}
// Websocketが閉じたとき
function liestener_ws_onclose(event){
        console.log("[Activity Listener] WebSocket connection closed.");
}
// Websocketでメッセージを受信したとき
function liestener_ws_onmessage(event){
    console.log("[Activity Listener]WebSocket connection closed.");
}

// Websocketセッションがacceptedされているか？
function is_listener_ws_session_accepted(){

    if(websocket_listen != null && websocket_listen.readyState == WebSocket.OPEN){
        return true;
    }
    return false;
}

// Wsセッションが無ければ作成
function ensure_listener_ws_session(){
    if(!is_listener_ws_session_accepted()){
        create_listener_ws_session();
    }
}

// event_log_queueの内容を送信
function send_behavior_log_queue(){
    ensure_listener_ws_session();

    if(event_log_queue.length == 0){
        return;
    }
    if(is_listener_ws_session_accepted()){
        var log_data = {
            "type": "behavior_log",
            "session_id": get_chat_session_id_from_cookie(),
            "logs": event_log_queue
        };
        websocket_listen.send(JSON.stringify(log_data));
        //console.log("[Activity Listener] Sent behavior log: " + JSON.stringify(log_data));
        event_log_queue = [];
    }
}
// cookieからセッションIDを取得
function get_chat_session_id_from_cookie(){
    var name = "session_id=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
  } 


// 定期的にBehavior Logを送信
setInterval( send_behavior_log_queue, behavior_log_send_interval_ms );
