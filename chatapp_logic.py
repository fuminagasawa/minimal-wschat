

# -----------------------------------------------------
#   シンプルなスロット充足対話
#   
#   動的スロットに対応させる版
#   
#   
# -----------------------------------------------------

import os, json, re, threading, time

from openai import OpenAI

from chatlogic_simple import initialize as initialize_simple
from chatlogic_simple import start_chat as start_chat_simple    
from chatlogic_simple import process_chat_exchange as process_chat_exchange_simple 



# --- Session log --------------------------------------


# --- LLM client -----------------------------------------------------------
api_key = os.getenv("OPENAI_API_KEY")
print(f"api_key:{api_key[0:20]}...")

if api_key is None:
    print("OPENAI_API_KEY 環境変数が設定されていません。")
    exit()

client = OpenAI(api_key=api_key) 



chatlogic = "simple"


# debug utils ----------------------------------------------------

def initialize_chatlogic(session_id:str=""):

    print(f"chatlogic_selected:{chatlogic}, session_id:{session_id}")

    if chatlogic == "simple":
        initialize_simple()




def start_chat(session_id:str=""):

    if chatlogic == "simple":
        return start_chat_simple()


def process_chat_exchange(dialog_state:dict, user_message:str, session_id:str=""):

    system_message = ""
    dialog_state  = dialog_state

    if chatlogic == "simple":
        system_message, dialog_state = process_chat_exchange_simple( dialog_state, user_message)


    return system_message, dialog_state

# --- main ----------------------------------------------------

if __name__ == "__main__":


    initial_message, dialog_state = start_chat()
    print(f"Initial message: {initial_message}")
    print(f"Dialog state: {dialog_state}")


    user_input = "こんにちは"
    print(f"User input: {user_input}")
    system_message, dialog_state = process_chat_exchange( dialog_state, user_input)

    print(f"System message: {system_message}")
    print(f"Dialog state: {dialog_state}")
