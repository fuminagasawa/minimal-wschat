

# -----------------------------------------------------
#   シンプルなスロット充足対話
#   
#   動的スロットに対応させる版
#   
#   
# -----------------------------------------------------

import os, json, re, threading, time

import cv2
from openai import OpenAI




# --- Session log --------------------------------------


# --- LLM client -----------------------------------------------------------

client = None


# --- Slot schema & helper ----------------------------------------------------

model_name     = "gpt-4.1"

def generate_by_llm( model_use, prompt):

    response = client.responses.create(
        model=model_use,
        input=prompt,
        temperature=0.0
    )

    return response.output_text




# debug utils ----------------------------------------------------
def initialize():

    global client

    api_key = os.getenv("OPENAI_API_KEY")
    print(f"api_key:{api_key[0:20]}...")

    client = OpenAI(api_key=api_key) 


def start_chat(session_id:str=""):

    dialog_log = []
    question_slot_tree = {}
    
    system_message = "こんにちは！最近どんなことがありましたか？"
    dialog_log.append( {"speaker":"system", "text":system_message} )


    dialog_state = {
        "dialog_log": dialog_log,
        "question_slot_tree": question_slot_tree
    }

    return system_message, dialog_state


def process_chat_exchange(dialog_state:dict, user_message:str,session_id:str=""):


    dialog_log = dialog_state.get("dialog_log", [])
    question_slot_tree = dialog_state.get("question_slot_tree", {})


    dialog_log.append( {"speaker":"user", "text":user_message} )

    dialog_log_text = ""
    for turn in dialog_log:
        dialog_log_text += f"User: {turn['speaker']}\nAgent: {turn['text']}\n"

    prompt = f'''あなたは対話型質問エージェントです。以下の対話履歴もとに、適切な応答を生成してください。
    対話履歴:
    {dialog_log_text}
    '''
    system_message = generate_by_llm( model_name, prompt)

    dialog_log.append( {"speaker":"system", "text":system_message} )

    dialog_state = {
        "dialog_log": dialog_log,
        "question_slot_tree": question_slot_tree
    }



    return system_message, dialog_state



if __name__ == "__main__":


    initial_message, dialog_state = start_chat()
    print(f"Initial message: {initial_message}")
    print(f"Dialog state: {dialog_state}")


    user_input = "最近、よく眠れなくて困っています。"
    print(f"User input: {user_input}")
    system_message, dialog_state = process_chat_exchange( dialog_state, user_input)

    print(f"System message: {system_message}")
    print(f"Dialog state: {dialog_state}")
