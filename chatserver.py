from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse,HTMLResponse,FileResponse
from starlette.middleware.cors import CORSMiddleware 

from pydantic import BaseModel
from typing import List, Union

import functools 
import asyncio
import uvicorn
import json
import uuid
import time
import os

#from q_tree_guidance_embeddist import process_chat_exchange
from chatapp_logic import initialize_chatlogic, start_chat, process_chat_exchange




app = FastAPI()
port_to_listen = 8080

public_http_path = "./chatbot_app" 
log_data_path = "./chatlogs"
os.makedirs( log_data_path, exist_ok=True)

# CORS対策
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,   # 追記により追加
    allow_methods=["*"],      # 追記により追加
    allow_headers=["*"]       # 追記により追加
)

# uvicornのログの長さを制限するためのフィルタクラス
class MaxLengthFilter:
    def __init__(self, max_length=1000):
        self.max_length = max_length

    def filter(self, record):
        if len(record.getMessage()) > self.max_length:
            record.msg = record.getMessage()[:self.max_length] + " [truncated]"
        return True


session_id_retry_limit = 20
# 一意なセッションIDを生成する関数
def generate_session_id():

    session_id = str(uuid.uuid4())


    # ログファイルが存在している場合は再生成
    for i in range(session_id_retry_limit):
        logfilepath_check = get_logfile_path("chat",session_id)

        if not os.path.exists( logfilepath_check ):
            return session_id

        session_id = str(uuid.uuid4())

    # リトライ上限に達した場合は末尾に日付を付けて強制的に返す
    session_id = f"{session_id}_{int(time.time())}"
    return session_id

# HTTPで静的ファイルを読み、返す
def get_file( request:Request):

    path = request.url.path[1:]  # 先頭のスラッシュを削除してパスを取得
    if path == "":
        path = "index.html"  # デフォルトのファイル名を指定

    path = f"{public_http_path}/{path}"

    allowed_extensions = [".html", ".css", ".js"]
    if not any(path.endswith(ext) for ext in allowed_extensions):
        return HTMLResponse(content="Filetype not found", status_code=404)


    print("get file:{}".format(path))

    try:
        #with open(path, "rb") as f:
        #    content = f.read()
        return FileResponse(path)
        #return HTMLResponse(content=content, status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="File not found", status_code=404)
    

@app.get("/")
async def get_root(request: Request):
    return get_file(request)

@app.get("/index.html")
async def get_index(request: Request):
    return get_file(request)

@app.get("/chatapp.css")
async def get_css(request: Request):
    return get_file(request)

@app.get("/chatapp.js")
async def get_chatappjs(request: Request):
    return get_file(request)

@app.get("/behavior_listener.js")
async def get_listenerjs(request: Request):
    return get_file(request)



# セッションIDとログファイルの対応
def get_logfile_path(logtype, session_id):
    return f"{log_data_path}/{session_id}_{logtype}.json"

# 対話状態をログに保存する関数
async def dump_dialog_state(session_id, chat_state):
    
    filepath = get_logfile_path("chat", session_id)
    json_output = json.dumps( chat_state, ensure_ascii=False, indent=4 )
    with open( filepath, "w", encoding="utf-8") as f:
        f.write( json_output )
    return

# ログから対話状態を復元する関数
def load_dialog_state(session_id):
    filepath = get_logfile_path("chat", session_id)
    try:
        with open( filepath, "r", encoding="utf-8") as f:
            json_input = f.read()
            chat_state = json.loads( json_input )
            return chat_state
    except FileNotFoundError:
        return None
    
# 監視ログを追記保存する関数
async def append_behavior_log(session_id, behavior_log_entries, append_target_entry = "log"):
    

    print(f"Appending behavior log for session_id: {session_id}, entries: {len(behavior_log_entries)}")

    filepath = get_logfile_path( "behavior", session_id)
    
    # JSONファイルのlogエントリに追加する形で保存
    try:
        with open( filepath, "r", encoding="utf-8") as f:
            json_input = f.read()
            log_data = json.loads( json_input )
    except Exception as e:
        log_data = {append_target_entry: []}

    if append_target_entry not in log_data:
        log_data[append_target_entry] = []


    for entry in behavior_log_entries:
        log_data[append_target_entry].append( entry )

    json_output = json.dumps( log_data, ensure_ascii=False, indent=4 )
    with open( filepath, "w", encoding="utf-8") as f:
        f.write( json_output )

    print(f"Appended {len(behavior_log_entries)} behavior log entries to {filepath}")

    return


@app.websocket("/behavior_ws")
async def websocket_behavior_endpoint(websocket: WebSocket):

    await websocket.accept()

    try:

        while True:
            data = await websocket.receive_text()
            #print(f"Received behavior data: {data}")

            json_data = json.loads(data)
            session_id = json_data.get("session_id", None)

            if not session_id is None:
                behavior_log_entries = json_data.get("logs", [])
    
                # 監視ログを追記保存
                await append_behavior_log(session_id, behavior_log_entries)

            else:
                print("No session_id provided in behavior data")


    except WebSocketDisconnect:
        print("Behavior WebSocket connection closed")

    



@app.websocket("/chat_ws")
async def websocket_chat_endpoint(websocket: WebSocket):

    #print(f"ws_endpoint called")

    await websocket.accept()

    session_id = generate_session_id()
    print(f"New session started: {session_id}")

    session_start_time = time.time()

    try:

        while True:
            data = await websocket.receive_text()
            print(f"Received message: {data} from session: {session_id}")

            json_data = json.loads(data)

            message_type = json_data.get("type", "")


            chat_state_updated = False
            # 
            if "chat_state" in json_data:
                session_id = json_data.get("session_id", session_id)
                chat_state = json_data.get("chat_state", {})
                chat_state_updated = True



            if message_type == "echo":

                await websocket.send_json({"type":"process_state", "busy":True, "session_id": session_id})

                message_body = json_data.get("message", "")
                # クライアントにセッションIDを送信
                await websocket.send_json({"type":"message","message": f"{message_body}", "busy":False, "session_id": session_id})


            elif message_type == "start_chat":

                await websocket.send_json({"type":"process_state", "busy":True, "session_id": session_id})

                # セッションID再発行
                new_session_id = generate_session_id()
                session_id = new_session_id

                initial_message, chat_state = start_chat(session_id)
                
                await websocket.send_json({
                    "type":"message", 
                    "message": initial_message, 
                    "chat_state": chat_state,
                    "busy":False,
                    "session_id": session_id
                    })


            elif message_type == "message":

                user_message = json_data.get("message", "")
                chat_state = json_data.get("chat_state", {})

                await websocket.send_json({"type":"process_state", "busy":True, "session_id": session_id})

                system_message, chat_state = process_chat_exchange( chat_state, user_message, session_id)

                await websocket.send_json({
                    "type":"message", 
                    "message": system_message, 
                    "chat_state": chat_state,
                    "busy":False,
                    "session_id": session_id
                    })

                chat_state_updated = True

            elif message_type == "get_state":
                await websocket.send_json({"type":"status", "session_id": session_id})

            elif message_type == "restore_session":

                session_id_client = json_data.get("session_id", "")
                print(f"Client attempting to reconnect with session_id: {session_id_client}")

                chat_state = load_dialog_state( session_id_client )
                restore_messages = []
                if chat_state is None:
                    chat_state = {}
                    print(f"No existing chat state found for session_id: {session_id_client}. Starting new session.")
                else:
                    print(f"Loaded existing chat state for session_id: {session_id_client}")
                    
                    session_id = session_id_client
                    # チャットログを復元
                    for turn in chat_state.get("dialog_log", []):
                        speaker = turn.get("speaker", "none")
                        txrx = "rx"
                        if speaker == "user":
                            txrx = "tx"
                        restore_messages.append( {"txrx": txrx, "message": turn.get("text","")} )


                
                await websocket.send_json({
                    "type":"reconnect_ack",
                    "restore_messages": restore_messages,
                    "chat_state": chat_state,
                    "session_id": session_id
                    })


            else:
                await websocket.send_json({"type":"error","message": "Unknown message type"})

            if chat_state_updated:
                # 対話状態をログに保存. 待たない
                asyncio.create_task( dump_dialog_state( session_id, chat_state) )

        # 処理
        #succeed, retbody = await run_script( request_dict, websocket, False)
        # 処理完了メッセージを送信
        #if succeed == True:
        #    await websocket.send_json({"type":"result","status": "completed"})
        #else:
        #    await websocket.send_json({"type":"result","status": "failed"})


    except WebSocketDisconnect:
        print("[Chat]WebSocket connection closed")
    except KeyboardInterrupt:
        print("[Chat]Server closed by KeyboardInterrupt")

if __name__ == "__main__":


    # このスクリプトの存在するパスを取得
    import os
    here_path = os.path.abspath(__file__)
    print(f"here_path:{here_path}")



    initialize_chatlogic("q_tree")

    # root_pathはこのスクリプトが動作しているパスに合わせて変更する
    uvicorn.run(app, host="0.0.0.0", port=port_to_listen, log_level="info")
